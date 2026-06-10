// Smoke test for the lighting module: flat stone world at y=20, one torch in a
// sealed cavity, one open shaft. Run: node test/light-test.mjs
import { computeLightRegion } from '../src/world/lighting.js';
import { CHUNK, HEIGHT } from '../src/world/constants.js';

const GROUND = 20;

function makeChunk() {
    const blocks = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    for (let lx = 0; lx < CHUNK; lx++) {
        for (let lz = 0; lz < CHUNK; lz++) {
            const col = (lx * CHUNK + lz) * HEIGHT;
            for (let y = 0; y <= GROUND; y++) blocks[col + y] = 3; // stone
        }
    }
    return blocks;
}

const chunks = new Map();
const world = {
    getChunk(cx, cz) {
        const k = cx + ',' + cz;
        if (!chunks.has(k)) chunks.set(k, { blocks: makeChunk() });
        return chunks.get(k);
    },
};

function setBlock(x, y, z, id) {
    const cx = Math.floor(x / CHUNK),
        cz = Math.floor(z / CHUNK);
    const c = world.getChunk(cx, cz);
    c.blocks[((x - cx * CHUNK) * CHUNK + (z - cz * CHUNK)) * HEIGHT + y] = id;
}

// cavity at y=10 with a torch (block 17 emits 14)
setBlock(5, 10, 5, 0);
setBlock(6, 10, 5, 0);
setBlock(7, 10, 5, 0);
setBlock(5, 10, 5, 17);

// open shaft from surface down to y=15 at (12, 12)
for (let y = 15; y <= GROUND; y++) setBlock(12, y, 12, 0);

const light = computeLightRegion(world, 0, 0);

const checks = [
    ['sky above ground = 15', light.skyAt(8, GROUND + 1, 8), 15],
    ['sky inside stone = 0', light.skyAt(8, 10, 8), 0],
    ['sky at shaft bottom = 15 (direct column)', light.skyAt(12, 15, 12), 15],
    ['torch at source = 14', light.torchAt(5, 10, 5), 14],
    ['torch 2 cells away = 12', light.torchAt(7, 10, 5), 12],
    ['torch blocked by stone = 0', light.torchAt(5, 10, 8), 0],
    ['torch above surface = 0', light.torchAt(5, GROUND + 1, 5), 0],
    ['sky across chunk border = 15', light.skyAt(-5, GROUND + 1, -5), 15],
];

let fail = 0;
for (const [name, got, want] of checks) {
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`);
}
process.exit(fail ? 1 : 0);
