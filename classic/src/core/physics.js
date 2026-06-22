// Shared voxel AABB physics for the player, mobs and item drops.
// body: { pos: Vector3 (feet center), vel: Vector3, half, height, onGround, hitWall }

import { isSolid } from '../world/blocks.js';

const EPS = 1e-4;

export function stepBody(world, body, dt) {
    body.hitWall = false;
    const prevVy = body.vel.y;

    const steps = Math.max(1, Math.ceil(((Math.abs(body.vel.y) + 1) * dt) / 0.5));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
        moveAxis(world, body, 'x', body.vel.x * sdt);
        moveAxis(world, body, 'z', body.vel.z * sdt);
        body.onGround = false;
        moveAxis(world, body, 'y', body.vel.y * sdt);
    }

    // velocity at the moment of landing, for fall damage
    return body.onGround ? prevVy : 0;
}

function moveAxis(world, body, axis, amount) {
    if (amount === 0) return;
    body.pos[axis] += amount;
    const { pos, half, height } = body;

    const minX = Math.floor(pos.x - half),
        maxX = Math.floor(pos.x + half);
    const minY = Math.floor(pos.y),
        maxY = Math.floor(pos.y + height);
    const minZ = Math.floor(pos.z - half),
        maxZ = Math.floor(pos.z + half);

    for (let bx = minX; bx <= maxX; bx++) {
        for (let by = minY; by <= maxY; by++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                if (!isSolid(world.getBlock(bx, by, bz))) continue;
                if (axis === 'x') {
                    pos.x = amount > 0 ? bx - half - EPS : bx + 1 + half + EPS;
                    body.vel.x = 0;
                    body.hitWall = true;
                } else if (axis === 'z') {
                    pos.z = amount > 0 ? bz - half - EPS : bz + 1 + half + EPS;
                    body.vel.z = 0;
                    body.hitWall = true;
                } else {
                    if (amount > 0) {
                        pos.y = by - height - EPS;
                    } else {
                        pos.y = by + 1 + EPS;
                        body.onGround = true;
                    }
                    body.vel.y = 0;
                }
                return;
            }
        }
    }
}

export function aabbIntersectsBlock(body, bx, by, bz) {
    return (
        bx + 1 > body.pos.x - body.half &&
        bx < body.pos.x + body.half &&
        by + 1 > body.pos.y &&
        by < body.pos.y + body.height &&
        bz + 1 > body.pos.z - body.half &&
        bz < body.pos.z + body.half
    );
}

// Slab test, for hitting mobs with the crosshair ray. Returns t or null.
export function rayVsAABB(origin, dir, min, max) {
    let tmin = -Infinity,
        tmax = Infinity;
    for (const axis of ['x', 'y', 'z']) {
        if (Math.abs(dir[axis]) < 1e-9) {
            if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
        } else {
            let t1 = (min[axis] - origin[axis]) / dir[axis];
            let t2 = (max[axis] - origin[axis]) / dir[axis];
            if (t1 > t2) [t1, t2] = [t2, t1];
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax) return null;
        }
    }
    return tmax < 0 ? null : Math.max(tmin, 0);
}
