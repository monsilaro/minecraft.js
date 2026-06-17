// localStorage savegame, 3 independent slots. Each slot stores its own world
// seed (so maps differ), world edits (diff vs generation), player vitals,
// inventory/armor, time of day. Auto-saves on an interval and on tab close.

const PREFIX = 'minecraft-ish-save';
const VERSION = 2;
export const SLOTS = 3;
const LEGACY_SEED = 20260609; // the old hardcoded world seed

function slotKey(i) {
    return `${PREFIX}-${i}`;
}

export function randomSeed() {
    return (Math.random() * 0x7fffffff) | 0;
}

// One-time migration: the old single-key save becomes slot 0.
function migrateLegacy() {
    const legacy = localStorage.getItem(PREFIX);
    if (!legacy) return;
    try {
        if (!localStorage.getItem(slotKey(0))) {
            const data = JSON.parse(legacy);
            data.v = VERSION;
            if (data.seed === undefined) data.seed = LEGACY_SEED;
            if (data.savedAt === undefined) data.savedAt = 0;
            localStorage.setItem(slotKey(0), JSON.stringify(data));
        }
    } catch {
        /* ignore corrupt legacy save */
    }
    localStorage.removeItem(PREFIX);
}

// Summary of all slots, for the world-select screen.
export function listSlots() {
    migrateLegacy();
    const out = [];
    for (let i = 0; i < SLOTS; i++) {
        const raw = localStorage.getItem(slotKey(i));
        if (!raw) {
            out.push({ index: i, exists: false });
            continue;
        }
        try {
            const d = JSON.parse(raw);
            out.push({
                index: i,
                exists: true,
                savedAt: d.savedAt || 0,
                seed: d.seed,
                hp: d.player?.hp,
            });
        } catch {
            out.push({ index: i, exists: false });
        }
    }
    return out;
}

export function loadSlot(i) {
    try {
        const raw = localStorage.getItem(slotKey(i));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.v !== VERSION) return null;
        return data;
    } catch {
        return null;
    }
}

export function writeSlot(i, { world, player, inv, timeOfDay }) {
    try {
        const data = {
            v: VERSION,
            savedAt: Date.now(),
            seed: world.seed,
            time: timeOfDay,
            player: {
                pos: [player.pos.x, player.pos.y, player.pos.z],
                yaw: player.yaw,
                pitch: player.pitch,
                hp: player.hp,
                hunger: player.hunger,
                air: player.air,
                spawn: [player.spawnPoint.x, player.spawnPoint.y, player.spawnPoint.z],
            },
            inv: inv.serialize(),
            edits: world.serializeEdits(),
        };
        localStorage.setItem(slotKey(i), JSON.stringify(data));
        return true;
    } catch (e) {
        console.warn('save failed', e);
        return false;
    }
}

export function clearSlot(i) {
    localStorage.removeItem(slotKey(i));
}

export function applySave(data, { world, player, inv }) {
    if (data.seed !== undefined) world.seed = data.seed;
    world.loadEdits(data.edits);
    inv.load(data.inv);
    const p = data.player;
    if (p) {
        player.pos.set(p.pos[0], p.pos[1], p.pos[2]);
        player.yaw = p.yaw || 0;
        player.pitch = p.pitch || 0;
        player.hp = p.hp ?? 20;
        player.hunger = p.hunger ?? 20;
        player.air = p.air ?? 10;
        if (p.spawn) player.spawnPoint.set(p.spawn[0], p.spawn[1], p.spawn[2]);
    }
    return data.time ?? 0.05;
}
