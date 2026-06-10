// Minecraft-ish survival — wires together world streaming, sky, player vitals,
// mobs, drops, mining, TNT, inventory/crafting UI, audio and the savegame.

import * as THREE from 'three';
import {
    createAtlas,
    createCrackTextures,
    setAtlasCanvas,
    getItemIcon,
} from './render/textures.js';
import { Sky } from './render/sky.js';
import { World } from './world/world.js';
import { buildBlockItemGeometry } from './world/mesher.js';
import { Player } from './entities/player.js';
import { DropManager } from './entities/drops.js';
import { MobManager } from './entities/mobs.js';
import { Interaction } from './gameplay/interact.js';
import { Effects } from './gameplay/effects.js';
import { Inventory } from './items/inventory.js';
import { UI } from './ui/hud.js';
import { S } from './audio/sounds.js';
import { loadSave, writeSave, clearSave, applySave } from './core/save.js';

const COL_WATER = new THREE.Color(0x2a4a9a);

// ---- renderer / scene / camera ----
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- game objects ----
const { texture: atlasTexture, canvas: atlasCanvas } = createAtlas();
setAtlasCanvas(atlasCanvas);

const sky = new Sky(scene);
const world = new World(scene, atlasTexture);
const player = new Player(world, camera, renderer.domElement);
const inv = new Inventory();
const ui = new UI(inv);
const drops = new DropManager(scene, world, world.opaqueMaterial);
const mobs = new MobManager(scene, world);
const effects = new Effects(scene);
const interact = new Interaction({
    world,
    player,
    camera,
    scene,
    inv,
    ui,
    drops,
    mobs,
    crackTextures: createCrackTextures(),
    dom: renderer.domElement,
});

// ---- savegame: restore world edits + player before first generation ----
const save = loadSave();
if (save) {
    sky.timeOfDay = applySave(save, { world, player, inv });
    world.pregenerate(player.pos.x, player.pos.z);
} else {
    player.findSpawn(); // pure math, picks dry grassy ground before any chunks exist
    world.pregenerate(player.pos.x, player.pos.z);
    inv.add(8, 16); // small head start in a fresh world
}
player.armorProvider = () => inv;

function persist() {
    writeSave({ world, player, inv, timeOfDay: sky.timeOfDay });
}
setInterval(persist, 10000);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
});
document.getElementById('newworld').addEventListener('click', (e) => {
    e.stopPropagation();
    clearSave();
    window.removeEventListener('beforeunload', persist);
    location.reload();
});

// ---- environment shared with mobs / explosions ----
const env = {
    world,
    player,
    dropManager: drops,
    sounds: S,
    isNight: false,
    dayFactor: 1,
    damagePlayer(n, fromPos) {
        player.damage(n, { armored: true });
        if (fromPos) player.knockback(fromPos.x, fromPos.z);
    },
    shootArrow(pos, vel) {
        mobs.shootArrow(pos, vel);
    },
    explodeAt(x, y, z, radius) {
        S.explosion();
        // destroy terrain, scatter a few block drops, chain nearby TNT
        const result = world.explode(x, y, z, radius);
        for (const d of result.drops) {
            drops.spawn(d.x + 0.5, d.y + 0.5, d.z + 0.5, d.id, d.n);
        }
        for (const t of result.tnts) {
            effects.igniteTNT(t.x, t.y, t.z, 0.3 + Math.random() * 0.6);
        }
        // hurt the player
        const pd = Math.hypot(player.pos.x - x, player.pos.y + 0.9 - y, player.pos.z - z);
        const blast = radius * 1.8;
        if (pd < blast) {
            player.damage(Math.ceil((1 - pd / blast) * 22), { armored: true });
            player.knockback(x, z, 14);
        }
        // hurt other mobs
        mobs.explodeDamage(x, y, z, radius, env);
        effects.flash(x, y, z, radius);
    },
};

effects.onExplode = (x, y, z, r) => env.explodeAt(x, y, z, r);
interact.onIgniteTNT = (x, y, z) => {
    world.setBlock(x, y, z, 0); // block disappears, primed entity takes over
    effects.igniteTNT(x, y, z, 2);
    S.hiss();
};

// ---- held item view ----
const heldGroup = new THREE.Group();
camera.add(heldGroup);
scene.add(camera);
heldGroup.position.set(0.42, -0.38, -0.65);
let heldMesh = null;
let heldId = null;
let swingT = 1;

