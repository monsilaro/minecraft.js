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
import { ITEMS } from './items/items.js';
import { EMIT_LUT, BRAZIER } from './world/blocks.js';
import {
    gloomExposure,
    gloomDamagePerSecond,
    GLOOM_SAFE_RADIUS,
    GLOOM_SAFE_LIGHT,
    BRAZIER_SAFE_RADIUS,
} from './world/breath.js';
import { UI } from './ui/hud.js';
import { S, setVolume, getVolume } from './audio/sounds.js';
import {
    listSlots,
    loadSlot,
    writeSlot,
    clearSlot,
    applySave,
    randomSeed,
    slotExists,
    backupSlot,
} from './core/save.js';

const COL_WATER = new THREE.Color(0x2a2050); // submerged in the Brume

// ---- renderer / scene / camera ----
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6e7490);

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

player.armorProvider = () => inv;

// ---- world-select screen: pick a slot before generating anything ----
let currentSlot = null;
let started = false;

function persist() {
    if (currentSlot === null) return false;
    return writeSlot(currentSlot, { world, player, inv, timeOfDay: sky.timeOfDay });
}

// Restore world edits + player, or seed a fresh world, then begin play.
function startGame(slot) {
    currentSlot = slot;
    const save = loadSlot(slot);
    if (save) {
        sky.timeOfDay = applySave(save, { world, player, inv });
        world.pregenerate(player.pos.x, player.pos.z);
    } else {
        // A null load on a slot that *has* raw data means it's corrupt or from an
        // older version. Back it up before the fresh world's first autosave
        // overwrites it, so no real progress is lost silently.
        if (slotExists(slot)) {
            backupSlot(slot);
            ui.toast('⚠️ Sauvegarde illisible — copie de secours créée');
        }
        world.seed = randomSeed(); // every fresh world gets a different map
        player.findSpawn(); // pure math, picks dry grassy ground before any chunks exist
        world.pregenerate(player.pos.x, player.pos.z);
        inv.add(8, 16); // small head start in a fresh world
    }
    document.getElementById('slotpicker').classList.add('hidden');
    started = true;
    // lock straight into the game using this click gesture (no "click to play")
    S.unlock();
    renderer.domElement.requestPointerLock();

    // Autosave every 10s. If a save fails (e.g. localStorage quota), surface it
    // once instead of losing progress silently; re-toast only when it flips back
    // to failing after a success, so we don't spam every tick.
    let lastSaveOk = true;
    setInterval(() => {
        const ok = persist();
        if (!ok && lastSaveOk) ui.toast('⚠️ Sauvegarde échouée! (espace plein?)');
        lastSaveOk = ok;
    }, 10000);
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persist();
    });
}

function renderSlotPicker() {
    const cards = document.getElementById('slotcards');
    cards.innerHTML = '';
    for (const s of listSlots()) {
        const card = document.createElement('div');
        card.className = 'slotcard';
        const title = document.createElement('h2');
        title.textContent = `Monde ${s.index + 1}`;
        card.appendChild(title);

        const info = document.createElement('div');
        if (s.exists) {
            info.className = 'meta';
            const when = s.savedAt ? new Date(s.savedAt).toLocaleString() : 'inconnu';
            info.innerHTML = `Joué: ${when}<br />Seed: ${s.seed ?? '?'}<br />❤ ${Math.ceil((s.hp ?? 20) / 2)}/10`;
        } else {
            info.className = 'empty';
            info.textContent = '✨ Nouveau monde';
        }
        card.appendChild(info);

        const play = document.createElement('button');
        play.className = 'play';
        play.textContent = s.exists ? '▶ Jouer' : '✨ Créer';
        play.addEventListener('click', () => startGame(s.index));
        card.appendChild(play);

        if (s.exists) {
            const del = document.createElement('button');
            del.className = 'del';
            del.textContent = '🗑 Supprimer';
            del.addEventListener('click', () => {
                if (confirm(`Supprimer le Monde ${s.index + 1}?`)) {
                    clearSlot(s.index);
                    renderSlotPicker();
                }
            });
            card.appendChild(del);
        }
        cards.appendChild(card);
    }
}
renderSlotPicker();

// "Changer de monde": save, then reload for a clean reset back to the picker.
document.getElementById('newworld').addEventListener('click', (e) => {
    e.stopPropagation();
    persist();
    window.removeEventListener('beforeunload', persist);
    location.reload();
});

