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

## Déploiement (GitHub Pages)

Le jeu est 100 % statique (aucun build) — GitHub Pages le sert tel quel. Ce dépôt
héberge **deux versions à la même source Pages**, distinguées par sous-dossier :

| URL                       | Version                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `…/minecraft.js/`         | **Hollow** (racine) — le pivot crépusculaire, la Respiration |
| `…/minecraft.js/classic/` | **Minecraft-ish** — instantané figé d'avant le pivot         |

Pages ne sert qu'une source par dépôt, mais cette source est une branche entière :
les deux dossiers cohabitent donc sous la même URL racine. Chemins relatifs
partout → un simple sous-dossier suffit, rien à reconfigurer. Comme les chemins
diffèrent (`/` vs `/classic/`), les sauvegardes localStorage des deux versions
restent **séparées**.

Mise en place : **Settings → Pages**, choisir la branche `main` (dossier `/root`)
comme source.

## Features

- Monde voxel en chunks 16×16×96, streaming infini, génération procédurale
  (montagnes, grottes, lacs, arbres, fleurs, filons de minerais par profondeur)
- Éclairage voxel réel: lumière du ciel propagée par BFS + torches (niveau 14),
  shader custom qui module le ciel selon l'heure — nuits noires, grottes sombres
- Cycle jour/nuit 10 min: soleil, lune, étoiles, couchers de soleil
- Survie: santé, faim, noyade, dégâts de chute, régénération, mort avec drop
- Minage progressif (dureté × outil), paliers d'outils bois→pierre→fer→diamant
- **Craft en grille style Minecraft**: patterns _shaped_/shapeless dans une grille
  2×2 (à la main) ou 3×3 (établi), slot de sortie calculé, clic droit = poser 1.
  Livre de recettes qui auto-remplit la grille. **Fourneau** dédié (entrée +
  charbon → fonte avec barre de progression)
- Outils: pioches, épées et **haches** (la hache accélère le bois sans être requise)
- **Portes en bois** 2 blocs de haut, 4 orientations, clic droit pour ouvrir/fermer
- **Décroissance des feuilles**: coupe le tronc et le feuillage déconnecté tombe
  graduellement (≤10 s), avec chance de pomme
- Armure fer/diamant: 4 slots, réduction de dégâts, durabilité
- **La Respiration** (signature de Hollow): une marée de Ténèbres monte et reflue
  sur le cycle du ciel. À marée haute le Gloom inonde les vallées sous la ligne de
  marée et **draine la vie** hors de la lumière — fuis vers les hauteurs ou pose
  des lanternes pour découper des zones sûres
- Créatures: bêtes des landes (au Reflux) et le **cortège spectral** qui monte
  avec la Respiration (spectres, revenants archers, husks explosifs) — ils se
  dissipent quand les Ténèbres refluent
- **Boucle de progression**: le cortège spectral lâche de l'**essence**; raffine-la
  au **Foyer** en _lumen_, fabrique un **Brasier** (nœud de lumière puissant) et
  pose-le pour étendre ton réseau sûr — une sphère plus large qu'une lanterne que
  le Gloom ne peut pas envahir
- **Attunements**: forge une **Lanterne du porteur** (puis attunée, puis ardente)
  avec du lumen; tenue en main elle annule la morsure du Gloom — les paliers
  supérieurs te laissent t'enfoncer dans des Ténèbres plus profondes (au prix de
  ta main: pas d'arme tant que tu la portes)
- TNT avec réactions en chaîne
- **3 emplacements de sauvegarde**, chacun avec son seed (map différente),
  choisis sur un écran de sélection au démarrage; sauvegarde localStorage
  (édits du monde par chunk, inventaire, position, heure)
- **Un seul menu en jeu** (l'inventaire, ouvert par Tab/E) avec contrôle du
  volume, bouton « Jour » et « Changer de monde »; voile de pause au
  déverrouillage de la souris
- Vue 1ʳᵉ personne: bras affiché à main vide, animation de coup avant/arrière
  (en boucle pendant le minage)

## Contrôles

WASD bouger · Souris regarder · Espace sauter · Shift sprinter ·
Clic gauche miner/attaquer · Clic droit placer/manger/ouvrir porte ·
Clic molette choisir le bloc · **E / Tab inventaire + craft** · 1-9 hotbar · F voler

Échap libère la souris (voile de pause, clic pour reprendre). Le menu de jeu
s'ouvre/ferme uniquement avec E / Tab.

## Structure

```
src/
├── main.js          assemblage + boucle de jeu
├── core/            noise (value noise/fbm), physics (AABB voxel), save (localStorage)
├── world/           constants, blocks (registre + portes), world (chunks/gen + décroissance feuilles),
│                    lighting (BFS), mesher (AO + lumière), leafdecay (logique pure testable)
├── entities/        player (vitals), mobs (IA), drops (items au sol)
├── items/           items (outils/nourriture/armure), inventory, crafting (grille shaped + fonte)
├── gameplay/        interact (minage/combat/placement/portes), effects (TNT/explosions)
├── render/          textures (atlas procédural + icônes), sky (cycle jour/nuit)
├── ui/              hud (cœurs/hotbar/inventaire + grille craft + fourneau + recettes)
└── audio/           sounds (synthé WebAudio)
test/                tests node sans DOM (lighting, inventaire/craft, décroissance feuilles)
tools/               scripts one-shot
```
