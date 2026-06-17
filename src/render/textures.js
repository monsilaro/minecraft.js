// Procedural 16x16 pixel-art textures, drawn from scratch:
// - 8x8 block atlas (terrain, ores, plants, utility blocks)
// - 4 crack stages for mining progress
// - item icons (tools, materials, food) for the hotbar/inventory

import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { IT } from '../items/items.js';
import { BLOCKS } from '../world/blocks.js';
import { TILE, ATLAS_COLS, tileUV } from '../world/atlas.js';

export { TILE, ATLAS_COLS, tileUV };

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setPx(px, x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
}

function setHex(px, x, y, hex, a = 255) {
    const c = hexToRgb(hex);
    setPx(px, x, y, c[0], c[1], c[2], a);
}

function noisyFill(px, rng, palette, alpha = 255) {
    const colors = palette.map(hexToRgb);
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const c = colors[Math.floor(rng() * colors.length)];
            setPx(px, x, y, c[0], c[1], c[2], alpha);
        }
    }
}

function blob(px, cx, cy, r, palette, rng) {
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r) {
                setHex(px, cx + dx, cy + dy, palette[Math.floor(rng() * palette.length)]);
            }
        }
    }
}

const GRASS = ['#5d9e3a', '#69b042', '#74bc4c', '#509134'];
const DIRT = ['#8a6038', '#7a5430', '#936a40', '#6e4b2a'];
const STONE = ['#8a8a8a', '#7d7d7d', '#959595', '#737373'];
const SAND = ['#dcd29b', '#d2c78d', '#e3daa7', '#cabf83'];
const LEAVES = ['#3e7a25', '#356b1f', '#48892d', '#2f6019'];
const SNOW = ['#f4f8fb', '#e9eff5', '#ffffff', '#dfe8f0'];
const BEDROCK_C = ['#3a3a3a', '#2c2c2c', '#4a4a4a', '#222222', '#555555'];
const WATER_C = ['#3b62d9', '#3258c8', '#4570e8', '#2d51bd'];
const PLANK = ['#b08a4f', '#a67f45', '#bb945a', '#9e7740'];

// Stone base with mineral specks in clusters.
function oreTile(px, rng, specks) {
    noisyFill(px, rng, STONE);
    for (let i = 0; i < 5; i++) {
        const cx = 2 + Math.floor(rng() * 12),
            cy = 2 + Math.floor(rng() * 12);
        setHex(px, cx, cy, specks[0]);
        setHex(px, cx + 1, cy, specks[1 % specks.length]);
        setHex(px, cx, cy + 1, specks[1 % specks.length]);
        if (rng() < 0.6) setHex(px, cx + 1, cy + 1, specks[0]);
    }
}

function clear(px) {
    for (let i = 3; i < px.length; i += 4) px[i] = 0;
}

function planksBase(px, rng) {
    noisyFill(px, rng, PLANK);
    for (let y = 3; y < TILE; y += 4) {
        for (let x = 0; x < TILE; x++) setHex(px, x, y, '#7a5c33');
    }
    const offsets = [4, 11, 7, 13];
    for (let row = 0; row < 4; row++) {
        for (let y = row * 4; y < row * 4 + 3; y++) setHex(px, offsets[row], y, '#7a5c33');
    }
}

