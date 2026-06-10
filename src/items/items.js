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
    [IT.DIAMOND]: { name: 'Diamant' },

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
        name: 'Pioche en diamant',
        tool: 'pick',
        tier: 4,
        speed: 8,
        dur: 1562,
        dmg: 5,
    },

    [IT.WOOD_SWORD]: { name: 'Épée en bois', tool: 'sword', speed: 1, dur: 60, dmg: 4 },
    [IT.STONE_SWORD]: { name: 'Épée en pierre', tool: 'sword', speed: 1, dur: 132, dmg: 5 },
    [IT.IRON_SWORD]: { name: 'Épée en fer', tool: 'sword', speed: 1, dur: 251, dmg: 6 },
    [IT.DIAMOND_SWORD]: { name: 'Épée en diamant', tool: 'sword', speed: 1, dur: 1562, dmg: 7 },

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
    [IT.DIAMOND_HELMET]: { name: 'Casque en diamant', armor: 3, slot: 0, dur: 363 },
    [IT.DIAMOND_CHEST]: { name: 'Plastron en diamant', armor: 8, slot: 1, dur: 528 },
    [IT.DIAMOND_LEGS]: { name: 'Jambières en diamant', armor: 6, slot: 2, dur: 495 },
    [IT.DIAMOND_BOOTS]: { name: 'Bottes en diamant', armor: 3, slot: 3, dur: 429 },
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