// "Sauvegarder": manual save with visible confirmation (autosave already runs).
document.getElementById('savebtn').addEventListener('click', (e) => {
    e.stopPropagation();
    ui.toast(persist() ? '💾 Sauvegardé!' : '⚠️ Échec de sauvegarde!');
});

// "Reflux": skip the cycle to noon, where the Gloom recedes — survive the Breath
document.getElementById('setday').addEventListener('click', (e) => {
    e.stopPropagation();
    sky.timeOfDay = 0.25; // 0.25 = noon = full Reflux (gloom 0)
    ui.toast('🌒 Le Reflux! Les Ténèbres refluent.');
});

// ---- volume slider (in the inventory footer) ----
const volSlider = document.getElementById('volslider');
const volVal = document.getElementById('volval');
function syncVol() {
    volVal.textContent = `${Math.round(getVolume() * 100)}%`;
}
volSlider.value = String(Math.round(getVolume() * 100));
syncVol();
volSlider.addEventListener('input', () => {
    setVolume(Number(volSlider.value) / 100);
    syncVol();
});
// keep slider clicks from bubbling into game/menu handlers
volSlider.addEventListener('click', (e) => e.stopPropagation());
document.getElementById('volume').addEventListener('click', (e) => e.stopPropagation());

// ---- environment shared with mobs / explosions ----
const env = {
    world,
    player,
    dropManager: drops,
    sounds: S,
    isNight: false,
    dayFactor: 1,
    gloom: 0,
    gloomLineY: 0,
    damagePlayer(n, fromPos) {
        // only play hurt sound + knock back when the hit actually lands
        // (not during the 0.6s invulnerability window)
        if (player.damage(n, { armored: true })) {
            S.hurt();
            if (fromPos) player.knockback(fromPos.x, fromPos.z);
        }
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

// breaking a log makes its disconnected leaves decay gradually
interact.onLogBroken = (x, y, z) => world.decayLeavesAround(x, y, z);

// bed: set spawn, and skip to morning at night (unless hostiles are nearby)
interact.onUseBed = (x, y, z) => {
    const danger = mobs.mobs.some((m) => m.type !== 'pig' && m.pos.distanceTo(player.pos) < 12);
    if (danger) {
        ui.toast('Trop dangereux pour dormir!');
        return;
    }
    player.spawnPoint.set(x + 0.5, y + 1.2, z + 0.5);
    if (env.isNight) {
        sky.timeOfDay = 0.0; // sunrise
        ui.toast('Tu te réveilles au matin. Réapparition définie.');
    } else {
        ui.toast('Point de réapparition défini.');
    }
    persist();
};

// ---- held item view ----
const heldGroup = new THREE.Group();
camera.add(heldGroup);
scene.add(camera);
heldGroup.position.set(0.42, -0.38, -0.65);
let heldMesh = null;
let heldItemMat = null; // material of the held icon plane, or null (blocks/empty)
let heldId = -2; // sentinel: forces the first refreshHeld() to run
let heldIsBlade = false; // sword/axe → arc slash instead of a forward jab
let swingT = 1;

// base colors for the first-person arm; dimmed by daylight each frame
const ARM_SKIN = new THREE.Color(0xcf9b6c);
const ARM_SLEEVE = new THREE.Color(0x3a6ea5);

// first-person right arm, shown when the hands are empty (so punches are visible)
const armGroup = new THREE.Group();
const armSkin = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.13, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xcf9b6c }),
);
armSkin.position.set(0, 0, -0.18);
const armSleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.17, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x3a6ea5 }),
);
armSleeve.position.set(0, 0, 0.12);
armGroup.add(armSkin, armSleeve);
armGroup.position.set(0.02, -0.05, 0.15);
armGroup.rotation.set(0.5, 0.15, -0.2);
armGroup.visible = false;
heldGroup.add(armGroup);

function refreshHeld() {
    const stack = inv.currentItem();
    const id = stack ? stack.id : null;
    if (id === heldId) return;
    heldId = id;
    if (heldMesh) {
        heldGroup.remove(heldMesh);
        heldMesh = null;
    }
    armGroup.visible = id === null; // empty hand → show the bare arm
    heldItemMat = null;
    const def = id !== null ? ITEMS[id] : null;
    heldIsBlade = !!(def && (def.tool === 'sword' || def.tool === 'axe'));
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
        heldItemMat = heldMesh.material; // unlit icon plane → dim it by daylight
    }
    heldGroup.add(heldMesh);
}

