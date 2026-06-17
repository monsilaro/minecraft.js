// Survival player: look + movement input, shared voxel physics, and vitals
// (health, hunger, air) with fall damage, drowning, regen and death.

import * as THREE from 'three';
import { WATER } from '../world/blocks.js';
import { stepBody, aabbIntersectsBlock } from '../core/physics.js';

const EYE = 1.62;
const GRAVITY = 32;
const TERMINAL = -78;
const JUMP_SPEED = 9;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 5.8;
const FLY_SPEED = 11;

export class Player {
    constructor(world, camera, dom) {
        this.world = world;
        this.camera = camera;
        this.pos = new THREE.Vector3(8, 50, 8);
        this.vel = new THREE.Vector3();
        this.half = 0.3;
        this.height = 1.8;
        this.yaw = 0;
        this.pitch = 0;
        this.onGround = false;
        this.hitWall = false;
        this.flying = false;
        this.inWater = false;
        this.keys = {};

        // vitals (half-units: 20 = 10 hearts)
        this.maxHp = 20;
        this.hp = 20;
        this.hunger = 20;
        this.air = 10;
        this.dead = false;
        this.invuln = 0;
        this.regenTimer = 0;
        this.starveTimer = 0;
        this.hungerTimer = 0;
        this.airTimer = 0;
        this.eatCooldown = 0;
        this.spawnPoint = new THREE.Vector3(8.5, 50, 8.5);
        this.onDamaged = null; // cb(amount)
        this.onDeath = null;
        this.armorProvider = null; // set by main: () => inventory (for damage reduction)

        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyF') {
                this.flying = !this.flying;
                this.vel.y = 0;
            }
            if (e.code === 'Space') e.preventDefault();
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        dom.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== dom) return;
            this.yaw -= e.movementX * 0.0024;
            this.pitch -= e.movementY * 0.0024;
            const lim = Math.PI / 2 - 0.001;
            this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
        });
    }

    // Spiral search outward from the origin for dry, grassy ground
    // (above sea level, below the rock line). surfaceHeight is pure math,
    // so no chunks need to exist yet.
    findSpawn() {
        const SEA = 30;
        let sx = 8,
            sz = 8;
        outer: for (let r = 0; r <= 400; r += 8) {
            for (let dx = -r; dx <= r; dx += 8) {
                for (let dz = -r; dz <= r; dz += 8) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    const h = this.world.surfaceHeight(8 + dx, 8 + dz);
                    if (h > SEA + 1 && h < 58) {
                        sx = 8 + dx;
                        sz = 8 + dz;
                        break outer;
                    }
                }
            }
        }
        const h = this.world.surfaceHeight(sx, sz);
        this.spawnPoint.set(sx + 0.5, h + 2, sz + 0.5);
        this.respawn();
    }

    respawn() {
        this.pos.copy(this.spawnPoint);
        this.vel.set(0, 0, 0);
        this.hp = this.maxHp;
        this.hunger = 20;
        this.air = 10;
        this.dead = false;
        this.invuln = 1;
    }

    update(dt, inputOn) {
        const k = inputOn && !this.dead ? this.keys : {};
        this.invuln = Math.max(0, this.invuln - dt);
        this.eatCooldown = Math.max(0, this.eatCooldown - dt);

        let fx = 0,
            fz = 0;
        if (k['KeyW']) fz += 1;
        if (k['KeyS']) fz -= 1;
        if (k['KeyA']) fx -= 1;
        if (k['KeyD']) fx += 1;
        const len = Math.hypot(fx, fz);
        if (len > 0) {
            fx /= len;
            fz /= len;
        }

        const sin = Math.sin(this.yaw),
            cos = Math.cos(this.yaw);
        const wishX = fx * cos - fz * sin;
        const wishZ = -fx * sin - fz * cos;
        const sprinting = !!k['ShiftLeft'] && fz > 0 && this.hunger > 6;

        const bx = Math.floor(this.pos.x),
            bz = Math.floor(this.pos.z);
        this.inWater = this.world.getBlock(bx, Math.floor(this.pos.y + 0.4), bz) === WATER;
        const headInWater = this.world.getBlock(bx, Math.floor(this.pos.y + EYE), bz) === WATER;

        if (this.flying) {
            const speed = sprinting ? FLY_SPEED * 2 : FLY_SPEED;
            this.vel.x = wishX * speed;
            this.vel.z = wishZ * speed;
            this.vel.y = (k['Space'] ? speed : 0) + (k['ShiftLeft'] && !sprinting ? -speed : 0);
        } else {
            let speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
            if (this.inWater) speed *= 0.5;
            this.vel.x = wishX * speed;
            this.vel.z = wishZ * speed;

            if (this.inWater) {
                this.vel.y += (k['Space'] ? 16 : -10) * dt;
                this.vel.y = Math.max(-4, Math.min(5, this.vel.y));
                // hop out when swimming into shore (climb 1-block ledges)
                if (k['Space'] && this.hitWall) this.vel.y = JUMP_SPEED;
            } else {
                this.vel.y -= GRAVITY * dt;
                if (this.vel.y < TERMINAL) this.vel.y = TERMINAL;
                if (k['Space'] && this.onGround) {
                    this.vel.y = JUMP_SPEED;
                    this.onGround = false;
                    this.hungerTimer += 4; // jumping burns food
                }
            }
        }

        const impactVy = stepBody(this.world, this, dt);

        // fall damage: more than ~3.5 blocks of fall
        if (impactVy < -16 && !this.inWater && !this.flying) {
            const fallBlocks = (impactVy * impactVy) / (2 * GRAVITY);
            const dmg = Math.floor(fallBlocks - 3);
            if (dmg > 0) this.damage(dmg);
        }

        this.updateVitals(dt, headInWater, sprinting);

        if (this.pos.y < -10) this.damage(100);

        this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
        this.camera.rotation.set(0, 0, 0);
        this.camera.rotateY(this.yaw);
        this.camera.rotateX(this.pitch);

        return { headInWater, sprinting };
    }

    updateVitals(dt, headInWater, sprinting) {
        if (this.dead) return;

        // drowning
        if (headInWater) {
            this.airTimer += dt;
            if (this.airTimer >= 1) {
                this.airTimer = 0;
                if (this.air > 0) this.air--;
                else this.damage(2, true);
            }
        } else {
            this.air = Math.min(10, this.air + dt * 6);
            this.airTimer = 0;
        }

        // hunger drain (sprint costs more)
        this.hungerTimer += dt * (sprinting ? 4 : 1);
        if (this.hungerTimer >= 50) {
            this.hungerTimer = 0;
            if (this.hunger > 0) this.hunger--;
        }

        // regen when well fed
        if (this.hunger >= 18 && this.hp < this.maxHp) {
            this.regenTimer += dt;
            if (this.regenTimer >= 2) {
                this.regenTimer = 0;
                this.hp = Math.min(this.maxHp, this.hp + 1);
                this.hungerTimer += 12;
            }
        }

        // starving
        if (this.hunger <= 0) {
            this.starveTimer += dt;
            if (this.starveTimer >= 4) {
                this.starveTimer = 0;
                if (this.hp > 1) this.damage(1, true);
            }
        }
    }

    // opts: { bypassInvuln, armored } — armored hits are reduced by worn armor
    // (4% per armor point, capped 80%) and wear the armor down.
    damage(amount, opts = {}) {
        if (this.dead) return;
        if (typeof opts === 'boolean') opts = { bypassInvuln: opts };
        if (!opts.bypassInvuln && this.invuln > 0) return;

        if (opts.armored && this.armorProvider) {
            const inv = this.armorProvider();
            const pts = Math.min(20, inv.armorPoints());
            if (pts > 0) {
                amount = Math.max(1, Math.round(amount * (1 - pts * 0.04)));
                inv.damageArmor();
            }
        }

        this.hp -= amount;
        this.invuln = 0.6;
        if (this.onDamaged) this.onDamaged(amount);
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            if (this.onDeath) this.onDeath();
        }
    }

    knockback(fromX, fromZ, force = 8) {
        const dx = this.pos.x - fromX,
            dz = this.pos.z - fromZ;
        const d = Math.hypot(dx, dz) || 1;
        this.vel.x += (dx / d) * force;
        this.vel.z += (dz / d) * force;
        this.vel.y = Math.max(this.vel.y, 5);
    }

    eat(foodValue) {
        if (this.eatCooldown > 0 || this.hunger >= 20) return false;
        this.hunger = Math.min(20, this.hunger + foodValue);
        this.eatCooldown = 0.85;
        return true;
    }

    intersectsBlock(bx, by, bz) {
        return aabbIntersectsBlock(this, bx, by, bz);
    }
}
