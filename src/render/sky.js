// Sky: day/night cycle, sun/moon, stars, drifting clouds, and the scene lights
// used by Lambert-shaded mobs. Owns timeOfDay (persisted by the savegame).

import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

const DAY_LENGTH = 600; // seconds for a full cycle

const COL_DAY = new THREE.Color(0x87ceeb);
const COL_SUNSET = new THREE.Color(0xf08a4a);
const COL_NIGHT = new THREE.Color(0x070b1d);

function makeCloudTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rng = mulberry32(4242);
    for (let i = 0; i < 90; i++) {
        const cx = Math.floor(rng() * size),
            cy = Math.floor(rng() * size),
            r = 8 + Math.floor(rng() * 22);
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const x = (cx + dx + size) % size,
                    y = (cy + dy + size) % size;
                const k = (y * size + x) * 4;
                img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
                img.data[k + 3] = Math.min(235, img.data[k + 3] + 90);
            }
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

export class Sky {
    constructor(scene) {
        this.timeOfDay = 0.05; // 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight
        this.color = new THREE.Color();

        this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a553a, 1.0);
        this.dirLight = new THREE.DirectionalLight(0xfff2d0, 1.6);
        this.dirLight.position.set(0.6, 1, 0.3);
        scene.add(this.hemi, this.dirLight);

        this.sun = new THREE.Mesh(
            new THREE.PlaneGeometry(36, 36),
            new THREE.MeshBasicMaterial({ color: 0xfffbe0, fog: false }),
        );
        this.moon = new THREE.Mesh(
            new THREE.PlaneGeometry(26, 26),
            new THREE.MeshBasicMaterial({ color: 0xdde4f0, fog: false }),
        );
        scene.add(this.sun, this.moon);

        const starRng = mulberry32(77);
        const starPos = [];
        for (let i = 0; i < 420; i++) {
            const t = starRng() * Math.PI * 2,
                p = Math.acos(starRng() * 2 - 1);
            starPos.push(
                420 * Math.sin(p) * Math.cos(t),
                Math.abs(420 * Math.cos(p)) + 20,
                420 * Math.sin(p) * Math.sin(t),
            );
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        this.starMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.6,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
        });
        this.stars = new THREE.Points(starGeo, this.starMat);
        scene.add(this.stars);

        this.cloudTex = makeCloudTexture();
        this.cloudMat = new THREE.MeshBasicMaterial({
            map: this.cloudTex,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
        });
        this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.cloudMat);
        this.clouds.rotation.x = -Math.PI / 2;
        this.clouds.position.y = 120;
        scene.add(this.clouds);
    }

    // Advance the cycle, move sky objects around the player, scale the lights.
    // Returns { skyColor, dayFactor, isNight }.
    update(dt, playerPos, camera) {
        this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH) % 1;
        const ang = this.timeOfDay * Math.PI * 2;
        const sinH = Math.sin(ang);

        // chunk skylight multiplier: full day 1.0, moonlit night ~0.16
        const dayFactor = 0.16 + 0.84 * THREE.MathUtils.smoothstep(sinH, -0.12, 0.25);

        // sky color: night -> sunset -> day
        const f1 = THREE.MathUtils.smoothstep(sinH, -0.3, 0.0);
        const f2 = THREE.MathUtils.smoothstep(sinH, 0.02, 0.3);
        this.color.copy(COL_NIGHT).lerp(COL_SUNSET, f1).lerp(COL_DAY, f2);

        this.sun.position.set(
            playerPos.x + Math.cos(ang) * 380,
            playerPos.y + sinH * 380,
            playerPos.z,
        );
        this.moon.position.set(
            playerPos.x - Math.cos(ang) * 380,
            playerPos.y - sinH * 380,
            playerPos.z,
        );
        this.sun.lookAt(camera.position);
        this.moon.lookAt(camera.position);
        this.starMat.opacity = THREE.MathUtils.clamp(-sinH * 2.2, 0, 0.9);
        this.stars.position.set(playerPos.x, 0, playerPos.z);

        this.clouds.position.x = playerPos.x;
        this.clouds.position.z = playerPos.z;
        this.cloudTex.offset.x += dt * 0.002;
        this.cloudMat.color.setScalar(0.25 + 0.75 * dayFactor);

        this.hemi.intensity = 0.25 + 0.85 * dayFactor;
        this.dirLight.intensity = 0.2 + 1.4 * dayFactor;

        return { skyColor: this.color, dayFactor, isNight: sinH < -0.05 };
    }

    // "HH:MM" for the debug readout (06:00 = sunrise)
    clockString() {
        const hours = Math.floor((this.timeOfDay * 24 + 6) % 24);
        const mins = Math.floor(((this.timeOfDay * 24 + 6) * 60) % 60);
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
}
