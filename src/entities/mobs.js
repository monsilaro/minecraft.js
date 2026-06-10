// Mobs: pigs (passive, day), zombies (melee, night, burn at dawn), skeletons
// (ranged, night, burn at dawn), creepers (fuse + explosion, persist in day).
// Plus the arrow projectiles skeletons fire.

import * as THREE from 'three';
import { stepBody, rayVsAABB } from '../core/physics.js';
import { isSolid } from '../world/blocks.js';
import { IT } from '../items/items.js';
import { raycastVoxel } from '../gameplay/interact.js';

const GRAVITY = 32;

function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color }),
    );
    m.position.set(x, y, z);
    return m;
}

function buildPig() {
    const g = new THREE.Group();
    const pink = 0xeda3a3,
        dark = 0xd98f8f,
        snout = 0xc97777;
    g.add(box(0.58, 0.45, 0.9, pink, 0, 0.62, 0));
    const head = box(0.42, 0.42, 0.4, pink, 0, 0.72, 0.62);
    head.add(box(0.2, 0.14, 0.06, snout, 0, -0.05, 0.23));
    g.add(head);
    const legs = [];
    for (const [lx, lz] of [
        [-0.18, 0.3],
        [0.18, 0.3],
        [-0.18, -0.3],
        [0.18, -0.3],
    ]) {
        const leg = box(0.16, 0.4, 0.16, dark, lx, 0.2, lz);
        legs.push(leg);
        g.add(leg);
    }
    return { group: g, legs };
}

function buildZombie() {
    const g = new THREE.Group();
    const skin = 0x55944a,
        shirt = 0x3a7a8c,
        pants = 0x4a3f8a;
    g.add(box(0.5, 0.68, 0.26, shirt, 0, 1.08, 0));
    g.add(box(0.42, 0.42, 0.42, skin, 0, 1.66, 0));
    g.add(box(0.16, 0.16, 0.6, skin, -0.34, 1.32, 0.3));
    g.add(box(0.16, 0.16, 0.6, skin, 0.34, 1.32, 0.3));
    const legs = [];
    for (const lx of [-0.14, 0.14]) {
        const leg = box(0.2, 0.72, 0.2, pants, lx, 0.38, 0);
        legs.push(leg);
        g.add(leg);
    }
    return { group: g, legs };
}

function buildSkeleton() {
    const g = new THREE.Group();
    const boneC = 0xd8d8d0,
        dark = 0xb8b8b0;
    g.add(box(0.4, 0.66, 0.2, boneC, 0, 1.1, 0));
    g.add(box(0.4, 0.4, 0.4, boneC, 0, 1.66, 0));
    g.add(box(0.12, 0.12, 0.5, dark, -0.28, 1.34, 0.22)); // arms holding bow
    g.add(box(0.12, 0.12, 0.5, dark, 0.28, 1.34, 0.22));
    g.add(box(0.06, 0.5, 0.08, 0x6b4d2e, 0, 1.34, 0.5)); // bow stave
    const legs = [];
    for (const lx of [-0.12, 0.12]) {
        const leg = box(0.14, 0.74, 0.14, dark, lx, 0.37, 0);
        legs.push(leg);
        g.add(leg);
    }
    return { group: g, legs };
}

function buildCreeper() {
    const g = new THREE.Group();
    const green = 0x55b04a,
        dark = 0x3f8f38;
    g.add(box(0.5, 0.9, 0.3, green, 0, 0.85, 0));
    const head = box(0.46, 0.46, 0.46, green, 0, 1.55, 0);
    // the iconic sad face, in dark green
    head.add(box(0.1, 0.12, 0.02, 0x1a1a1a, -0.11, 0.06, 0.24));
    head.add(box(0.1, 0.12, 0.02, 0x1a1a1a, 0.11, 0.06, 0.24));
    head.add(box(0.12, 0.16, 0.02, 0x1a1a1a, 0, -0.13, 0.24));
    g.add(head);
    const legs = [];
    for (const [lx, lz] of [
        [-0.14, 0.16],
        [0.14, 0.16],
        [-0.14, -0.16],
        [0.14, -0.16],
    ]) {
        const leg = box(0.2, 0.4, 0.2, dark, lx, 0.2, lz);
        legs.push(leg);
        g.add(leg);
    }
    return { group: g, legs };
}

