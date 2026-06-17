// Smoke test: inventory stacking + crafting chain log -> planks -> sticks -> pick.
import { Inventory } from '../src/items/inventory.js';
import { RECIPES, matchCraft, recipeMinGrid, smeltOf, recipePlacement } from '../src/items/crafting.js';
import { IT } from '../src/items/items.js';
import { DOOR, isDoor, doorId, doorFacing, doorOpen, doorTop } from '../src/world/blocks.js';

const inv = new Inventory();
let fail = 0;

function check(name, got, want) {
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`);
}

// stacking
inv.add(2, 70); // dirt, more than one stack
check('stack split 64', inv.slots[0].n, 64);
check('stack split rest', inv.slots[1].n, 6);
check('count', inv.count(2), 70);
inv.take(2, 70);
check('take all', inv.count(2), 0);

// shaped/shapeless grid matching
check('planks shapeless (2x2)', matchCraft([6, 0, 0, 0], 2)?.out.id, 8);
check('planks output count', matchCraft([0, 6, 0, 0], 2)?.out.n, 4);

const stick = matchCraft([8, 0, 8, 0], 2); // two planks stacked vertically
check('sticks shaped (2x2)', stick?.out.id, IT.STICK);
check('sticks use 2 cells', stick?.used.filter(Boolean).length, 2);
check('horizontal planks ≠ sticks', matchCraft([8, 8, 0, 0], 2), null);
check('empty grid no craft', matchCraft([0, 0, 0, 0], 2), null);

// pickaxe is a 3x3 recipe: cannot be made in the 2x2 hand grid
check('pick needs 3x3', recipeMinGrid(RECIPES.find((r) => r.out.id === IT.WOOD_PICK)), 3);
check('pick not in 2x2', matchCraft([8, 8, 0, 8], 2), null);
const S = IT.STICK;
const pick = matchCraft([8, 8, 8, 0, S, 0, 0, S, 0], 3);
check('pick in 3x3', pick?.out.id, IT.WOOD_PICK);
check('pick uses 5 cells', pick?.used.filter(Boolean).length, 5);

// axe: 3x3 shaped recipe (XX / XS / _S), planks + sticks
check('axe needs 3x3', recipeMinGrid(RECIPES.find((r) => r.out.id === IT.WOOD_AXE)), 3);
const axe = matchCraft([8, 8, 0, 8, S, 0, 0, S, 0], 3);
check('axe in 3x3', axe?.out.id, IT.WOOD_AXE);

// door: state id round-trip + recipe (6 planks -> 3 doors, 3x3)
const dId = doorId(2, true, true);
check('door id facing', doorFacing(dId), 2);
check('door id open', doorOpen(dId), true);
check('door id top', doorTop(dId), true);
check('isDoor true', isDoor(DOOR), true);
check('isDoor false', isDoor(8), false);
const door = matchCraft([8, 8, 0, 8, 8, 0, 8, 8, 0], 3);
check('door recipe out', door?.out.id, DOOR);
check('door recipe count', door?.out.n, 3);

// recipe book placement
check('placement planks at cell 0', recipePlacement(RECIPES.find((r) => r.out.id === 8), 2).get(0), 6);

// smelting
check('smelt raw iron -> ingot', smeltOf(IT.RAW_IRON)?.out.id, IT.IRON_INGOT);
check('smelt non-smeltable', smeltOf(IT.STICK), null);

// keep cobble around for the serialize round-trip below
inv.add(9, 8);

// tool wear
inv.add(IT.WOOD_PICK, 1);
inv.selected = inv.slots.findIndex((s) => s?.id === IT.WOOD_PICK);
for (let i = 0; i < 59; i++) inv.wearSelected();
check('tool not broken at 1', inv.currentItem()?.id, IT.WOOD_PICK);
check('tool breaks at 0', inv.wearSelected(), true);
check('slot emptied', inv.currentItem(), null);

// armor
inv.add(IT.IRON_CHEST, 1);
const chestSlot = inv.slots.findIndex((s) => s?.id === IT.IRON_CHEST);
const prev = inv.equip(inv.slots[chestSlot]);
inv.slots[chestSlot] = null;
check('equip returns nothing worn', prev, null);
check('armor points (iron chest)', inv.armorPoints(), 6);
inv.add(IT.IRON_BOOTS, 1);
inv.equip(inv.slots.find((s) => s?.id === IT.IRON_BOOTS));
check('armor points (chest+boots)', inv.armorPoints(), 8);
inv.damageArmor();
check('armor wears', inv.armor[1].dur, 239);
inv.armor[3].dur = 1;
inv.damageArmor();
check('armor breaks at 0', inv.armor[3], null);
check('points after break', inv.armorPoints(), 6);

// serialize round-trip
const data = JSON.parse(JSON.stringify(inv.serialize()));
const inv2 = new Inventory();
inv2.load(data);
check('serialize keeps armor', inv2.armorPoints(), 6);
check('serialize keeps slots', inv2.count(9), inv.count(9));

// armor goes into death drops
const dumped = inv2.dumpAll();
check(
    'dump includes armor',
    dumped.some((s) => s.id === IT.IRON_CHEST),
    true,
);
check('armor cleared after dump', inv2.armorPoints(), 0);

process.exit(fail ? 1 : 0);
