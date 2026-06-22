// Inventory data: 36 slots (0-8 = hotbar). Slot = { id, n, dur? } | null.

import { BLOCKS } from '../world/blocks.js';
import { ITEMS, stackSize } from './items.js';

export function defOf(id) {
    if (id < 100) return BLOCKS[id];
    return ITEMS[id];
}

export function nameOf(id) {
    const d = defOf(id);
    return d ? d.name : '?';
}

export class Inventory {
    constructor() {
        this.slots = new Array(36).fill(null);
        this.armor = new Array(4).fill(null); // 0 head, 1 chest, 2 legs, 3 feet
        this.selected = 0;
        this.onChange = null;
    }

    armorPoints() {
        let pts = 0;
        for (const p of this.armor) {
            if (p) pts += defOf(p.id)?.armor || 0;
        }
        return pts;
    }

    // Wear every equipped piece by 1 when taking a hit; pieces break at 0.
    damageArmor() {
        for (let i = 0; i < 4; i++) {
            const p = this.armor[i];
            if (!p) continue;
            p.dur--;
            if (p.dur <= 0) this.armor[i] = null;
        }
        this.changed();
    }

    // Equip an armor stack into its slot; returns the previously equipped piece.
    equip(stack) {
        const slot = defOf(stack.id)?.slot;
        if (slot === undefined) return stack;
        const prev = this.armor[slot];
        this.armor[slot] = stack;
        this.changed();
        return prev;
    }

    serialize() {
        return { slots: this.slots, armor: this.armor, selected: this.selected };
    }

    load(data) {
        if (!data) return;
        if (Array.isArray(data.slots)) {
            for (let i = 0; i < 36; i++) this.slots[i] = data.slots[i] || null;
        }
        if (Array.isArray(data.armor)) {
            for (let i = 0; i < 4; i++) this.armor[i] = data.armor[i] || null;
        }
        if (typeof data.selected === 'number') this.selected = data.selected;
        this.changed();
    }

    changed() {
        if (this.onChange) this.onChange();
    }

    currentItem() {
        return this.slots[this.selected];
    }

    // Add items, filling existing stacks first, then empty slots (hotbar first).
    // Returns the count that did not fit.
    add(id, n, dur) {
        const max = stackSize(id);
        if (max > 1) {
            for (let i = 0; i < 36 && n > 0; i++) {
                const s = this.slots[i];
                if (s && s.id === id && s.n < max) {
                    const take = Math.min(max - s.n, n);
                    s.n += take;
                    n -= take;
                }
            }
        }
        for (let i = 0; i < 36 && n > 0; i++) {
            if (!this.slots[i]) {
                const take = Math.min(max, n);
                this.slots[i] = { id, n: take };
                if (dur !== undefined) this.slots[i].dur = dur;
                else if (defOf(id)?.dur) this.slots[i].dur = defOf(id).dur;
                n -= take;
            }
        }
        this.changed();
        return n;
    }

    count(id) {
        let n = 0;
        for (const s of this.slots) if (s && s.id === id) n += s.n;
        return n;
    }

    take(id, n) {
        for (let i = 35; i >= 0 && n > 0; i--) {
            const s = this.slots[i];
            if (s && s.id === id) {
                const t = Math.min(s.n, n);
                s.n -= t;
                n -= t;
                if (s.n <= 0) this.slots[i] = null;
            }
        }
        this.changed();
    }

    consumeSelected(n = 1) {
        const s = this.slots[this.selected];
        if (!s) return;
        s.n -= n;
        if (s.n <= 0) this.slots[this.selected] = null;
        this.changed();
    }

    // Wear the selected tool by 1; destroys it at 0. Returns true if it broke.
    wearSelected() {
        const s = this.slots[this.selected];
        if (!s || s.dur === undefined) return false;
        s.dur--;
        if (s.dur <= 0) {
            this.slots[this.selected] = null;
            this.changed();
            return true;
        }
        this.changed();
        return false;
    }

    // Everything currently held (including worn armor), for death drops; clears all.
    dumpAll() {
        const out = [];
        for (let i = 0; i < 36; i++) {
            if (this.slots[i]) out.push(this.slots[i]);
            this.slots[i] = null;
        }
        for (let i = 0; i < 4; i++) {
            if (this.armor[i]) out.push(this.armor[i]);
            this.armor[i] = null;
        }
        this.changed();
        return out;
    }
}
