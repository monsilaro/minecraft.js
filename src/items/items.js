// Non-block items: materials, tools, food. Block items reuse their block id (< 100).

export const IT = {
    STICK: 100,
    COAL: 101,
    RAW_IRON: 102,
    IRON_INGOT: 103,
    RAW_GOLD: 104,
    GOLD_INGOT: 105,
    DIAMOND: 106,
    WOOD_PICK: 110,
    STONE_PICK: 111,
    IRON_PICK: 112,
    DIAMOND_PICK: 113,
    WOOD_SWORD: 120,
    STONE_SWORD: 121,
    IRON_SWORD: 122,
    DIAMOND_SWORD: 123,
    GOLD_PICK: 114,
    GOLD_SWORD: 125,
    GOLD_AXE: 164,
    WOOD_AXE: 160,
    STONE_AXE: 161,
    IRON_AXE: 162,
    DIAMOND_AXE: 163,
    WOOD_SHOVEL: 170,
    STONE_SHOVEL: 171,
    IRON_SHOVEL: 172,
    GOLD_SHOVEL: 173,
    DIAMOND_SHOVEL: 174,
    WOOD_HOE: 180,
    STONE_HOE: 181,
    IRON_HOE: 182,
    GOLD_HOE: 183,
    DIAMOND_HOE: 184,
    PORKCHOP: 130,
    COOKED_PORKCHOP: 131,
    FLESH: 132,
    APPLE: 133,
    BONE: 134,
    GUNPOWDER: 135,
    FIBER: 136,
    ARROW: 137,
    BOW: 124,
    IRON_HELMET: 140,
    IRON_CHEST: 141,
    IRON_LEGS: 142,
    IRON_BOOTS: 143,
    DIAMOND_HELMET: 150,
    DIAMOND_CHEST: 151,
    DIAMOND_LEGS: 152,
    DIAMOND_BOOTS: 153,
};

