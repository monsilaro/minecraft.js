// Main-thread side of meshing: wraps the pure typed arrays from mesher-core
// (computed here or in the mesh worker) into THREE.BufferGeometry.

import * as THREE from 'three';
import { buildChunkArrays, buildBlockItemArrays } from './mesher-core.js';

export function arraysToGeometry(a) {
    if (!a) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(a.colors, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(a.uvs, 2));
    g.setAttribute('aSky', new THREE.BufferAttribute(a.sky, 1));
    g.setAttribute('aTorch', new THREE.BufferAttribute(a.torch, 1));
    g.setIndex(new THREE.BufferAttribute(a.indices, 1));
    g.computeBoundingSphere();
    return g;
}

// Synchronous meshing (used for the pregenerated spawn area).
export function buildChunkGeometry(world, chunk, light) {
    const { opaque, trans } = buildChunkArrays(world, chunk, light);
    return { opaque: arraysToGeometry(opaque), trans: arraysToGeometry(trans) };
}

export function buildBlockItemGeometry(id, size = 0.25) {
    return arraysToGeometry(buildBlockItemArrays(id, size));
}
