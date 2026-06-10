// Chunked voxel world: terrain + ore + flora generation, block storage,
// chunk streaming, lighting-aware meshing, day/night-aware chunk shader.

import * as THREE from 'three';
import { fbm2, valueNoise3, hash2, mulberry32 } from '../core/noise.js';
import { AIR, WATER, BEDROCK, BLOCKS, blockDrops, isSolid } from './blocks.js';
import { buildChunkGeometry } from './mesher.js';
import { computeLightRegion } from './lighting.js';
import { CHUNK, HEIGHT, SEA } from './constants.js';

export { CHUNK, HEIGHT, SEA };

const MESH_RADIUS = 6;
const GEN_RADIUS = MESH_RADIUS + 1;
const GEN_BUDGET = 2;
const MESH_BUDGET = 2;
const SEED = 20260609;

// id, attempts per chunk, vein size, max y
const ORES = [
    { id: 13, tries: 16, size: 9, minY: 5, maxY: 60 }, // coal
    { id: 14, tries: 9, size: 7, minY: 5, maxY: 40 }, // iron
    { id: 15, tries: 3, size: 6, minY: 5, maxY: 22 }, // gold
    { id: 16, tries: 2, size: 5, minY: 5, maxY: 14 }, // diamond
];

function key(cx, cz) {
    return cx + ',' + cz;
}

const VERT = /* glsl */ `
  attribute float aColor;
  attribute float aSky;
  attribute float aTorch;
  varying vec2 vUv;
  varying float vColor;
  varying float vSky;
  varying float vTorch;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vColor = aColor;
    vSky = aSky;
    vTorch = aTorch;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uDay;
  uniform float uAlphaTest;
  uniform float uOpacity;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying float vColor;
  varying float vSky;
  varying float vTorch;
  varying float vFogDepth;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < uAlphaTest) discard;
    float light = max(vSky * uDay, vTorch * 1.05);
    light = max(light, 0.04);
    // torch light warms the color slightly
    vec3 tint = mix(vec3(1.0), vec3(1.0, 0.85, 0.6), clamp(vTorch - vSky * uDay, 0.0, 1.0) * 0.5);
    vec3 col = tex.rgb * vColor * light * tint;
    float fogF = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(col, uFogColor, fogF), tex.a * uOpacity);
  }
`;

export class World {
    constructor(scene, atlasTexture) {
        this.scene = scene;
        this.chunks = new Map();
        this.seed = SEED;
        // player-made block edits, by chunk key -> Map(blockIndex -> id).
        // Source of truth for the savegame; applied on top of generation.
        this.allEdits = new Map();

        // shared uniform objects: updating these updates every chunk material
        this.uniforms = {
            uDay: { value: 1.0 },
            uFogColor: { value: new THREE.Color(0x87ceeb) },
            uFogNear: { value: 60 },
            uFogFar: { value: 150 },
        };

        this.opaqueMaterial = this.makeMaterial(atlasTexture, {
            alphaTest: 0.5,
            opacity: 1,
            transparent: false,
        });
        this.transMaterial = this.makeMaterial(atlasTexture, {
            alphaTest: 0.01,
            opacity: 1,
            transparent: true,
        });
    }

