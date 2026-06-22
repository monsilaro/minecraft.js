// Atlas layout math, dependency-free so the mesh worker can import it
// (textures.js re-exports these for the main thread).

export const TILE = 16;
export const ATLAS_COLS = 8;

// UV rect of a tile, with a small inset against bleeding.
// v0 = bottom of the drawn tile (flipY convention).
export function tileUV(index) {
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    const s = 1 / ATLAS_COLS;
    const inset = s * 0.02;
    return {
        u0: col * s + inset,
        v0: (ATLAS_COLS - 1 - row) * s + inset,
        u1: (col + 1) * s - inset,
        v1: (ATLAS_COLS - row) * s - inset,
    };
}
