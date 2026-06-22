// Mesh worker: lighting BFS + geometry building off the main thread.
// Receives a 3x3 block of chunk data (enough for face culling, AO and the
// 14-block light margin), returns transferable typed arrays.
// Only pure modules are imported here — no THREE, no DOM.

import { computeLightRegion } from './lighting.js';
import { buildChunkArrays } from './mesher-core.js';
import { AIR, BEDROCK } from './blocks.js';
import { CHUNK, HEIGHT } from './constants.js';

self.onmessage = (e) => {
    const { jobId, cx, cz, chunks } = e.data; // chunks: [{cx, cz, blocks: Uint8Array}]
    const map = new Map(chunks.map((c) => [c.cx + ',' + c.cz, c]));

    const shim = {
        getChunk(ccx, ccz) {
            return map.get(ccx + ',' + ccz);
        },
        getBlock(x, y, z) {
            if (y < 0) return BEDROCK;
            if (y >= HEIGHT) return AIR;
            const ccx = Math.floor(x / CHUNK),
                ccz = Math.floor(z / CHUNK);
            const c = map.get(ccx + ',' + ccz);
            if (!c) return AIR;
            return c.blocks[((x - ccx * CHUNK) * CHUNK + (z - ccz * CHUNK)) * HEIGHT + y];
        },
    };

    const light = computeLightRegion(shim, cx, cz);
    const chunk = map.get(cx + ',' + cz);
    const { opaque, trans } = buildChunkArrays(shim, chunk, light);

    const transfers = [];
    for (const g of [opaque, trans]) {
        if (g) {
            transfers.push(
                g.positions.buffer,
                g.colors.buffer,
                g.uvs.buffer,
                g.sky.buffer,
                g.torch.buffer,
                g.indices.buffer,
            );
        }
    }
    self.postMessage({ jobId, cx, cz, opaque, trans }, transfers);
};
