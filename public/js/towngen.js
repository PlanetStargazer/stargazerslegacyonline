// =====================================================================================================
// PROCEDURAL TOWNS - every settlement grows from its own seed into a different map: a street network
// (crossroads, ring, twin avenues or a loop), a plaza with its own centrepiece, buildings that are dropped onto
// lots beside the streets, furnished interiors, ponds, trees, lamps and patrolling guards.
// Used by generateTown() in game.js; if a seed ever fails the sanity checks the next attempt uses a new sub-seed.
// =====================================================================================================

// ancestry of the people of a settlement: a mix weighted so that every town has a few non-humans
const NPC_RACE_WEIGHTS = [['Human', 38], ['Elf', 17], ['Dwarf', 20], ['Halfling', 15], ['Automaton', 10]];
function townPickRace(rng, prefer) {
    if (prefer && rng() < 0.7) return prefer;
    let r = rng() * NPC_RACE_WEIGHTS.reduce((s, [, n]) => s + n, 0);
    for (const [race, n] of NPC_RACE_WEIGHTS) { if ((r -= n) < 0) return race; }
    return 'Human';
}
// first and last syllables per ancestry and gender (automatons are the same for everyone)
const NPC_RACE_NAMES = {
    Elf: {
        M: [['Ael', 'Cal', 'Eli', 'Lor', 'Thal', 'Vael', 'Ean', 'Fen', 'Ilu', 'Mir'], ['andil', 'indor', 'orn', 'aeth', 'ithil', 'eth', 'ion', 'dir', 'as', 'ellan']],
        F: [['Ara', 'Fae', 'Liri', 'Nae', 'Syl', 'Ilya', 'Mae', 'Sael', 'Lia', 'Elen'], ['wen', 'riel', 'anel', 'ys', 'iel', 'ara', 'ia', 'ithe', 'una', 'elle']]
    },
    Dwarf: {
        M: [['Bor', 'Dur', 'Gim', 'Kaz', 'Thor', 'Bal', 'Dain', 'Brom', 'Orin', 'Gar', 'Rurik', 'Skar', 'Thrum'], ['in', 'ur', 'rik', 'grim', 'dak', 'mar', 'bek', 'din', 'gar', 'rim', 'nor']],
        F: [['Hild', 'Brun', 'Dis', 'Gund', 'Helga', 'Ing', 'Kath', 'Mar', 'Sig', 'Thyra', 'Ulla', 'Vor'], ['a', 'hild', 'ra', 'dis', 'run', 'ni', 'la', 'trude', 'wyn', 'gerd']]
    },
    Halfling: {
        M: [['Pod', 'Wib', 'Nib', 'Fen', 'Hob', 'Rudd', 'Millo', 'Pim', 'Tolly', 'Bram', 'Cob', 'Dodo'], ['kin', 'by', 'low', 'wick', 'bury', 'foot', 'bottom', 'wort', 'ling']],
        F: [['Tansy', 'Dilly', 'Poppy', 'Lotti', 'Rosie', 'Pearl', 'Posy', 'Marigold', 'Cowslip', 'Bella'], ['kin', 'by', 'low', 'wick', 'bury', 'foot', 'bottom', 'cress', 'wort']]
    },
    Automaton: {
        M: [['Cog', 'Brass', 'Gear', 'Rivet', 'Tick', 'Iron', 'Piston', 'Bolt', 'Sprocket', 'Copper', 'Valve', 'Spring'], ['wright', 'worth', '-7', '-12', '-3', '-21', ' Mk II', '-9', ' Prime', '-44']]
    }
};
NPC_RACE_NAMES.Automaton.F = NPC_RACE_NAMES.Automaton.M;
// gender: 'M' | 'F' (defaults to a coin toss on the rng)
function townPersonName(race, rng, human, gender) {
    const byG = NPC_RACE_NAMES[race];
    if (!byG) return human;
    const g = gender === 'F' || gender === 'M' ? gender : (rng() < 0.5 ? 'M' : 'F');
    const p = byG[g];
    const a = p[0][Math.floor(rng() * p[0].length)], b = p[1][Math.floor(rng() * p[1].length)];
    return (a + b).toUpperCase();
}
// the shopkeepers and lords carry names from fixed lists: these are the women
const FEMALE_NPC_NAMES = /\b(hilda|marta|gerta|bess|elspeth|mabel|nora|fenna|tilly|greta|brynn|zora|lyrielle|miria|aurelia|seraphina|seraphine|evadne|isolde|thessaly|liora|elowen|vespera|althea|nyssa|oriana|valeria|celestia|lavinia|rosalind|delphine|perdita|marguerite|wilhelmina|odalys|henrietta|morgana|countess|lady|queen|duchess|empress|abbess|baroness|margravine|sister|vesna|marisol|beatrix|fiora|rosamund|linnea|giselle|yvonne|odette|hazel)\b/i;
function npcNameIsFemale(name) { return FEMALE_NPC_NAMES.test(name || ''); }

