// Smoke test: inventory stacking + crafting chain log -> planks -> sticks -> pick.
import { Inventory } from '../src/items/inventory.js';
import { RECIPES, canCraft, doCraft } from '../src/items/crafting.js';
import { IT } from '../src/items/items.js';

const inv = new Inventory();
const ctx = { nearTable: true, nearFurnace: false };
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

// craft chain: 2 logs -> planks -> sticks -> wood pick
inv.add(6, 2);
const rPlanks = RECIPES.find((r) => r.out.id === 8);
const rSticks = RECIPES.find((r) => r.out.id === IT.STICK);
const rPick = RECIPES.find((r) => r.out.id === IT.WOOD_PICK);

check('can craft planks', canCraft(inv, rPlanks, ctx), true);
doCraft(inv, rPlanks, ctx);
doCraft(inv, rPlanks, ctx);
check('planks count', inv.count(8), 8);
doCraft(inv, rSticks, ctx);
check('sticks count', inv.count(IT.STICK), 4);
check('can craft pick', canCraft(inv, rPick, ctx), true);
doCraft(inv, rPick, ctx);
check('pick crafted', inv.count(IT.WOOD_PICK), 1);
check('pick has durability', inv.slots.find((s) => s?.id === IT.WOOD_PICK).dur, 60);
check('planks consumed', inv.count(8), 3);

// table gating
const rFurnace = RECIPES.find((r) => r.out.id === 22);
inv.add(9, 8);
check(
    'furnace needs table',
    canCraft(inv, rFurnace, { nearTable: false, nearFurnace: false }),
    false,
);
check('furnace with table', canCraft(inv, rFurnace, ctx), true);

// tool wear
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