export const ITEMS = {
    [IT.STICK]: { name: 'Bâton' },
    [IT.COAL]: { name: 'Charbon' },
    [IT.RAW_IRON]: { name: 'Fer brut' },
    [IT.IRON_INGOT]: { name: 'Lingot de fer' },
    [IT.RAW_GOLD]: { name: 'Or brut' },
    [IT.GOLD_INGOT]: { name: "Lingot d'or" },
    [IT.DIAMOND]: { name: 'Cristal de mémoire' },

    [IT.WOOD_PICK]: { name: 'Pioche en bois', tool: 'pick', tier: 1, speed: 2, dur: 60, dmg: 2 },
    [IT.STONE_PICK]: {
        name: 'Pioche en pierre',
        tool: 'pick',
        tier: 2,
        speed: 4,
        dur: 132,
        dmg: 3,
    },
    [IT.IRON_PICK]: { name: 'Pioche en fer', tool: 'pick', tier: 3, speed: 6, dur: 251, dmg: 4 },
    [IT.DIAMOND_PICK]: {
        name: 'Pioche en cristal',
        tool: 'pick',
        tier: 4,
        speed: 8,
        dur: 1562,
        dmg: 5,
    },

    [IT.WOOD_SWORD]: { name: 'Épée en bois', tool: 'sword', speed: 1, dur: 60, dmg: 4 },
    [IT.STONE_SWORD]: { name: 'Épée en pierre', tool: 'sword', speed: 1, dur: 132, dmg: 5 },
    [IT.IRON_SWORD]: { name: 'Épée en fer', tool: 'sword', speed: 1, dur: 251, dmg: 6 },
    [IT.DIAMOND_SWORD]: { name: 'Épée en cristal', tool: 'sword', speed: 1, dur: 1562, dmg: 7 },

    [IT.WOOD_AXE]: { name: 'Hache en bois', tool: 'axe', tier: 1, speed: 2, dur: 60, dmg: 3 },
    [IT.STONE_AXE]: { name: 'Hache en pierre', tool: 'axe', tier: 2, speed: 4, dur: 132, dmg: 4 },
    [IT.IRON_AXE]: { name: 'Hache en fer', tool: 'axe', tier: 3, speed: 6, dur: 251, dmg: 5 },
    [IT.DIAMOND_AXE]: {
        name: 'Hache en cristal',
        tool: 'axe',
        tier: 4,
        speed: 8,
        dur: 1562,
        dmg: 6,
    },

    // gold: low tier, very fast, very fragile (like Minecraft)
    [IT.GOLD_PICK]: { name: 'Pioche en or', tool: 'pick', tier: 2, speed: 12, dur: 33, dmg: 2 },
    [IT.GOLD_SWORD]: { name: 'Épée en or', tool: 'sword', speed: 1, dur: 33, dmg: 4 },
    [IT.GOLD_AXE]: { name: 'Hache en or', tool: 'axe', tier: 2, speed: 12, dur: 33, dmg: 3 },

    // shovels: mirror the pick of their material (dmg = pick - 1)
    [IT.WOOD_SHOVEL]: { name: 'Pelle en bois', tool: 'shovel', tier: 1, speed: 2, dur: 60, dmg: 1 },
    [IT.STONE_SHOVEL]: {
        name: 'Pelle en pierre',
        tool: 'shovel',
        tier: 2,
        speed: 4,
        dur: 132,
        dmg: 2,
    },
    [IT.IRON_SHOVEL]: { name: 'Pelle en fer', tool: 'shovel', tier: 3, speed: 6, dur: 251, dmg: 3 },
    [IT.GOLD_SHOVEL]: { name: 'Pelle en or', tool: 'shovel', tier: 2, speed: 12, dur: 33, dmg: 1 },
    [IT.DIAMOND_SHOVEL]: {
        name: 'Pelle en cristal',
        tool: 'shovel',
        tier: 4,
        speed: 8,
        dur: 1562,
        dmg: 4,
    },

    // hoes: weak weapon, sword durability (no farming system yet)
    [IT.WOOD_HOE]: { name: 'Houe en bois', tool: 'hoe', speed: 1, dur: 60, dmg: 1 },
    [IT.STONE_HOE]: { name: 'Houe en pierre', tool: 'hoe', speed: 1, dur: 132, dmg: 1 },
    [IT.IRON_HOE]: { name: 'Houe en fer', tool: 'hoe', speed: 1, dur: 251, dmg: 1 },
    [IT.GOLD_HOE]: { name: 'Houe en or', tool: 'hoe', speed: 1, dur: 33, dmg: 1 },
    [IT.DIAMOND_HOE]: { name: 'Houe en cristal', tool: 'hoe', speed: 1, dur: 1562, dmg: 1 },

    [IT.PORKCHOP]: { name: 'Porc cru', food: 3 },
    [IT.COOKED_PORKCHOP]: { name: 'Porc cuit', food: 8 },
    [IT.FLESH]: { name: 'Chair putride', food: 4 },
    [IT.APPLE]: { name: 'Pomme', food: 4 },
    [IT.BONE]: { name: 'Os' },
    [IT.GUNPOWDER]: { name: 'Poudre à canon' },
    [IT.FIBER]: { name: 'Fibre végétale' },
    [IT.ARROW]: { name: 'Flèche' },
    [IT.BOW]: { name: 'Arc', bow: true, dur: 384 },

    // armor: points feed the damage reduction (4% per point), slot 0=head..3=feet
    [IT.IRON_HELMET]: { name: 'Casque en fer', armor: 2, slot: 0, dur: 165 },
    [IT.IRON_CHEST]: { name: 'Plastron en fer', armor: 6, slot: 1, dur: 240 },
    [IT.IRON_LEGS]: { name: 'Jambières en fer', armor: 5, slot: 2, dur: 225 },
    [IT.IRON_BOOTS]: { name: 'Bottes en fer', armor: 2, slot: 3, dur: 195 },
    [IT.DIAMOND_HELMET]: { name: 'Casque en cristal', armor: 3, slot: 0, dur: 363 },
    [IT.DIAMOND_CHEST]: { name: 'Plastron en cristal', armor: 8, slot: 1, dur: 528 },
    [IT.DIAMOND_LEGS]: { name: 'Jambières en cristal', armor: 6, slot: 2, dur: 495 },
    [IT.DIAMOND_BOOTS]: { name: 'Bottes en cristal', armor: 3, slot: 3, dur: 429 },
};

export function isTool(id) {
    const d = ITEMS[id];
    return !!(d && (d.tool || d.armor || d.bow));
}

export function isArmor(id) {
    const d = ITEMS[id];
    return !!(d && d.armor);
}

export function stackSize(id) {
    return isTool(id) ? 1 : 64;
}
