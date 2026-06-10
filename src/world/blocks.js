// Block registry: render data, physics flags, mining data (hardness/tool/tier),
// light emission and drop tables. Tile indices refer to the 8x8 atlas in textures.js.

import { IT } from '../items/items.js';

export const AIR = 0;
export const WATER = 5;
export const BEDROCK = 11;
export const TORCH = 17;
export const CRAFTING_TABLE = 21;
export const FURNACE = 22;

// render: 'cube' (default) | 'cross' (two diagonal quads, cutout)
export const BLOCKS = {
    0: { name: 'Air', solid: false, transparent: true },
    1: {
        name: 'Bloc de gazon',
        solid: true,
        transparent: false,
        hardness: 0.6,
        tiles: { top: 0, bottom: 2, side: 1 },
        drop: () => [{ id: 2, n: 1 }],
    },
    2: {
        name: 'Terre',
        solid: true,
        transparent: false,
        hardness: 0.5,
        tiles: { top: 2, bottom: 2, side: 2 },
    },
    3: {
        name: 'Pierre',
        solid: true,
        transparent: false,
        hardness: 1.5,
        tool: 'pick',
        tier: 1,
        tiles: { top: 3, bottom: 3, side: 3 },
        drop: () => [{ id: 9, n: 1 }],
    },
    4: {
        name: 'Sable',
        solid: true,
        transparent: false,
        hardness: 0.5,
        tiles: { top: 4, bottom: 4, side: 4 },
    },
    5: {
        name: 'Eau',
        solid: false,
        transparent: true,
        liquid: true,
        tiles: { top: 11, bottom: 11, side: 11 },
    },
    6: {
        name: 'Bûche de chêne',
        solid: true,
        transparent: false,
        hardness: 2,
        tiles: { top: 6, bottom: 6, side: 5 },
    },
    7: {
        name: 'Feuilles',
        solid: true,
        transparent: false,
        hardness: 0.2,
        tiles: { top: 7, bottom: 7, side: 7 },
        drop: (r) => (r() < 0.05 ? [{ id: IT.APPLE, n: 1 }] : []),
    },
    8: {
        name: 'Planches',
        solid: true,
        transparent: false,
        hardness: 2,
        tiles: { top: 8, bottom: 8, side: 8 },
    },
    9: {
        name: 'Pierres taillées',
        solid: true,
        transparent: false,
        hardness: 2,
        tool: 'pick',
        tier: 1,
        tiles: { top: 9, bottom: 9, side: 9 },
    },
    10: {
        name: 'Verre',
        solid: true,
        transparent: true,
        hardness: 0.3,
        tiles: { top: 10, bottom: 10, side: 10 },
        drop: () => [],
    },
    11: {
        name: 'Bedrock',
        solid: true,
        transparent: false,
        unbreakable: true,
        tiles: { top: 12, bottom: 12, side: 12 },
    },
    12: {
        name: 'Neige',
        solid: true,
        transparent: false,
        hardness: 0.2,
        tiles: { top: 13, bottom: 2, side: 14 },
    },
    13: {
        name: 'Minerai de charbon',
        solid: true,
        transparent: false,
        hardness: 3,
        tool: 'pick',
        tier: 1,
        tiles: { top: 15, bottom: 15, side: 15 },
        drop: () => [{ id: IT.COAL, n: 1 }],
    },
    14: {
        name: 'Minerai de fer',
        solid: true,
        transparent: false,
        hardness: 3,
        tool: 'pick',
        tier: 2,
        tiles: { top: 16, bottom: 16, side: 16 },
        drop: () => [{ id: IT.RAW_IRON, n: 1 }],
    },
    15: {
        name: "Minerai d'or",
        solid: true,
        transparent: false,
        hardness: 3,
        tool: 'pick',
        tier: 3,
        tiles: { top: 17, bottom: 17, side: 17 },
        drop: () => [{ id: IT.RAW_GOLD, n: 1 }],
    },
    16: {
        name: 'Minerai de diamant',
        solid: true,
        transparent: false,
        hardness: 3,
        tool: 'pick',
        tier: 3,
        tiles: { top: 18, bottom: 18, side: 18 },
        drop: () => [{ id: IT.DIAMOND, n: 1 }],
    },
    17: {
        name: 'Torche',
        solid: false,
        transparent: true,
        hardness: 0,
        render: 'cross',
        light: 14,
        tiles: { top: 19, bottom: 19, side: 19 },
    },
    18: {
        name: 'Coquelicot',
        solid: false,
        transparent: true,
        hardness: 0,
        render: 'cross',
        tiles: { top: 20, bottom: 20, side: 20 },
    },
    19: {
        name: 'Pissenlit',
        solid: false,
        transparent: true,
        hardness: 0,
        render: 'cross',
        tiles: { top: 21, bottom: 21, side: 21 },
    },
    20: {
        name: 'Herbes hautes',
        solid: false,
        transparent: true,
        hardness: 0,
        render: 'cross',
        tiles: { top: 22, bottom: 22, side: 22 },
        drop: () => [],
    },
    21: {
        name: 'Établi',
        solid: true,
        transparent: false,
        hardness: 2.5,
        tiles: { top: 23, bottom: 8, side: 24 },
    },
    22: {
        name: 'Fourneau',
        solid: true,
        transparent: false,
        hardness: 3.5,
        tool: 'pick',
        tier: 1,
        tiles: { top: 27, bottom: 27, side: 25 },
    },
    23: {
        name: 'TNT',
        solid: true,
        transparent: false,
        hardness: 0.3,
        tiles: { top: 29, bottom: 29, side: 28 },
    },
};

export const TNT = 23;

// Fast lookup tables (hot paths: lighting BFS, meshing, physics)
export const OPAQUE_LUT = new Uint8Array(64);
export const SOLID_LUT = new Uint8Array(64);
export const EMIT_LUT = new Uint8Array(64);
for (const [id, b] of Object.entries(BLOCKS)) {
    OPAQUE_LUT[id] = b.solid && !b.transparent ? 1 : 0;
    SOLID_LUT[id] = b.solid ? 1 : 0;
    EMIT_LUT[id] = b.light || 0;
}

export function isSolid(id) {
    return SOLID_LUT[id] === 1;
}
export function isOpaque(id) {
    return OPAQUE_LUT[id] === 1;
}

// Items dropped when a block is harvested (rng: () => [0,1))
export function blockDrops(id, rng) {
    const b = BLOCKS[id];
    if (!b) return [];
    if (b.drop) return b.drop(rng);
    return [{ id: Number(id), n: 1 }];
}