renderer.domElement.addEventListener('mousedown', () => {
    if (document.pointerLockElement === renderer.domElement) swingT = 0;
    else if (started && !ui.inventoryOpen && !player.dead) {
        renderer.domElement.requestPointerLock(); // safety: re-lock if somehow unlocked w/o veil
    }
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

// ---- pointer lock is the single source of truth for the in-game menu ----
// locked ⇒ menu closed (playing);  unlocked ⇒ menu open (paused).
// Keys only request/exit the lock — they never open/close the menu directly,
// which is what previously made Escape toggle the menu twice.
// The menu is opened/closed ONLY by Tab/E. Escape just unlocks the pointer
// (browser-forced, can't be intercepted) → show a pause veil; clicking it resumes.
const pauseEl = document.getElementById('pause');
pauseEl.addEventListener('click', () => {
    S.unlock();
    renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked && ui.inventoryOpen) ui.setInventoryOpen(false); // re-locking = back in game
    // veil only for the "unlocked, no menu" pause state (Escape / alt-tab)
    pauseEl.classList.toggle('hidden', locked || ui.inventoryOpen || player.dead || !started);
});
// kill all browser context menus (UI + canvas) — right-click is game/UI only
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
    if (!started || player.dead || e.target?.tagName === 'INPUT') return;
    if (e.code === 'Tab' || e.code === 'KeyE') {
        e.preventDefault();
        if (ui.inventoryOpen) {
            ui.setInventoryOpen(false);
            renderer.domElement.requestPointerLock();
        } else {
            ui.setInventoryOpen(true, { mode: 'hand' });
            document.exitPointerLock();
        }
    }
});

// ---- The Breath bites: the Gloom drains the unlit below the tideline ----
const gloomVeil = document.getElementById('gloomveil');
let gloomDmgAccum = 0; // fractional hp carried between frames
let gloomWarned = false; // one warning per descent into the dark
let gloomLit = false; // cached light check, refreshed a few times/sec
let gloomLitTimer = 0;
let gloomVeilOpacity = 0;

