// Voxel lighting, Minecraft-style: two BFS-propagated light fields.
// - sky light: 15 from open sky, flood-fills sideways into caves/overhangs
// - torch light: emitted by light-source blocks (torches), radius ~14
// Computed over the chunk plus a margin so light crosses chunk borders cleanly.
// Recomputed whenever a chunk is remeshed (block edits mark 3x3 chunks dirty).

import { OPAQUE_LUT, EMIT_LUT, WATER } from './blocks.js';
import { CHUNK, HEIGHT } from './constants.js';

const M = 14; // light radius margin
const W = CHUNK + 2 * M; // region width (44)

// Scratch buffers reused across calls (results are consumed synchronously by
// the mesher before the next chunk is processed).
const blocksBuf = new Uint8Array(W * W * HEIGHT);
const skyBuf = new Uint8Array(W * W * HEIGHT);
const torchBuf = new Uint8Array(W * W * HEIGHT);

export function computeLightRegion(world, cx, cz) {
    const rx0 = cx * CHUNK - M;
    const rz0 = cz * CHUNK - M;

    // copy block data into a flat region (columns are contiguous in y)
    const blocks = blocksBuf;
    blocks.fill(0);
    for (let ix = 0; ix < W; ix++) {
        const wx = rx0 + ix;
        const ccx = Math.floor(wx / CHUNK);
        const lx = wx - ccx * CHUNK;
        for (let iz = 0; iz < W; iz++) {
            const wz = rz0 + iz;
            const ccz = Math.floor(wz / CHUNK);
            const chunk = world.getChunk(ccx, ccz);
            if (!chunk) continue;
            const lz = wz - ccz * CHUNK;
            const src = (lx * CHUNK + lz) * HEIGHT;
            blocks.set(chunk.blocks.subarray(src, src + HEIGHT), (ix * W + iz) * HEIGHT);
        }
    }

    const sky = skyBuf;
    const torch = torchBuf;
    sky.fill(0);
    torch.fill(0);
    const skyQueue = [];
    const torchQueue = [];

    // skylight: vertical fill (direct sun stays 15, water absorbs)
    for (let ix = 0; ix < W; ix++) {
        for (let iz = 0; iz < W; iz++) {
            const col = (ix * W + iz) * HEIGHT;
            let level = 15;
            for (let y = HEIGHT - 1; y >= 0 && level > 0; y--) {
                const id = blocks[col + y];
                if (OPAQUE_LUT[id]) break;
                if (id === WATER) level = Math.max(0, level - 3);
                sky[col + y] = level;
                if (level > 1) skyQueue.push(col + y);
            }
        }
    }

    // torch sources
    for (let i = 0; i < blocks.length; i++) {
        const emit = EMIT_LUT[blocks[i]];
        if (emit > 0) {
            torch[i] = emit;
            torchQueue.push(i);
        }
    }

    bfs(blocks, sky, skyQueue);
    bfs(blocks, torch, torchQueue);

    // accessors take world coordinates
    const skyAt = (wx, y, wz) => {
        const ix = wx - rx0,
            iz = wz - rz0;
        if (ix < 0 || iz < 0 || ix >= W || iz >= W || y < 0) return 0;
        if (y >= HEIGHT) return 15;
        return sky[(ix * W + iz) * HEIGHT + y];
    };
    const torchAt = (wx, y, wz) => {
        const ix = wx - rx0,
            iz = wz - rz0;
        if (ix < 0 || iz < 0 || ix >= W || iz >= W || y < 0 || y >= HEIGHT) return 0;
        return torch[(ix * W + iz) * HEIGHT + y];
    };
    return { skyAt, torchAt };
}

// Flood-fill: each step loses 1 light level (water costs 2 extra).
function bfs(blocks, light, queue) {
    const colStride = HEIGHT;
    const rowStride = W * HEIGHT;

    for (let qi = 0; qi < queue.length; qi++) {
        const i = queue[qi];
        const lvl = light[i];
        if (lvl <= 1) continue;

        const y = i % HEIGHT;
        const colIdx = (i - y) / HEIGHT;
        const iz = colIdx % W;
        const ix = (colIdx - iz) / W;

        // -x, +x, -z, +z, -y, +y
        if (ix > 0) spread(blocks, light, queue, i - rowStride, lvl);
        if (ix < W - 1) spread(blocks, light, queue, i + rowStride, lvl);
        if (iz > 0) spread(blocks, light, queue, i - colStride, lvl);
        if (iz < W - 1) spread(blocks, light, queue, i + colStride, lvl);
        if (y > 0) spread(blocks, light, queue, i - 1, lvl);
        if (y < HEIGHT - 1) spread(blocks, light, queue, i + 1, lvl);
    }
}

function spread(blocks, light, queue, ni, lvl) {
    const nb = blocks[ni];
    if (OPAQUE_LUT[nb]) return;
    const nl = lvl - 1 - (nb === WATER ? 2 : 0);
    if (nl > light[ni]) {
        light[ni] = nl;
        queue.push(ni);
    }
}
