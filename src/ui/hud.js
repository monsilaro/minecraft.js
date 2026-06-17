// All DOM UI: stats bar (hearts/hunger/bubbles), hotbar, inventory panel with
// recipe book, damage vignette, death screen, block name label.

import { getItemIcon } from '../render/textures.js';
import { defOf, nameOf } from '../items/inventory.js';
import {
    RECIPES,
    matchCraft,
    recipeMinGrid,
    recipePlacement,
    recipeNeeds,
    smeltOf,
    SMELT_FUEL,
} from '../items/crafting.js';
import { isArmor, stackSize } from '../items/items.js';
import { S } from '../audio/sounds.js';

const HOTBAR_SIZE = 9;
const SMELT_TIME = 3; // seconds to smelt one item

// Add the icon/count/durability children to a .slot element.
function decorateSlot(slot) {
    const img = document.createElement('canvas');
    img.width = img.height = 16;
    img.className = 'icon';
    slot.appendChild(img);
    const count = document.createElement('span');
    count.className = 'count';
    slot.appendChild(count);
    const dur = document.createElement('div');
    dur.className = 'dur';
    slot.appendChild(dur);
    return slot;
}

function makeSlotEl(showNum, i) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (showNum) {
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);
        slot.appendChild(num);
    }
    return decorateSlot(slot);
}

function renderSlot(el, stack) {
    const ctx = el.querySelector('.icon').getContext('2d');
    ctx.clearRect(0, 0, 16, 16);
    const countEl = el.querySelector('.count');
    const durEl = el.querySelector('.dur');
    if (!stack) {
        countEl.textContent = '';
        durEl.style.display = 'none';
        el.title = '';
        return;
    }
    ctx.drawImage(getItemIcon(stack.id), 0, 0);
    countEl.textContent = stack.n > 1 ? String(stack.n) : '';
    el.title = nameOf(stack.id);
    const def = defOf(stack.id);
    if (stack.dur !== undefined && def?.dur) {
        const f = stack.dur / def.dur;
        durEl.style.display = f < 1 ? 'block' : 'none';
        durEl.style.width = `${Math.max(4, f * 100)}%`;
        durEl.style.background = f > 0.5 ? '#5dd35d' : f > 0.2 ? '#ddc94a' : '#d35d5d';
    } else {
        durEl.style.display = 'none';
    }
}

export class UI {
    constructor(inv) {
        this.inv = inv;
        this.cursorStack = null;
        this.inventoryOpen = false;
        this.onInventoryToggle = null;

        // crafting: a 2x2 (hand) or 3x3 (table) grid + computed output
        this.mode = 'hand'; // 'hand' | 'table' | 'furnace'
        this.craftSize = 0;
        this.craftGrid = [];
        this.craftCells = []; // DOM slot elements
        this.craftOut = null; // computed { id, n } or null
        this.craftUsed = []; // bool per grid cell, for consuming on take
        // furnace: input + fuel -> output, smelts while the window is open
        this.furnace = { in: null, fuel: null, out: null };
        this.furnaceProgress = 0;

        // hotbar
        this.hotbarEl = document.getElementById('hotbar');
        this.hotbarSlots = [];
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            const slot = makeSlotEl(true, i);
            this.hotbarEl.appendChild(slot);
            this.hotbarSlots.push(slot);
        }

        this.nameEl = document.getElementById('blockname');
        this.statsCanvas = document.getElementById('stats');
        this.statsCtx = this.statsCanvas.getContext('2d');
        this.vignette = document.getElementById('vignette');
        this.deathEl = document.getElementById('death');
        this.panel = document.getElementById('inventory');
        this.cursorEl = document.getElementById('cursorstack');
        this.cursorCanvas = this.cursorEl.querySelector('canvas');

        // inventory grid: rows 9-35 (main), then hotbar mirror 0-8
        this.invSlots = [];
        const mainGrid = document.getElementById('invmain');
        for (let i = 9; i < 36; i++) {
            const el = makeSlotEl(false, i);
            el.addEventListener('mousedown', (e) => this.slotClick(i, e));
            mainGrid.appendChild(el);
            this.invSlots[i] = el;
        }
        const hotGrid = document.getElementById('invhotbar');
        for (let i = 0; i < 9; i++) {
            const el = makeSlotEl(false, i);
            el.addEventListener('mousedown', (e) => this.slotClick(i, e));
            hotGrid.appendChild(el);
            this.invSlots[i] = el;
        }