class Mob {
    constructor(scene, world, type, x, y, z) {
        this.scene = scene;
        this.world = world;
        this.type = type;
        this.pos = new THREE.Vector3(x, y, z);
        this.vel = new THREE.Vector3();
        this.onGround = false;
        this.hitWall = false;
        this.dead = false;
        this.yaw = Math.random() * Math.PI * 2;
        this.hurtFlash = 0;
        this.attackCd = 0;
        this.soundCd = 4 + Math.random() * 14;
        this.burnTimer = 0;
        this.aggro = false;
        this.wanderTimer = 0;
        this.wanderDir = null;
        this.fuse = -1; // creeper

        let b;
        if (type === 'pig') {
            this.half = 0.4;
            this.height = 0.9;
            this.hp = 10;
            this.walkSpeed = 1.3;
            this.panic = 0;
            b = buildPig();
        } else if (type === 'zombie') {
            this.half = 0.3;
            this.height = 1.9;
            this.hp = 20;
            this.walkSpeed = 2.2;
            b = buildZombie();
        } else if (type === 'skeleton') {
            this.half = 0.3;
            this.height = 1.95;
            this.hp = 20;
            this.walkSpeed = 2.4;
            b = buildSkeleton();
        } else {
            this.half = 0.3;
            this.height = 1.7;
            this.hp = 20;
            this.walkSpeed = 2.1;
            b = buildCreeper();
        }
        this.group = b.group;
        this.legs = b.legs;
        scene.add(this.group);
    }

    update(dt, env) {
        this.attackCd = Math.max(0, this.attackCd - dt);
        this.hurtFlash = Math.max(0, this.hurtFlash - dt);
        this.soundCd -= dt;

        if (this.type === 'pig') this.updatePig(dt, env);
        else if (this.type === 'zombie') this.updateZombie(dt, env);
        else if (this.type === 'skeleton') this.updateSkeleton(dt, env);
        else this.updateCreeper(dt, env);

        this.vel.y -= GRAVITY * dt;
        if (this.vel.y < -60) this.vel.y = -60;
        const impact = stepBody(this.world, this, dt);
        if (impact < -16) {
            const dmg = Math.floor((impact * impact) / (2 * GRAVITY) - 3);
            if (dmg > 0) this.hurt(dmg, null, env);
        }

        if (this.hitWall && this.onGround && this.walking) {
            this.vel.y = 8.5;
        }

        this.group.position.copy(this.pos);
        this.group.rotation.y = this.yaw;
        const speed = Math.hypot(this.vel.x, this.vel.z);
        this.animTime = (this.animTime || 0) + dt * speed * 3.2;
        for (let i = 0; i < this.legs.length; i++) {
            this.legs[i].rotation.x =
                Math.sin(this.animTime + (i % 2) * Math.PI) * 0.7 * Math.min(1, speed);
        }

        // hurt flash / creeper fuse flash
        const flash =
            this.hurtFlash > 0
                ? 0x882222
                : this.fuse >= 0 && Math.floor(this.fuse * 8) % 2 === 0
                  ? 0x999999
                  : 0x000000;
        this.group.traverse((o) => {
            if (o.isMesh) o.material.emissive.setHex(flash);
        });
    }

    walkToward(tx, tz, speed) {
        const dx = tx - this.pos.x,
            dz = tz - this.pos.z;
        const d = Math.hypot(dx, dz);
        this.walking = d > 0.2;
        if (d < 0.2) {
            this.vel.x = this.vel.z = 0;
            return d;
        }
        this.vel.x = (dx / d) * speed;
        this.vel.z = (dz / d) * speed;
        this.yaw = Math.atan2(dx, dz);
        return d;
    }

    stand() {
        this.vel.x = this.vel.z = 0;
        this.walking = false;
    }

