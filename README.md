# Minecraft-ish

Clone de Minecraft survival en Three.js, sans bundler, sans assets — toutes les
textures sont du pixel-art procédural et tous les sons sont synthétisés en WebAudio.

## Lancer

```bash
npm run dev        # serveur sur http://localhost:3002
npm test           # tests éclairage + inventaire/craft
npm run check      # vérification bundle (esbuild)
npm run format     # prettier
```

## Features

- Monde voxel en chunks 16×16×96, streaming infini, génération procédurale
  (montagnes, grottes, lacs, arbres, fleurs, filons de minerais par profondeur)
- Éclairage voxel réel: lumière du ciel propagée par BFS + torches (niveau 14),
  shader custom qui module le ciel selon l'heure — nuits noires, grottes sombres
- Cycle jour/nuit 10 min: soleil, lune, étoiles, couchers de soleil
- Survie: santé, faim, noyade, dégâts de chute, régénération, mort avec drop
- Minage progressif (dureté × outil), paliers de pioches bois→pierre→fer→diamant
- Craft: établi et fourneau débloquent les recettes avancées (fonte au charbon)
- Armure fer/diamant: 4 slots, réduction de dégâts, durabilité
- Mobs: cochons (jour), zombies / squelettes archers / creepers (nuit) —
  les morts-vivants brûlent à l'aube
- TNT avec réactions en chaîne
- Sauvegarde localStorage: édits du monde (diff par chunk), inventaire, position

## Contrôles

WASD bouger · Souris regarder · Espace sauter · Shift sprinter ·
Clic gauche miner/attaquer · Clic droit placer/manger/allumer ·
Clic molette choisir le bloc · E inventaire + craft · 1-9 hotbar · F voler

## Structure

```
src/
├── main.js          assemblage + boucle de jeu
├── core/            noise (value noise/fbm), physics (AABB voxel), save (localStorage)
├── world/           constants, blocks (registre), world (chunks/gen), lighting (BFS), mesher (AO + lumière)
├── entities/        player (vitals), mobs (IA), drops (items au sol)
├── items/           items (outils/nourriture/armure), inventory, crafting (recettes)
├── gameplay/        interact (minage/combat/placement), effects (TNT/explosions)
├── render/          textures (atlas procédural + icônes), sky (cycle jour/nuit)
├── ui/              hud (cœurs/hotbar/inventaire/recettes)
└── audio/           sounds (synthé WebAudio)
test/                tests node sans DOM (lighting, inventaire/craft)
tools/               scripts one-shot
```
