# Stargazer's Legacy Online - Patch Bundle

This folder contains all updated and new files for:
1. **Shield Slot & Shield Items:** Buckler, Round Shield, Heater Shield, Tower Shield, and Astral Barrier.
2. **Armor Visual Decoupling:** Decoupled armor models from shields so heroes only display shields when actually equipped.
3. **Adventurer's Compendium Manual Rewrite:** Complete 12-tab manual (`Basics`, `Ancestries & Classes`, `Fighter`, `Paladin`, `Ranger`, `Rogue`, `Cleric`, `Wizard`, `Bard`, `Tinker`, `Playing Online`, `Bestiary`).
4. **Admin Panel Character Inspection:** Complete character inspector tool in `admin.html`.
5. **Monster Visual Overhaul & Proportions:** Redesigned vector artwork for Kobold, Goblin, Wolf, Orc Raider, Skeleton, Headless, and Gargoyle with accurate lore details, proper sizing relative to characters, and refined ground shadows.
6. **Giant Snake Venom:** Giant Snake bite now carries venom (35% poison chance on hit) that inflicts poison status in combat and persists on the overworld until cured.

---

## Files Included

```
patch/
├── admin.html          -> Admin control panel with character inspection
├── api.php             -> API endpoint dispatcher
├── index.html          -> Main game client & 12-tab manual
├── css/
│   └── game.css        -> Paperdoll grid layout for #pd-shield
├── js/
│   ├── game.js         -> Combat venom, monster stats, shield logic, inventory
│   ├── heroart.js      -> Shield vector artwork & armor model decoupling
│   ├── monsterart.js   -> Overhauled vector art for Kobold, Goblin, Wolf, Orc, Skeleton, Headless, Gargoyle, Snake
│   └── net.js          -> Shield state synchronization
└── server/
    ├── accounts.php    -> Account & character handling
    ├── admin.php       -> Admin character inspection API
    ├── lib.php         -> Character summary fields & shield serialization
    └── social.php      -> Player inspection & presence
```

---

## How to Apply to Existing Install

### Option A: Standard Repository / Webroot pointing at `public/`
Copy the frontend files into your `public/` folder and server files into `server/`:
```bash
# Frontend assets
cp patch/index.html   /path/to/install/public/
cp patch/admin.html   /path/to/install/public/
cp patch/api.php      /path/to/install/public/
cp -r patch/css/*     /path/to/install/public/css/
cp -r patch/js/*      /path/to/install/public/js/

# Backend logic
cp -r patch/server/*  /path/to/install/server/
```

### Option B: Flat / Single Directory (e.g. shared web hosting / ZIP install)
If your webroot has `api.php`, `index.html`, and `server/` in the same root directory, copy the contents of `patch/` directly into your root directory:
```bash
cp -r patch/* /path/to/webroot/
```
