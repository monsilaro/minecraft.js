// localStorage savegame: world edits (diff vs generation), player vitals,
// inventory/armor, time of day. Auto-saves on an interval and on tab close.

const KEY = 'minecraft-ish-save';
const VERSION = 1;

export function hasSave() {
    return localStorage.getItem(KEY) !== null;
}

export function loadSave() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.v !== VERSION) return null;
        return data;
    } catch {
        return null;
    }
}

export function writeSave({ world, player, inv, timeOfDay }) {
    try {
        const data = {
            v: VERSION,
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
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.warn('save failed', e);
        return false;
    }
}

export function clearSave() {
    localStorage.removeItem(KEY);
}

export function applySave(data, { world, player, inv }) {
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
