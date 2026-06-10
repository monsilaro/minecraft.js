// Recipe list (Minecraft-style recipe book). Some recipes need to be near a
// placed crafting table; smelting needs to be near a placed furnace.

import { IT } from './items.js';

export const RECIPES = [
    { out: { id: 8, n: 4 }, ins: [{ id: 6, n: 1 }] }, // log -> planks
    { out: { id: IT.STICK, n: 4 }, ins: [{ id: 8, n: 2 }] }, // planks -> sticks
    {
        out: { id: 17, n: 4 },
        ins: [
            { id: IT.COAL, n: 1 },
            { id: IT.STICK, n: 1 },
        ],
    }, // torches
    { out: { id: 21, n: 1 }, ins: [{ id: 8, n: 4 }] }, // crafting table
    { out: { id: 22, n: 1 }, ins: [{ id: 9, n: 8 }], table: true }, // furnace

    {
        out: { id: IT.WOOD_PICK, n: 1 },
        ins: [
            { id: 8, n: 3 },
            { id: IT.STICK, n: 2 },
        ],
        table: true,
    },
    {
        out: { id: IT.STONE_PICK, n: 1 },
        ins: [
            { id: 9, n: 3 },
            { id: IT.STICK, n: 2 },
        ],
        table: true,
    },
    {
        out: { id: IT.IRON_PICK, n: 1 },
        ins: [
            { id: IT.IRON_INGOT, n: 3 },
            { id: IT.STICK, n: 2 },
        ],
        table: true,
    },
    {
        out: { id: IT.DIAMOND_PICK, n: 1 },
        ins: [
            { id: IT.DIAMOND, n: 3 },
            { id: IT.STICK, n: 2 },
        ],
        table: true,
    },

    {
        out: { id: IT.WOOD_SWORD, n: 1 },
        ins: [
            { id: 8, n: 2 },
            { id: IT.STICK, n: 1 },
        ],
        table: true,
    },
    {
        out: { id: IT.STONE_SWORD, n: 1 },
        ins: [
            { id: 9, n: 2 },
            { id: IT.STICK, n: 1 },
        ],
        table: true,
    },
    {
        out: { id: IT.IRON_SWORD, n: 1 },
        ins: [
            { id: IT.IRON_INGOT, n: 2 },
            { id: IT.STICK, n: 1 },
        ],
        table: true,
    },
    {
        out: { id: IT.DIAMOND_SWORD, n: 1 },
        ins: [
            { id: IT.DIAMOND, n: 2 },
            { id: IT.STICK, n: 1 },
        ],
        table: true,
    },

    {
        out: { id: IT.IRON_INGOT, n: 1 },
        ins: [
            { id: IT.RAW_IRON, n: 1 },
            { id: IT.COAL, n: 1 },
        ],
        furnace: true,
    },
    {
        out: { id: IT.GOLD_INGOT, n: 1 },
        ins: [
            { id: IT.RAW_GOLD, n: 1 },
            { id: IT.COAL, n: 1 },
        ],
        furnace: true,
    },
    {
        out: { id: IT.COOKED_PORKCHOP, n: 1 },
        ins: [
            { id: IT.PORKCHOP, n: 1 },
            { id: IT.COAL, n: 1 },
        ],
        furnace: true,
    },

    {
        out: { id: 10, n: 1 },
        ins: [
            { id: 4, n: 1 },
            { id: IT.COAL, n: 1 },
        ],
        furnace: true,
    }, // glass

    { out: { id: IT.IRON_HELMET, n: 1 }, ins: [{ id: IT.IRON_INGOT, n: 5 }], table: true },
    { out: { id: IT.IRON_CHEST, n: 1 }, ins: [{ id: IT.IRON_INGOT, n: 8 }], table: true },
    { out: { id: IT.IRON_LEGS, n: 1 }, ins: [{ id: IT.IRON_INGOT, n: 7 }], table: true },
    { out: { id: IT.IRON_BOOTS, n: 1 }, ins: [{ id: IT.IRON_INGOT, n: 4 }], table: true },
    { out: { id: IT.DIAMOND_HELMET, n: 1 }, ins: [{ id: IT.DIAMOND, n: 5 }], table: true },
    { out: { id: IT.DIAMOND_CHEST, n: 1 }, ins: [{ id: IT.DIAMOND, n: 8 }], table: true },
    { out: { id: IT.DIAMOND_LEGS, n: 1 }, ins: [{ id: IT.DIAMOND, n: 7 }], table: true },
    { out: { id: IT.DIAMOND_BOOTS, n: 1 }, ins: [{ id: IT.DIAMOND, n: 4 }], table: true },

    {
        out: { id: 23, n: 1 },
        ins: [
            { id: IT.GUNPOWDER, n: 5 },
            { id: 4, n: 4 },
        ],
        table: true,
    }, // TNT
];

// ctx: { nearTable, nearFurnace }
export function canCraft(inv, recipe, ctx) {
    if (recipe.table && !ctx.nearTable) return false;
    if (recipe.furnace && !ctx.nearFurnace) return false;
    return recipe.ins.every((ing) => inv.count(ing.id) >= ing.n);
}

export function doCraft(inv, recipe, ctx) {
    if (!canCraft(inv, recipe, ctx)) return false;
    for (const ing of recipe.ins) inv.take(ing.id, ing.n);
    inv.add(recipe.out.id, recipe.out.n);
    return true;
}
