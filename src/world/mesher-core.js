// Pure chunk meshing math — no THREE, no DOM — so it runs both on the main
// thread and inside the mesh worker. Produces raw typed arrays; mesher.js
// wraps them into BufferGeometry on the main thread.
//
// Face culling, directional shading, vertex AO, smooth per-vertex sky/torch
// light (separate attributes so the shader can scale skylight with the time
// of day), and cross-rendered blocks (plants, torches).

import { AIR, BLOCKS, isOpaque, doorFacing, doorOpen } from './blocks.js';
import { tileUV } from './atlas.js';
import { CHUNK, HEIGHT } from './constants.js';

const FACES = [
    {
        dir: [1, 0, 0],
        shade: 0.6,
        tile: 'side',
        corners: [
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
            [1, 0, 1],
        ],
        uvs: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ],
    },
    {
        dir: [-1, 0, 0],
        shade: 0.6,
        tile: 'side',
        corners: [
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
            [0, 0, 0],
        ],
        uvs: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ],
    },
    {
        dir: [0, 1, 0],
        shade: 1.0,
        tile: 'top',
        corners: [
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 0],
            [0, 1, 0],
        ],
        uvs: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ],
    },
    {
        dir: [0, -1, 0],
        shade: 0.5,
        tile: 'bottom',
        corners: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 0, 1],
            [0, 0, 1],
        ],
        uvs: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ],
    },
    {
        dir: [0, 0, 1],
        shade: 0.8,
        tile: 'side',
        corners: [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1],
        ],
        uvs: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ],
    },
    {
        dir: [0, 0, -1],
        shade: 0.8,
        tile: 'side',
        corners: [
            [1, 0, 0],
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
        ],
        uvs: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ],
    },
];

const AO_LEVELS = [0.45, 0.65, 0.82, 1.0];

function faceVisible(selfId, neighborId) {
    if (neighborId === AIR) return true;
    if (isOpaque(neighborId)) return false;
    return neighborId !== selfId;
}

class GeoBuffer {
    constructor() {
        this.positions = [];
        this.colors = [];
        this.uvs = [];
        this.sky = [];
        this.torch = [];
        this.indices = [];
        this.vertCount = 0;
    }

    quadIndices(flip) {
        const b = this.vertCount;
        if (flip) this.indices.push(b + 1, b + 2, b + 3, b + 1, b + 3, b);
        else this.indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
        this.vertCount += 4;
    }

    // Plain typed arrays — transferable across the worker boundary.
    build() {
        if (this.vertCount === 0) return null;
        return {
            positions: new Float32Array(this.positions),
            colors: new Float32Array(this.colors),
            uvs: new Float32Array(this.uvs),
            sky: new Float32Array(this.sky),
            torch: new Float32Array(this.torch),
            indices: new Uint32Array(this.indices),
        };
    }
}

// world: anything with getBlock(x, y, z) world-coords.
export function buildChunkArrays(world, chunk, light) {
    const ox = chunk.cx * CHUNK,
        oz = chunk.cz * CHUNK;
    const opaqueBuf = new GeoBuffer();
    const transBuf = new GeoBuffer();

    for (let lx = 0; lx < CHUNK; lx++) {
        for (let lz = 0; lz < CHUNK; lz++) {
            const col = (lx * CHUNK + lz) * HEIGHT;
            for (let y = 0; y < HEIGHT; y++) {
                const id = chunk.blocks[col + y];
                if (id === AIR) continue;
                const block = BLOCKS[id];
                const wx = ox + lx,
                    wz = oz + lz;

                if (block.render === 'cross') {
                    addCross(opaqueBuf, block, wx, y, wz, light);
                    continue;
                }
                if (block.render === 'door') {
                    addDoor(transBuf, id, block, wx, y, wz, light);
                    continue;
                }

                const buf = block.transparent ? transBuf : opaqueBuf;
                for (const face of FACES) {
                    const [dx, dy, dz] = face.dir;
                    if (!faceVisible(id, world.getBlock(wx + dx, y + dy, wz + dz))) continue;

                    const { u0, v0, u1, v1 } = tileUV(block.tiles[face.tile]);
                    const ao = [0, 0, 0, 0];

                    for (let i = 0; i < 4; i++) {
                        const c = face.corners[i];
                        buf.positions.push(wx + c[0], y + c[1], wz + c[2]);

                        // sample the 4 cells touching this vertex outside the face
                        const s = cornerSamples(wx, y, wz, face, c);
                        let aoCount = 0,
                            skySum = 0,
                            torchSum = 0,
                            n = 0;
                        for (let k = 0; k < 4; k++) {
                            const [sx, sy, sz] = s[k];
                            if (k > 0 && isOpaque(world.getBlock(sx, sy, sz))) {
                                if (k < 3) aoCount++;
                                else if (aoCount < 2) aoCount++; // corner counts only if sides open
                                continue;
                            }
                            skySum += light.skyAt(sx, sy, sz);
                            torchSum += light.torchAt(sx, sy, sz);
                            n++;
                        }
                        const aoLevel =
                            aoCount >= 2 &&
                            isOpaque(world.getBlock(s[1][0], s[1][1], s[1][2])) &&
                            isOpaque(world.getBlock(s[2][0], s[2][1], s[2][2]))
                                ? 0
                                : 3 - aoCount;
                        ao[i] = aoLevel;
                        buf.colors.push(face.shade * AO_LEVELS[aoLevel]);
                        buf.sky.push(n > 0 ? skySum / (n * 15) : 0);
                        buf.torch.push(n > 0 ? torchSum / (n * 15) : 0);
                        const uv = face.uvs[i];
                        buf.uvs.push(uv[0] ? u1 : u0, uv[1] ? v1 : v0);
                    }

                    buf.quadIndices(ao[0] + ao[2] <= ao[1] + ao[3]);
                }
            }
        }
    }

    return { opaque: opaqueBuf.build(), trans: transBuf.build() };
}