// Builds the layout into T.grid / T.under / T.rooms. T: { w, h, rng, grid, under, rooms, put, paint, kind, service,
// big, npcTiles }, kind = 'village' | 'town' | 'castle' | 'port'. Returns { startX, startY, guards, npcTiles } or null.
function townBuild(T) {
    const { w, h, rng, grid, under, rooms, put, paint, kind } = T;
    const G = TILE.GRASS, ROAD = TILE.ROAD;
    const R = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const at = (x, y) => (inb(x, y) ? grid[y][x] : -1);
    const reserved = new Set();                         // doorsteps and corridors: nothing may be dropped there
    const key = (x, y) => y * w + x;
    const village = kind === 'village';
    let startX = 11, startY = h - 2;
    const npcTiles = [];

    // ---------------------------------------------------------------- roads
    const road = (x, y) => { if (inb(x, y) && x > 0 && y > 0 && x < w - 1 && y < h - 1 && at(x, y) === G) put(x, y, ROAD, ROAD); };
    const hline = (x0, x1, y, wd = 1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = 0; k < wd; k++) road(x, y + k); };
    const vline = (x, y0, y1, wd = 1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = 0; k < wd; k++) road(x + k, y); };
    const plaza = (cx, cy, pw, ph) => { for (let y = cy - (ph >> 1); y <= cy + (ph >> 1); y++) for (let x = cx - (pw >> 1); x <= cx + (pw >> 1); x++) road(x, y); };

    let gateX = R(7, w - 8);
    let px, py, pw, ph;

    if (village) {
        // forest ring with a gap at the bottom where the lane enters
        gateX = R(6, w - 7);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const edge = x === 0 || x === w - 1 || y === 0 || y === h - 1;
            const near = x === 1 || x === w - 2 || y === 1 || y === h - 2;
            if ((edge || (near && rng() < 0.55)) && !(Math.abs(x - gateX) <= 2 && y >= h - 3)) put(x, y, TILE.FOREST, G);
        }
        startX = gateX;
        px = clampN(gateX + R(-4, 4), 6, w - 7); py = R(Math.round(h * .36), Math.round(h * .5)); pw = pick([5, 5, 7]); ph = pick([3, 4, 5]);
        const jy = R(py + ph, h - 5);
        for (let k = -1; k <= 1; k++) put(gateX + k, h - 1, ROAD, ROAD);
        vline(gateX, jy, h - 2); vline(gateX - 1, h - 2, h - 2); vline(gateX + 1, h - 2, h - 2);
        hline(gateX, px, jy);
        vline(px, py, jy);
        plaza(px, py, pw, ph);
        if (rng() < 0.5) hline(R(2, 5), px, py + (ph >> 1) + 1);                       // a side lane
    } else {
        for (let x = 0; x < w; x++) { put(x, 0, TILE.WALL, G); put(x, h - 1, TILE.WALL, G); }
        for (let y = 0; y < h; y++) { put(0, y, TILE.WALL, G); put(w - 1, y, TILE.WALL, G); }
        startX = gateX;
        pw = pick([5, 7, 7, 9]); ph = pick([5, 5, 7]);
        px = clampN(gateX + R(-3, 3), (pw >> 1) + 3, w - (pw >> 1) - 4); py = R(Math.round(h * .3), Math.round(h * .5));
        const aw = pick([2, 3, 3]);
        for (let k = -1; k <= 1; k++) put(gateX + k, h - 1, ROAD, ROAD);
        const jy = R(py + (ph >> 1) + 2, h - 4);
        vline(gateX - 1, jy, h - 2, 3);
        hline(Math.min(gateX, px) - 1, Math.max(gateX, px) + 1, jy, aw);
        vline(px - (aw >> 1), py, jy, aw);
        plaza(px, py, pw, ph);
        const style = pick(['crossroads', 'ring', 'twin', 'loop', 'crossroads']);
        if (style === 'crossroads') {
            hline(2, w - 3, py + R(-1, 1), pick([1, 2]));
            if (rng() < 0.7) vline(px, 2, py - (ph >> 1), 2);
        } else if (style === 'ring') {
            const rx = (pw >> 1) + 3, ry = (ph >> 1) + 3;
            hline(px - rx, px + rx, py - ry); hline(px - rx, px + rx, py + ry); vline(px - rx, py - ry, py + ry); vline(px + rx, py - ry, py + ry);
            vline(px, 2, py - ry); hline(2, px - rx, py); hline(px + rx, w - 3, py);
        } else if (style === 'twin') {
            const side = rng() < 0.5 ? -1 : 1, x2 = clampN(px + side * R(6, 8), 3, w - 4);
            vline(x2, 3, jy, 2);
            hline(Math.min(x2, px), Math.max(x2, px), py - R(1, 2)); hline(Math.min(x2, px), Math.max(x2, px), jy);
            if (rng() < 0.6) hline(2, w - 3, R(3, py - 3));
        } else {                                                                      // loop road around the quarter
            const x0 = R(3, 4), x1 = R(w - 5, w - 4), y0 = R(3, 4), y1 = R(h - 6, h - 5);
            hline(x0, x1, y0); hline(x0, x1, y1); vline(x0, y0, y1); vline(x1, y0, y1);
            vline(px, y0, py);
        }
    }

    // ---------------------------------------------------------------- port: a stretch of sea with a pier
    let seaSide = null;
    if (kind === 'port') {
        seaSide = rng() < 0.5 ? 'E' : 'W';
        const y0 = R(3, 5), y1 = R(h - 8, h - 6), depth = R(3, 4);
        for (let y = y0; y <= y1; y++) for (let k = 0; k < depth; k++) { const x = seaSide === 'E' ? w - 1 - k : k; put(x, y, TILE.WATER, TILE.WATER); }
        for (let y = y0 + 1; y < y1; y++) for (let k = depth; k < depth + 1; k++) { /* shore stays grass */ }
        const pierY = R(y0 + 2, y1 - 2), len = depth - 1;
        let sx;
        if (seaSide === 'E') { sx = w - depth; for (let x = sx; x <= w - 2; x++) put(x, pierY, TILE.WOODFLOOR, TILE.WOODFLOOR); put(w - 2, pierY, TILE.SHIPWRIGHT, TILE.WOODFLOOR); if (!connect(sx - 1, pierY, -1, 0, 14)) { T.why = 'pier'; return null; } }
        else { sx = depth - 1; for (let x = 1; x <= sx; x++) put(x, pierY, TILE.WOODFLOOR, TILE.WOODFLOOR); put(1, pierY, TILE.SHIPWRIGHT, TILE.WOODFLOOR); if (!connect(sx + 1, pierY, 1, 0, 14)) { T.why = 'pier'; return null; } }
        npcTiles.push(TILE.SHIPWRIGHT);
        void len;
    }

    // paints a one-tile road from (x,y) in direction (dx,dy) until it meets an existing road; false when it cannot
    function connect(x, y, dx, dy, maxLen) {
        const cells = [];
        for (let k = 0; k <= maxLen; k++) {
            const cx = x + dx * k, cy = y + dy * k;
            if (!inb(cx, cy) || cx <= 0 || cy <= 0 || cx >= w - 1 || cy >= h - 1) return false;
            const t = at(cx, cy);
            if (t === ROAD) { cells.forEach(([a, b]) => { put(a, b, ROAD, ROAD); reserved.add(key(a, b)); }); reserved.add(key(cx, cy)); return true; }
            if (t !== G) return false;
            cells.push([cx, cy]);
        }
        return false;
    }
    function canConnect(x, y, dx, dy, maxLen) {
        for (let k = 0; k <= maxLen; k++) {
            const cx = x + dx * k, cy = y + dy * k;
            if (!inb(cx, cy) || cx <= 0 || cy <= 0 || cx >= w - 1 || cy >= h - 1) return false;
            const t = at(cx, cy);
            if (t === ROAD) return true;
            if (t !== G) return false;
        }
        return false;
    }

    // ---------------------------------------------------------------- buildings
    const lots = [];
    const lotFree = (x, y, rw, rh) => {
        for (let yy = y - 1; yy <= y + rh; yy++) for (let xx = x - 1; xx <= x + rw; xx++) {
            if (!inb(xx, yy)) return false;
            const core = xx >= x && xx < x + rw && yy >= y && yy < y + rh;
            const t = at(xx, yy);
            if (core) { if (t !== G || reserved.has(key(xx, yy))) return false; }
            else if (t !== G && t !== ROAD && t !== TILE.WALL) return false;
        }
        return true;
    };
    const SIDES = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
    // drops a building onto a lot beside a street; door faces a street that can be reached by a short path
    function place(rw, rh, floor, npcTile, furnishAs, where, offCentre, reach) {
        const maxLen = reach || (village ? 7 : 6);
        for (let attempt = 0; attempt < 260; attempt++) {
            let x, y;
            if (where) { x = R(where.x0, where.x1); y = R(where.y0, where.y1); }
            else { x = R(2, w - rw - 2); y = R(2, h - rh - 3); }
            if (!lotFree(x, y, rw, rh)) continue;
            const mx = x + (rw >> 1), my = y + (rh >> 1);
            const doors = { S: [mx, y + rh - 1], N: [mx, y], E: [x + rw - 1, my], W: [x, my] };
            for (const side of shuffle(['S', 'N', 'E', 'W'])) {
                const [ddx, ddy] = SIDES[side], [dx0, dy0] = doors[side];
                if (!canConnect(dx0 + ddx, dy0 + ddy, ddx, ddy, maxLen)) continue;
                // the door tile itself sits in the wall ring; the doorstep and corridor are painted as road
                rooms.push({ x: x + 1, y: y + 1, w: rw - 2, h: rh - 2 });
                for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) {
                    const edge = yy === y || yy === y + rh - 1 || xx === x || xx === x + rw - 1;
                    put(xx, yy, edge ? TILE.HOUSE_WALL : floor, floor);
                }
                put(dx0, dy0, ddx === 0 ? TILE.DOOR : TILE.DOOR_V, TILE.WOODFLOOR);
                connect(dx0 + ddx, dy0 + ddy, ddx, ddy, maxLen);
                // residents of ordinary houses stand beside the doorway line so the room behind the door stays open
                let nx = mx, ny = my;
                if (offCentre) { if (ddx === 0) nx = mx - 1; else ny = my - 1; }
                if (npcTile) { put(nx, ny, npcTile, floor); npcTiles.push(npcTile); }
                const b = { x, y, w: rw, h: rh, door: [dx0, dy0], side, npc: npcTile ? [nx, ny] : null, floor, kind: npcTile };
                lots.push(b);
                furnish(b, furnishAs);
                return b;
            }
        }
        return null;
    }

    // furniture along the walls, never on the way from the door to the resident
    function furnish(b, as) {
        const { x, y, w: rw, h: rh, door, npc } = b;
        const list = {
            lord: [TILE.BOOKCASE, TILE.BOOKCASE, TILE.CLOCK, TILE.CLOCK, TILE.PLANT, TILE.PLANT],
            smith: [TILE.WEAPONRACK, TILE.WEAPONRACK, TILE.FIREPLACE, TILE.BARREL, TILE.BARREL, TILE.CRATE, TILE.CRATE, TILE.TABLE],
            food: [TILE.BARREL, TILE.BARREL, TILE.BARREL, TILE.CRATE, TILE.CRATE, TILE.TABLE, TILE.TABLE, TILE.PLANT],
            healer: [TILE.PEW, TILE.PEW, TILE.PEW, TILE.PLANT, TILE.PLANT, TILE.BOOKCASE, TILE.BOOKCASE],
            barber: [TILE.TABLE, TILE.TABLE, TILE.PLANT, TILE.CLOCK, TILE.BOOKCASE, TILE.PLANT],
            tailor: [TILE.TABLE, TILE.TABLE, TILE.PLANT, TILE.CLOCK, TILE.CRATE, TILE.BOOKCASE],
            vendor: [TILE.CRATE, TILE.CRATE, TILE.BARREL, TILE.BARREL, TILE.CRATE, TILE.WEAPONRACK, TILE.TABLE, TILE.BOOKCASE],
            witch: [TILE.TABLE, TILE.BARREL, TILE.BARREL, TILE.BOOKCASE, TILE.PLANT, TILE.PLANT, TILE.CRATE],
            pets: [TILE.BARREL, TILE.CRATE, TILE.CRATE, TILE.PLANT, TILE.PLANT, TILE.TABLE],
            home: [TILE.BED, TILE.FIREPLACE, TILE.TABLE, TILE.BOOKCASE, TILE.CLOCK, TILE.PLANT, TILE.BED]
        }[as] || [TILE.PLANT];
        const items = list;
        const inner = [];
        for (let yy = y + 1; yy < y + rh - 1; yy++) for (let xx = x + 1; xx < x + rw - 1; xx++) inner.push([xx, yy]);
        const nearDoor = ([a, c]) => Math.abs(a - door[0]) <= 1 && Math.abs(c - door[1]) <= 1;
        const isNpc = ([a, c]) => npc && a === npc[0] && c === npc[1];
        const wallish = ([a, c]) => a === x + 1 || a === x + rw - 2 || c === y + 1 || c === y + rh - 2;
        // the focal piece first: throne / altar against the far wall behind the resident
        if (as === 'lord' || as === 'healer') {
            const mx = x + (rw >> 1), my = y + (rh >> 1);
            const [fxx, fyy] = { S: [mx, y + 1], N: [mx, y + rh - 2], E: [x + 1, my], W: [x + rw - 2, my] }[b.side];
            if (!isNpc([fxx, fyy]) && grid[fyy][fxx] === b.floor) put(fxx, fyy, as === 'lord' ? TILE.THRONE : TILE.ALTAR);
        }
        // an inn gets a couple of tables in the middle of the room with patrons drinking beer
        if (as === 'food' && rw >= 7 && rh >= 6) {
            const tables = [];
            for (const [cx, cy] of shuffle(inner.filter(c => !wallish(c) && !nearDoor(c) && !isNpc(c) && grid[c[1]][c[0]] === b.floor))) {
                if (tables.length >= 2) break;
                if (tables.some(([a, c]) => Math.abs(a - cx) + Math.abs(c - cy) < 3)) continue;
                put(cx, cy, TILE.TAVERNTABLE);
                if (!roomStillOpen(b)) { put(cx, cy, b.floor, b.floor); continue; }
                tables.push([cx, cy]);
            }
        }
        // ... and a bard playing by the wall
        if (as === 'food' && rw >= 6 && rh >= 5) {
            for (const [cx, cy] of shuffle(inner.filter(c => !nearDoor(c) && !isNpc(c) && wallish(c) && grid[c[1]][c[0]] === b.floor))) {
                put(cx, cy, TILE.BARD, b.floor);
                if (!roomStillOpen(b)) { put(cx, cy, b.floor, b.floor); continue; }
                npcTiles.push(TILE.BARD);
                break;
            }
        }
        const cand = shuffle(inner.filter(c => !nearDoor(c) && !isNpc(c) && wallish(c) && grid[c[1]][c[0]] === b.floor));
        let i = 0;
        for (const t of items) {
            while (i < cand.length) {
                const [cx, cy] = cand[i++];
                if (grid[cy][cx] !== b.floor) continue;
                put(cx, cy, t);
                if (!roomStillOpen(b)) { put(cx, cy, b.floor, b.floor); continue; }
                break;
            }
        }
    }
    // can one still walk from the doorstep to a cell next to the resident (or across the room for a plain house)?
    function roomStillOpen(b) {
        const { x, y, w: rw, h: rh, door } = b;
        const ok = (a, c) => a > x && a < x + rw - 1 && c > y && c < y + rh - 1 && TOWN_WALKABLE.has(grid[c][a]);
        const [sdx, sdy] = SIDES[b.side];
        const sx = door[0] - sdx, sy = door[1] - sdy;
        if (!ok(sx, sy)) return false;
        const seen = new Set([key(sx, sy)]), q = [[sx, sy]];
        let reachedNpc = !b.npc, open = 1;
        while (q.length) {
            const [cx, cy] = q.shift();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (b.npc && nx === b.npc[0] && ny === b.npc[1]) reachedNpc = true;
                if (!ok(nx, ny) || seen.has(key(nx, ny))) continue;
                seen.add(key(nx, ny)); q.push([nx, ny]); open++;
            }
        }
        return reachedNpc && open >= 3;
    }

    const must = [];                                    // the buildings every settlement of this kind needs
    if (village) {
        const svc = T.service;
        const fl = svc === TILE.HEALER || svc === TILE.LORD ? TILE.CARPET : TILE.WOODFLOOR;
        const as = svc === TILE.HEALER ? 'healer' : (svc === TILE.SHOP_GEAR ? 'smith' : (svc === TILE.LORD ? 'lord' : 'food'));
        must.push(() => (svc === TILE.SHOP_FOOD && place(R(8, 9), R(6, 7), fl, svc, as, { x0: 2, x1: w - 11, y0: 3, y1: h - 10 })) ||
            place(R(6, 7), R(5, 6), fl, svc, as, { x0: 2, x1: w - 9, y0: 3, y1: h - 9 }));
        if (R(0, 9) < 4) must.push(() => place(4, 4, TILE.WOODFLOOR, TILE.WITCH, 'witch', null, true) || place(4, 4, TILE.WOODFLOOR, TILE.WITCH, 'witch', null, true, 14));       // some villages have a potion witch
        const homes = R(1, 3);
        for (let i = 0; i < homes; i++) must.push(() => place(R(4, 5), R(4, 5), pick([TILE.WOODFLOOR, TILE.WOODFLOOR, TILE.CARPET]), TILE.CITIZEN, 'home', null, true));
    } else {
        const bigHall = kind === 'castle' || T.big;
        must.push(() => place(bigHall ? R(8, 10) : R(7, 8), R(5, 6), TILE.CARPET, TILE.LORD, 'lord', { x0: 2, x1: w - 12, y0: 2, y1: Math.max(3, py - (ph >> 1) - 7) }) ||
            place(7, 5, TILE.CARPET, TILE.LORD, 'lord'));
        must.push(() => place(5, 5, TILE.WOODFLOOR, TILE.SHOP_GEAR, 'smith') || place(5, 5, TILE.WOODFLOOR, TILE.SHOP_GEAR, 'smith', null, false, 14));
        must.push(() => place(9, 7, TILE.WOODFLOOR, TILE.SHOP_FOOD, 'food') || place(8, 6, TILE.WOODFLOOR, TILE.SHOP_FOOD, 'food') || place(7, 6, TILE.WOODFLOOR, TILE.SHOP_FOOD, 'food') ||
            place(5, 5, TILE.WOODFLOOR, TILE.SHOP_FOOD, 'food', null, false, 14));                        // a roomy inn, with tables for the patrons
        must.push(() => place(5, 5, TILE.CARPET, TILE.HEALER, 'healer') || place(5, 5, TILE.CARPET, TILE.HEALER, 'healer', null, false, 14));
        must.push(() => place(4, 4, TILE.WOODFLOOR, TILE.BARBER, 'barber', null, true) || place(4, 4, TILE.WOODFLOOR, TILE.BARBER, 'barber', null, true, 14));
        must.push(() => place(4, 4, TILE.CARPET, TILE.TAILOR, 'tailor', null, true) || place(4, 4, TILE.CARPET, TILE.TAILOR, 'tailor', null, true, 14));
        if (T.pets) must.push(() => place(5, 5, TILE.WOODFLOOR, TILE.PETSELLER, 'pets', null, true) || place(5, 5, TILE.WOODFLOOR, TILE.PETSELLER, 'pets', null, true, 14));     // Castle Stargazer keeps a pet shop
        must.push(() => place(4, 4, TILE.CARPET, TILE.WITCH, 'witch', null, true) || place(4, 4, TILE.CARPET, TILE.WITCH, 'witch', null, true, 14));       // every town and city has a potion witch
        must.push(() => place(5, 5, TILE.WOODFLOOR, TILE.VENDOR, 'vendor', null, true) || place(5, 5, TILE.WOODFLOOR, TILE.VENDOR, 'vendor', null, true, 14) || place(4, 4, TILE.WOODFLOOR, TILE.VENDOR, 'vendor', null, true, 14));       // cities and castles have a general vendor
        const homes = R(3, kind === 'castle' ? 7 : 6);
        for (let i = 0; i < homes; i++) must.push(() => place(R(4, 6), R(4, 5), pick([TILE.WOODFLOOR, TILE.WOODFLOOR, TILE.CARPET]), TILE.CITIZEN, 'home', null, true));
    }
    let placed = 0;
    for (let i = 0; i < must.length; i++) {
        const b = must[i]();
        if (b) placed++;
        else if (i < (village ? 1 : (T.pets ? 7 : 6))) { T.why = 'must' + i; return null; }      // a required building found no lot: try another seed
    }

    // the barber's pole stands in the street beside his doorstep (never on it, never on the way to it)
    const barberLot = lots.find(b => b.kind === TILE.BARBER);
    if (barberLot) {
        const [bdx, bdy] = barberLot.door, [ox, oy] = SIDES[barberLot.side];
        const sx = bdx + ox, sy = bdy + oy;
        const cands = ox === 0 ? [[sx - 1, sy], [sx + 1, sy], [sx - 2, sy], [sx + 2, sy]] : [[sx, sy - 1], [sx, sy + 1], [sx, sy - 2], [sx, sy + 2]];
        const spot = cands.find(([x, y]) => (at(x, y) === G || at(x, y) === ROAD) && !reserved.has(key(x, y)));
        if (!spot) { T.why = 'pole'; return null; }
        put(spot[0], spot[1], TILE.BARBERPOLE, at(spot[0], spot[1]) === ROAD ? ROAD : G);
        reserved.add(key(spot[0], spot[1]));
    }

    // how many tiles can be walked to from the gate
    function reachableCount() {
        const seen = new Set([key(startX, startY)]), q = [[startX, startY]];
        for (let i = 0; i < q.length; i++) {
            const [cx, cy] = q[i];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (!inb(nx, ny) || seen.has(key(nx, ny)) || !TOWN_WALKABLE.has(grid[ny][nx])) continue;
                seen.add(key(nx, ny)); q.push([nx, ny]);
            }
        }
        return seen.size;
    }
    // a hanging shop sign stands in the street beside every shop doorstep, saying what the shop is
    const signs = [];
    lots.filter(b => SHOP_SIGN_KINDS.includes(b.kind)).forEach(lot => {
        const [bdx, bdy] = lot.door, [ox, oy] = SIDES[lot.side];
        const sx = bdx + ox, sy = bdy + oy;
        const cands = ox === 0 ? [[sx - 1, sy], [sx + 1, sy], [sx - 2, sy], [sx + 2, sy]] : [[sx, sy - 1], [sx, sy + 1], [sx, sy - 2], [sx, sy + 2]];
        // a sign is an obstacle: it may never cut a street or a pocket of the town off from the gate
        const spot = cands.find(([x, y]) => {
            if ((at(x, y) !== G && at(x, y) !== ROAD) || reserved.has(key(x, y))) return false;
            const before = reachableCount(), floor = at(x, y);
            put(x, y, TILE.SHOPSIGN, floor);
            const ok = reachableCount() >= before - 1;
            put(x, y, floor, floor);
            return ok;
        });
        if (!spot) return;
        put(spot[0], spot[1], TILE.SHOPSIGN, at(spot[0], spot[1]) === ROAD ? ROAD : G);
        reserved.add(key(spot[0], spot[1]));
        signs.push({ x: spot[0], y: spot[1], kind: lot.kind });
    });

    // ---------------------------------------------------------------- the plaza's centrepiece
    if (!village) {
        const centre = pick(['fountain', 'fountain', 'market', 'garden']);
        const lampSpots = [[px - (pw >> 1), py - (ph >> 1)], [px + (pw >> 1), py - (ph >> 1)], [px - (pw >> 1), py + (ph >> 1)], [px + (pw >> 1), py + (ph >> 1)]];
        if (centre !== 'garden' && !reserved.has(key(px, py))) put(px, py, TILE.FOUNTAIN, ROAD);
        else { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0]]) if (!reserved.has(key(px + dx, py + dy))) put(px + dx, py + dy, TILE.GARDEN, ROAD); }
        lampSpots.forEach(([lx, ly]) => { if (at(lx, ly) === ROAD && !reserved.has(key(lx, ly))) put(lx, ly, TILE.LAMPPOST, ROAD); });
        if (centre === 'market') {
            const stalls = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2]].slice(0, R(3, 6));
            stalls.forEach(([dx, dy]) => { const sx = px + dx * 2, sy = py + dy; if (at(sx, sy) === ROAD && !reserved.has(key(sx, sy))) put(sx, sy, pick([TILE.TABLE, TILE.BARREL, TILE.CRATE]), ROAD); });
        }
    } else {
        if (!reserved.has(key(px, py))) put(px, py, TILE.FOUNTAIN, ROAD);
        [[px - 2, py - 1], [px + 2, py - 1]].forEach(([lx, ly]) => { if (at(lx, ly) === ROAD && !reserved.has(key(lx, ly))) put(lx, ly, TILE.LAMPPOST, ROAD); });
    }

    // ---------------------------------------------------------------- water, trees, bushes, lamps
    const clear = (x, y, r, okSet) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const t = at(x + dx, y + dy); if (t !== -1 && !okSet.has(t)) return false; } return true; };
    if (!village && rng() < 0.45) {                                           // a pond
        for (let a = 0; a < 60; a++) {
            const pwd = R(3, 4), phd = R(2, 3), x = R(2, w - pwd - 3), y = R(2, h - phd - 5);
            let ok = true;
            for (let yy = y - 2; yy <= y + phd + 1 && ok; yy++) for (let xx = x - 2; xx <= x + pwd + 1 && ok; xx++) if (at(xx, yy) !== G && at(xx, yy) !== TILE.WALL) ok = false;
            if (!ok) continue;
            for (let yy = y; yy < y + phd; yy++) for (let xx = x; xx < x + pwd; xx++) if (!((xx === x || xx === x + pwd - 1) && (yy === y || yy === y + phd - 1))) put(xx, yy, TILE.WATER, TILE.WATER);
            break;
        }
    }
    const OPEN = new Set([G, TILE.GARDEN, TILE.FOREST, TILE.TREE, TILE.WALL, TILE.WATER]);
    const scatter = (tile, count, tries, margin, okSet) => {
        let n = 0;
        for (let a = 0; a < tries && n < count; a++) {
            const x = R(1, w - 2), y = R(1, h - 2);
            if (at(x, y) !== G || reserved.has(key(x, y)) || (y >= h - 3 && Math.abs(x - gateX) <= 3)) continue;
            if (!clear(x, y, margin, okSet || OPEN)) continue;
            grid[y][x] = tile; n++;
        }
    };
    // lamps beside the streets
    const lampNear = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (at(x + dx, y + dy) === TILE.LAMPPOST) return true; return false; };
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (at(x, y) !== ROAD || rng() > 0.1) continue;
        for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
            const lx = x + dx, ly = y + dy;
            if (at(lx, ly) === G && !reserved.has(key(lx, ly)) && !lampNear(lx, ly)) { put(lx, ly, TILE.LAMPPOST, G); break; }
        }
    }
    const STREET_OK = new Set([G, TILE.GARDEN, TILE.FOREST, TILE.TREE, TILE.WALL, TILE.WATER, ROAD, TILE.HOUSE_WALL, TILE.LAMPPOST]);
    scatter(TILE.TREE, village ? R(11, 16) : R(8, 14), 260, 1);
    scatter(TILE.GARDEN, village ? R(16, 24) : R(20, 32), 340, 1, STREET_OK);
    if (village) {                                                            // a vegetable patch or two
        for (let f = 0, n = R(1, 2); f < n; f++) for (let a = 0; a < 50; a++) {
            const fw = R(3, 4), fh = R(2, 3), x = R(2, w - fw - 2), y = R(2, h - fh - 5);
            let ok = true;
            for (let yy = y - 1; yy <= y + fh && ok; yy++) for (let xx = x - 1; xx <= x + fw && ok; xx++) if (at(xx, yy) !== G) ok = false;
            if (!ok) continue;
            for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) if ((xx + yy) % 2 === 0) put(xx, yy, TILE.GARDEN, G);
            break;
        }
    }

    // ---------------------------------------------------------------- guards
    const guards = [];
    const roadRun = (x, y, dx, dy) => { let n = 0; while (at(x + dx * (n + 1), y + dy * (n + 1)) === ROAD) n++; return n; };
    const patrolSpots = [];
    for (let y = 2; y < h - 3; y++) for (let x = 2; x < w - 2; x++) {
        if (at(x, y) !== ROAD) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]]) if (roadRun(x, y, dx, dy) >= 3 && at(x - dx, y - dy) === ROAD) patrolSpots.push([x, y, dx, dy]);
    }
    const nPatrol = village ? 1 : (kind === 'castle' ? 3 : 2);
    shuffle(patrolSpots);
    const used = new Set();
    for (const [x, y, dx, dy] of patrolSpots) {
        if (guards.length >= nPatrol) break;
        if (used.has(key(x, y)) || Math.abs(x - startX) + Math.abs(y - startY) < 5) continue;
        used.add(key(x, y));
        guards.push({ name: village ? 'VILLAGE WATCH' : (kind === 'castle' && guards.length === 0 ? 'ROYAL GUARD' : 'CITY GUARD'), x, y, patrol: true, dx, dy });
    }
    if (!village) {
        [-2, 2].forEach(o => { const gx = gateX + o; if (TOWN_WALKABLE.has(at(gx, h - 2)) && !reserved.has(key(gx, h - 2))) guards.push({ name: 'GATE SENTINEL', x: gx, y: h - 2, patrol: false }); });
    }
    return { startX, startY, guards, npcTiles, signs, lots: lots.map(b => ({ kind: b.kind, x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2 })) };
}

function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

// every NPC doorway and NPC must be reachable from the gate; used to reject unlucky seeds
function townIsValid(grid, w, h, startX, startY, npcTiles) {
    if (!TOWN_WALKABLE.has(grid[startY][startX])) return false;
    const seen = Array.from({ length: h }, () => Array(w).fill(false));
    const q = [[startX, startY]];
    seen[startY][startX] = true;
    let n = 0;
    while (q.length) {
        const [x, y] = q.shift(); n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny][nx] || !TOWN_WALKABLE.has(grid[ny][nx])) continue;
            seen[ny][nx] = true; q.push([nx, ny]);
        }
    }
    if (n < 60) return false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = grid[y][x];
        if ((t === TILE.DOOR || t === TILE.DOOR_V) && !seen[y][x]) return false;      // a house nobody can walk into
        if (!isTownNpcTile(t)) continue;
        const touched = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[y + dy] && seen[y + dy][x + dx]);
        if (!touched) return false;
    }
    return true;
}
