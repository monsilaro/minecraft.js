// Minecraft-style grid crafting. Recipes are either SHAPED (a pattern of cells
// that must be matched, position-relative within its bounding box) or SHAPELESS
// (a multiset of items in any arrangement). Crafting happens in a 2x2 grid (hand,
// in the inventory) or 3x3 grid (at a crafting table). Smelting is separate.
//
// Limitation: shaped matching is exact (no horizontal mirror). Place recipes as
// shown.

import { IT } from './items.js';
import { DOOR } from '../world/blocks.js';

// material tiers for tools/armor, reused across recipes
const PLANK = 8,
    COBBLE = 9,
    IRON = IT.IRON_INGOT,
    GOLD = IT.GOLD_INGOT,
    DIAMOND = IT.DIAMOND;

function pick(mat, out) {
    return { shape: ['XXX', ' S ', ' S '], key: { X: mat, S: IT.STICK }, out: { id: out, n: 1 } };
}
function sword(mat, out) {
    return { shape: ['X', 'X', 'S'], key: { X: mat, S: IT.STICK }, out: { id: out, n: 1 } };
}
function axe(mat, out) {
    return { shape: ['XX', 'XS', ' S'], key: { X: mat, S: IT.STICK }, out: { id: out, n: 1 } };
}
function shovel(mat, out) {
    return { shape: ['X', 'S', 'S'], key: { X: mat, S: IT.STICK }, out: { id: out, n: 1 } };
}
function hoe(mat, out) {
    return { shape: ['XX', ' S', ' S'], key: { X: mat, S: IT.STICK }, out: { id: out, n: 1 } };
}
function helmet(mat, out) {
    return { shape: ['XXX', 'X X'], key: { X: mat }, out: { id: out, n: 1 } };
}
function chest(mat, out) {
    return { shape: ['X X', 'XXX', 'XXX'], key: { X: mat }, out: { id: out, n: 1 } };
}
function legs(mat, out) {
    return { shape: ['XXX', 'X X', 'X X'], key: { X: mat }, out: { id: out, n: 1 } };
}
function boots(mat, out) {
    return { shape: ['X X', 'X X'], key: { X: mat }, out: { id: out, n: 1 } };
}

export const RECIPES = [
    // --- basics (fit in 2x2, craftable by hand) ---
    { shapeless: [6], out: { id: PLANK, n: 4 } }, // log -> planks
    { shape: ['X', 'X'], key: { X: PLANK }, out: { id: IT.STICK, n: 4 } }, // planks -> sticks
    { shape: ['C', 'S'], key: { C: IT.COAL, S: IT.STICK }, out: { id: 17, n: 4 } }, // torches
    { shape: ['XX', 'XX'], key: { X: PLANK }, out: { id: 21, n: 1 } }, // crafting table

    // --- 3x3 structures ---
    { shape: ['XXX', 'X X', 'XXX'], key: { X: COBBLE }, out: { id: 22, n: 1 } }, // furnace
    { shape: ['FFF', 'PPP'], key: { F: IT.FIBER, P: PLANK }, out: { id: 24, n: 1 } }, // bed
    { shape: ['XX', 'XX', 'XX'], key: { X: PLANK }, out: { id: DOOR, n: 3 } }, // door
    { shape: [' XS', 'X S', ' XS'], key: { X: IT.STICK, S: IT.FIBER }, out: { id: IT.BOW, n: 1 } },
    {
        shape: ['C', 'S', 'F'],
        key: { C: IT.COAL, S: IT.STICK, F: IT.FIBER },
        out: { id: IT.ARROW, n: 4 },
    },

    // --- tools ---
    pick(PLANK, IT.WOOD_PICK),
    pick(COBBLE, IT.STONE_PICK),
    pick(IRON, IT.IRON_PICK),
    pick(DIAMOND, IT.DIAMOND_PICK),
    sword(PLANK, IT.WOOD_SWORD),
    sword(COBBLE, IT.STONE_SWORD),
    sword(IRON, IT.IRON_SWORD),
    sword(DIAMOND, IT.DIAMOND_SWORD),
    axe(PLANK, IT.WOOD_AXE),
    axe(COBBLE, IT.STONE_AXE),
    axe(IRON, IT.IRON_AXE),
    axe(DIAMOND, IT.DIAMOND_AXE),
    pick(GOLD, IT.GOLD_PICK),
    sword(GOLD, IT.GOLD_SWORD),
    axe(GOLD, IT.GOLD_AXE),
    shovel(PLANK, IT.WOOD_SHOVEL),
    shovel(COBBLE, IT.STONE_SHOVEL),
    shovel(IRON, IT.IRON_SHOVEL),
    shovel(GOLD, IT.GOLD_SHOVEL),
    shovel(DIAMOND, IT.DIAMOND_SHOVEL),
    hoe(PLANK, IT.WOOD_HOE),
    hoe(COBBLE, IT.STONE_HOE),
    hoe(IRON, IT.IRON_HOE),
    hoe(GOLD, IT.GOLD_HOE),
    hoe(DIAMOND, IT.DIAMOND_HOE),

    // --- armor ---
    helmet(IRON, IT.IRON_HELMET),
    chest(IRON, IT.IRON_CHEST),
    legs(IRON, IT.IRON_LEGS),
    boots(IRON, IT.IRON_BOOTS),
    helmet(DIAMOND, IT.DIAMOND_HELMET),
    chest(DIAMOND, IT.DIAMOND_CHEST),
    legs(DIAMOND, IT.DIAMOND_LEGS),
    boots(DIAMOND, IT.DIAMOND_BOOTS),

    // TNT: gunpowder + sand checker
    { shape: ['GSG', 'SGS', 'GSG'], key: { G: IT.GUNPOWDER, S: 4 }, out: { id: 23, n: 1 } },
];

