// Item drop entities: small spinning meshes with gravity, magnet pickup.

import * as THREE from 'three';
import { stepBody } from '../core/physics.js';
import { buildBlockItemGeometry } from '../world/mesher.js';
import { getItemIcon } from '../render/textures.js';

const PICKUP_DIST = 1.5;
const MAGNET_DIST = 2.6;
const DESPAWN = 300; // seconds
const MAX_DROPS = 200;

const blockGeoCache = new Map();
const itemMatCache = new Map();
const spriteGeo = new THREE.PlaneGeometry(0.32, 0.32);

export class DropManager {
    constructor(scene, world, chunkMaterial) {
        this.scene = scene;
        this.world = world;
        this.chunkMaterial = chunkMaterial; // block drops share the lit chunk shader
        this.drops = [];
    }

    spawn(x, y, z, id, n, dur) {
        if (this.drops.length >= MAX_DROPS) return;
        let mesh;
        if (id < 100) {
            if (!blockGeoCache.has(id)) blockGeoCache.set(id, buildBlockItemGeometry(id, 0.25));
            mesh = new THREE.Mesh(blockGeoCache.get(id), this.chunkMaterial);
        } else {
            if (!itemMatCache.has(id)) {
                const tex = new THREE.CanvasTexture(getItemIcon(id));
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                itemMatCache.set(
                    id,
                    new THREE.MeshBasicMaterial({
                        map: tex,
                        transparent: true,
                        alphaTest: 0.1,
                        side: THREE.DoubleSide,
                    }),
                );
            }
            mesh = new THREE.Mesh(spriteGeo, itemMatCache.get(id));
        }
        this.scene.add(mesh);

        const drop = {
            id,
            n,
            dur,
            pos: new THREE.Vector3(x, y, z),
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                3 + Math.random() * 2,
                (Math.random() - 0.5) * 3,
            ),
            half: 0.12,
            height: 0.24,
            onGround: false,
            hitWall: false,
            mesh,
            age: 0,
            pickupDelay: 0.6,
            spin: Math.random() * Math.PI * 2,
        };
        this.drops.push(drop);
    }

    scatter(pos, items) {
        for (const s of items) this.spawn(pos.x, pos.y + 0.5, pos.z, s.id, s.n, s.dur);
    }

    update(dt, player, inv, onPickup, camera, dayTint) {
        // tint flat item sprites with the time of day
        for (const m of itemMatCache.values()) m.color.setScalar(dayTint);

        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.age += dt;
            d.pickupDelay -= dt;

            if (d.age > DESPAWN) {
                this.remove(i);
                continue;
            }

            // physics (cheap: only when moving or airborne)
            d.vel.y -= 24 * dt;
            d.vel.x *= 0.9;
            d.vel.z *= 0.9;
            stepBody(this.world, d, dt);

            // magnet toward the player
            const dx = player.pos.x - d.pos.x;
            const dy = player.pos.y + 0.8 - d.pos.y;
            const dz = player.pos.z - d.pos.z;
            const dist = Math.hypot(dx, dy, dz);

            if (d.pickupDelay <= 0 && !player.dead) {
                if (dist < PICKUP_DIST) {
                    const left = inv.add(d.id, d.n, d.dur);
                    if (left === 0) {
                        this.remove(i);
                        if (onPickup) onPickup();
                        continue;
                    }
                    d.n = left;
                } else if (dist < MAGNET_DIST) {
                    d.vel.x += (dx / dist) * 24 * dt;
                    d.vel.y += (dy / dist) * 24 * dt;
                    d.vel.z += (dz / dist) * 24 * dt;
                }
            }

            // bob + spin
            d.spin += dt * 2.2;
            d.mesh.position.set(d.pos.x, d.pos.y + 0.15 + Math.sin(d.age * 2.5) * 0.05, d.pos.z);
            if (d.id < 100) {
                d.mesh.rotation.y = d.spin;
            } else {
                d.mesh.quaternion.copy(camera.quaternion); // billboard sprites
            }
        }
    }

    remove(i) {
        this.scene.remove(this.drops[i].mesh);
        this.drops.splice(i, 1);
    }
}