        // armor slots column
        this.armorSlots = [];
        const armorCol = document.getElementById('invarmor');
        const placeholders = ['⛑', '🦺', '👖', '🥾'];
        for (let i = 0; i < 4; i++) {
            const el = makeSlotEl(false, i);
            el.classList.add('armorslot');
            el.dataset.ph = placeholders[i];
            el.addEventListener('mousedown', (e) => this.armorClick(i, e));
            armorCol.appendChild(el);
            this.armorSlots.push(el);
        }

        this.recipeList = document.getElementById('recipes');

        // crafting / furnace DOM
        this.craftPanel = document.getElementById('craftpanel');
        this.furnacePanel = document.getElementById('furnacepanel');
        this.craftTitle = document.getElementById('crafttitle');
        this.craftGridEl = document.getElementById('craftgrid');
        this.craftOutEl = decorateSlot(document.getElementById('craftout'));
        this.craftOutEl.addEventListener('mousedown', (e) => this.craftOutClick(e));

        this.fInEl = decorateSlot(document.getElementById('furnacein'));
        this.fFuelEl = decorateSlot(document.getElementById('furnacefuel'));
        this.fOutEl = decorateSlot(document.getElementById('furnaceout'));
        this.fBar = document.getElementById('fbar');
        this.fInEl.addEventListener('mousedown', (e) => this.furnaceSlotClick('in', e));
        this.fFuelEl.addEventListener('mousedown', (e) => this.furnaceSlotClick('fuel', e));
        this.fOutEl.addEventListener('mousedown', (e) => this.furnaceSlotClick('out', e));
        for (const el of [this.craftOutEl, this.fInEl, this.fFuelEl, this.fOutEl]) {
            el.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        this.buildCraftGrid(2);

        document.addEventListener('mousemove', (e) => {
            if (this.cursorStack) {
                this.cursorEl.style.left = `${e.clientX + 6}px`;
                this.cursorEl.style.top = `${e.clientY + 6}px`;
            }
        });

        document.addEventListener('keydown', (e) => {
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= 9 && !this.inventoryOpen) this.select(n - 1);
        });
        document.addEventListener('wheel', (e) => {
            if (this.inventoryOpen) return;
            const d = Math.sign(e.deltaY);
            this.select((this.inv.selected + d + 9) % 9);
        });