// Smelting: input id -> output. Fuel is always coal.
export const SMELT_FUEL = IT.COAL;
export const SMELT_RECIPES = [
    { in: IT.RAW_IRON, out: { id: IT.IRON_INGOT, n: 1 } },
    { in: IT.RAW_GOLD, out: { id: IT.GOLD_INGOT, n: 1 } },
    { in: IT.PORKCHOP, out: { id: IT.COOKED_PORKCHOP, n: 1 } },
    { in: 4, out: { id: 10, n: 1 } }, // sand -> glass
];

export function smeltOf(id) {
    return SMELT_RECIPES.find((r) => r.in === id) || null;
}

// --- shaped pattern helpers ---

// Expand a recipe's shape into a {w, h, rows: id[][]} bounding box (0 = empty).
function shapeBox(recipe) {
    if (recipe._box) return recipe._box;
    const rows = recipe.shape.map((row) => [...row].map((ch) => (ch === ' ' ? 0 : recipe.key[ch])));
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const grid = rows.map((r) => {
        const out = r.slice();
        while (out.length < w) out.push(0);
        return out;
    });
    recipe._box = { w, h, rows: grid };
    return recipe._box;
}

export function recipeMinGrid(recipe) {
    if (recipe.shapeless) return recipe.shapeless.length <= 4 ? 2 : 3;
    const { w, h } = shapeBox(recipe);
    return w <= 2 && h <= 2 ? 2 : 3;
}

// Trimmed bounding box of the non-empty cells in a size*size grid of ids.
function trimGrid(cells, size) {
    let minR = size,
        maxR = -1,
        minC = size,
        maxC = -1;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (cells[r * size + c]) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }
    if (maxR < 0) return null; // empty grid
    return { minR, maxR, minC, maxC, w: maxC - minC + 1, h: maxR - minR + 1 };
}

function matchShaped(recipe, cells, size, box) {
    const sb = shapeBox(recipe);
    if (sb.w !== box.w || sb.h !== box.h) return null;
    const used = new Array(size * size).fill(false);
    for (let r = 0; r < box.h; r++) {
        for (let c = 0; c < box.w; c++) {
            const want = sb.rows[r][c];
            const idx = (box.minR + r) * size + (box.minC + c);
            const have = cells[idx];
            if (want === 0) {
                if (have !== 0) return null; // extra item where pattern is empty
            } else {
                if (have !== want) return null;
                used[idx] = true;
            }
        }
    }
    return used;
}

function matchShapeless(recipe, cells, size) {
    const want = recipe.shapeless.slice();
    const used = new Array(size * size).fill(false);
    const filled = [];
    for (let i = 0; i < cells.length; i++) if (cells[i]) filled.push(i);
    if (filled.length !== want.length) return null;
    for (const idx of filled) {
        const k = want.indexOf(cells[idx]);
        if (k < 0) return null;
        want.splice(k, 1);
        used[idx] = true;
    }
    return want.length === 0 ? used : null;
}

// cells: id[] of length size*size (0 = empty). Returns { out, used } or null.
export function matchCraft(cells, size) {
    const box = trimGrid(cells, size);
    if (!box) return null;
    for (const recipe of RECIPES) {
        if (recipeMinGrid(recipe) > size) continue;
        const used = recipe.shapeless
            ? matchShapeless(recipe, cells, size)
            : matchShaped(recipe, cells, size, box);
        if (used) return { out: { ...recipe.out }, used };
    }
    return null;
}

// For the recipe book: which cell index gets which id, for a given grid size.
// Returns Map(cellIndex -> id) placing the recipe top-left, or null if it
// doesn't fit this grid size.
export function recipePlacement(recipe, size) {
    if (recipeMinGrid(recipe) > size) return null;
    const map = new Map();
    if (recipe.shapeless) {
        recipe.shapeless.forEach((id, i) => {
            const r = Math.floor(i / size),
                c = i % size;
            map.set(r * size + c, id);
        });
        return map;
    }
    const sb = shapeBox(recipe);
    for (let r = 0; r < sb.h; r++) {
        for (let c = 0; c < sb.w; c++) {
            if (sb.rows[r][c]) map.set(r * size + c, sb.rows[r][c]);
        }
    }
    return map;
}

// Distinct ingredient counts a recipe needs (for "can I auto-fill?" checks).
export function recipeNeeds(recipe) {
    const need = new Map();
    const ids = recipe.shapeless
        ? recipe.shapeless
        : [...recipe.shape.join('')].filter((ch) => ch !== ' ').map((ch) => recipe.key[ch]);
    for (const id of ids) need.set(id, (need.get(id) || 0) + 1);
    return need;
}