const TILE_PAINTERS = [
    // 0 grass top
    (px, rng) => noisyFill(px, rng, GRASS),
    // 1 grass side
    (px, rng) => {
        noisyFill(px, rng, DIRT);
        for (let x = 0; x < TILE; x++) {
            const depth = 2 + Math.floor(rng() * 3);
            for (let y = 0; y < depth; y++)
                setHex(px, x, y, GRASS[Math.floor(rng() * GRASS.length)]);
        }
    },
    // 2 dirt
    (px, rng) => noisyFill(px, rng, DIRT),
    // 3 stone
    (px, rng) => {
        noisyFill(px, rng, STONE);
        for (let i = 0; i < 4; i++) {
            let x = Math.floor(rng() * TILE),
                y = Math.floor(rng() * TILE);
            for (let j = 0; j < 3 + Math.floor(rng() * 4); j++) {
                setHex(px, x, y, '#666666');
                x += rng() < 0.5 ? 1 : 0;
                y += rng() < 0.7 ? 1 : 0;
            }
        }
    },
    // 4 sand
    (px, rng) => noisyFill(px, rng, SAND),
    // 5 log side
    (px, rng) => {
        const bark = ['#6b4d2e', '#5d4226', '#75552f', '#523a20'];
        for (let x = 0; x < TILE; x++) {
            for (let y = 0; y < TILE; y++) {
                setHex(
                    px,
                    x,
                    y,
                    rng() < 0.15 ? bark[Math.floor(rng() * bark.length)] : bark[x % bark.length],
                );
            }
        }
    },
    // 6 log top
    (px, rng) => {
        noisyFill(px, rng, ['#6b4d2e', '#5d4226']);
        const rings = ['#a8854f', '#8c6c3c', '#a8854f', '#8c6c3c', '#c2a06a'];
        for (let r = 0; r < rings.length; r++) {
            const lo = 2 + r,
                hi = TILE - 3 - r;
            if (lo >= hi) {
                setHex(px, 7, 7, rings[r]);
                setHex(px, 8, 8, rings[r]);
                break;
            }
            for (let i = lo; i <= hi; i++) {
                setHex(px, i, lo, rings[r]);
                setHex(px, i, hi, rings[r]);
                setHex(px, lo, i, rings[r]);
                setHex(px, hi, i, rings[r]);
            }
        }
    },
    // 7 leaves
    (px, rng) => {
        noisyFill(px, rng, LEAVES);
        for (let i = 0; i < 10; i++)
            setHex(px, Math.floor(rng() * TILE), Math.floor(rng() * TILE), '#1f4a10');
    },
    // 8 planks
    (px, rng) => planksBase(px, rng),
    // 9 cobblestone
    (px, rng) => {
        noisyFill(px, rng, ['#5a5a5a', '#525252']);
        const blobs = [
            [3, 3],
            [10, 2],
            [13, 8],
            [4, 10],
            [9, 12],
            [14, 14],
            [1, 14],
            [7, 7],
        ];
        for (const [bx, by] of blobs) blob(px, bx, by, 2 + Math.floor(rng() * 2), STONE, rng);
    },
    // 10 glass
    (px) => {
        for (let y = 0; y < TILE; y++)
            for (let x = 0; x < TILE; x++) setPx(px, x, y, 220, 240, 250, 0);
        for (let i = 0; i < TILE; i++) {
            setPx(px, i, 0, 200, 220, 230);
            setPx(px, i, TILE - 1, 200, 220, 230);
            setPx(px, 0, i, 200, 220, 230);
            setPx(px, TILE - 1, i, 200, 220, 230);
        }
        for (let i = 2; i < 7; i++) setPx(px, i, 10 - i, 235, 245, 255, 180);
        for (let i = 8; i < 12; i++) setPx(px, i, 20 - i, 235, 245, 255, 120);
    },
    // 11 water
    (px, rng) => noisyFill(px, rng, WATER_C, 190),
    // 12 bedrock
    (px, rng) => noisyFill(px, rng, BEDROCK_C),
    // 13 snow top
    (px, rng) => noisyFill(px, rng, SNOW),
    // 14 snow side
    (px, rng) => {
        noisyFill(px, rng, DIRT);
        for (let x = 0; x < TILE; x++) {
            const depth = 3 + Math.floor(rng() * 2);
            for (let y = 0; y < depth; y++) setHex(px, x, y, SNOW[Math.floor(rng() * SNOW.length)]);
        }
    },
    // 15 coal ore
    (px, rng) => oreTile(px, rng, ['#1d1d1d', '#333333']),
    // 16 iron ore
    (px, rng) => oreTile(px, rng, ['#d8b29a', '#b08968']),
    // 17 gold ore
    (px, rng) => oreTile(px, rng, ['#f5d76e', '#d4af37']),
    // 18 diamond ore
    (px, rng) => oreTile(px, rng, ['#4ee0d6', '#7df0ea']),
    // 19 torch (cross-rendered)
    (px) => {
        clear(px);
        for (let y = 6; y < 14; y++) {
            setHex(px, 7, y, '#6b4d2e');
            setHex(px, 8, y, '#5d4226');
        }
        setHex(px, 7, 5, '#ffdd55');
        setHex(px, 8, 5, '#ffaa33');
        setHex(px, 7, 4, '#fff2a0');
        setHex(px, 8, 4, '#ffdd55');
    },
    // 20 poppy
    (px, rng) => {
        clear(px);
        for (let y = 8; y < 15; y++) setHex(px, 7, y, '#3f7d2a');
        setHex(px, 6, 10, '#3f7d2a');
        setHex(px, 8, 12, '#3f7d2a');
        blob(px, 7, 5, 2, ['#c62828', '#e53935', '#b71c1c'], rng);
        setHex(px, 7, 5, '#212121');
    },
    // 21 dandelion
    (px, rng) => {
        clear(px);
        for (let y = 8; y < 15; y++) setHex(px, 8, y, '#3f7d2a');
        setHex(px, 7, 11, '#3f7d2a');
        blob(px, 8, 5, 2, ['#ffd600', '#ffea00', '#ffc400'], rng);
    },
    // 22 tall grass
    (px, rng) => {
        clear(px);
        const greens = ['#4f8f30', '#5d9e3a', '#447a28'];
        for (let i = 0; i < 7; i++) {
            const bx = 2 + Math.floor(rng() * 12);
            const h = 5 + Math.floor(rng() * 7);
            let x = bx;
            for (let y = 15; y > 15 - h; y--) {
                setHex(px, x, y, greens[Math.floor(rng() * greens.length)]);
                if (rng() < 0.3) x += rng() < 0.5 ? 1 : -1;
            }
        }
    },
    // 23 crafting table top
    (px, rng) => {
        planksBase(px, rng);
        for (let i = 0; i < TILE; i++) {
            setHex(px, i, 0, '#5e4426');
            setHex(px, i, 15, '#5e4426');
            setHex(px, 0, i, '#5e4426');
            setHex(px, 15, i, '#5e4426');
            setHex(px, i, 5, '#5e4426');
            setHex(px, i, 10, '#5e4426');
            setHex(px, 5, i, '#5e4426');
            setHex(px, 10, i, '#5e4426');
        }
    },
    // 24 crafting table side
    (px, rng) => {
        planksBase(px, rng);
        // tool silhouettes
        blob(px, 4, 5, 1, ['#4a3520'], rng);
        blob(px, 11, 6, 1, ['#8c8c8c'], rng);
        for (let y = 6; y < 11; y++) setHex(px, 4, y, '#4a3520');
        for (let y = 7; y < 11; y++) setHex(px, 11, y, '#4a3520');
    },
    // 25 furnace side
    (px, rng) => {
        noisyFill(px, rng, ['#6e6e6e', '#646464', '#787878']);
        for (let i = 0; i < TILE; i++) {
            setHex(px, i, 0, '#4a4a4a');
            setHex(px, i, 15, '#4a4a4a');
            setHex(px, 0, i, '#4a4a4a');
            setHex(px, 15, i, '#4a4a4a');
        }
        // dark opening
        for (let y = 8; y < 14; y++) for (let x = 5; x < 11; x++) setHex(px, x, y, '#1a1a1a');
        for (let x = 6; x < 10; x++) setHex(px, x, 13, '#3a2a1a');
    },
    // 26 furnace back (unused spare)
    (px, rng) => noisyFill(px, rng, ['#6e6e6e', '#646464', '#787878']),
    // 27 furnace top
    (px, rng) => {
        noisyFill(px, rng, ['#7d7d7d', '#737373', '#878787']);
        for (let i = 0; i < TILE; i++) {
            setHex(px, i, 0, '#4a4a4a');
            setHex(px, i, 15, '#4a4a4a');
            setHex(px, 0, i, '#4a4a4a');
            setHex(px, 15, i, '#4a4a4a');
        }
    },
    // 28 TNT side: red body, white band with lettering marks
    (px, rng) => {
        noisyFill(px, rng, ['#c8342a', '#b52c22', '#d4423a']);
        for (let y = 6; y <= 9; y++) {
            for (let x = 0; x < TILE; x++) setHex(px, x, y, '#e8e2d0');
        }
        // dark tick marks on the band
        for (const x of [3, 5, 7, 8, 10, 12]) setHex(px, x, 7, '#2a2a2a');
        for (const x of [3, 7, 8, 12]) setHex(px, x, 8, '#2a2a2a');
    },
    // 29 TNT top: red rim, fuse dots
    (px, rng) => {
        noisyFill(px, rng, ['#c8342a', '#b52c22']);
        for (let y = 3; y <= 12; y++) {
            for (let x = 3; x <= 12; x++) setHex(px, x, y, '#e8e2d0');
        }
        for (const [fx, fy] of [
            [5, 5],
            [10, 5],
            [5, 10],
            [10, 10],
            [7, 7],
            [8, 8],
        ]) {
            setHex(px, fx, fy, '#2a2a2a');
        }
    },
    // 30 bed top: white pillow + red blanket
    (px, rng) => {
        noisyFill(px, rng, ['#b8332a', '#a82c24', '#c43d33']);
        for (let y = 0; y < 5; y++) {
            for (let x = 1; x < 15; x++) setHex(px, x, y, rng() < 0.2 ? '#e4e4e4' : '#f4f4f4');
        }
        for (let x = 0; x < TILE; x++) setHex(px, x, 5, '#7e1f18'); // blanket seam
        for (let i = 0; i < TILE; i++) {
            setHex(px, 0, i, '#6b4d2e');
            setHex(px, 15, i, '#6b4d2e'); // wood frame rails
        }
    },
    // 31 bed side: blanket over wood frame
    (px, rng) => {
        noisyFill(px, rng, ['#b8332a', '#a82c24', '#c43d33']);
        for (let y = 10; y < TILE; y++) {
            for (let x = 0; x < TILE; x++)
                setHex(px, x, y, PLANK[Math.floor(rng() * PLANK.length)]);
        }
        for (let x = 0; x < TILE; x++) setHex(px, x, 10, '#5e4426');
        for (let x = 1; x < 5; x++) setHex(px, x, 2, '#f4f4f4'); // pillow peek
        for (let x = 1; x < 5; x++) setHex(px, x, 3, '#e4e4e4');
    },
    // 32 door upper: plank panel, framed, with a small window
    (px, rng) => {
        planksBase(px, rng);
        for (let i = 0; i < TILE; i++) {
            setHex(px, 0, i, '#5e4426');
            setHex(px, 15, i, '#5e4426');
            setHex(px, i, 0, '#5e4426');
        }
        for (let y = 3; y <= 7; y++) for (let x = 6; x <= 10; x++) setHex(px, x, y, '#5e4426');
        for (let y = 4; y <= 6; y++) for (let x = 7; x <= 9; x++) setPx(px, x, y, 150, 190, 220, 200);
    },
    // 33 door lower: plank panel, framed, with a handle on the right
    (px, rng) => {
        planksBase(px, rng);
        for (let i = 0; i < TILE; i++) {
            setHex(px, 0, i, '#5e4426');
            setHex(px, 15, i, '#5e4426');
            setHex(px, i, 15, '#5e4426');
        }
        // recessed panel
        for (let y = 3; y <= 12; y++) {
            setHex(px, 4, y, '#7a5c33');
            setHex(px, 11, y, '#7a5c33');
        }
        for (let x = 4; x <= 11; x++) {
            setHex(px, x, 3, '#7a5c33');
            setHex(px, x, 12, '#7a5c33');
        }
        // handle
        setHex(px, 12, 8, '#2a2a2a');
        setHex(px, 13, 8, '#1a1a1a');
        setHex(px, 13, 9, '#1a1a1a');
    },
];