// The 4 light/AO sample cells for a vertex: face cell, two edge neighbors, diagonal.
function cornerSamples(x, y, z, face, corner) {
    const [dx, dy, dz] = face.dir;
    let a, b;
    if (dx !== 0) {
        a = 1;
        b = 2;
    } else if (dy !== 0) {
        a = 0;
        b = 2;
    } else {
        a = 0;
        b = 1;
    }

    const p = [x + dx, y + dy, z + dz];
    const sa = corner[a] === 1 ? 1 : -1;
    const sb = corner[b] === 1 ? 1 : -1;

    const s1 = [...p];
    s1[a] += sa;
    const s2 = [...p];
    s2[b] += sb;
    const c = [...p];
    c[a] += sa;
    c[b] += sb;
    return [p, s1, s2, c];
}

// Two crossed quads (double-sided material handles the back faces).
function addCross(buf, block, x, y, z, light) {
    const { u0, v0, u1, v1 } = tileUV(block.tiles.side);
    const sky = light.skyAt(x, y, z) / 15;
    const torch = light.torchAt(x, y, z) / 15;
    const quads = [
        [
            [0.15, 0, 0.15],
            [0.85, 0, 0.85],
            [0.85, 1, 0.85],
            [0.15, 1, 0.15],
        ],
        [
            [0.15, 0, 0.85],
            [0.85, 0, 0.15],
            [0.85, 1, 0.15],
            [0.15, 1, 0.85],
        ],
    ];
    for (const q of quads) {
        const uvs = [
            [u0, v0],
            [u1, v0],
            [u1, v1],
            [u0, v1],
        ];
        for (let i = 0; i < 4; i++) {
            buf.positions.push(x + q[i][0], y + q[i][1], z + q[i][2]);
            buf.colors.push(1.0);
            buf.sky.push(sky);
            buf.torch.push(torch);
            buf.uvs.push(uvs[i][0], uvs[i][1]);
        }
        buf.quadIndices(false);
    }
}

// Thin door panel: a slab hugging one cell edge. facing = blocked wall when
// closed; open swings it 90° to a perpendicular edge.
const DOOR_OPEN_WALL = [2, 3, 0, 1]; // +z↔+x, -z↔-x when opened
function addDoor(buf, id, block, x, y, z, light) {
    const T = 0.18;
    const wall = doorOpen(id) ? DOOR_OPEN_WALL[doorFacing(id)] : doorFacing(id);
    let x0 = 0,
        x1 = 1,
        z0 = 0,
        z1 = 1;
    if (wall === 0) z0 = 1 - T; // +z
    else if (wall === 1) z1 = T; // -z
    else if (wall === 2) x0 = 1 - T; // +x
    else x1 = T; // -x

    const { u0, v0, u1, v1 } = tileUV(block.tiles.side);
    const sky = light.skyAt(x, y, z) / 15;
    const torch = light.torchAt(x, y, z) / 15;
    const min = [x + x0, y, z + z0];
    const max = [x + x1, y + 1, z + z1];
    for (const face of FACES) {
        for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            buf.positions.push(
                c[0] ? max[0] : min[0],
                c[1] ? max[1] : min[1],
                c[2] ? max[2] : min[2],
            );
            buf.colors.push(face.shade);
            buf.sky.push(sky);
            buf.torch.push(torch);
            const uv = face.uvs[i];
            buf.uvs.push(uv[0] ? u1 : u0, uv[1] ? v1 : v0);
        }
        buf.quadIndices(false);
    }
}

// Small standalone cube for item drops / held block, fully sky-lit.
export function buildBlockItemArrays(id, size = 0.25) {
    const block = BLOCKS[id];
    const buf = new GeoBuffer();
    const h = size / 2;

    if (block.render === 'cross') {
        const { u0, v0, u1, v1 } = tileUV(block.tiles.side);
        const uvs = [
            [u0, v0],
            [u1, v0],
            [u1, v1],
            [u0, v1],
        ];
        for (const q of [
            [
                [-h, -h, -h],
                [h, -h, h],
                [h, h, h],
                [-h, h, -h],
            ],
            [
                [-h, -h, h],
                [h, -h, -h],
                [h, h, -h],
                [-h, h, h],
            ],
        ]) {
            for (let i = 0; i < 4; i++) {
                buf.positions.push(q[i][0], q[i][1], q[i][2]);
                buf.colors.push(1.0);
                buf.sky.push(1.0);
                buf.torch.push(0.0);
                buf.uvs.push(uvs[i][0], uvs[i][1]);
            }
            buf.quadIndices(false);
        }
        return buf.build();
    }

    for (const face of FACES) {
        const { u0, v0, u1, v1 } = tileUV(block.tiles[face.tile]);
        for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            buf.positions.push(c[0] * size - h, c[1] * size - h, c[2] * size - h);
            buf.colors.push(face.shade);
            buf.sky.push(1.0);
            buf.torch.push(0.0);
            const uv = face.uvs[i];
            buf.uvs.push(uv[0] ? u1 : u0, uv[1] ? v1 : v0);
        }
        buf.quadIndices(false);
    }
    return buf.build();
}