        inv.onChange = () => this.refresh();
        this.refresh();
        this.select(0);
    }

    select(i) {
        this.inv.selected = i;
        this.hotbarSlots.forEach((s, j) => s.classList.toggle('selected', j === i));
        const stack = this.inv.slots[i];
        this.toast(stack ? nameOf(stack.id) : '');
    }

    // brief fading message above the hotbar (item names, bed feedback, ...)
    toast(text) {
        this.nameEl.textContent = text;
        this.nameEl.classList.remove('show');
        void this.nameEl.offsetWidth;
        this.nameEl.classList.add('show');
        setTimeout(() => this.nameEl.classList.remove('show'), 50);
    }

    refresh() {
        for (let i = 0; i < 9; i++) renderSlot(this.hotbarSlots[i], this.inv.slots[i]);
        if (this.inventoryOpen) {
            for (let i = 0; i < 36; i++) renderSlot(this.invSlots[i], this.inv.slots[i]);
            for (let i = 0; i < 4; i++) renderSlot(this.armorSlots[i], this.inv.armor[i]);
            this.renderRecipes();
        }
    }

    armorClick(slotIdx, e) {
        e.preventDefault();
        if (e.button !== 0) return; // left-click only
        const cur = this.cursorStack;
        const worn = this.inv.armor[slotIdx];

        if (cur) {
            const def = defOf(cur.id);
            if (def?.slot !== slotIdx) return; // wrong piece for this slot
            this.inv.armor[slotIdx] = cur;
            this.cursorStack = worn || null;
            S.equip();
        } else if (worn) {
            this.cursorStack = worn;
            this.inv.armor[slotIdx] = null;
        }
        this.inv.changed();
        this.renderCursor();
    }

    // ---- inventory panel ----

    toggleInventory(ctx) {
        this.setInventoryOpen(!this.inventoryOpen, ctx);
    }

    // ctx.mode: 'hand' (2x2, default), 'table' (3x3), 'furnace'
    setInventoryOpen(open, ctx = {}) {
        const wasOpen = this.inventoryOpen;
        this.inventoryOpen = open;
        this.panel.classList.toggle('hidden', !open);

        if (open) {
            this.mode = ctx.mode || 'hand';
            const furnace = this.mode === 'furnace';
            this.craftPanel.classList.toggle('hidden', furnace);
            this.furnacePanel.classList.toggle('hidden', !furnace);
            if (!furnace) {
                const size = this.mode === 'table' ? 3 : 2;
                if (size !== this.craftSize) this.buildCraftGrid(size);
                this.craftTitle.textContent = this.mode === 'table' ? 'Établi' : 'Fabrication';
                this.recomputeCraft();
                this.renderCraftGrid();
            }
            this.refresh();
            this.renderFurnace();
        } else if (wasOpen) {
            // return everything held in the temporary grids to the inventory
            this.clearCraftToInv();
            this.clearFurnaceToInv();
            if (this.cursorStack) {
                this.inv.add(this.cursorStack.id, this.cursorStack.n, this.cursorStack.dur);
                this.cursorStack = null;
                this.renderCursor();
            }
        }
        if (this.onInventoryToggle) this.onInventoryToggle(open);
    }

    // ---- crafting grid ----

    buildCraftGrid(size) {
        this.craftSize = size;
        this.craftGrid = new Array(size * size).fill(null);
        this.craftCells = [];
        this.craftGridEl.innerHTML = '';
        this.craftGridEl.style.gridTemplateColumns = `repeat(${size}, 44px)`;
        for (let i = 0; i < size * size; i++) {
            const el = makeSlotEl(false, i);
            el.addEventListener('mousedown', (e) => this.craftCellClick(i, e));
            el.addEventListener('contextmenu', (e) => e.preventDefault());
            this.craftGridEl.appendChild(el);
            this.craftCells.push(el);
        }
    }

    craftCellClick(i, e) {
        e.preventDefault();
        const cur = this.cursorStack;
        if (e.button === 2 && cur) {
            // right-click: drop a single item into the cell
            const s = this.craftGrid[i];
            if (!s) {
                this.craftGrid[i] = { id: cur.id, n: 1 };
                if (cur.dur !== undefined) this.craftGrid[i].dur = cur.dur;
                cur.n--;
            } else if (s.id === cur.id && s.dur === undefined && cur.dur === undefined && s.n < 64) {
                s.n++;
                cur.n--;
            }
            if (cur.n <= 0) this.cursorStack = null;
        } else {
            this.cursorOnStack(
                () => this.craftGrid[i],
                (v) => {
                    this.craftGrid[i] = v;
                },
            );
        }
        this.recomputeCraft();
        this.renderCraftGrid();
        this.renderCursor();
    }

    recomputeCraft() {
        const ids = this.craftGrid.map((s) => (s ? s.id : 0));
        const match = matchCraft(ids, this.craftSize);
        this.craftOut = match ? match.out : null;
        this.craftUsed = match ? match.used : [];
        renderSlot(this.craftOutEl, this.craftOut);
    }

    craftOutClick(e) {
        e.preventDefault();
        if (e.button !== 0) return; // left-click only
        if (!this.craftOut) return;
        const out = this.craftOut;
        const cur = this.cursorStack;
        if (cur) {
            if (cur.id !== out.id || cur.dur !== undefined) return; // can't stack onto it
            cur.n += out.n;
        } else {
            const stack = { id: out.id, n: out.n };
            const d = defOf(out.id)?.dur;
            if (d) stack.dur = d;
            this.cursorStack = stack;
        }
        for (let i = 0; i < this.craftUsed.length; i++) {
            if (!this.craftUsed[i]) continue;
            const s = this.craftGrid[i];
            if (s) {
                s.n--;
                if (s.n <= 0) this.craftGrid[i] = null;
            }
        }
        S.craft();
        this.recomputeCraft();
        this.renderCraftGrid();
        this.renderCursor();
    }

    renderCraftGrid() {
        for (let i = 0; i < this.craftCells.length; i++) {
            renderSlot(this.craftCells[i], this.craftGrid[i]);
        }
    }

    clearCraftToInv() {
        for (let i = 0; i < this.craftGrid.length; i++) {
            const s = this.craftGrid[i];
            if (s) {
                this.inv.add(s.id, s.n, s.dur);
                this.craftGrid[i] = null;
            }
        }
        this.craftOut = null;
        this.craftUsed = [];
    }

    // Shared cursor pick/place/swap/merge on one stack location.
    // get() -> stack|null, set(stack|null). takeOnly: output slots (no placing).
    cursorOnStack(get, set, { takeOnly = false } = {}) {
        const cur = this.cursorStack;
        const s = get();
        if (takeOnly) {
            if (!s) return;
            if (!cur) {
                this.cursorStack = s;
                set(null);
            } else if (cur.id === s.id && cur.dur === undefined && s.dur === undefined) {
                cur.n += s.n;
                set(null);
            }
            return;
        }
        if (!cur && s) {
            this.cursorStack = s;
            set(null);
        } else if (cur && !s) {
            set(cur);
            this.cursorStack = null;
        } else if (cur && s) {
            if (s.id === cur.id && s.dur === undefined && cur.dur === undefined) {
                const room = stackSize(s.id) - s.n;
                const t = Math.min(room, cur.n);
                s.n += t;
                cur.n -= t;
                if (cur.n <= 0) this.cursorStack = null;
                set(s);
            } else {
                set(cur);
                this.cursorStack = s;
            }
        }
    }

    // ---- furnace ----

    furnaceSlotClick(which, e) {
        e.preventDefault();
        if (e.button !== 0) return; // left-click only
        if (which === 'out') {
            this.cursorOnStack(
                () => this.furnace.out,
                (v) => {
                    this.furnace.out = v;
                },
                { takeOnly: true },
            );
        } else {
            this.cursorOnStack(
                () => this.furnace[which],
                (v) => {
                    this.furnace[which] = v;
                },
            );
        }
        this.renderFurnace();
        this.renderCursor();
    }

    // Smelt one item per SMELT_TIME while input + fuel are present and output fits.
    tickFurnace(dt) {
        if (this.mode !== 'furnace' || !this.inventoryOpen) return;
        const f = this.furnace;
        const recipe = f.in ? smeltOf(f.in.id) : null;
        const hasFuel = f.fuel && f.fuel.id === SMELT_FUEL && f.fuel.n > 0;
        const outOk = !f.out || (f.out.id === recipe?.out.id && f.out.n + recipe.out.n <= 64);
        if (recipe && hasFuel && outOk) {
            this.furnaceProgress += dt;
            if (this.furnaceProgress >= SMELT_TIME) {
                this.furnaceProgress = 0;
                f.in.n--;
                if (f.in.n <= 0) f.in = null;
                f.fuel.n--;
                if (f.fuel.n <= 0) f.fuel = null;
                if (f.out) f.out.n += recipe.out.n;
                else f.out = { id: recipe.out.id, n: recipe.out.n };
                S.craft();
                this.renderFurnace();
            }
        } else {
            this.furnaceProgress = 0;
        }
        this.fBar.style.width = `${(this.furnaceProgress / SMELT_TIME) * 100}%`;
    }

    renderFurnace() {
        renderSlot(this.fInEl, this.furnace.in);
        renderSlot(this.fFuelEl, this.furnace.fuel);
        renderSlot(this.fOutEl, this.furnace.out);
    }

    clearFurnaceToInv() {
        for (const k of ['in', 'fuel', 'out']) {
            const s = this.furnace[k];
            if (s) {
                this.inv.add(s.id, s.n, s.dur);
                this.furnace[k] = null;
            }
        }
        this.furnaceProgress = 0;
        this.fBar.style.width = '0%';
    }

    slotClick(i, e) {
        e.preventDefault();
        if (e.button !== 0) return; // left-click only
        const slots = this.inv.slots;
        const cur = this.cursorStack;
        const s = slots[i];

        if (e.shiftKey && s && !cur) {
            // shift-click armor: equip it directly
            if (isArmor(s.id)) {
                const slot = defOf(s.id).slot;
                const worn = this.inv.armor[slot];
                this.inv.armor[slot] = s;
                slots[i] = worn || null;
                this.inv.changed();
                S.equip();
                return;
            }
            // quick move between hotbar and main inventory
            const stack = s;
            slots[i] = null;
            const target = i < 9 ? [9, 36] : [0, 9];
            let n = stack.n;
            for (let j = target[0]; j < target[1] && n > 0; j++) {
                if (!slots[j]) {
                    slots[j] = { ...stack, n };
                    n = 0;
                } else if (slots[j].id === stack.id && slots[j].dur === undefined) {
                    const room = 64 - slots[j].n;
                    const t = Math.min(room, n);
                    slots[j].n += t;
                    n -= t;
                }
            }
            if (n > 0) slots[i] = { ...stack, n };
            this.inv.changed();
            return;
        }

        if (!cur && s) {
            this.cursorStack = s;
            slots[i] = null;
        } else if (cur && !s) {
            slots[i] = cur;
            this.cursorStack = null;
        } else if (cur && s) {
            if (s.id === cur.id && s.dur === undefined && cur.dur === undefined) {
                const room = 64 - s.n;
                const t = Math.min(room, cur.n);
                s.n += t;
                cur.n -= t;
                if (cur.n <= 0) this.cursorStack = null;
            } else {
                slots[i] = cur;
                this.cursorStack = s;
            }
        }
        this.inv.changed();
        this.renderCursor();
    }

    renderCursor() {
        if (this.cursorStack) {
            this.cursorEl.classList.remove('hidden');
            const ctx = this.cursorCanvas.getContext('2d');
            ctx.clearRect(0, 0, 16, 16);
            ctx.drawImage(getItemIcon(this.cursorStack.id), 0, 0);
            this.cursorEl.querySelector('.count').textContent =
                this.cursorStack.n > 1 ? String(this.cursorStack.n) : '';
        } else {
            this.cursorEl.classList.add('hidden');
        }
    }

    // Recipe book: lists recipes that fit the current grid; clicking one
    // auto-places its ingredients into the grid (Minecraft recipe-book style).
    renderRecipes() {
        this.recipeList.innerHTML = '';
        if (this.mode === 'furnace') return;
        const size = this.craftSize;
        for (const r of RECIPES) {
            if (recipeMinGrid(r) > size) continue;
            const needs = recipeNeeds(r);
            const have = [...needs].every(([id, n]) => this.inv.count(id) >= n);
            const row = document.createElement('div');
            row.className = 'recipe' + (have ? '' : ' locked');

            const icon = document.createElement('canvas');
            icon.width = icon.height = 16;
            icon.getContext('2d').drawImage(getItemIcon(r.out.id), 0, 0);
            row.appendChild(icon);

            const label = document.createElement('div');
            label.className = 'rlabel';
            const ins = [...needs].map(([id, n]) => `${n} ${nameOf(id)}`).join(' + ');
            label.innerHTML = `<b>${nameOf(r.out.id)}${r.out.n > 1 ? ' ×' + r.out.n : ''}</b><span>${ins}</span>`;
            row.appendChild(label);

            if (have) row.addEventListener('click', () => this.autoFill(r));
            this.recipeList.appendChild(row);
        }
    }

    autoFill(recipe) {
        this.clearCraftToInv(); // return whatever's currently in the grid
        const needs = recipeNeeds(recipe);
        for (const [id, n] of needs) {
            if (this.inv.count(id) < n) {
                this.recomputeCraft();
                this.renderCraftGrid();
                return;
            }
        }
        const placement = recipePlacement(recipe, this.craftSize);
        for (const [cell, id] of placement) {
            this.inv.take(id, 1);
            this.craftGrid[cell] = { id, n: 1 };
        }
        this.recomputeCraft();
        this.renderCraftGrid();
    }

    // ---- stats bar (hearts, hunger, bubbles) ----

    updateStats(player, armorPoints = 0) {
        const ctx = this.statsCtx;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 182, 30);

        for (let i = 0; i < 10; i++) {
            const v = player.hp - i * 2;
            drawHeart(ctx, i * 9, 20, v >= 2 ? 'full' : v >= 1 ? 'half' : 'empty');
        }
        for (let i = 0; i < 10; i++) {
            const v = player.hunger - i * 2;
            drawFood(ctx, 173 - i * 9, 20, v >= 2 ? 'full' : v >= 1 ? 'half' : 'empty');
        }
        if (armorPoints > 0) {
            for (let i = 0; i < 10; i++) {
                const v = armorPoints - i * 2;
                if (v >= 1) drawArmorIcon(ctx, i * 9, 9, v >= 2);
            }
        }
        if (player.air < 10) {
            for (let i = 0; i < Math.ceil(player.air); i++) {
                drawBubble(ctx, 173 - i * 9, 9);
            }
        }
    }

    flashDamage() {
        this.vignette.classList.remove('flash');
        void this.vignette.offsetWidth;
        this.vignette.classList.add('flash');
    }

    showDeath(onRespawn) {
        this.deathEl.classList.remove('hidden');
        document.getElementById('respawnbtn').onclick = () => {
            this.deathEl.classList.add('hidden');
            onRespawn();
        };
    }
}