export function createAtlas() {
    const size = TILE * ATLAS_COLS;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < TILE_PAINTERS.length; i++) {
        const rng = mulberry32(1337 + i * 101);
        const img = ctx.createImageData(TILE, TILE);
        TILE_PAINTERS[i](img.data, rng);
        ctx.putImageData(img, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;

    return { texture, canvas };
}

// ---- mining crack overlay, 4 stages ----

export function createCrackTextures() {
    const textures = [];
    for (let stage = 0; stage < 4; stage++) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = TILE;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(TILE, TILE);
        const rng = mulberry32(9000 + stage);
        const branches = 3 + stage * 2;
        for (let b = 0; b < branches; b++) {
            let x = 7 + Math.floor(rng() * 2),
                y = 7 + Math.floor(rng() * 2);
            const len = 4 + stage * 3;
            const dx = rng() < 0.5 ? 1 : -1,
                dy = rng() < 0.5 ? 1 : -1;
            for (let i = 0; i < len; i++) {
                setPx(img.data, x, y, 20, 20, 20, 200);
                if (rng() < 0.3) setPx(img.data, x + 1, y, 20, 20, 20, 140);
                x += rng() < 0.6 ? dx : 0;
                y += rng() < 0.6 ? dy : 0;
                if (x < 0 || y < 0 || x > 15 || y > 15) break;
            }
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        textures.push(tex);
    }
    return textures;
}

// ---- item icons (16x16 canvases, cached) ----

const TIER_COLORS = {
    wood: ['#a0824c', '#8a6d3b'],
    stone: ['#9e9e9e', '#7d7d7d'],
    iron: ['#e8e8e8', '#c0c0c0'],
    diamond: ['#4ee0d6', '#2bbfb5'],
};

function drawPick(px, tier) {
    const [c1, c2] = TIER_COLORS[tier];
    // handle
    for (let i = 0; i < 8; i++) {
        setHex(px, 4 + i, 12 - i, '#6b4d2e');
        setHex(px, 5 + i, 12 - i, '#523a20');
    }
    // head arc
    for (let x = 3; x <= 12; x++) setHex(px, x, 3, c1);
    setHex(px, 2, 4, c2);
    setHex(px, 13, 4, c2);
    setHex(px, 2, 5, c2);
    setHex(px, 13, 5, c2);
    setHex(px, 2, 6, c2);
    setHex(px, 13, 6, c2);
}

function drawSword(px, tier) {
    const [c1, c2] = TIER_COLORS[tier];
    for (let i = 0; i < 9; i++) {
        setHex(px, 5 + i, 11 - i, c1);
        setHex(px, 6 + i, 11 - i, c2);
    }
    setHex(px, 4, 11, '#6b4d2e');
    setHex(px, 6, 13, '#6b4d2e'); // guard
    setHex(px, 3, 12, '#523a20');
    setHex(px, 2, 13, '#523a20'); // grip
}

function drawAxe(px, tier) {
    const [c1, c2] = TIER_COLORS[tier];
    // diagonal wooden handle, bottom-left to top-right
    for (let i = 0; i < 9; i++) {
        setHex(px, 4 + i, 13 - i, '#6b4d2e');
        setHex(px, 5 + i, 13 - i, '#523a20');
    }
    // axe head: a wedge near the top of the handle (left-facing blade)
    for (let y = 2; y <= 7; y++) {
        const span = 3 - Math.abs(4 - y); // widest at the middle of the head
        for (let x = 8 - span; x <= 8; x++) setHex(px, x, y, x <= 8 - span + 1 ? c2 : c1);
    }
    setHex(px, 9, 3, c1);
    setHex(px, 9, 4, c1);
    setHex(px, 9, 5, c1); // head shoulder against the handle
}

const ITEM_PAINTERS = {
    [IT.STICK]: (px) => {
        for (let i = 0; i < 9; i++) {
            setHex(px, 4 + i, 12 - i, '#8a6d3b');
            setHex(px, 5 + i, 12 - i, '#6b4d2e');
        }
    },
    [IT.COAL]: (px, rng) => blob(px, 8, 8, 4, ['#1c1c1c', '#2e2e2e', '#0f0f0f'], rng),
    [IT.RAW_IRON]: (px, rng) => blob(px, 8, 8, 4, ['#d8b29a', '#c49a7e', '#b08968'], rng),
    [IT.RAW_GOLD]: (px, rng) => blob(px, 8, 8, 4, ['#f5d76e', '#e6c450', '#d4af37'], rng),
    [IT.IRON_INGOT]: (px) => {
        for (let y = 9; y <= 13; y++)
            for (let x = 3 + (13 - y); x <= 9 + (13 - y); x++) setHex(px, x, y, '#c8c8c8');
        for (let x = 7; x <= 13; x++) setHex(px, x, 9, '#ececec');
    },
    [IT.GOLD_INGOT]: (px) => {
        for (let y = 9; y <= 13; y++)
            for (let x = 3 + (13 - y); x <= 9 + (13 - y); x++) setHex(px, x, y, '#e6c450');
        for (let x = 7; x <= 13; x++) setHex(px, x, 9, '#ffe98a');
    },
    [IT.DIAMOND]: (px) => {
        const w = [1, 3, 5, 7, 5, 3, 1];
        for (let r = 0; r < 7; r++) {
            for (let x = 8 - (w[r] >> 1); x <= 8 + (w[r] >> 1); x++) {
                setHex(px, x, 5 + r, r < 3 ? '#aff7f0' : '#4ee0d6');
            }
        }
    },
    [IT.WOOD_PICK]: (px) => drawPick(px, 'wood'),
    [IT.STONE_PICK]: (px) => drawPick(px, 'stone'),
    [IT.IRON_PICK]: (px) => drawPick(px, 'iron'),
    [IT.DIAMOND_PICK]: (px) => drawPick(px, 'diamond'),
    [IT.WOOD_SWORD]: (px) => drawSword(px, 'wood'),
    [IT.STONE_SWORD]: (px) => drawSword(px, 'stone'),
    [IT.IRON_SWORD]: (px) => drawSword(px, 'iron'),
    [IT.DIAMOND_SWORD]: (px) => drawSword(px, 'diamond'),
    [IT.WOOD_AXE]: (px) => drawAxe(px, 'wood'),
    [IT.STONE_AXE]: (px) => drawAxe(px, 'stone'),
    [IT.IRON_AXE]: (px) => drawAxe(px, 'iron'),
    [IT.DIAMOND_AXE]: (px) => drawAxe(px, 'diamond'),
    [IT.PORKCHOP]: (px, rng) => {
        blob(px, 9, 7, 4, ['#f2a0a0', '#e88c8c', '#f7b5b5'], rng);
        setHex(px, 4, 12, '#f5efe0');
        setHex(px, 3, 13, '#f5efe0');
    },
    [IT.COOKED_PORKCHOP]: (px, rng) => {
        blob(px, 9, 7, 4, ['#b5704a', '#a3603c', '#c2825c'], rng);
        setHex(px, 4, 12, '#e8dcc0');
        setHex(px, 3, 13, '#e8dcc0');
    },
    [IT.FLESH]: (px, rng) => {
        blob(px, 8, 8, 4, ['#a04a3a', '#8c3e30', '#b25a48'], rng);
        setHex(px, 6, 7, '#6e7e3a');
        setHex(px, 10, 9, '#6e7e3a');
    },
    [IT.APPLE]: (px, rng) => {
        blob(px, 8, 9, 4, ['#d83030', '#c42828', '#e84444'], rng);
        setHex(px, 8, 4, '#6b4d2e');
        setHex(px, 8, 3, '#6b4d2e');
        setHex(px, 9, 3, '#4f8f30');
        setHex(px, 10, 4, '#4f8f30');
    },
    [IT.BONE]: (px) => {
        for (let i = 0; i < 8; i++) {
            setHex(px, 4 + i, 11 - i, '#f0ead6');
            setHex(px, 5 + i, 11 - i, '#ded5b8');
        }
        setHex(px, 3, 12, '#f0ead6');
        setHex(px, 4, 13, '#f0ead6');
        setHex(px, 3, 13, '#ded5b8');
        setHex(px, 12, 3, '#f0ead6');
        setHex(px, 13, 4, '#f0ead6');
        setHex(px, 13, 3, '#ded5b8');
    },
    [IT.GUNPOWDER]: (px, rng) => {
        blob(px, 8, 9, 4, ['#5a5a5a', '#444444', '#6e6e6e'], rng);
        setHex(px, 6, 7, '#8a8a8a');
        setHex(px, 10, 10, '#8a8a8a');
    },
    [IT.FIBER]: (px, rng) => {
        const greens = ['#7da34a', '#6b9140', '#8fb45a'];
        for (let i = 0; i < 5; i++) {
            let x = 4 + i * 2;
            for (let y = 13; y > 4 + Math.floor(rng() * 3); y--) {
                setHex(px, x, y, greens[Math.floor(rng() * greens.length)]);
                if (rng() < 0.3) x += rng() < 0.5 ? 1 : -1;
            }
        }
    },
    [IT.ARROW]: (px) => {
        for (let i = 0; i < 8; i++) setHex(px, 4 + i, 11 - i, '#8a6d3b'); // shaft
        setHex(px, 12, 3, '#c8c8c8');
        setHex(px, 13, 2, '#e0e0e0'); // tip
        setHex(px, 12, 2, '#c8c8c8');
        setHex(px, 3, 12, '#f0ead6');
        setHex(px, 2, 13, '#f0ead6'); // fletching
        setHex(px, 4, 13, '#ded5b8');
        setHex(px, 3, 14, '#ded5b8');
    },
    [IT.BOW]: (px) => {
        // curved stave
        for (const [x, y] of [
            [4, 2],
            [5, 2],
            [6, 3],
            [7, 4],
            [8, 5],
            [9, 6],
            [10, 7],
            [11, 8],
            [12, 9],
            [13, 10],
            [13, 11],
            [12, 12],
        ]) {
            setHex(px, x, y, '#6b4d2e');
            setHex(px, x + 1, y + 1, '#523a20');
        }
        // string
        for (let i = 0; i < 10; i++) setHex(px, 3, 3 + i, '#e8e2d0');
        setHex(px, 4, 3, '#e8e2d0');
        setHex(px, 4, 13, '#e8e2d0');
        setHex(px, 12, 13, '#e8e2d0');
    },
};

function armorColors(tier) {
    return tier === 'iron' ? ['#e0e0e0', '#b8b8b8'] : ['#4ee0d6', '#2bbfb5'];
}

function drawHelmet(px, tier) {
    const [c1, c2] = armorColors(tier);
    for (let y = 4; y <= 9; y++) {
        for (let x = 3; x <= 12; x++) {
            if (y === 4 && (x < 5 || x > 10)) continue;
            setHex(px, x, y, y < 6 ? c1 : c2);
        }
    }
    for (let y = 8; y <= 9; y++) {
        setHex(px, 6, y, '#222');
        setHex(px, 7, y, '#222');
        setHex(px, 8, y, '#222');
        setHex(px, 9, y, '#222');
    }
    setHex(px, 7, 8, c2);
    setHex(px, 8, 8, c2); // nose bridge
}

function drawChest(px, tier) {
    const [c1, c2] = armorColors(tier);
    for (let y = 3; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
            if (y <= 4 && x >= 6 && x <= 9) continue; // neck hole
            setHex(px, x, y, x < 6 || x > 9 ? c2 : c1);
        }
    }
    setHex(px, 3, 3, c2);
    setHex(px, 12, 3, c2); // shoulders
    setHex(px, 3, 4, c2);
    setHex(px, 12, 4, c2);
}

