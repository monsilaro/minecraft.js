// Transient world effects: primed TNT (flashing cube on a timer) and the
// expanding explosion flash sphere.

import * as THREE from 'three';

export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.tntFuses = [];
        this.flashes = [];
        this.fuseMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
        });
        this.onExplode = null; // cb(x, y, z, radius) wired by main
    }

    igniteTNT(x, y, z, fuse = 2) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), this.fuseMat.clone());
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.scene.add(mesh);
        this.tntFuses.push({ x, y, z, t: fuse, mesh });
    }

    flash(x, y, z, radius) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.6, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.9 }),
        );
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        this.flashes.push({ mesh, t: 0 });
    }

    update(dt) {
        for (let i = this.tntFuses.length - 1; i >= 0; i--) {
            const f = this.tntFuses[i];
            f.t -= dt;
            f.mesh.material.opacity = 0.3 + 0.5 * Math.abs(Math.sin(f.t * 12));
            if (f.t <= 0) {
                this.scene.remove(f.mesh);
                this.tntFuses.splice(i, 1);
                if (this.onExplode) this.onExplode(f.x + 0.5, f.y + 0.5, f.z + 0.5, 4.2);
            }
        }

        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.t += dt;
            f.mesh.scale.setScalar(1 + f.t * 6);
            f.mesh.material.opacity = Math.max(0, 0.9 - f.t * 2.5);
            if (f.t > 0.4) {
                this.scene.remove(f.mesh);
                f.mesh.geometry.dispose();
                f.mesh.material.dispose();
                this.flashes.splice(i, 1);
            }
        }
    }
}