// tiny pixel pictograms
function drawHeart(ctx, x, y, kind) {
    const red = '#e3302e',
        dark = '#3a0c0c',
        off = '#555';
    const fill = kind === 'empty' ? off : red;
    px(ctx, x, y, dark, [
        [1, 0],
        [2, 0],
        [4, 0],
        [5, 0],
        [0, 1],
        [3, 1],
        [6, 1],
        [0, 2],
        [6, 2],
        [1, 3],
        [5, 3],
        [2, 4],
        [4, 4],
        [3, 5],
    ]);
    if (kind !== 'empty') {
        const cells =
            kind === 'full'
                ? [
                      [1, 1],
                      [2, 1],
                      [4, 1],
                      [5, 1],
                      [1, 2],
                      [2, 2],
                      [3, 2],
                      [4, 2],
                      [5, 2],
                      [2, 3],
                      [3, 3],
                      [4, 3],
                      [3, 4],
                  ]
                : [
                      [1, 1],
                      [2, 1],
                      [1, 2],
                      [2, 2],
                      [3, 2],
                      [2, 3],
                      [3, 3],
                      [3, 4],
                  ];
        px(ctx, x, y, fill, cells);
    }
}

function drawFood(ctx, x, y, kind) {
    const meat = '#c1683c',
        bone = '#e8dcc0',
        off = '#555';
    if (kind === 'empty') {
        px(ctx, x, y, off, [
            [3, 1],
            [4, 1],
            [5, 2],
            [2, 2],
            [3, 3],
            [2, 4],
            [1, 5],
        ]);
        return;
    }
    px(ctx, x, y, meat, [
        [3, 1],
        [4, 1],
        [3, 2],
        [4, 2],
        [5, 2],
        [2, 2],
        [3, 3],
        [2, 3],
        [2, 4],
    ]);
    px(ctx, x, y, bone, [
        [1, 5],
        [0, 6],
        [1, 6],
    ]);
    if (kind === 'half')
        px(ctx, x, y, '#555', [
            [4, 1],
            [5, 2],
            [4, 2],
        ]);
}