function drawLegs(px, tier) {
    const [c1, c2] = armorColors(tier);
    for (let x = 4; x <= 11; x++) setHex(px, x, 3, c1);
    for (let y = 4; y <= 12; y++) {
        setHex(px, 4, y, c2);
        setHex(px, 5, y, c1);
        setHex(px, 10, y, c1);
        setHex(px, 11, y, c2);
    }
}

function drawBoots(px, tier) {
    const [c1, c2] = armorColors(tier);
    for (let y = 7; y <= 9; y++) {
        setHex(px, 3, y, c1);
        setHex(px, 4, y, c1);
        setHex(px, 11, y, c1);
        setHex(px, 12, y, c1);
    }
    for (let y = 10; y <= 12; y++) {
        for (let x = 2; x <= 5; x++) setHex(px, x, y, c2);
        for (let x = 10; x <= 13; x++) setHex(px, x, y, c2);
    }
}

ITEM_PAINTERS[IT.IRON_HELMET] = (px) => drawHelmet(px, 'iron');
ITEM_PAINTERS[IT.IRON_CHEST] = (px) => drawChest(px, 'iron');
ITEM_PAINTERS[IT.IRON_LEGS] = (px) => drawLegs(px, 'iron');
ITEM_PAINTERS[IT.IRON_BOOTS] = (px) => drawBoots(px, 'iron');
ITEM_PAINTERS[IT.DIAMOND_HELMET] = (px) => drawHelmet(px, 'diamond');
ITEM_PAINTERS[IT.DIAMOND_CHEST] = (px) => drawChest(px, 'diamond');
ITEM_PAINTERS[IT.DIAMOND_LEGS] = (px) => drawLegs(px, 'diamond');
ITEM_PAINTERS[IT.DIAMOND_BOOTS] = (px) => drawBoots(px, 'diamond');

const iconCache = new Map();
let atlasCanvasRef = null;

export function setAtlasCanvas(canvas) {
    atlasCanvasRef = canvas;
}

export function getItemIcon(id) {
    if (iconCache.has(id)) return iconCache.get(id);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (id < 100) {
        const tiles = BLOCKS[id]?.tiles;
        if (tiles && atlasCanvasRef) {
            const t = tiles.side;
            ctx.drawImage(
                atlasCanvasRef,
                (t % ATLAS_COLS) * TILE,
                Math.floor(t / ATLAS_COLS) * TILE,
                TILE,
                TILE,
                0,
                0,
                TILE,
                TILE,
            );
        }
    } else {
        const painter = ITEM_PAINTERS[id];
        if (painter) {
            const img = ctx.createImageData(TILE, TILE);
            painter(img.data, mulberry32(5000 + id));
            ctx.putImageData(img, 0, 0);
        }
    }
    iconCache.set(id, canvas);
    return canvas;
}
