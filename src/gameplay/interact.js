// Block targeting, hold-to-mine with crack overlay and tool logic, mob combat,
// placing blocks from the inventory, eating food.

import * as THREE from 'three';
import { AIR, WATER, BLOCKS, blockDrops, isDoor, doorId, doorTop, doorFacing, doorOpen } from '../world/blocks.js';
import { defOf } from '../items/inventory.js';
import { IT } from '../items/items.js';
import { S } from '../audio/sounds.js';

const REACH = 5;
const FIST_DMG = 1;

export function raycastVoxel(world, origin, dir, maxDist) {
    let x = Math.floor(origin.x),
        y = Math.floor(origin.y),
        z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x),
        stepY = Math.sign(dir.y),
        stepZ = Math.sign(dir.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = stepX !== 0 ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX : Infinity;
    let tMaxY = stepY !== 0 ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ !== 0 ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ : Infinity;
    let normal = [0, 0, 0];
    let t = 0;

    while (t <= maxDist) {
        const id = world.getBlock(x, y, z);
        if (id !== AIR && id !== WATER) return { x, y, z, id, normal, t };
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
            x += stepX;
            t = tMaxX;
            tMaxX += tDeltaX;
            normal = [-stepX, 0, 0];
        } else if (tMaxY < tMaxZ) {
            y += stepY;
            t = tMaxY;
            tMaxY += tDeltaY;
            normal = [0, -stepY, 0];
        } else {
            z += stepZ;
            t = tMaxZ;
            tMaxZ += tDeltaZ;
            normal = [0, 0, -stepZ];
        }
    }
    return null;
}

