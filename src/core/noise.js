// Seeded value noise (2D + 3D) with fbm, used for terrain and caves.

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Integer lattice hash -> [0, 1)
function hash3(x, y, z, seed) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export function hash2(x, z, seed) {
    return hash3(x, 0, z, seed);
}

function smooth(t) {
    return t * t * (3 - 2 * t);
}

export function valueNoise2(x, z, seed) {
    const xi = Math.floor(x),
        zi = Math.floor(z);
    const xf = smooth(x - xi),
        zf = smooth(z - zi);
    const a = hash2(xi, zi, seed);
    const b = hash2(xi + 1, zi, seed);
    const c = hash2(xi, zi + 1, seed);
    const d = hash2(xi + 1, zi + 1, seed);
    return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}

export function fbm2(x, z, octaves, seed) {
    let total = 0,
        amp = 1,
        freq = 1,
        max = 0;
    for (let i = 0; i < octaves; i++) {
        total += valueNoise2(x * freq, z * freq, seed + i * 1013) * amp;
        max += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return total / max; // [0, 1]
}

export function valueNoise3(x, y, z, seed) {
    const xi = Math.floor(x),
        yi = Math.floor(y),
        zi = Math.floor(z);
    const xf = smooth(x - xi),
        yf = smooth(y - yi),
        zf = smooth(z - zi);
    const c000 = hash3(xi, yi, zi, seed);
    const c100 = hash3(xi + 1, yi, zi, seed);
    const c010 = hash3(xi, yi + 1, zi, seed);
    const c110 = hash3(xi + 1, yi + 1, zi, seed);
    const c001 = hash3(xi, yi, zi + 1, seed);
    const c101 = hash3(xi + 1, yi, zi + 1, seed);
    const c011 = hash3(xi, yi + 1, zi + 1, seed);
    const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
    const x00 = c000 + (c100 - c000) * xf;
    const x10 = c010 + (c110 - c010) * xf;
    const x01 = c001 + (c101 - c001) * xf;
    const x11 = c011 + (c111 - c011) * xf;
    const y0 = x00 + (x10 - x00) * yf;
    const y1 = x01 + (x11 - x01) * yf;
    return y0 + (y1 - y0) * zf;
}
