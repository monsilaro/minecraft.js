// Verifies leaf-decay support detection: leaves stay while the trunk stands,
// and all become unsupported once the trunk is removed.
import { findUnsupportedLeaves } from '../src/world/leafdecay.js';

const LOG = 6,
    LEAVES = 7;
const world = new Map();
const k = (x, y, z) => x + ',' + y + ',' + z;
const set = (x, y, z, id) => world.set(k(x, y, z), id);
const getBlock = (x, y, z) => world.get(k(x, y, z)) || 0;

let fail = 0;
function check(name, got, want) {
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`);
}

// Build a small oak: trunk column + radius-2 canopy (corners trimmed, like the generator)
const leafPositions = [];
for (let y = 4; y <= 7; y++) {
    const r = y <= 6 ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // trimmed corners
            if (dx === 0 && dz === 0 && y <= 5) continue; // trunk column
            set(dx, y, dz, LEAVES);
            leafPositions.push([dx, y, dz]);
        }
    }
}
for (let y = 1; y <= 5; y++) set(0, y, 0, LOG); // trunk

// trunk standing → nothing should decay
check('supported while trunk stands', findUnsupportedLeaves(getBlock, 0, 3, 0).length, 0);

// remove the whole trunk → every canopy leaf is now unsupported
for (let y = 1; y <= 5; y++) set(0, y, 0, 0);
check('all leaves unsupported after trunk gone', findUnsupportedLeaves(getBlock, 0, 1, 0).length, leafPositions.length);

// a lone floating leaf with no log nearby is unsupported
const w2 = new Map();
w2.set('20,20,20', LEAVES);
check(
    'lone leaf unsupported',
    findUnsupportedLeaves((x, y, z) => w2.get(x + ',' + y + ',' + z) || 0, 20, 20, 20).length,
    1,
);

process.exit(fail ? 1 : 0);