function refreshHeld() {
    const stack = inv.currentItem();
    const id = stack ? stack.id : null;
    if (id === heldId) return;
    heldId = id;
    if (heldMesh) {
        heldGroup.remove(heldMesh);
        heldMesh = null;
    }
    if (id === null) return;
    if (id < 100) {
        heldMesh = new THREE.Mesh(buildBlockItemGeometry(id, 0.4), world.opaqueMaterial);
    } else {
        const tex = new THREE.CanvasTexture(getItemIcon(id));
        tex.magFilter = THREE.NearestFilter;
        heldMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.42, 0.42),
            new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide,
            }),
        );
        heldMesh.rotation.y = -0.5;
    }
    heldGroup.add(heldMesh);
}

renderer.domElement.addEventListener('mousedown', () => {
    if (document.pointerLockElement === renderer.domElement) swingT = 0;
});

// ---- player damage / death feedback ----
player.onDamaged = () => {
    ui.flashDamage();
    S.hurt();
};
player.onDeath = () => {
    S.death();
    drops.scatter(player.pos, inv.dumpAll());
    document.exitPointerLock();
    ui.setInventoryOpen(false);
    ui.showDeath(() => {
        player.respawn();
        renderer.domElement.requestPointerLock();
    });
};

// ---- pointer lock / pause overlay / inventory key ----
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
    S.unlock();
    renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) ui.setInventoryOpen(false);
    overlay.classList.toggle('hidden', locked || ui.inventoryOpen || player.dead);
});
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !player.dead) {
        if (ui.inventoryOpen) {
            ui.setInventoryOpen(false);
            renderer.domElement.requestPointerLock();
        } else if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock();
            ui.setInventoryOpen(true, interact.craftCtx());
        }
    }
    if (e.code === 'Escape' && ui.inventoryOpen) ui.setInventoryOpen(false);
});
ui.onInventoryToggle = (open) => {
    if (!open && document.pointerLockElement !== renderer.domElement && !player.dead) {
        overlay.classList.remove('hidden');
    }
};

// ---- main loop ----
const debugEl = document.getElementById('debug');
const clock = new THREE.Clock();
let statTimer = 0;
let frames = 0,
    fps = 0,
    fpsTimer = 0;

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const locked = document.pointerLockElement === renderer.domElement;

    const { skyColor, dayFactor, isNight } = sky.update(dt, player.pos, camera);
    world.uniforms.uDay.value = dayFactor;
    env.dayFactor = dayFactor;
    env.isNight = isNight;

    const { headInWater } = player.update(dt, locked);
    world.update(player.pos.x, player.pos.z);
    interact.update(dt, locked);
    mobs.update(dt, env);
    drops.update(dt, player, inv, () => S.pickup(), camera, Math.max(dayFactor, 0.3));
    effects.update(dt);

    // held item swing + bob
    refreshHeld();
    swingT = Math.min(1, swingT + dt * 4);
    const swing = Math.sin(swingT * Math.PI) * 0.5;
    heldGroup.rotation.x = -swing * 1.2;
    heldGroup.position.y =
        -0.38 -
        swing * 0.18 +
        Math.sin(performance.now() * 0.008) * 0.012 * Math.hypot(player.vel.x, player.vel.z) * 0.2;

    // fog + background
    if (headInWater) {
        scene.background.copy(COL_WATER);
        world.uniforms.uFogColor.value.copy(COL_WATER);
        world.uniforms.uFogNear.value = 1;
        world.uniforms.uFogFar.value = 24;
    } else {
        scene.background.copy(skyColor);
        world.uniforms.uFogColor.value.copy(skyColor);
        world.uniforms.uFogNear.value = 60;
        world.uniforms.uFogFar.value = 150;
    }

    // stats bar at ~20 Hz
    statTimer += dt;
    if (statTimer > 0.05) {
        statTimer = 0;
        ui.updateStats(player, inv.armorPoints());
    }

    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
        fps = Math.round(frames / fpsTimer);
        frames = 0;
        fpsTimer = 0;
        const p = player.pos;
        debugEl.textContent =
            `Minecraft-ish  ${fps} fps   ${sky.clockString()}\n` +
            `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\n` +
            `Chunks: ${world.countMeshedChunks()} / ${world.chunks.size}   Mobs: ${mobs.mobs.length}   Drops: ${drops.drops.length}` +
            (player.flying ? '\nVOL (F)' : '');
    }

    renderer.render(scene, camera);
}

loop();