export class Interaction {
    constructor({ world, player, camera, scene, inv, ui, drops, mobs, crackTextures, dom }) {
        this.world = world;
        this.player = player;
        this.camera = camera;
        this.inv = inv;
        this.ui = ui;
        this.drops = drops;
        this.mobs = mobs;
        this.dom = dom;

        this.leftDown = false;
        this.mineKey = null;
        this.mineProgress = 0;
        this.attackCd = 0;
        this.digSoundTimer = 0;
        this.bowCharge = -1; // -1 idle, 0..1 while drawing
        this.onUseBed = null; // cb(x, y, z) wired by main
        this.onLogBroken = null; // cb(x, y, z) — triggers leaf decay
        this.dir = new THREE.Vector3();

        // target highlight
        const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
        this.highlight = new THREE.LineSegments(
            new THREE.EdgesGeometry(box),
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
        );
        this.highlight.visible = false;
        scene.add(this.highlight);

        // crack overlay
        this.crackMats = crackTextures.map(
            (t) =>
                new THREE.MeshBasicMaterial({
                    map: t,
                    transparent: true,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                }),
        );
        this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), this.crackMats[0]);
        this.crack.visible = false;
        scene.add(this.crack);

        dom.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement !== dom) return;
            e.preventDefault();
            if (e.button === 0) {
                this.leftDown = true;
                this.tryAttack();
            } else if (e.button === 1) {
                this.pickBlock();
            } else if (e.button === 2) {
                const held = this.inv.currentItem();
                if (held && defOf(held.id)?.bow && !this.player.dead) {
                    if (this.inv.count(IT.ARROW) > 0) this.bowCharge = 0;
                } else {
                    this.rightClick();
                }
            }
        });
        dom.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.leftDown = false;
            if (e.button === 2 && this.bowCharge >= 0) this.releaseBow();
        });
        dom.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    target() {
        this.camera.getWorldDirection(this.dir);
        return raycastVoxel(this.world, this.camera.position, this.dir, REACH);
    }

    // ---- combat ----

    tryAttack() {
        if (this.attackCd > 0 || this.player.dead) return;
        this.camera.getWorldDirection(this.dir);
        const blockHit = this.target();
        const mobHit = this.mobs.raycast(this.camera.position, this.dir, 3.5);
        if (mobHit && (!blockHit || mobHit.t < blockHit.t)) {
            this.attackCd = 0.55;
            const held = this.inv.currentItem();
            const def = held ? defOf(held.id) : null;
            const dmg = def?.dmg || FIST_DMG;
            mobHit.mob.hurt(dmg, this.player.pos, { dropManager: this.drops });
            S.mobHit();
            if (def?.tool) this.inv.wearSelected();
            this.resetMining();
        }
    }

    // ---- right click: eat / place / open table ----

    rightClick() {
        if (this.player.dead) return;
        const held = this.inv.currentItem();
        const def = held ? defOf(held.id) : null;

        if (def?.food) {
            if (this.player.eat(def.food)) {
                this.inv.consumeSelected();
                S.eat();
            }
            return;
        }

        const hit = this.target();
        if (!hit) return;

        if (hit.id === 21) {
            // crafting table: open the 3x3 crafting grid
            document.exitPointerLock();
            this.ui.setInventoryOpen(true, { mode: 'table' });
            return;
        }
        if (hit.id === 22) {
            // furnace: open the smelting UI
            document.exitPointerLock();
            this.ui.setInventoryOpen(true, { mode: 'furnace' });
            return;
        }

        if (hit.id === 23 && this.onIgniteTNT) {
            this.onIgniteTNT(hit.x, hit.y, hit.z);
            return;
        }

        if (hit.id === 24 && this.onUseBed) {
            this.onUseBed(hit.x, hit.y, hit.z);
            return;
        }

        if (isDoor(hit.id)) {
            this.toggleDoor(hit.x, hit.y, hit.z);
            return;
        }

        if (!held || held.id >= 100) return; // only blocks are placeable
        if (BLOCKS[held.id]?.render === 'door') {
            this.placeDoor(hit);
            return;
        }
        const px = hit.x + hit.normal[0];
        const py = hit.y + hit.normal[1];
        const pz = hit.z + hit.normal[2];
        const current = this.world.getBlock(px, py, pz);
        if (current !== AIR && current !== WATER && !BLOCKS[current]?.render) return;
        if (BLOCKS[held.id].solid && this.player.intersectsBlock(px, py, pz)) return;
        this.world.setBlock(px, py, pz, held.id);
        this.inv.consumeSelected();
        S.place();
    }

    // open/close both halves of a door (clicked half can be top or bottom)
    toggleDoor(x, y, z) {
        const id = this.world.getBlock(x, y, z);
        const bottomY = doorTop(id) ? y - 1 : y;
        const facing = doorFacing(id);
        const open = !doorOpen(id);
        if (isDoor(this.world.getBlock(x, bottomY, z)))
            this.world.setBlock(x, bottomY, z, doorId(facing, open, false));
        if (isDoor(this.world.getBlock(x, bottomY + 1, z)))
            this.world.setBlock(x, bottomY + 1, z, doorId(facing, open, true));
        S.door();
    }

    // place a 2-tall door at the targeted cell, facing the player
    placeDoor(hit) {
        const px = hit.x + hit.normal[0],
            py = hit.y + hit.normal[1],
            pz = hit.z + hit.normal[2];
        for (const yy of [py, py + 1]) {
            const c = this.world.getBlock(px, yy, pz);
            if (c !== AIR && c !== WATER && !BLOCKS[c]?.render) return; // need both cells free
        }
        if (this.player.intersectsBlock(px, py, pz) || this.player.intersectsBlock(px, py + 1, pz))
            return;
        // facing = dominant axis of the player's look direction
        const fx = -Math.sin(this.player.yaw),
            fz = -Math.cos(this.player.yaw);
        const facing = Math.abs(fz) >= Math.abs(fx) ? (fz > 0 ? 0 : 1) : fx > 0 ? 2 : 3;
        this.world.setBlock(px, py, pz, doorId(facing, false, false));
        this.world.setBlock(px, py + 1, pz, doorId(facing, false, true));
        this.inv.consumeSelected();
        S.place();
    }

    pickBlock() {
        const hit = this.target();
        if (!hit) return;
        for (let i = 0; i < 9; i++) {
            if (this.inv.slots[i]?.id === hit.id) {
                this.ui.select(i);
                return;
            }
        }
    }

    // ---- bow ----

    releaseBow() {
        const charge = this.bowCharge;
        this.bowCharge = -1;
        if (charge < 0.12 || this.player.dead) return;
        if (this.inv.count(IT.ARROW) <= 0) return;

        this.camera.getWorldDirection(this.dir);
        const origin = this.camera.position.clone().addScaledVector(this.dir, 0.4);
        const vel = this.dir.clone().multiplyScalar(12 + charge * 16);
        this.mobs.shootArrow(origin, vel, {
            fromPlayer: true,
            dmg: 2 + Math.round(charge * 6),
            shooterPos: this.player.pos.clone(),
        });
        this.inv.take(IT.ARROW, 1);
        this.inv.wearSelected();
        S.bow();
    }

    // ---- per-frame: mining + highlight ----

    update(dt, active) {
        this.attackCd = Math.max(0, this.attackCd - dt);

        if (this.bowCharge >= 0) {
            const held = this.inv.currentItem();
            if (!active || !held || !defOf(held.id)?.bow) this.bowCharge = -1;
            else this.bowCharge = Math.min(1, this.bowCharge + dt / 1.0);
        }

        const hit = active ? this.target() : null;

        if (hit) {
            this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
            this.highlight.visible = true;
        } else {
            this.highlight.visible = false;
        }

        if (!this.leftDown || !hit || this.player.dead || !active) {
            this.resetMining();
            return;
        }

        const def = BLOCKS[hit.id];
        if (def.unbreakable) {
            this.resetMining();
            return;
        }

        const key = `${hit.x},${hit.y},${hit.z}`;
        if (key !== this.mineKey) {
            this.mineKey = key;
            this.mineProgress = 0;
        }

        const breakTime = this.breakTime(def);
        this.mineProgress += dt / Math.max(0.05, breakTime);

        this.digSoundTimer -= dt;
        if (this.digSoundTimer <= 0) {
            this.digSoundTimer = 0.25;
            S.dig();
        }

        if (this.mineProgress >= 1) {
            this.finishBreak(hit, def);
            return;
        }

        const stage = Math.min(3, Math.floor(this.mineProgress * 4));
        this.crack.material = this.crackMats[stage];
        this.crack.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        this.crack.visible = true;
    }

    breakTime(def) {
        const held = this.inv.currentItem();
        const heldDef = held ? defOf(held.id) : null;
        const rightTool = def.tool && heldDef?.tool === def.tool;
        const canHarvest = !def.tool || (rightTool && heldDef.tier >= (def.tier || 1));
        if (!canHarvest) return def.hardness * 5;
        // required tool speeds it up; fastTool (e.g. axe on wood) speeds it up too
        // without being required for harvest
        let speed = 1;
        if (rightTool) speed = heldDef.speed;
        else if (def.fastTool && heldDef?.tool === def.fastTool) speed = heldDef.speed;
        return (def.hardness * 1.5) / speed;
    }

    finishBreak(hit, def) {
        const held = this.inv.currentItem();
        const heldDef = held ? defOf(held.id) : null;
        const rightTool = def.tool && heldDef?.tool === def.tool;
        const canHarvest = !def.tool || (rightTool && heldDef.tier >= (def.tier || 1));

        this.world.setBlock(hit.x, hit.y, hit.z, AIR);
        // breaking either door half removes the other (it drops a single door)
        if (isDoor(hit.id)) {
            const otherY = doorTop(hit.id) ? hit.y - 1 : hit.y + 1;
            if (isDoor(this.world.getBlock(hit.x, otherY, hit.z)))
                this.world.setBlock(hit.x, otherY, hit.z, AIR);
        }
        // a plant sitting on top pops off
        const above = this.world.getBlock(hit.x, hit.y + 1, hit.z);
        if (BLOCKS[above]?.render === 'cross') {
            this.world.setBlock(hit.x, hit.y + 1, hit.z, AIR);
            for (const d of blockDrops(above, Math.random)) {
                this.drops.spawn(hit.x + 0.5, hit.y + 1.3, hit.z + 0.5, d.id, d.n);
            }
        }

        if (canHarvest) {
            for (const d of blockDrops(hit.id, Math.random)) {
                this.drops.spawn(hit.x + 0.5, hit.y + 0.3, hit.z + 0.5, d.id, d.n);
            }
        }
        if (heldDef?.tool && def.hardness > 0) this.inv.wearSelected();
        if (hit.id === 6 && this.onLogBroken) this.onLogBroken(hit.x, hit.y, hit.z); // log → leaf decay
        S.breakBlock();
        this.resetMining();
    }

    resetMining() {
        this.mineKey = null;
        this.mineProgress = 0;
        this.crack.visible = false;
    }
}