    makeMaterial(map, { alphaTest, opacity, transparent }) {
        return new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uMap: { value: map },
                uAlphaTest: { value: alphaTest },
                uOpacity: { value: opacity },
                uDay: this.uniforms.uDay,
                uFogColor: this.uniforms.uFogColor,
                uFogNear: this.uniforms.uFogNear,
                uFogFar: this.uniforms.uFogFar,
            },
            transparent,
            side: THREE.DoubleSide,
        });
    }

    // ---- terrain shape ----

    surfaceHeight(x, z) {
        const e = fbm2(x * 0.012, z * 0.012, 4, this.seed);
        const m = fbm2(x * 0.004 + 100, z * 0.004 - 100, 3, this.seed + 7);
        let h = 18 + e * 26 + Math.max(0, m - 0.55) * 130;
        return Math.min(Math.floor(h), HEIGHT - 12);
    }

    treeAt(x, z) {
        if (hash2(x, z, this.seed + 777) >= 0.015) return false;
        const h = this.surfaceHeight(x, z);
        return h > SEA + 1 && h < 58;
    }

    // ---- storage ----

    getChunk(cx, cz) {
        return this.chunks.get(key(cx, cz));
    }

    getBlock(x, y, z) {
        if (y < 0) return BEDROCK;
        if (y >= HEIGHT) return AIR;
        const cx = Math.floor(x / CHUNK),
            cz = Math.floor(z / CHUNK);
        const c = this.chunks.get(key(cx, cz));
        if (!c) return AIR;
        return c.blocks[((x - cx * CHUNK) * CHUNK + (z - cz * CHUNK)) * HEIGHT + y];
    }

    setBlock(x, y, z, id) {
        if (!this.writeBlock(x, y, z, id)) return;
        const cx = Math.floor(x / CHUNK),
            cz = Math.floor(z / CHUNK);
        // light can reach ~14 blocks: remesh the 3x3 neighborhood
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const n = this.chunks.get(key(cx + dx, cz + dz));
                if (n) n.dirty = true;
            }
        }
    }

    // Write + record the edit, without marking chunks dirty (bulk callers batch that).
    writeBlock(x, y, z, id) {
        if (y < 0 || y >= HEIGHT) return false;
        const cx = Math.floor(x / CHUNK),
            cz = Math.floor(z / CHUNK);
        const k = key(cx, cz);
        const c = this.chunks.get(k);
        if (!c) return false;
        const idx = ((x - cx * CHUNK) * CHUNK + (z - cz * CHUNK)) * HEIGHT + y;
        c.blocks[idx] = id;
        let edits = this.allEdits.get(k);
        if (!edits) {
            edits = new Map();
            this.allEdits.set(k, edits);
        }
        edits.set(idx, id);
        return true;
    }

    // Destroy blocks in a sphere. Water and bedrock resist. Returns
    // { drops: [{x,y,z,id,n}], tnts: [{x,y,z}] } — destroyed TNT chains instead of dropping.
    explode(ex, ey, ez, radius) {
        const drops = [];
        const tnts = [];
        const dirtyKeys = new Set();
        const r = Math.ceil(radius);
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist > radius * (0.8 + Math.random() * 0.25)) continue;
                    const x = Math.floor(ex) + dx,
                        y = Math.floor(ey) + dy,
                        z = Math.floor(ez) + dz;
                    const id = this.getBlock(x, y, z);
                    if (id === AIR || id === WATER || BLOCKS[id]?.unbreakable) continue;
                    if (this.writeBlock(x, y, z, AIR)) {
                        const cx = Math.floor(x / CHUNK),
                            cz = Math.floor(z / CHUNK);
                        for (let nx = -1; nx <= 1; nx++) {
                            for (let nz = -1; nz <= 1; nz++) dirtyKeys.add(key(cx + nx, cz + nz));
                        }
                        if (id === 23) tnts.push({ x, y, z });
                        else if (Math.random() < 0.3) {
                            for (const d of blockDrops(id, Math.random))
                                drops.push({ x, y, z, ...d });
                        }
                    }
                }
            }
        }
        for (const k of dirtyKeys) {
            const c = this.chunks.get(k);
            if (c) c.dirty = true;
        }
        return { drops, tnts };
    }

    serializeEdits() {
        const out = {};
        for (const [k, edits] of this.allEdits) {
            if (edits.size > 0) out[k] = Array.from(edits.entries());
        }
        return out;
    }

    loadEdits(data) {
        if (!data) return;
        for (const [k, pairs] of Object.entries(data)) {
            this.allEdits.set(k, new Map(pairs));
        }
    }

    // ---- generation ----

    generateChunk(cx, cz) {
        const blocks = new Uint8Array(CHUNK * CHUNK * HEIGHT);
        const ox = cx * CHUNK,
            oz = cz * CHUNK;

        for (let lx = 0; lx < CHUNK; lx++) {
            for (let lz = 0; lz < CHUNK; lz++) {
                const wx = ox + lx,
                    wz = oz + lz;
                const h = this.surfaceHeight(wx, wz);
                const col = (lx * CHUNK + lz) * HEIGHT;

                for (let y = 0; y <= h; y++) {
                    let id;
                    if (y === 0) id = BEDROCK;
                    else if (y < h - 3) id = 3;
                    else if (y < h) id = h <= SEA + 2 ? 4 : 2;
                    else {
                        if (h <= SEA + 2) id = 4;
                        else if (h >= 72) id = 12;
                        else if (h >= 58) id = 3;
                        else id = 1;
                    }
                    if (
                        id !== BEDROCK &&
                        y > 4 &&
                        y < h - 3 &&
                        valueNoise3(wx * 0.09, y * 0.12, wz * 0.09, this.seed + 31) > 0.76
                    ) {
                        id = AIR;
                    }
                    blocks[col + y] = id;
                }

                for (let y = h + 1; y <= SEA; y++) blocks[col + y] = WATER;

                // flora on grass
                if (blocks[col + h] === 1 && h + 1 < HEIGHT) {
                    const r = hash2(wx, wz, this.seed + 555);
                    if (r < 0.05)
                        blocks[col + h + 1] = 20; // tall grass
                    else if (r < 0.058)
                        blocks[col + h + 1] = 18; // poppy
                    else if (r < 0.066) blocks[col + h + 1] = 19; // dandelion
                }
            }
        }

        const chunk = { cx, cz, blocks, dirty: false, meshes: null };
        this.chunks.set(key(cx, cz), chunk);
        this.stampOres(chunk);
        this.stampTrees(chunk);

        // replay saved player edits on top of generation
        const edits = this.allEdits.get(key(cx, cz));
        if (edits) {
            for (const [idx, id] of edits) blocks[idx] = id;
        }
        return chunk;
    }

    stampOres(chunk) {
        for (let o = 0; o < ORES.length; o++) {
            const ore = ORES[o];
            const rng = mulberry32(
                (hash2(chunk.cx, chunk.cz, this.seed + 4000 + o) * 0x7fffffff) | 0,
            );
            for (let t = 0; t < ore.tries; t++) {
                let x = Math.floor(rng() * CHUNK);
                let z = Math.floor(rng() * CHUNK);
                let y = ore.minY + Math.floor(rng() * (ore.maxY - ore.minY));
                for (let s = 0; s < ore.size; s++) {
                    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK && y > 0 && y < HEIGHT) {
                        const i = (x * CHUNK + z) * HEIGHT + y;
                        if (chunk.blocks[i] === 3) chunk.blocks[i] = ore.id;
                    }
                    const axis = Math.floor(rng() * 3);
                    const step = rng() < 0.5 ? 1 : -1;
                    if (axis === 0) x += step;
                    else if (axis === 1) y += step;
                    else z += step;
                }
            }
        }
    }

    stampTrees(chunk) {
        const ox = chunk.cx * CHUNK,
            oz = chunk.cz * CHUNK;
        const set = (wx, y, wz, id, onlyReplaceable) => {
            const lx = wx - ox,
                lz = wz - oz;
            if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= HEIGHT) return;
            const i = (lx * CHUNK + lz) * HEIGHT + y;
            const cur = chunk.blocks[i];
            if (onlyReplaceable && cur !== AIR && cur !== 20 && cur !== 18 && cur !== 19) return;
            chunk.blocks[i] = id;
        };

        for (let lx = -3; lx < CHUNK + 3; lx++) {
            for (let lz = -3; lz < CHUNK + 3; lz++) {
                const wx = ox + lx,
                    wz = oz + lz;
                if (!this.treeAt(wx, wz)) continue;
                const h = this.surfaceHeight(wx, wz);
                const trunk = 4 + Math.floor(hash2(wx, wz, this.seed + 99) * 2);

                for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
                    const r = dy < trunk ? 2 : 1;
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dz = -r; dz <= r; dz++) {
                            if (Math.abs(dx) === r && Math.abs(dz) === r && r === 2) continue;
                            set(wx + dx, h + 1 + dy, wz + dz, 7, true);
                        }
                    }
                }
                for (let dy = 1; dy <= trunk; dy++) set(wx, h + dy, wz, 6, false);
            }
        }
    }

    // ---- per-frame streaming ----

    update(px, pz) {
        const pcx = Math.floor(px / CHUNK),
            pcz = Math.floor(pz / CHUNK);

        let genLeft = GEN_BUDGET;
        outer: for (let r = 0; r <= GEN_RADIUS && genLeft > 0; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    if (!this.chunks.has(key(pcx + dx, pcz + dz))) {
                        this.generateChunk(pcx + dx, pcz + dz);
                        if (--genLeft <= 0) break outer;
                    }
                }
            }
        }

        let meshLeft = MESH_BUDGET;
        outer2: for (let r = 0; r <= MESH_RADIUS && meshLeft > 0; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    const c = this.chunks.get(key(pcx + dx, pcz + dz));
                    if (!c || (!c.dirty && c.meshes)) continue;
                    if (!this.neighborsReady(pcx + dx, pcz + dz)) continue;
                    this.meshChunk(c);
                    if (--meshLeft <= 0) break outer2;
                }
            }
        }

        for (const c of this.chunks.values()) {
            if (
                Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > MESH_RADIUS + 2 &&
                c.meshes
            ) {
                this.disposeMeshes(c);
            }
        }
    }

    neighborsReady(cx, cz) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (!this.chunks.has(key(cx + dx, cz + dz))) return false;
            }
        }
        return true;
    }

    meshChunk(chunk) {
        this.disposeMeshes(chunk);
        const light = computeLightRegion(this, chunk.cx, chunk.cz);
        const { opaque, trans } = buildChunkGeometry(this, chunk, light);
        const meshes = {};
        if (opaque) {
            meshes.opaque = new THREE.Mesh(opaque, this.opaqueMaterial);
            this.scene.add(meshes.opaque);
        }
        if (trans) {
            meshes.trans = new THREE.Mesh(trans, this.transMaterial);
            this.scene.add(meshes.trans);
        }
        chunk.meshes = meshes;
        chunk.dirty = false;
    }

    disposeMeshes(chunk) {
        if (!chunk.meshes) return;
        for (const m of Object.values(chunk.meshes)) {
            this.scene.remove(m);
            m.geometry.dispose();
        }
        chunk.meshes = null;
    }

    pregenerate(px, pz) {
        const pcx = Math.floor(px / CHUNK),
            pcz = Math.floor(pz / CHUNK);
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (!this.chunks.has(key(pcx + dx, pcz + dz)))
                    this.generateChunk(pcx + dx, pcz + dz);
            }
        }
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.meshChunk(this.chunks.get(key(pcx + dx, pcz + dz)));
            }
        }
    }

    countMeshedChunks() {
        let n = 0;
        for (const c of this.chunks.values()) if (c.meshes) n++;
        return n;
    }

    // top-most solid block y at column, for mob spawning
    topSolidY(x, z) {
        for (let y = HEIGHT - 1; y > 0; y--) {
            if (isSolid(this.getBlock(x, y, z))) return y;
        }
        return 0;
    }
}
