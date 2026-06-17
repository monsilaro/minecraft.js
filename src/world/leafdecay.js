// Pure leaf-decay logic (no Three.js / DOM) so it can be unit-tested.
// A leaf is "supported" if a log sits within DIST steps through connected leaves.
// After a trunk is cut, unsupported leaves should vanish.

const LOG = 6;
const LEAVES = 7;
const NEIGH = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];

// getBlock(x, y, z) -> block id. Returns the leaf positions within `R` of
// (lx, ly, lz) that are NOT connected to any log within `dist` leaf-steps.
export function findUnsupportedLeaves(getBlock, lx, ly, lz, R = 6, dist = 4) {
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const supported = new Set();
    const q = [];

    // seed: leaves directly touching a log are supported (distance 1)
    for (let x = lx - R; x <= lx + R; x++) {
        for (let y = ly - R; y <= ly + R; y++) {
            for (let z = lz - R; z <= lz + R; z++) {
                if (getBlock(x, y, z) !== LOG) continue;
                for (const [dx, dy, dz] of NEIGH) {
                    const nx = x + dx,
                        ny = y + dy,
                        nz = z + dz;
                    if (getBlock(nx, ny, nz) === LEAVES) {
                        const k = key(nx, ny, nz);
                        if (!supported.has(k)) {
                            supported.add(k);
                            q.push([nx, ny, nz, 1]);
                        }
                    }
                }
            }
        }
    }
    // BFS through connected leaves up to `dist`
    for (let h = 0; h < q.length; h++) {
        const [x, y, z, d] = q[h];
        if (d >= dist) continue;
        for (const [dx, dy, dz] of NEIGH) {
            const nx = x + dx,
                ny = y + dy,
                nz = z + dz;
            if (getBlock(nx, ny, nz) === LEAVES) {
                const k = key(nx, ny, nz);
                if (!supported.has(k)) {
                    supported.add(k);
                    q.push([nx, ny, nz, d + 1]);
                }
            }
        }
    }
    // collect leaves in range that are not supported
    const out = [];
    for (let x = lx - R; x <= lx + R; x++) {
        for (let y = ly - R; y <= ly + R; y++) {
            for (let z = lz - R; z <= lz + R; z++) {
                if (getBlock(x, y, z) !== LEAVES) continue;
                if (!supported.has(key(x, y, z))) out.push({ x, y, z });
            }
        }
    }
    return out;
}