    wander(dt, range, speed) {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 2 + Math.random() * 6;
            this.wanderDir =
                Math.random() < 0.55
                    ? null
                    : {
                          x: this.pos.x + (Math.random() - 0.5) * range,
                          z: this.pos.z + (Math.random() - 0.5) * range,
                      };
        }
        if (this.wanderDir) {
            if (this.walkToward(this.wanderDir.x, this.wanderDir.z, speed) < 0.5)
                this.wanderDir = null;
        } else {
            this.stand();
        }
    }

    burnInDaylight(dt, env) {
        if (env.dayFactor > 0.6) {
            this.burnTimer += dt;
            if (this.burnTimer >= 1) {
                this.burnTimer = 0;
                this.hurt(2, null, env);
            }
        }
    }

    updatePig(dt, env) {
        this.panic = Math.max(0, this.panic - dt);
        this.wander(dt, 14, this.panic > 0 ? 3.4 : this.walkSpeed);
        if (this.soundCd <= 0) {
            this.soundCd = 6 + Math.random() * 18;
            if (this.pos.distanceTo(env.player.pos) < 14) env.sounds.oink();
        }
    }

    updateZombie(dt, env) {
        this.burnInDaylight(dt, env);
        const p = env.player;
        const dist = this.pos.distanceTo(p.pos);
        if (!p.dead && (dist < 16 || this.aggro)) {
            this.aggro = true;
            const d = this.walkToward(p.pos.x, p.pos.z, this.walkSpeed);
            if (d < 1.7 && Math.abs(p.pos.y - this.pos.y) < 2 && this.attackCd <= 0) {
                this.attackCd = 1.1;
                env.damagePlayer(3, this.pos);
            }
        } else {
            this.wander(dt, 10, 1);
        }
        if (this.soundCd <= 0) {
            this.soundCd = 5 + Math.random() * 12;
            if (dist < 14) env.sounds.groan();
        }
    }

    updateSkeleton(dt, env) {
        this.burnInDaylight(dt, env);
        const p = env.player;
        const dist = this.pos.distanceTo(p.pos);

        if (!p.dead && (dist < 16 || this.aggro)) {
            this.aggro = true;
            // keep a comfortable shooting distance
            if (dist > 11) this.walkToward(p.pos.x, p.pos.z, this.walkSpeed);
            else if (dist < 6) {
                // back away
                const ax = this.pos.x * 2 - p.pos.x,
                    az = this.pos.z * 2 - p.pos.z;
                this.walkToward(ax, az, this.walkSpeed);
                this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z); // still face player
            } else {
                this.stand();
                this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
            }

            if (dist < 15 && this.attackCd <= 0) {
                const eye = new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
                const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z);
                const dir = target.clone().sub(eye);
                const flatDist = dir.length();
                dir.normalize();
                // line of sight check
                const hit = raycastVoxel(this.world, eye, dir, flatDist);
                if (!hit) {
                    this.attackCd = 2.2;
                    const vel = dir.multiplyScalar(22);
                    vel.y += flatDist * 0.35; // arc compensation
                    env.shootArrow(eye, vel);
                    env.sounds.bow();
                }
            }
        } else {
            this.wander(dt, 10, 1);
        }
        if (this.soundCd <= 0) {
            this.soundCd = 7 + Math.random() * 14;
            if (dist < 12) env.sounds.rattle();
        }
    }

    updateCreeper(dt, env) {
        const p = env.player;
        const dist = this.pos.distanceTo(p.pos);

        if (!p.dead && dist < 3.2) {
            // start / continue the fuse
            if (this.fuse < 0) {
                this.fuse = 0;
                env.sounds.hiss();
            }
            this.stand();
            this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
            this.fuse += dt;
            if (this.fuse >= 1.5) {
                this.dead = true;
                this.exploded = true;
                env.explodeAt(this.pos.x, this.pos.y + 0.8, this.pos.z, 3.6);
            }
            return;
        }

        // player escaped: defuse
        if (this.fuse >= 0) {
            this.fuse -= dt * 2;
            if (this.fuse < 0) this.fuse = -1;
        }

        if (!p.dead && dist < 14) {
            this.walkToward(p.pos.x, p.pos.z, this.walkSpeed);
        } else {
            this.wander(dt, 10, 1);
        }
    }

    hurt(dmg, from, env) {
        this.hp -= dmg;
        this.hurtFlash = 0.25;
        if (this.type === 'pig') {
            this.panic = 5;
            this.wanderTimer = 0;
        } else {
            this.aggro = true;
        }
        if (from) {
            const dx = this.pos.x - from.x,
                dz = this.pos.z - from.z;
            const d = Math.hypot(dx, dz) || 1;
            this.vel.x += (dx / d) * 7;
            this.vel.z += (dz / d) * 7;
            this.vel.y = Math.max(this.vel.y, 5.5);
        }
        if (this.hp <= 0) {
            this.dead = true;
            const roll = (n) => 1 + Math.floor(Math.random() * n);
            let drops = [];
            if (this.type === 'pig') drops = [{ id: IT.PORKCHOP, n: roll(2) }];
            else if (this.type === 'zombie')
                drops = Math.random() < 0.8 ? [{ id: IT.FLESH, n: roll(2) }] : [];
            else if (this.type === 'skeleton') {
                drops = [{ id: IT.BONE, n: roll(2) }];
                if (Math.random() < 0.7) drops.push({ id: IT.ARROW, n: roll(2) });
            } else if (!this.exploded) drops = [{ id: IT.GUNPOWDER, n: roll(2) }];
            env.dropManager.scatter(this.pos, drops);
        }
    }

    aabb() {
        return {
            min: { x: this.pos.x - this.half, y: this.pos.y, z: this.pos.z - this.half },
            max: {
                x: this.pos.x + this.half,
                y: this.pos.y + this.height,
                z: this.pos.z + this.half,
            },
        };
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.traverse((o) => {
            if (o.isMesh) {
                o.geometry.dispose();
                o.material.dispose();
            }
        });
    }
}

const arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xcfc8b8 });

export class MobManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.mobs = [];
        this.arrows = [];
        this.spawnTimer = 0;
    }

    // opts: { fromPlayer, dmg, shooterPos } — player arrows hit mobs instead
    shootArrow(pos, vel, opts = {}) {
        const mesh = new THREE.Mesh(arrowGeo, arrowMat);
        this.scene.add(mesh);
        this.arrows.push({ pos: pos.clone(), vel: vel.clone(), mesh, age: 0, ...opts });
    }

    update(dt, env) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 2;
            this.trySpawns(env);
        }

        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const m = this.mobs[i];
            m.update(dt, env);
            const dist = m.pos.distanceTo(env.player.pos);
            if (m.dead || dist > 90 || m.pos.y < -10) {
                m.dispose();
                this.mobs.splice(i, 1);
            }
        }

        this.updateArrows(dt, env);
    }

    updateArrows(dt, env) {
        const p = env.player;
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const a = this.arrows[i];
            a.age += dt;
            a.vel.y -= 18 * dt;
            a.pos.addScaledVector(a.vel, dt);
            a.mesh.position.copy(a.pos);
            a.mesh.lookAt(a.pos.x + a.vel.x, a.pos.y + a.vel.y, a.pos.z + a.vel.z);

            if (a.fromPlayer) {
                // player arrows hit mobs (AABB expanded a touch for fairness)
                const hitMob = this.mobs.find(
                    (m) =>
                        !m.dead &&
                        Math.abs(a.pos.x - m.pos.x) < m.half + 0.25 &&
                        Math.abs(a.pos.z - m.pos.z) < m.half + 0.25 &&
                        a.pos.y > m.pos.y - 0.15 &&
                        a.pos.y < m.pos.y + m.height + 0.15,
                );
                if (hitMob) {
                    hitMob.hurt(a.dmg || 4, a.shooterPos || a.pos, env);
                    env.sounds.mobHit();
                    this.removeArrow(i);
                    continue;
                }
            }

            const hitPlayer =
                !a.fromPlayer &&
                !p.dead &&
                Math.abs(a.pos.x - p.pos.x) < 0.5 &&
                Math.abs(a.pos.z - p.pos.z) < 0.5 &&
                a.pos.y > p.pos.y &&
                a.pos.y < p.pos.y + 1.9;

            if (hitPlayer) {
                env.damagePlayer(3, a.pos);
                this.removeArrow(i);
            } else if (
                a.age > 5 ||
                isSolid(
                    this.world.getBlock(
                        Math.floor(a.pos.x),
                        Math.floor(a.pos.y),
                        Math.floor(a.pos.z),
                    ),
                )
            ) {
                this.removeArrow(i);
            }
        }
    }

    removeArrow(i) {
        this.scene.remove(this.arrows[i].mesh);
        this.arrows.splice(i, 1);
    }

    // Hurt every mob within an explosion radius.
    explodeDamage(x, y, z, radius, env) {
        for (const m of this.mobs) {
            const d = m.pos.distanceTo({ x, y, z });
            if (d < radius * 1.6) {
                m.hurt(Math.ceil((1 - d / (radius * 1.6)) * 24), { x, z }, env);
            }
        }
    }

    trySpawns(env) {
        const p = env.player.pos;
        const pigs = this.mobs.filter((m) => m.type === 'pig').length;
        const hostiles = this.mobs.length - pigs;

        if (pigs < 8 && env.dayFactor > 0.5) this.trySpawnOne('pig', p, true);
        if (hostiles < 12 && env.isNight) {
            const r = Math.random();
            const type = r < 0.45 ? 'zombie' : r < 0.75 ? 'skeleton' : 'creeper';
            this.trySpawnOne(type, p, false);
        }
    }

    trySpawnOne(type, p, needGrass) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 24 + Math.random() * 28;
        const x = Math.floor(p.x + Math.cos(ang) * dist);
        const z = Math.floor(p.z + Math.sin(ang) * dist);
        const y = this.world.topSolidY(x, z);
        if (y <= 1 || y > 90) return;
        const ground = this.world.getBlock(x, y, z);
        if (needGrass && ground !== 1) return;
        if (ground === 5) return;
        this.mobs.push(new Mob(this.scene, this.world, type, x + 0.5, y + 1.05, z + 0.5));
    }

    raycast(origin, dir, maxDist) {
        let best = null,
            bestT = maxDist;
        for (const m of this.mobs) {
            const { min, max } = m.aabb();
            const t = rayVsAABB(origin, dir, min, max);
            if (t !== null && t < bestT) {
                bestT = t;
                best = m;
            }
        }
        return best ? { mob: best, t: bestT } : null;
    }
}