function drawBubble(ctx, x, y) {
    px(ctx, x, y, '#cfe8ff', [
        [2, 0],
        [3, 0],
        [1, 1],
        [4, 1],
        [1, 2],
        [4, 2],
        [2, 3],
        [3, 3],
    ]);
    px(ctx, x, y, '#7db8e8', [
        [2, 1],
        [3, 2],
    ]);
}

function drawArmorIcon(ctx, x, y, full) {
    // tiny chestplate
    px(ctx, x, y, '#cfcfcf', [
        [1, 0],
        [2, 0],
        [4, 0],
        [5, 0],
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
        [5, 1],
        [2, 2],
        [3, 2],
        [4, 2],
        [2, 3],
        [3, 3],
        [4, 3],
    ]);
    px(ctx, x, y, '#8f8f8f', [
        [0, 0],
        [6, 0],
        [0, 1],
        [6, 1],
    ]);
    if (!full)
        px(ctx, x, y, '#555', [
            [4, 1],
            [5, 1],
            [4, 2],
            [4, 3],
            [5, 0],
            [4, 0],
        ]);
}

function px(ctx, ox, oy, color, cells) {
    ctx.fillStyle = color;
    for (const [x, y] of cells) ctx.fillRect(ox + x, oy + y, 1, 1);
}
