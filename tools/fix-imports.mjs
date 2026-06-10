// One-shot: rewrite module specifiers after the folder restructure.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const MAP = {
    'noise.js': 'core/noise.js',
    'physics.js': 'core/physics.js',
    'save.js': 'core/save.js',
    'worldconst.js': 'world/constants.js',
    'blocks.js': 'world/blocks.js',
    'world.js': 'world/world.js',
    'lighting.js': 'world/lighting.js',
    'mesher.js': 'world/mesher.js',
    'items.js': 'items/items.js',
    'inventory.js': 'items/inventory.js',
    'crafting.js': 'items/crafting.js',
    'player.js': 'entities/player.js',
    'mobs.js': 'entities/mobs.js',
    'drops.js': 'entities/drops.js',
    'textures.js': 'render/textures.js',
    'hud.js': 'ui/hud.js',
    'sounds.js': 'audio/sounds.js',
    'interact.js': 'gameplay/interact.js',
};

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (p.endsWith('.js')) out.push(p);
    }
    return out;
}

const srcRoot = join(process.cwd(), 'src');
for (const file of walk(srcRoot)) {
    let content = readFileSync(file, 'utf8');
    const fromDir = dirname(file);
    for (const [old, target] of Object.entries(MAP)) {
        let rel = relative(fromDir, join(srcRoot, target)).replaceAll('\\', '/');
        if (!rel.startsWith('.')) rel = './' + rel;
        content = content.replaceAll(`'./${old}'`, `'${rel}'`);
    }
    writeFileSync(file, content);
}

for (const file of ['test/light-test.mjs', 'test/inv-test.mjs']) {
    let c = readFileSync(file, 'utf8');
    for (const [old, target] of Object.entries(MAP)) {
        c = c.replaceAll(`'../src/${old}'`, `'../src/${target}'`);
    }
    writeFileSync(file, c);
}
console.log('imports rewritten');