// Is the player in enough light to be safe? Scans nearby emissive blocks
// (EMIT_LUT): a Brazier wards a large guaranteed sphere (the refined upgrade),
// while a lantern/torch protects by distance falloff. Cheap: it only runs while
// actually exposed, and only a few times a second.
function litAgainstGloom(pos) {
    const px = Math.floor(pos.x),
        py = Math.floor(pos.y),
        pz = Math.floor(pos.z);
    const R = BRAZIER_SAFE_RADIUS;
    for (let dx = -R; dx <= R; dx++) {
        for (let dy = -R; dy <= R; dy++) {
            for (let dz = -R; dz <= R; dz++) {
                const id = world.getBlock(px + dx, py + dy, pz + dz);
                if (!EMIT_LUT[id]) continue;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (id === BRAZIER) {
                    if (dist <= BRAZIER_SAFE_RADIUS) return true;
                } else if (dist <= GLOOM_SAFE_RADIUS && EMIT_LUT[id] - dist >= GLOOM_SAFE_LIGHT) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Drain life while submerged in Gloom without light, and drive the screen veil.
function updateGloom(dt) {
    const exposure = gloomExposure(player.pos.y, env.gloom, env.gloomLineY);
    let veilTarget = 0;
    if (exposure > 0 && !player.dead) {
        gloomLitTimer -= dt;
        if (gloomLitTimer <= 0) {
            gloomLit = litAgainstGloom(player.pos);
            gloomLitTimer = 0.3;
        }
        if (gloomLit) {
            gloomDmgAccum = 0;
            gloomWarned = false;
            veilTarget = exposure * 0.18; // light keeps the murk thin
        } else {
            veilTarget = exposure * 0.9;
            gloomDmgAccum += gloomDamagePerSecond(exposure, false) * dt;
            if (gloomDmgAccum >= 1) {
                const dmg = Math.floor(gloomDmgAccum);
                if (player.damage(dmg)) gloomDmgAccum -= dmg; // env damage, no armor
            }
            if (!gloomWarned) {
                gloomWarned = true;
                ui.toast('🕯️ Les Ténèbres te submergent — trouve la lumière!');
                S.gloom();
            }
        }
    } else {
        gloomDmgAccum = 0;
        gloomWarned = false;
    }
    gloomVeilOpacity += (veilTarget - gloomVeilOpacity) * Math.min(1, dt * 3);
    if (gloomVeil) gloomVeil.style.opacity = gloomVeilOpacity.toFixed(3);
}

// ---- main loop ----
const debugEl = document.getElementById('debug');
const clock = new THREE.Clock();
let statTimer = 0;
let frames = 0,
    fps = 0,
    fpsTimer = 0;

function loop() {
    requestAnimationFrame(loop);
    if (!started) {
        renderer.render(scene, camera); // picker DOM covers the canvas
        return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const locked = document.pointerLockElement === renderer.domElement;

    const { skyColor, dayFactor, isNight, gloom, gloomLineY } = sky.update(dt, player.pos, camera);
    world.uniforms.uDay.value = dayFactor;
    world.uniforms.uGloom.value = gloom;
    world.uniforms.uGloomLineY.value = gloomLineY;
    env.dayFactor = dayFactor;
    env.isNight = isNight;
    env.gloom = gloom;
    env.gloomLineY = gloomLineY;

    const { headInWater } = player.update(dt, locked);
    world.update(player.pos.x, player.pos.z);
    updateGloom(dt);
    interact.update(dt, locked);
    mobs.update(dt, env);
    drops.update(dt, player, inv, () => S.pickup(), camera, Math.max(dayFactor, 0.3));
    effects.update(dt);
    ui.tickFurnace(dt); // smelting progresses while the furnace window is open

    // leaves cut off from logs vanish gradually, sometimes dropping an apple
    const leafDrops = world.updateLeafDecay(dt);
    if (leafDrops) {
        for (const d of leafDrops) drops.spawn(d.x + 0.5, d.y + 0.3, d.z + 0.5, d.id, d.n);
    }

    // held item: blades slash in an arc, everything else does a forward jab
    refreshHeld();
    swingT = Math.min(1, swingT + dt * 4);
    // keep swinging on a loop while actively mining a block, until it breaks
    if (interact.leftDown && interact.mineKey && swingT >= 1) swingT = 0;
    const swing = Math.sin(swingT * Math.PI); // 0..1..0
    const draw = Math.max(0, interact.bowCharge); // pull the bow toward the eye
    const bob =
        Math.sin(performance.now() * 0.008) * 0.012 * Math.hypot(player.vel.x, player.vel.z) * 0.2;
    heldGroup.position.x = 0.42 - draw * 0.18;
    if (heldIsBlade) {
        // diagonal slash: roll the blade up toward the crosshair so the edge
        // leads the swing instead of poking handle-first. Flip rotation.z's
        // sign to slash the other diagonal.
        heldGroup.rotation.z = swing * 1.5;
        heldGroup.rotation.x = -swing * 0.5; // tip pitches forward into the world
        heldGroup.rotation.y = swing * 0.3; // blade edge rotates forward
        heldGroup.position.z = -0.65 - swing * 0.28;
        heldGroup.position.x = 0.42 - swing * 0.1; // pull toward center across the slash
        heldGroup.position.y = -0.38 + bob + swing * 0.04;
    } else {
        heldGroup.rotation.z = 0;
        heldGroup.rotation.y = 0;
        heldGroup.rotation.x = -swing * 0.35; // slight pitch; motion is mostly forward
        heldGroup.position.z = -0.65 + draw * 0.22 - swing * 0.35; // thrust forward (jab)
        heldGroup.position.y = -0.38 + draw * 0.1 + bob - swing * 0.05;
    }

    // light the unlit first-person meshes by daylight (no night flash)
    const heldLight = Math.max(0.18, dayFactor);
    armSkin.material.color.copy(ARM_SKIN).multiplyScalar(heldLight);
    armSleeve.material.color.copy(ARM_SLEEVE).multiplyScalar(heldLight);
    if (heldItemMat) heldItemMat.color.setScalar(heldLight);

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
        const tide =
            env.gloom < 0.15
                ? 'Reflux'
                : env.gloom > 0.75
                  ? 'Respiration'
                  : env.gloom > 0.5
                    ? 'Marée montante'
                    : 'Marée';
        debugEl.textContent =
            `Hollow  ${fps} fps   ${sky.clockString()}\n` +
            `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\n` +
            `Ténèbres: ${tide} ${Math.round(env.gloom * 100)}%  (ligne Y ${env.gloomLineY.toFixed(0)})\n` +
            `Chunks: ${world.countMeshedChunks()} / ${world.chunks.size}   Mobs: ${mobs.mobs.length}   Drops: ${drops.drops.length}` +
            (player.flying ? '\nVOL (F)' : '');
    }

    renderer.render(scene, camera);
}

loop();
