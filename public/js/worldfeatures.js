// =====================================================================================================
// WORLD FEATURES - biomes (ice, taiga, desert, savannah, jungle), coastlines, roads between the great settlements,
// signposts at the crossroads, and ruins that wake with the dead at night.
// Everything is derived from the world seed, so every browser grows the same land.
// Loaded before game.js; the functions run when generateOverworld() calls applyWorldFeatures() and from the painters.
// =====================================================================================================

// ---- which ground is it? (zones are in the original 1200 x 600 map; one row is 0.3 degrees of latitude) ----
const WF_ZONES = {
    desert: [
        { cx: 633, cy: 220, rx: 88, ry: 24 },   // Sahara
        { cx: 775, cy: 215, rx: 40, ry: 24 },   // Arabia
        { cx: 800, cy: 165, rx: 22, ry: 10 },   // Karakum
        { cx: 945, cy: 158, rx: 40, ry: 10 },   // Gobi
        { cx: 840, cy: 205, rx: 14, ry: 8 },    // Thar
        { cx: 667, cy: 385, rx: 30, ry: 22 },   // Namib & Kalahari
        { cx: 1040, cy: 388, rx: 55, ry: 26 },  // the Australian outback
        { cx: 228, cy: 190, rx: 28, ry: 14 },   // the American south-west
        { cx: 367, cy: 385, rx: 8, ry: 25 }     // Atacama
    ],
    jungle: [
        { cx: 665, cy: 300, rx: 36, ry: 18 },   // Congo
        { cx: 395, cy: 305, rx: 46, ry: 26 },   // Amazon
        { cx: 925, cy: 252, rx: 28, ry: 18 },   // South-East Asia
        { cx: 965, cy: 308, rx: 56, ry: 12 },   // the Sunda islands
        { cx: 1065, cy: 315, rx: 30, ry: 8 },   // New Guinea
        { cx: 300, cy: 255, rx: 20, ry: 11 },   // Central America
        { cx: 610, cy: 270, rx: 30, ry: 8 },    // the Guinea coast
        { cx: 757, cy: 355, rx: 7, ry: 14 }     // Madagascar
    ],
    savanna: [
        { cx: 633, cy: 262, rx: 95, ry: 14 },   // the Sahel
        { cx: 712, cy: 305, rx: 30, ry: 42 },   // East Africa
        { cx: 688, cy: 352, rx: 42, ry: 24 },   // Southern Africa
        { cx: 1045, cy: 350, rx: 52, ry: 14 },  // northern Australia
        { cx: 420, cy: 352, rx: 36, ry: 26 },   // the Brazilian cerrado
        { cx: 370, cy: 270, rx: 30, ry: 10 },   // the Llanos
        { cx: 852, cy: 248, rx: 22, ry: 16 }    // the Deccan
    ]
};
const WF = { NOWRITE: null };

function wfScaledZone(z) { return { cx: z.cx * WS, cy: z.cy * WS, rx: z.rx * WS, ry: z.ry * WS }; }
const WF_LANDISH = (t) => t === TILE.GRASS || t === TILE.FOREST;

function applyBiomes() {
    const ow = state.overworld, W = ow.width, H = ow.height;
    const near = (x, y) => Math.abs(x - START_X) + Math.abs(y - START_Y) < 28 * WS;       // the home valley stays green
    const noise = (x, y, k) => vnoise(x / k, y / k);
    // the poles: ice, then taiga towards the temperate band
    const iceN = Math.round(80 * WS), iceS = Math.round(545 * WS), tagN = Math.round(118 * WS), tagS = Math.round(472 * WS);
    for (let y = 0; y < H; y++) {
        const isIce = y < iceN + (noise(0, y, 6) - 0.5) * 6 * WS || y > iceS - (noise(0, y, 6) - 0.5) * 6 * WS;
        const isTaigaBand = !isIce && (y < tagN + (noise(y * 3, y, 11) - 0.5) * 9 * WS || y > tagS - (noise(y * 3, y, 11) - 0.5) * 9 * WS);
        if (!isIce && !isTaigaBand) continue;
        for (let x = 0; x < W; x++) {
            const t = ow.grid[y * W + x];
            if (t !== TILE.GRASS && t !== TILE.FOREST) continue;
            if (near(x, y)) continue;
            const n = noise(x, y, 5);
            if (isIce) ow.grid[y * W + x] = n > 0.42 ? TILE.ICE : TILE.SNOW;
            else if (t === TILE.FOREST) ow.grid[y * W + x] = TILE.TAIGA;
            else ow.grid[y * W + x] = n > 0.32 ? TILE.TAIGA : TILE.SNOW;
        }
    }
    const zoneFill = (zones, fn) => zones.forEach(z0 => {
        const z = wfScaledZone(z0);
        for (let y = Math.max(0, Math.floor(z.cy - z.ry * 1.5)); y <= Math.min(H - 1, Math.ceil(z.cy + z.ry * 1.5)); y++) {
            for (let x = Math.floor(z.cx - z.rx * 1.5); x <= Math.ceil(z.cx + z.rx * 1.5); x++) {
                const wx = ((x % W) + W) % W;
                const t = ow.grid[y * W + wx];
                if (!WF_LANDISH(t) || near(wx, y)) continue;
                const nx = (x - z.cx) / z.rx, ny = (y - z.cy) / z.ry;
                if (nx * nx + ny * ny <= 1 + (noise(x, y, 8) - 0.5) * 0.7) ow.grid[y * W + wx] = fn(t, wx, y);
            }
        }
    });
    zoneFill(WF_ZONES.desert, () => TILE.DESERT);
    zoneFill(WF_ZONES.jungle, (t, x, y) => (t === TILE.FOREST || noise(x, y, 4) > 0.5) ? TILE.JUNGLE : TILE.LUSH);
    zoneFill(WF_ZONES.savanna, () => TILE.SAVANNA);
}

// ---- coastlines: a band of sand along every shore ----
function applyBeaches() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const sandy = (t) => t === TILE.GRASS || t === TILE.SAVANNA || t === TILE.LUSH || t === TILE.SNOW || t === TILE.DESERT;
    const wet = (x, y) => y >= 0 && y < H && g[y * W + ((x % W) + W) % W] === TILE.WATER;
    const mark = [];
    for (let y = 1; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
            if (!sandy(g[y * W + x])) continue;
            if (wet(x + 1, y) || wet(x - 1, y) || wet(x, y + 1) || wet(x, y - 1)) { mark.push(y * W + x); continue; }
            // sometimes a second, ragged row
            if ((wet(x + 2, y) || wet(x - 2, y) || wet(x, y + 2) || wet(x, y - 2)) && vnoise(x / 3, y / 3) > 0.55) mark.push(y * W + x);
        }
    }
    mark.forEach(i => { g[i] = TILE.BEACH; });
}
// bit mask of the neighbours (1 N, 2 E, 4 S, 8 W) that satisfy test(tile)
function wfMask(x, y, test) {
    return (test(getWorldTile(x, y - 1)) ? 1 : 0) | (test(getWorldTile(x + 1, y)) ? 2 : 0) | (test(getWorldTile(x, y + 1)) ? 4 : 0) | (test(getWorldTile(x - 1, y)) ? 8 : 0);
}
const wfIsWater = (t) => t === TILE.WATER;
const wfIsDryLand = (t) => t !== TILE.WATER && t !== TILE.RIVER;
const wfIsRoadish = (t) => t === TILE.TRACK || t === TILE.HIGHROAD || t === TILE.BRIDGE || t === TILE.TOWN || t === TILE.CASTLE || t === TILE.PORT_TOWN || t === TILE.VILLAGE;
function wfBeachMask(x, y) { return wfMask(x, y, wfIsWater); }
function wfShoreMask(x, y) { return wfMask(x, y, wfIsDryLand); }
function wfRoadMask(x, y) { return wfMask(x, y, wfIsRoadish); }

// foam and shallows on an ocean tile that touches land (drawn over the water sprite every frame)
function wfDrawShoreFoam(ctx, px, py, s, mask, tick) {
    const sides = [[1, 0, -1, 0], [2, 1, 0, 1], [4, 0, 1, 0], [8, -1, 0, 1]];
    sides.forEach(([bit, nx, ny]) => {
        if (!(mask & bit)) return;
        ctx.save();
        ctx.translate(px + s / 2, py + s / 2);
        ctx.rotate(bit === 1 ? 0 : bit === 2 ? Math.PI / 2 : bit === 4 ? Math.PI : -Math.PI / 2);   // draw as if the land were to the north
        ctx.translate(-s / 2, -s / 2);
        const g = ctx.createLinearGradient(0, 0, 0, s * 0.34);
        g.addColorStop(0, 'rgba(150,220,235,0.55)'); g.addColorStop(1, 'rgba(150,220,235,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, s, s * 0.34);
        const ph = tick * 0.06 + (px + py) * 0.05;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.lineCap = 'round';
        ctx.beginPath();
        const y0 = s * (0.1 + 0.035 * Math.sin(ph));
        ctx.moveTo(0, y0);
        for (let i = 1; i <= 6; i++) ctx.lineTo(s * i / 6, s * (0.1 + 0.035 * Math.sin(ph + i * 1.3)) + (i % 2 ? s * 0.02 : 0));
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(0.8, s * 0.025);
        ctx.beginPath(); ctx.moveTo(0, s * (0.24 + 0.03 * Math.sin(ph + 2))); for (let i = 1; i <= 5; i++) ctx.lineTo(s * i / 5, s * (0.24 + 0.03 * Math.sin(ph + 2 + i))); ctx.stroke();
        ctx.restore();
    });
}

// ---- roads ----
function wfBuildRoads() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const lms = ow.landmarks || [];
    const SETTLE = new Set([TILE.TOWN, TILE.CASTLE, TILE.PORT_TOWN, TILE.VILLAGE]);
    const HUB = new Set([TILE.TOWN, TILE.CASTLE, TILE.PORT_TOWN]);
    const places = lms.filter(l => SETTLE.has(l.type));
    const hubs = places.filter(l => HUB.has(l.type));
    const idx = (x, y) => y * W + (((x % W) + W) % W);
    const wdx = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };
    const dist = (a, b) => wdx(a.x, b.x) + Math.abs(a.y - b.y);

    // which landmass is each tile on? (rivers count as land: the road bridges them)
    const label = new Uint16Array(W * H);
    let nl = 0;
    const isLand = (t) => t !== TILE.WATER;
    const stack = [];
    places.forEach(p => {
        const s = idx(p.x, p.y);
        if (label[s]) return;
        nl++;
        label[s] = nl; stack.push(s);
        while (stack.length) {
            const c = stack.pop(), cy = (c / W) | 0, cx = c - cy * W;
            const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
            for (const [nx0, ny] of nb) {
                if (ny < 0 || ny >= H) continue;
                const i = idx(nx0, ny);
                if (label[i] || !isLand(g[i])) continue;
                label[i] = nl; stack.push(i);
            }
        }
    });

    const cost = (t) => {
        switch (t) {
            case TILE.WATER: return Infinity;
            case TILE.RIVER: return 14;
            case TILE.MOUNTAIN: return 7;
            case TILE.SWAMP: return 5;
            case TILE.JUNGLE: return 4.5;
            case TILE.FOREST: case TILE.TAIGA: return 3;
            case TILE.ICE: case TILE.DESERT: return 1.8;
            case TILE.TRACK: case TILE.HIGHROAD: case TILE.BRIDGE: return 0.35;
            case TILE.BEACH: return 1.2;
            case TILE.GRASS: case TILE.SAVANNA: case TILE.LUSH: case TILE.SNOW: return 1;
            default: return 9;               // settlements, dungeons, moongates, ruins ...: walk around them
        }
    };
    const gs = new Float32Array(W * H), parent = new Int32Array(W * H), stamp = new Uint32Array(W * H);
    let run = 0;
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const near = new Uint8Array(W * H);                        // tiles touching a settlement: roads keep off them unless they end there
    places.forEach(p => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const y = p.y + dy; if (y >= 0 && y < H) near[idx(p.x + dx, y)] = 1; } });
    const astar = (a, b) => {
        run++;
        heap.length = 0;
        const s = idx(a.x, a.y), goal = idx(b.x, b.y);
        stamp[s] = run; gs[s] = 0; parent[s] = -1;
        push(0, s);
        let expanded = 0;
        while (heap.length && expanded < 220000) {
            const [, c] = pop();
            if (c === goal) {
                const path = []; for (let k = c; k !== -1; k = parent[k]) path.push(k); return path.reverse();
            }
            expanded++;
            const cy = (c / W) | 0, cx = c - cy * W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ny = cy + dy; if (ny < 1 || ny >= H - 1) continue;
                const nx = (cx + dx + W) % W, ni = ny * W + nx;
                let cc = cost(g[ni]); if (ni === goal) cc = 1;
                if (near[ni] && ni !== goal && !(wdx(nx, a.x) <= 1 && Math.abs(ny - a.y) <= 1) && !(wdx(nx, b.x) <= 1 && Math.abs(ny - b.y) <= 1)) cc += 40;
                if (cc === Infinity) continue;
                const ng = gs[c] + cc;
                if (stamp[ni] === run && gs[ni] <= ng) continue;
                stamp[ni] = run; gs[ni] = ng; parent[ni] = c;
                const hx = wdx(nx, b.x), hy = Math.abs(ny - b.y);
                push(ng + (hx + hy) * 0.9, ni);
            }
        }
        return null;
    };

    // a tree of roads (minimum spanning forest per landmass), so nothing loops needlessly; a hub pair gets a second road
    // only when the way round through the tree would be a long detour
    const pairs = new Map();
    const key = (a, b) => (a.name < b.name ? a.name + '|' + b.name : b.name + '|' + a.name);
    const link = (a, b) => { const k = key(a, b); if (!pairs.has(k)) pairs.set(k, { a, b, hi: HUB.has(a.type) && HUB.has(b.type) }); };
    const cand = [];
    for (let i = 0; i < places.length; i++) for (let j = i + 1; j < places.length; j++) {
        const a = places[i], b = places[j];
        if (label[idx(a.x, a.y)] !== label[idx(b.x, b.y)]) continue;
        const d = dist(a, b), lim = HUB.has(a.type) && HUB.has(b.type) ? 320 : (HUB.has(a.type) || HUB.has(b.type) ? 160 : 90);
        if (d <= lim) cand.push({ a, b, d });
    }
    cand.sort((p, q) => p.d - q.d);
    const uf = new Map(places.map(p => [p, p]));
    const find = (p) => { while (uf.get(p) !== p) { uf.set(p, uf.get(uf.get(p))); p = uf.get(p); } return p; };
    const adj = new Map(places.map(p => [p, []]));
    cand.forEach(c => {
        const ra = find(c.a), rb = find(c.b);
        if (ra === rb) return;
        uf.set(ra, rb); link(c.a, c.b); adj.get(c.a).push([c.b, c.d]); adj.get(c.b).push([c.a, c.d]);
    });
    const treeDist = (from, to) => {                    // shortest way through the roads built so far
        const best = new Map([[from, 0]]), todo = [from];
        while (todo.length) {
            todo.sort((p, q) => best.get(q) - best.get(p));
            const c = todo.pop();
            if (c === to) return best.get(c);
            adj.get(c).forEach(([n, d]) => { const nd = best.get(c) + d; if (!best.has(n) || nd < best.get(n)) { best.set(n, nd); todo.push(n); } });
        }
        return Infinity;
    };
    cand.filter(c => HUB.has(c.a.type) && HUB.has(c.b.type) && c.d <= 200).forEach(c => {
        if (pairs.has(key(c.a, c.b))) return;
        if (treeDist(c.a, c.b) > 3 * c.d) { link(c.a, c.b); adj.get(c.a).push([c.b, c.d]); adj.get(c.b).push([c.a, c.d]); }
    });
    let built = 0;
    const prevTile = new Map();                        // what each road tile replaced, so a tile can be given back
    // main roads first so the lesser tracks can join them
    // a settlement sits at the end of its first road; further roads branch off beside it rather than running through it
    const isRoadTile = (t) => t === TILE.TRACK || t === TILE.HIGHROAD || t === TILE.BRIDGE;
    const anchor = (p) => {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = (p.x + dx + W) % W, y = p.y + dy; if (y > 0 && y < H && isRoadTile(g[y * W + x])) return { x, y, name: p.name }; }
        return p;
    };
    [...pairs.values()].sort((p, q) => (q.hi ? 1 : 0) - (p.hi ? 1 : 0)).forEach(pr => {
        const path = astar(anchor(pr.a), anchor(pr.b));
        if (!path) { (ow.roadFails = ow.roadFails || []).push(pr.a.name + ' - ' + pr.b.name); return; }
        built++;
        for (let k = 1; k < path.length - 1; k++) {
            const i = path[k], t = g[i];
            if (t === TILE.RIVER) g[i] = TILE.BRIDGE;
            else if (t === TILE.BRIDGE || t === TILE.HIGHROAD) continue;
            else if (t === TILE.TRACK) { if (pr.hi) g[i] = TILE.HIGHROAD; }
            else if (cost(t) === 9 || t === TILE.WATER) continue;
            else { if (!prevTile.has(i)) prevTile.set(i, t); g[i] = pr.hi ? TILE.HIGHROAD : TILE.TRACK; }
        }
    });
    // tidy: wherever the road is wider than a single lane (2x2 blobs, ladders) drop the tiles that are not needed to keep it connected
    const linkable = (t) => t === TILE.TRACK || t === TILE.HIGHROAD || t === TILE.BRIDGE || SETTLE.has(t);
    const at = (x, y) => g[y * W + ((x % W) + W) % W];
    for (let pass = 0; pass < 6; pass++) {
        let removed = 0;
        for (let y = 2; y < H - 2; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, t = g[i];
            if (t !== TILE.TRACK && t !== TILE.HIGHROAD) continue;
            // only tiles that sit in a 2x2 block of road
            let block = false;
            for (const [bx, by] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
                if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => linkable(at(x + bx + dx, y + by + dy)))) { block = true; break; }
            }
            if (!block) continue;
            // the road neighbours must stay connected to each other without this tile (through the 8-neighbourhood)
            const nb = [];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && linkable(at(x + dx, y + dy))) nb.push([dx, dy]);
            const key = ([dx, dy]) => dx + ',' + dy;
            const set = new Set(nb.map(key)), seen = new Set([key(nb[0])]), st = [nb[0]];
            while (st.length) { const [cx, cy] = st.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = [cx + dx, cy + dy]; if ((dx || dy) && set.has(key(q)) && !seen.has(key(q)) && Math.abs(q[0] - cx) + Math.abs(q[1] - cy) <= 1) { seen.add(key(q)); st.push(q); } } }
            // (4-connected inside the ring keeps the lane unbroken)
            if (seen.size !== set.size) continue;
            g[i] = prevTile.get(i) || TILE.GRASS; removed++;
        }
        if (!removed) break;
    }
    ow.roadCount = built;
}

// ---- signposts at the crossroads: one beside every place where roads meet ----
function wfPlaceSignposts() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const isRoad = (t) => t === TILE.TRACK || t === TILE.HIGHROAD;
    const SET = (t) => t === TILE.TOWN || t === TILE.CASTLE || t === TILE.PORT_TOWN || t === TILE.VILLAGE;
    const free = (t) => t === TILE.GRASS || t === TILE.SAVANNA || t === TILE.LUSH || t === TILE.SNOW || t === TILE.DESERT || t === TILE.BEACH || t === TILE.FOREST || t === TILE.TAIGA || t === TILE.ICE;
    const at = (x, y) => g[y * W + ((x % W) + W) % W];
    // junction tiles: a road with three or more roads (or a road and a settlement) around it
    const jn = new Map();
    for (let y = 2; y < H - 2; y++) for (let x = 0; x < W; x++) {
        if (!isRoad(g[y * W + x])) continue;
        let n = 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const t = at(x + dx, y + dy); if (isRoad(t) || t === TILE.BRIDGE) n++; });
        if (n >= 3) jn.set(y * W + x, { x, y });
    }
    // neighbouring junction tiles belong to the same crossing
    const seen = new Set(), signs = [];
    jn.forEach((j, k) => {
        if (seen.has(k)) return;
        const cluster = [], st = [j]; seen.add(k);
        while (st.length) {
            const c = st.pop(); cluster.push(c);
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                const x = (c.x + dx + W) % W, y = c.y + dy, kk = y * W + x;
                if (jn.has(kk) && !seen.has(kk)) { seen.add(kk); st.push(jn.get(kk)); }
            }
        }
        const cx = Math.round(cluster.reduce((a, c) => a + c.x, 0) / cluster.length), cy = Math.round(cluster.reduce((a, c) => a + c.y, 0) / cluster.length);
        const cands = [];
        cluster.forEach(c => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx || dy) cands.push({ x: (c.x + dx + W) % W, y: c.y + dy }); } });
        cands.sort((p, q) => (Math.abs(p.x - cx) + Math.abs(p.y - cy)) - (Math.abs(q.x - cx) + Math.abs(q.y - cy)));
        for (const c of cands) {
            if (c.y < 1 || c.y >= H - 1 || !free(at(c.x, c.y))) continue;
            g[c.y * W + c.x] = TILE.SIGNPOST; signs.push({ x: c.x, y: c.y }); return;
        }
    });
    ow.signposts = signs;
}
const WF_COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
function wfSignText(sx, sy) {
    const ow = state.overworld, W = ow.width;
    const list = (ow.landmarks || []).filter(l => [TILE.TOWN, TILE.CASTLE, TILE.PORT_TOWN, TILE.VILLAGE].includes(l.type)).map(l => {
        let dx = l.x - sx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
        const dy = l.y - sy;
        return { l, dx, dy, d: Math.abs(dx) + Math.abs(dy) };
    }).sort((a, b) => a.d - b.d).slice(0, 5);
    return list.map(o => {
        const ang = Math.atan2(o.dy, o.dx), dir = WF_COMPASS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
        return `${o.l.name} - ${o.d} leagues ${dir}`;
    });
}

// ---- ruins ----
const WF_RUIN_A = ['Old', 'Fallen', 'Lost', 'Broken', 'Sunken', 'Forgotten', 'Weeping', 'Hollow'];
const WF_RUIN_B = ['Watchtower', 'Abbey', 'Fort', 'Temple', 'Keep', 'Shrine', 'Hall', 'Barrow'];
const WF_TREE_TILES = () => ({ [TILE.GRASS]: TILE.LONETREE, [TILE.LUSH]: TILE.LONETREE, [TILE.SAVANNA]: TILE.LONETREE_DRY, [TILE.DESERT]: TILE.LONETREE_DRY, [TILE.TAIGA]: TILE.LONETREE_SNOW, [TILE.SNOW]: TILE.LONETREE_SNOW });
function wfPlaceRuins() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const rng = createSeededRNG('RUINS_V1');
    const ok = (t) => t === TILE.GRASS || t === TILE.FOREST || t === TILE.DESERT || t === TILE.SAVANNA || t === TILE.JUNGLE || t === TILE.LUSH || t === TILE.TAIGA || t === TILE.SNOW || t === TILE.MOUNTAIN;
    const lm = (ow.landmarks || []).map(l => ({ x: l.x, y: l.y }));
    const ruins = [];
    const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };
    for (let a = 0; a < 160000 && ruins.length < 180; a++) {
        const x = 4 + Math.floor(rng() * (W - 8)), y = 14 + Math.floor(rng() * (H - 28));
        if (!ok(g[y * W + x])) continue;
        if (lm.some(p => wd(p.x, x) + Math.abs(p.y - y) < 18) || ruins.some(p => wd(p.x, x) + Math.abs(p.y - y) < 26)) continue;
        // keep to open country: no sea right next to it
        let wet = false;
        for (let dy = -2; dy <= 2 && !wet; dy++) for (let dx = -2; dx <= 2; dx++) { const t = g[(y + dy) * W + ((x + dx + W) % W)]; if (t === TILE.WATER || t === TILE.RIVER || t === TILE.TRACK || t === TILE.HIGHROAD) { wet = true; break; } }
        if (wet) continue;
        ruins.push({ x, y, name: `${WF_RUIN_A[Math.floor(rng() * 8)]} ${WF_RUIN_B[Math.floor(rng() * 8)]}` });
    }
    ruins.forEach(r => {
        g[r.y * W + r.x] = TILE.RUINS;
        for (let k = 0; k < 4; k++) {                      // a scatter of fallen stones around it
            const sx = (r.x + Math.floor(rng() * 5) - 2 + W) % W, sy = r.y + Math.floor(rng() * 5) - 2, i = sy * W + sx;
            if (ok(g[i]) && g[i] !== TILE.MOUNTAIN) g[i] = TILE.RUINS;
        }
    });
    ow.ruins = ruins;
}

// ---- wildlife and ropers: homes are fixed by the world seed; the animals wander about them, the ropers never move ----
function wfPlaceCreatures() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const lm = (ow.landmarks || []).map(l => ({ x: l.x, y: l.y }));
    const nearSettlement = (x, y) => lm.some(p => { const d = Math.abs(p.x - x); return Math.min(d, W - d) + Math.abs(p.y - y) < 10; });
    const fauna = [], ropers = [];
    const kindFor = (t, h2) => {
        switch (t) {
            case TILE.GRASS: return h2 < 0.0006 ? (h2 < 0.0002 ? 18 : 16) : 0;          // hare / deer
            case TILE.FOREST: return h2 < 0.0005 ? 16 : 0;
            case TILE.LUSH: return h2 < 0.0004 ? 16 : 0;
            case TILE.SAVANNA: return h2 < 0.0022 ? 17 : 0;                              // antelope
            case TILE.DESERT: return h2 < 0.0003 ? 17 : 0;
            case TILE.MOUNTAIN: return h2 < 0.0012 ? 19 : 0;                             // mountain goat
            case TILE.TAIGA: case TILE.SNOW: return h2 < 0.0004 ? 18 : 0;
            default: return 0;
        }
    };
    for (let y = 12; y < H - 12; y++) for (let x = 0; x < W; x++) {
        const t = g[y * W + x], h = wfHash(x, y, 77);
        if (t === TILE.SWAMP) { if (h < 0.012 && !nearSettlement(x, y)) ropers.push({ x, y }); continue; }
        if (h > 0.0025) continue;
        const k = kindFor(t, h);
        if (k && !nearSettlement(x, y)) fauna.push({ x, y, kind: k });
    }
    ow.fauna = []; ow.ropers = ropers;
    // groups of wisps drift over the marshes, the lake shores and the odd glade - after dark only
    const wisps = [];
    for (let y = 12; y < H - 12; y++) for (let x = 0; x < W; x++) {
        const t = g[y * W + x], h = wfHash(x, y, 91);
        if (t === TILE.SWAMP ? h < 0.004 : ((t === TILE.FOREST || t === TILE.LUSH || t === TILE.JUNGLE) ? h < 0.0003 : (t === TILE.BEACH && h < 0.0005))) { if (!nearSettlement(x, y)) wisps.push({ x, y }); }
    }
    (ow.lakes || []).forEach((l, i) => { if (wfHash(i, 5, 17) < 0.7) wisps.push({ x: l.x + Math.round(l.rx) + 2, y: l.y }); });
    ow.wisps = wisps;
}
// creatures within `range` of the party right now (ropers and wildlife by day and night; the undead only after dark)
function wfCreaturesNear(px, py, range) {
    const ow = state.overworld;
    const info = getTimeOfDayInfo(), W = ow.width, out = [];
    const day = info.day;
    const near = (x, y) => { let dx = x - px; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; return Math.abs(dx) <= range + 6 && Math.abs(y - py) <= range + 6; };
    const slain = ow.slain || {};
    (ow.ropers || []).forEach((r, i) => {
        if (!near(r.x, r.y)) return;
        const key = `r|${i}|${day}`;
        if (!slain[key]) out.push({ x: r.x, y: r.y, tier: M_ROPER, key, hostile: true });
    });
    if (info.hour >= 20 || info.hour <= 4) {
        const night = info.hour <= 4 ? day - 1 : day;                    // the night belongs to the day it began on
        (ow.wisps || []).forEach((w, i) => {
            if (!near(w.x, w.y)) return;
            const key = `w|${i}|${night}`;
            if (slain[key]) return;
            const t = getWorldTile(w.x, w.y);
            if (t === TILE.WATER || t === TILE.RIVER) return;
            out.push({ x: w.x, y: w.y, tier: M_WISP, key, hostile: true });
        });
    }
    const phase = Math.floor(worldNow() / 9000);
    (ow.fauna || []).forEach((f, i) => {
        if (!near(f.x, f.y)) return;
        const key = `f|${i}|${day}`;
        if (slain[key]) return;
        let ox = Math.round((wfHash(i, phase, 5) - 0.5) * 6), oy = Math.round((wfHash(i, phase, 9) - 0.5) * 6);
        const x = (f.x + ox + W) % W, y = f.y + oy, t = getWorldTile(x, y);
        if (t === TILE.WATER || t === TILE.RIVER || t === TILE.BRIDGE || t === TILE.TRACK || t === TILE.HIGHROAD || t === TILE.SIGNPOST || t === TILE.RUINS || (t >= TILE.TOWN && t <= TILE.DUNGEON) || t === TILE.VILLAGE || t === TILE.PORT_TOWN || t === TILE.MOONGATE) { ox = 0; oy = 0; }
        out.push({ x: (f.x + ox + W) % W, y: f.y + oy, tier: f.kind, key, animal: true });
    });
    return out;
}

function applyWorldFeatures() {
    applyBiomes();
    wfPlaceLakes();
    wfBuildRoads();
    wfPlaceSignposts();
    wfPlaceRuins();
    applyBeaches();
    wfPlaceLighthouses();
    wfPlaceCamps();
    wfPlaceLoneTrees();
    wfPlaceCreatures();
    wfPlaceWagonSites();
    wfBuildLairs();
}

// ---- lakes: ponds and lakes inland (the beaches pick up their shores), small oases in the deserts ----
const WF_LAKE_LAND = (t) => t === TILE.GRASS || t === TILE.FOREST || t === TILE.LUSH || t === TILE.SAVANNA || t === TILE.TAIGA || t === TILE.SNOW || t === TILE.JUNGLE || t === TILE.DESERT || t === TILE.SWAMP;
function wfPlaceLakes() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const rng = createSeededRNG('LAKES_V1');
    const lm = (ow.landmarks || []).map(l => ({ x: l.x, y: l.y }));
    const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };
    const lakes = [];
    for (let a = 0; a < 120000 && lakes.length < 140; a++) {
        const x = 6 + Math.floor(rng() * (W - 12)), y = 22 + Math.floor(rng() * (H - 44));
        if (!WF_LAKE_LAND(g[y * W + x])) continue;
        if (wd(x, START_X) + Math.abs(y - START_Y) < 30 * WS) continue;
        if (lm.some(p => wd(p.x, x) + Math.abs(p.y - y) < 18) || lakes.some(l => wd(l.x, x) + Math.abs(l.y - y) < 34)) continue;
        const desert = g[y * W + x] === TILE.DESERT;
        const rx = desert ? 1.5 + rng() * 1.5 : 2.5 + rng() * 5, ry = Math.max(1.5, rx * (0.55 + rng() * 0.5));
        // the whole neighbourhood must be dry land: lakes never touch the sea, a river or a mountain
        const R = Math.ceil(rx + 4), RY = Math.ceil(ry + 4);
        let clear = true;
        for (let dy = -RY; dy <= RY && clear; dy++) for (let dx = -R; dx <= R; dx++) {
            const t = g[(y + dy) * W + (((x + dx) % W + W) % W)];
            if (!WF_LAKE_LAND(t)) { clear = false; break; }
        }
        if (!clear) continue;
        const ph = rng() * 100;
        for (let dy = -RY; dy <= RY; dy++) for (let dx = -R; dx <= R; dx++) {
            const d = (dx / rx) * (dx / rx) + (dy / ry) * (dy / ry);
            if (d < 1 + (vnoise((x + dx) / 2.2 + ph, (y + dy) / 2.2) - 0.5) * 0.7) g[(y + dy) * W + (((x + dx) % W + W) % W)] = TILE.WATER;
        }
        lakes.push({ x, y, rx, ry });
    }
    ow.lakes = lakes;
}

// ---- lighthouses on the coasts ----
const WF_LIGHT_A = ['Gull', 'Storm', 'Raven', 'Silver', 'Lantern', 'Windy', 'Misty', 'Hollow', 'Foam', 'Star', 'Whale', 'Kelp'];
const WF_LIGHT_B = ['Point', 'Head', 'Rock', 'Cape', 'Reach', 'Spit', 'Bluff', 'Ness'];
function wfPlaceLighthouses() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const rng = createSeededRNG('LIGHTHOUSES_V1');
    const lm = (ow.landmarks || []).map(l => ({ x: l.x, y: l.y }));
    const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };
    const landOk = (t) => t === TILE.GRASS || t === TILE.FOREST || t === TILE.LUSH || t === TILE.SAVANNA || t === TILE.TAIGA || t === TILE.SNOW || t === TILE.DESERT || t === TILE.JUNGLE;
    const cands = [];
    for (let y = 14; y < H - 14; y++) for (let x = 0; x < W; x++) {
        if (!landOk(g[y * W + x]) || wfHash(x, y, 211) > 0.07) continue;
        // right at the shore: sand beside it, open sea within three tiles
        let beach = false, sea = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[(y + dy) * W + (((x + dx) % W + W) % W)] === TILE.BEACH) beach = true;
        if (!beach) continue;
        for (let dy = -3; dy <= 3 && !sea; dy++) for (let dx = -3; dx <= 3; dx++) if (g[(y + dy) * W + (((x + dx) % W + W) % W)] === TILE.WATER) { sea = true; break; }
        if (sea) cands.push({ x, y });
    }
    // shuffle, then keep the ones that are far enough from towns and from each other
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    const out = [];
    for (const c of cands) {
        if (out.length >= 110) break;
        if (lm.some(p => wd(p.x, c.x) + Math.abs(p.y - c.y) < 8) || out.some(p => wd(p.x, c.x) + Math.abs(p.y - c.y) < 40)) continue;
        out.push({ x: c.x, y: c.y, name: `${WF_LIGHT_A[Math.floor(rng() * WF_LIGHT_A.length)]} ${WF_LIGHT_B[Math.floor(rng() * WF_LIGHT_B.length)]} Light` });
    }
    out.forEach(l => { g[l.y * W + l.x] = TILE.LIGHTHOUSE; });
    ow.lighthouses = out;
}

// ---- monster encampments (they breed one kind of monster) and abandoned camps (a bounty for whoever finds them first) ----
const WF_CAMP_SPECIES = {               // monster index by terrain: [species ...]
    grass: [11, 11, 9, 13, 0, 2], taiga: [13, 13, 0, 11], desert: [9, 12, 0, 2], jungle: [12, 11, 9], default: [11, 9, 13]
};
const WF_CAMP_NAMES = { 0: 'Orc Warband', 2: 'Bandit Camp', 8: 'Rat Warren', 9: 'Kobold Warren', 11: 'Goblin Encampment', 12: 'Snake Nest', 13: 'Wolf Den', 14: 'Headless Camp' };
function wfPlaceCamps() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const rng = createSeededRNG('CAMPS_V1');
    const lm = (ow.landmarks || []).map(l => ({ x: l.x, y: l.y }));
    const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };
    const ok = (t) => t === TILE.GRASS || t === TILE.FOREST || t === TILE.LUSH || t === TILE.SAVANNA || t === TILE.TAIGA || t === TILE.SNOW || t === TILE.DESERT || t === TILE.JUNGLE;
    const near = (list, x, y, d) => list.some(p => wd(p.x, x) + Math.abs(p.y - y) < d);
    const kindOf = (t) => (t === TILE.TAIGA || t === TILE.SNOW) ? 'taiga' : ((t === TILE.DESERT || t === TILE.SAVANNA) ? 'desert' : (t === TILE.JUNGLE || t === TILE.LUSH ? 'jungle' : 'grass'));
    const camps = [], abandoned = [];
    const free = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = g[(y + dy) * W + (((x + dx) % W + W) % W)]; if (!ok(t) && t !== TILE.MOUNTAIN) return false; }
        return true;
    };
    for (let a = 0; a < 200000 && camps.length < 170; a++) {
        const x = 4 + Math.floor(rng() * (W - 8)), y = 16 + Math.floor(rng() * (H - 32));
        const t = g[y * W + x];
        if (!ok(t) || wd(x, START_X) + Math.abs(y - START_Y) < 22 * WS) continue;
        if (near(lm, x, y, 20) || near(ow.ruins || [], x, y, 14) || near(camps, x, y, 30) || !free(x, y)) continue;
        const pool = WF_CAMP_SPECIES[kindOf(t)] || WF_CAMP_SPECIES.default;
        const sp = pool[Math.floor(rng() * pool.length)];
        camps.push({ x, y, species: sp, name: WF_CAMP_NAMES[sp] || 'Monster Camp' });
    }
    for (let a = 0; a < 200000 && abandoned.length < 220; a++) {
        const x = 4 + Math.floor(rng() * (W - 8)), y = 14 + Math.floor(rng() * (H - 28));
        const t = g[y * W + x];
        if (!ok(t) || near(lm, x, y, 10) || near(camps, x, y, 12) || near(ow.ruins || [], x, y, 8) || near(abandoned, x, y, 22) || !free(x, y)) continue;
        abandoned.push({ x, y });
    }
    camps.forEach(c => { g[c.y * W + c.x] = TILE.ENCAMP; });
    abandoned.forEach(c => { g[c.y * W + c.x] = TILE.ABANDONED; });
    ow.camps = camps; ow.abandoned = abandoned;
}

// ---- lone trees: single trees standing in the open ----
function wfPlaceLoneTrees() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const map = WF_TREE_TILES();
    let n = 0;
    for (let y = 12; y < H - 12; y++) for (let x = 0; x < W; x++) {
        const t = g[y * W + x], tree = map[t];
        if (!tree) continue;
        const h = wfHash(x, y, 313);
        if (h > (t === TILE.GRASS ? 0.0035 : 0.0018)) continue;
        // not on a road, and not in a crowd: a lone tree is lonely
        let crowd = false;
        for (let dy = -1; dy <= 1 && !crowd; dy++) for (let dx = -1; dx <= 1; dx++) {
            const u = g[(y + dy) * W + (((x + dx) % W + W) % W)];
            if (u === TILE.FOREST || u === TILE.JUNGLE || u === TILE.TRACK || u === TILE.HIGHROAD || u === TILE.SIGNPOST || (u >= TILE.TOWN && u <= TILE.DUNGEON) || u === TILE.RUINS) { crowd = true; break; }
        }
        if (crowd) continue;
        g[y * W + x] = tree; n++;
    }
    ow.loneTrees = n;
}

// ---- gypsy wagons: now and then at night one is parked beside a road that runs by the woods ----
function wfPlaceWagonSites() {
    const ow = state.overworld, W = ow.width, H = ow.height, g = ow.grid;
    const rng = createSeededRNG('WAGONS_V1');
    const lm = (ow.landmarks || []).map(l => ({ x: l.x, y: l.y }));
    const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };
    const road = (t) => t === TILE.TRACK || t === TILE.HIGHROAD;
    const open = (t) => t === TILE.GRASS || t === TILE.LUSH || t === TILE.SAVANNA || t === TILE.TAIGA || t === TILE.SNOW;
    const idx = (x, y) => y * W + (((x % W) + W) % W);
    const sites = [];
    for (let y = 14; y < H - 14; y++) for (let x = 0; x < W; x++) {
        if (!road(g[idx(x, y)]) || wfHash(x, y, 417) > 0.2) continue;
        // woods close by
        let wood = 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const t = g[idx(x + dx, y + dy)]; if (t === TILE.FOREST || t === TILE.JUNGLE || t === TILE.TAIGA) wood++; }
        if (wood < 3) continue;
        const sp = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([sx, sy]) => open(g[idx(sx, sy)]));
        if (!sp.length) continue;
        const [sx, sy] = sp[Math.floor(rng() * sp.length)];
        if (lm.some(p => wd(p.x, sx) + Math.abs(p.y - sy) < 8) || sites.some(p => wd(p.x, sx) + Math.abs(p.y - sy) < 9)) continue;
        sites.push({ x: ((sx % W) + W) % W, y: sy });
    }
    ow.wagonSites = sites;
}
// the wagons parked right now near (px, py): each site has one on about half of the nights
function wfWagonsNear(px, py, range) {
    const ow = state.overworld, sites = ow.wagonSites;
    if (!sites || !sites.length) return [];
    const info = getTimeOfDayInfo();
    if (!(info.hour >= 20 || info.hour <= 4)) return [];
    const night = info.hour <= 4 ? info.day - 1 : info.day, W = ow.width, out = [];
    sites.forEach((w, i) => {
        let dx = w.x - px; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
        if (Math.abs(dx) > range + 2 || Math.abs(w.y - py) > range + 2) return;
        if (wfHash(i, night, 43) < 0.5) out.push({ x: w.x, y: w.y, i, night });
    });
    return out;
}
function wfWagonAt(x, y) {
    const sites = state.overworld.wagonSites;
    if (!sites) return null;
    const info = getTimeOfDayInfo();
    if (!(info.hour >= 20 || info.hour <= 4)) return null;
    const night = info.hour <= 4 ? info.day - 1 : info.day;
    for (let i = 0; i < sites.length; i++) if (sites[i].x === x && sites[i].y === y && wfHash(i, night, 43) < 0.5) return { x, y, i, night };
    return null;
}
// a painted caravan with a lit lantern, drawn over the ground in a size x size box
function wfDrawWagon(ctx, px, py, s, t) {
    ctx.save(); ctx.translate(px, py);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.9, s * 0.42, s * 0.07, 0, 0, 7); ctx.fill();
    vgGlow(ctx, s * 0.5, s * 0.55, s * 0.8, '255,190,90', 0.32 + 0.05 * Math.sin(t * 0.1));
    // body: a barrel-roofed caravan, painted plum with gold trim
    ctx.fillStyle = tlGrad(ctx, 0, s * 0.3, 0, s * 0.82, [[0, '#8b3fa8'], [1, '#4c1d6b']]);
    tlRR(ctx, s * 0.12, s * 0.36, s * 0.66, s * 0.42, s * 0.04); ctx.fill();
    ctx.strokeStyle = '#1c0a24'; ctx.lineWidth = Math.max(0.8, s * 0.02); ctx.stroke();
    ctx.fillStyle = tlGrad(ctx, 0, s * 0.18, 0, s * 0.4, [[0, '#d97706'], [1, '#92400e']]);
    ctx.beginPath(); ctx.moveTo(s * 0.08, s * 0.4); ctx.quadraticCurveTo(s * 0.45, s * 0.1, s * 0.82, s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = Math.max(0.8, s * 0.016);
    ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.5); ctx.lineTo(s * 0.78, s * 0.5); ctx.moveTo(s * 0.12, s * 0.72); ctx.lineTo(s * 0.78, s * 0.72); ctx.stroke();
    // a lit window with a star, and a little door
    ctx.fillStyle = '#fde68a'; tlRR(ctx, s * 0.22, s * 0.52, s * 0.18, s * 0.16, s * 0.02); ctx.fill(); ctx.strokeStyle = '#1c0a24'; ctx.stroke();
    ctx.fillStyle = '#7c2d12'; ctx.fillRect(s * 0.52, s * 0.52, s * 0.16, s * 0.26);
    // wheels
    [[0.26, 0.82], [0.64, 0.82]].forEach(([x, y]) => {
        ctx.save(); ctx.translate(s * x, s * y); ctx.rotate(0);
        ctx.fillStyle = '#5b3a1a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, 7); ctx.fill(); ctx.strokeStyle = '#1c0a24'; ctx.stroke();
        ctx.strokeStyle = '#d6b370'; ctx.lineWidth = Math.max(0.6, s * 0.012); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k * 0.785) * s * 0.09, Math.sin(k * 0.785) * s * 0.09); ctx.stroke(); }
        ctx.restore();
    });
    // a lantern swinging from the back and a crescent moon on the roof
    ctx.strokeStyle = '#3b2412'; ctx.lineWidth = Math.max(0.8, s * 0.015); ctx.beginPath(); ctx.moveTo(s * 0.8, s * 0.42); ctx.lineTo(s * 0.88, s * 0.42); ctx.stroke();
    const sw = Math.sin(t * 0.08) * s * 0.012;
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(s * 0.88 + sw, s * 0.48, s * 0.04, 0, 7); ctx.fill();
    vgGlow(ctx, s * 0.88 + sw, s * 0.48, s * 0.2, '253,224,71', 0.5);
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(s * 0.45, s * 0.22, s * 0.045, 0, 7); ctx.fill(); ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.arc(s * 0.47, s * 0.21, s * 0.04, 0, 7); ctx.fill();
    ctx.restore();
}

// every place that breeds monsters: the server spawns them around these while somebody is near (a roamer's `lair` is the index here)
function wfBuildLairs() {
    const ow = state.overworld;
    const list = [];
    (ow.ruins || []).forEach(r => list.push({ x: r.x, y: r.y, type: 0 }));
    (ow.landmarks || []).filter(l => l.type === TILE.DUNGEON).forEach(l => list.push({ x: l.x, y: l.y, type: 1 }));
    (ow.camps || []).forEach(c => list.push({ x: c.x, y: c.y, type: 2, species: c.species, tier: Math.max(0, MONSTERS[c.species].rank | 0) }));
    ow.lairList = list;
}

// ---- the dead of the ruins: at night skeletons shamble about them, and (very rarely) a ghost appears ----
const WF_TIER_SKELETON = 1, WF_TIER_GHOST = 7;
function wfHash(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function wfIsNight(hour) { return hour >= 21 || hour <= 4; }
// the undead that walk right now near (px, py)
function wfUndeadNear(px, py, range) {
    return [];            // ruins now spawn their monsters on the server (see roamers.php); only the swamp ropers stay client-side
    const ow = state.overworld;
    if (!ow.ruins || !ow.ruins.length) return [];
    const info = getTimeOfDayInfo();
    if (!wfIsNight(info.hour)) return [];
    const W = ow.width, phase = Math.floor(worldNow() / 7000), out = [];
    ow.ruins.forEach((r, i) => {
        let dx = r.x - px; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
        if (Math.abs(dx) > range + 6 || Math.abs(r.y - py) > range + 6) return;
        const day = info.hour <= 4 ? info.day - 1 : info.day;             // the night belongs to the day it began on
        const n = 1 + Math.floor(wfHash(i, day, 1) * 3);
        const kinds = [];
        for (let k = 0; k < n; k++) kinds.push(WF_TIER_SKELETON);
        if (wfHash(i, day, 2) < 0.05) kinds.push(WF_TIER_GHOST);
        kinds.forEach((tier, k) => {
            const key = `${i}|${day}|${k}`;
            if (ow.slain && ow.slain[key]) return;
            let ox = Math.round((wfHash(i, k, phase * 3 + 5) - 0.5) * 8), oy = Math.round((wfHash(i, k, phase * 3 + 9) - 0.5) * 8);
            const x = (r.x + ox + W) % W, y = r.y + oy, t = getWorldTile(x, y);
            if (t === TILE.WATER || t === TILE.RIVER) { ox = 0; oy = 1; }
            out.push({ x: (r.x + ox + W) % W, y: r.y + oy, tier, key, ruin: i });
        });
    });
    return out;
}

// ---- tile art ----
function wfSand(ctx, s, c0, c1) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, c0], [1, c1]]); ctx.fillRect(0, 0, s, s);
}
function paintDesert(ctx, s, variant, rng) {
    wfSand(ctx, s, '#e2c481', '#cfa95e');
    // dunes: pale crest, shaded lee
    for (let i = 0; i < 3; i++) {
        const y = s * (0.2 + i * 0.28 + rng() * 0.08), a = s * (0.06 + rng() * 0.05);
        ctx.fillStyle = 'rgba(120,80,30,0.16)';
        ctx.beginPath(); ctx.moveTo(0, y + a); ctx.quadraticCurveTo(s * 0.5, y - a, s, y + a * 0.5); ctx.lineTo(s, y + a * 2.2); ctx.quadraticCurveTo(s * 0.5, y + a * 0.6, 0, y + a * 2.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = Math.max(0.8, s * 0.02);
        ctx.beginPath(); ctx.moveTo(0, y + a); ctx.quadraticCurveTo(s * 0.5, y - a, s, y + a * 0.5); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(110,70,25,0.25)';
    for (let i = 0; i < 9; i++) ctx.fillRect(s * rng(), s * rng(), Math.max(1, s * 0.015), Math.max(1, s * 0.015));
    if (variant === 2 || variant === 3) {                       // saguaro cactus
        const x = s * (0.35 + rng() * 0.3), b = s * 0.86, c = '#4a8f3f';
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + s * 0.03, b, s * 0.12, s * 0.035, 0, 0, 7); ctx.fill();
        tlRR(ctx, x - s * 0.04, s * 0.3, s * 0.08, b - s * 0.3, s * 0.04); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#2f6b2a'; ctx.lineWidth = Math.max(0.7, s * 0.014); ctx.stroke();
        tlRR(ctx, x - s * 0.16, s * 0.48, s * 0.055, s * 0.22, s * 0.027); ctx.fill(); ctx.stroke();
        tlRR(ctx, x - s * 0.16, s * 0.66, s * 0.14, s * 0.05, s * 0.025); ctx.fill(); ctx.stroke();
        tlRR(ctx, x + s * 0.105, s * 0.42, s * 0.055, s * 0.2, s * 0.027); ctx.fill(); ctx.stroke();
        tlRR(ctx, x + s * 0.03, s * 0.6, s * 0.13, s * 0.05, s * 0.025); ctx.fill(); ctx.stroke();
    } else if (variant === 4) {                                 // sun-bleached rocks
        [[0.3, 0.7, 0.09], [0.55, 0.78, 0.065], [0.68, 0.62, 0.05]].forEach(([x, y, r]) => {
            ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x * s, y * s + r * s * 0.7, r * s * 1.2, r * s * 0.4, 0, 0, 7); ctx.fill();
            ctx.fillStyle = tlGrad(ctx, x * s - r * s, y * s - r * s, x * s + r * s, y * s + r * s, [[0, '#c9b79a'], [1, '#8a7860']]);
            ctx.beginPath(); ctx.ellipse(x * s, y * s, r * s * 1.2, r * s, 0, 0, 7); ctx.fill();
        });
    } else if (variant === 5) {                                 // dry shrub with a bleached skull
        ctx.strokeStyle = '#7a6a3a'; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(s * 0.7, s * 0.8); ctx.lineTo(s * (0.55 + rng() * 0.3), s * (0.55 + rng() * 0.15)); ctx.stroke(); }
        ctx.fillStyle = '#f1eadb'; ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.75, s * 0.06, s * 0.05, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#3b2f20'; ctx.fillRect(s * 0.255, s * 0.73, s * 0.016, s * 0.02); ctx.fillRect(s * 0.295, s * 0.73, s * 0.016, s * 0.02);
    } else if (variant === 7) {                                 // cracked earth
        ctx.strokeStyle = 'rgba(80,50,20,0.45)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
        for (let i = 0; i < 4; i++) { let x = s * rng(), y = s * rng(); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * s * 0.3; y += (rng() - 0.3) * s * 0.2; ctx.lineTo(x, y); } ctx.stroke(); }
    }
}
function wfAcacia(ctx, s, x, base, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, base, h * 0.55, h * 0.1, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5b3d1e'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x - h * 0.05, base - h * 0.5, x + h * 0.02, base - h * 0.75); ctx.moveTo(x, base - h * 0.45); ctx.lineTo(x + h * 0.2, base - h * 0.7); ctx.stroke();
    [[0, -0.82, 0.5], [0.22, -0.74, 0.28]].forEach(([dx, dy, w]) => {
        ctx.fillStyle = tlGrad(ctx, 0, base + dy * h - h * 0.12, 0, base + dy * h + h * 0.1, [[0, '#9fb347'], [1, '#5f7d2a']]);
        ctx.beginPath(); ctx.ellipse(x + dx * h, base + dy * h, h * w, h * 0.11, 0, 0, 7); ctx.fill();
    });
}
function paintSavanna(ctx, s, variant, rng) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#b9a64a'], [1, '#948a3a']]); ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3; i++) {
        const x = s * rng(), y = s * rng(), r = s * (0.18 + rng() * 0.16);
        ctx.fillStyle = tlRad(ctx, x, y, 0, r, [[0, rng() < 0.5 ? 'rgba(230,210,110,0.28)' : 'rgba(90,70,20,0.22)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
        const x = s * (0.08 + rng() * 0.84), y = s * (0.25 + rng() * 0.7), h = s * (0.09 + rng() * 0.09);
        ctx.strokeStyle = rng() < 0.5 ? 'rgba(235,215,120,0.85)' : 'rgba(150,130,50,0.9)'; ctx.lineWidth = Math.max(0.8, s * 0.02);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h * 0.3, y - h); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.15, y - h * 1.1); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.5, y - h * 0.85); ctx.stroke();
    }
    if (variant === 3 || variant === 4) wfAcacia(ctx, s, s * 0.5, s * 0.88, s * (variant === 3 ? 0.62 : 0.46));
    else if (variant === 5) {                                    // termite mound
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.82, s * 0.14, s * 0.04, 0, 0, 7); ctx.fill();
        ctx.fillStyle = tlGrad(ctx, s * 0.4, s * 0.4, s * 0.6, s * 0.8, [[0, '#c08457'], [1, '#7a4a2a']]);
        ctx.beginPath(); ctx.moveTo(s * 0.36, s * 0.82); ctx.quadraticCurveTo(s * 0.4, s * 0.45, s * 0.5, s * 0.4); ctx.quadraticCurveTo(s * 0.6, s * 0.45, s * 0.64, s * 0.82); ctx.closePath(); ctx.fill();
    } else if (variant === 6) {                                  // a flat-topped rock
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.8, s * 0.18, s * 0.05, 0, 0, 7); ctx.fill();
        ctx.fillStyle = tlGrad(ctx, 0, s * 0.55, 0, s * 0.8, [[0, '#b0a58f'], [1, '#6f6652']]);
        tlRR(ctx, s * 0.32, s * 0.55, s * 0.36, s * 0.25, s * 0.06); ctx.fill();
    }
}
function paintJungle(ctx, s, variant, rng, phase) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#15532a'], [1, '#0b3a1c']]); ctx.fillRect(0, 0, s, s);
    const leaf = (x, y, len, ang, c1, c2) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = tlGrad(ctx, 0, -len * 0.2, len, len * 0.2, [[0, c1], [1, c2]]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,40,10,0.5)'; ctx.lineWidth = Math.max(0.6, s * 0.012); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
        ctx.restore();
    };
    for (let i = 0; i < 26; i++) leaf(s * rng(), s * (0.2 + rng() * 0.8), s * (0.22 + rng() * 0.2), rng() * 6.28, rng() < 0.5 ? '#2f9e4f' : '#1f7a3a', '#0f5a28');
    // a broad-leaved canopy tree (or a palm) on top
    const cx = s * (0.42 + rng() * 0.16), base = s * 0.92;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, base, s * 0.3, s * 0.06, 0, 0, 7); ctx.fill();
    if (variant % 2) {
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1.4, s * 0.05); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, base); ctx.quadraticCurveTo(cx + s * 0.06, s * 0.55, cx + s * 0.02, s * 0.3); ctx.stroke();
        for (let i = 0; i < 7; i++) leaf(cx + s * 0.02, s * 0.3, s * 0.34, -Math.PI / 2 + (i - 3) * 0.55 + Math.sin(phase + i) * 0.03, '#4fcf6a', '#1c8a3a');
    } else {
        ctx.strokeStyle = '#5b3d1e'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, s * 0.42); ctx.stroke();
        [[0, 0.3, 0.3], [-0.16, 0.38, 0.22], [0.17, 0.37, 0.22], [-0.07, 0.24, 0.2], [0.08, 0.22, 0.2]].forEach(([dx, dy, r]) => {
            ctx.fillStyle = tlRad(ctx, cx + dx * s, dy * s, 0, r * s, [[0, '#59d276'], [0.7, '#2a9a47'], [1, '#146a2e']]);
            ctx.beginPath(); ctx.arc(cx + dx * s, dy * s, r * s, 0, 7); ctx.fill();
        });
    }
    // vines and a flower
    ctx.strokeStyle = 'rgba(120,200,90,0.7)'; ctx.lineWidth = Math.max(0.8, s * 0.016);
    ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.2); ctx.quadraticCurveTo(s * 0.2, s * 0.5, s * 0.1, s * 0.75); ctx.stroke();
    if (variant > 4) { ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.arc(s * 0.8, s * 0.7, s * 0.03, 0, 7); ctx.fill(); ctx.fillStyle = '#fde047'; ctx.fillRect(s * 0.795, s * 0.695, 1, 1); }
}
function paintLush(ctx, s, variant, rng) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#2f8a3c'], [1, '#1c6a2c']]); ctx.fillRect(0, 0, s, s);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {            // ferns
        const x = s * (0.1 + rng() * 0.8), y = s * (0.45 + rng() * 0.5), len = s * (0.14 + rng() * 0.1);
        ctx.strokeStyle = rng() < 0.5 ? '#6fd788' : '#3fae57'; ctx.lineWidth = Math.max(0.8, s * 0.02);
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + k * len * 0.3, y - len * 0.8, x + k * len * 0.6, y - len * (1 - Math.abs(k) * 0.12)); ctx.stroke(); }
    }
    for (let i = 0; i < 3; i++) { const x = s * rng(), y = s * rng(), r = s * 0.2; ctx.fillStyle = tlRad(ctx, x, y, 0, r, [[0, 'rgba(10,50,20,0.28)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    if (variant % 3 === 0) { [['#fb7185', 0.3, 0.3], ['#fbbf24', 0.7, 0.65], ['#c084fc', 0.5, 0.8]].forEach(([c, x, y]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s * x, s * y, s * 0.028, 0, 7); ctx.fill(); }); }
}
function wfSpruce(ctx, s, cx, base, h, snow) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, base, h * 0.3, h * 0.05, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3320'; ctx.fillRect(cx - h * 0.04, base - h * 0.14, h * 0.08, h * 0.14);
    for (let i = 0; i < 3; i++) {
        const top = base - h * (1 - i * 0.28), w = h * (0.22 + i * 0.1), bot = top + h * 0.44;
        ctx.fillStyle = tlGrad(ctx, cx - w, 0, cx + w, 0, [[0, '#2f6b50'], [1, '#17402e']]);
        ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + w, bot); ctx.lineTo(cx - w, bot); ctx.closePath(); ctx.fill();
        if (snow) { ctx.fillStyle = '#f1f7fb'; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + w * 0.55, top + (bot - top) * 0.5); ctx.quadraticCurveTo(cx + w * 0.2, top + (bot - top) * 0.42, cx, top + (bot - top) * 0.52); ctx.quadraticCurveTo(cx - w * 0.2, top + (bot - top) * 0.42, cx - w * 0.55, top + (bot - top) * 0.5); ctx.closePath(); ctx.fill(); }
    }
}
function wfSnowBase(ctx, s, rng) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#eef5fa'], [1, '#cfe0ec']]); ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(150,180,205,0.5)'; ctx.lineWidth = Math.max(0.8, s * 0.02); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const y = s * (0.25 + i * 0.28 + rng() * 0.06); ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s * 0.5, y - s * (0.05 + rng() * 0.04), s, y + s * 0.02); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < 6; i++) ctx.fillRect(s * rng(), s * rng(), Math.max(1, s * 0.015), Math.max(1, s * 0.015));
}
function paintSnow(ctx, s, variant, rng) {
    wfSnowBase(ctx, s, rng);
    ctx.strokeStyle = 'rgba(90,140,90,0.9)'; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.lineCap = 'round';          // grass poking through
    for (let i = 0; i < 3; i++) { const x = s * (0.15 + rng() * 0.7), y = s * (0.5 + rng() * 0.4); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.02, y - s * 0.07); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.025, y - s * 0.08); ctx.stroke(); }
    if (variant === 2 || variant === 3) wfSpruce(ctx, s, s * (0.35 + rng() * 0.3), s * 0.88, s * 0.5, true);
    else if (variant === 5) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(s * (0.2 + i * 0.18), s * (0.35 + (i % 2) * 0.25), s * 0.03, s * 0.015, 0, 0, 7); ctx.fill(); } }       // animal tracks
}
function paintTaiga(ctx, s, variant, rng) {
    wfSnowBase(ctx, s, rng);
    const trees = variant % 2 ? [[0.28, 0.62, 0.55], [0.72, 0.56, 0.5], [0.5, 0.94, 0.7]] : [[0.3, 0.58, 0.5], [0.68, 0.62, 0.56], [0.48, 0.92, 0.68]];
    trees.forEach(([x, b, h]) => wfSpruce(ctx, s, x * s, b * s, h * s, true));
}
function paintIce(ctx, s, variant, rng) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#cfeefa'], [1, '#8fc9e3']]); ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = tlRad(ctx, s * 0.3, s * 0.25, 0, s * 0.6, [[0, 'rgba(255,255,255,0.65)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(0.8, s * 0.016); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { let x = s * rng(), y = s * rng(); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rng() - 0.3) * s * 0.3; y += (rng() - 0.5) * s * 0.25; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.strokeStyle = 'rgba(60,120,160,0.45)';
    for (let i = 0; i < 2; i++) { let x = s * rng(), y = s * rng(); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rng() - 0.5) * s * 0.3; y += (rng() - 0.5) * s * 0.3; ctx.lineTo(x, y); } ctx.stroke(); }
    if (variant === 4 || variant === 5) {          // an ice spire
        ctx.fillStyle = 'rgba(0,40,80,0.2)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.84, s * 0.2, s * 0.05, 0, 0, 7); ctx.fill();
        ctx.fillStyle = tlGrad(ctx, s * 0.35, 0, s * 0.65, 0, [[0, '#f4fcff'], [1, '#7fc0dd']]);
        ctx.beginPath(); ctx.moveTo(s * 0.36, s * 0.84); ctx.lineTo(s * 0.44, s * 0.4); ctx.lineTo(s * 0.5, s * 0.18); ctx.lineTo(s * 0.58, s * 0.45); ctx.lineTo(s * 0.66, s * 0.84); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(40,100,140,0.5)'; ctx.stroke();
    }
}
function paintBeach(ctx, s, mask, rng, variant) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#ead9a6'], [1, '#d3bd85']]); ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(120,90,40,0.25)'; for (let i = 0; i < 14; i++) ctx.fillRect(s * rng(), s * rng(), Math.max(1, s * 0.014), Math.max(1, s * 0.014));
    // wet sand and foam on the side facing the sea
    [[1, 0, 0, 1, 0], [2, 1, 0, 0, 1], [4, 0, 1, 1, 0], [8, 0, 0, 0, 1]].forEach(([bit]) => {
        if (!(mask & bit)) return;
        ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(bit === 1 ? 0 : bit === 2 ? Math.PI / 2 : bit === 4 ? Math.PI : -Math.PI / 2); ctx.translate(-s / 2, -s / 2);
        const g = ctx.createLinearGradient(0, 0, 0, s * 0.4); g.addColorStop(0, 'rgba(90,70,40,0.5)'); g.addColorStop(1, 'rgba(90,70,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s * 0.4);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(0.8, s * 0.025); ctx.beginPath(); ctx.moveTo(0, s * 0.03); for (let i = 1; i <= 5; i++) ctx.lineTo(s * i / 5, s * (0.03 + (i % 2) * 0.03)); ctx.stroke();
        ctx.restore();
    });
    if (variant === 1) { ctx.fillStyle = '#f8d4c8'; ctx.beginPath(); ctx.ellipse(s * 0.6, s * 0.65, s * 0.045, s * 0.035, 0.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#d19a8c'; ctx.lineWidth = Math.max(0.6, s * 0.01); ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.62); ctx.lineTo(s * 0.6, s * 0.68); ctx.stroke(); }
    else if (variant === 2) { ctx.fillStyle = '#7d6a48'; ctx.beginPath(); ctx.ellipse(s * 0.35, s * 0.7, s * 0.09, s * 0.025, -0.3, 0, 7); ctx.fill(); }       // driftwood
    else if (variant === 3) { ctx.strokeStyle = '#6aa04a'; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = s * (0.5 + i * 0.05), y = s * 0.75; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.03, y - s * 0.1); ctx.stroke(); } }  // dune grass
}
// a dirt track or a paved high road; mask = which neighbours are road, settlement or bridge (1 N, 2 E, 4 S, 8 W)
function paintWayRoad(ctx, s, mask, rng, paved, variant) {
    // verge first: the track is a ribbon with ragged edges where it does not continue
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#6f8a3c'], [1, '#55702f']]); ctx.fillRect(0, 0, s, s);
    const c = s / 2, w = s * 0.4;
    ctx.lineCap = 'butt';
    const arms = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
    const band = (width, style) => {
        ctx.strokeStyle = style; ctx.fillStyle = style; ctx.lineWidth = width;
        arms.forEach(([dx, dy, bit]) => { if (!(mask & bit)) return; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + dx * s * 0.51, c + dy * s * 0.51); ctx.stroke(); });
        ctx.beginPath(); ctx.arc(c, c, width / 2, 0, 7); ctx.fill();
    };
    band(w * 1.18, paved ? '#59534a' : '#6b5330');
    band(w, paved ? '#b4ac9b' : '#a98a57');
    if (paved) {
        const rr = tlRng(777 + variant);
        ctx.save(); ctx.beginPath(); arms.forEach(([dx, dy, bit]) => { if (mask & bit) ctx.rect(c - w / 2 + (dx ? (dx > 0 ? w / 2 : -c) : 0), c - w / 2 + (dy ? (dy > 0 ? w / 2 : -c) : 0), dx ? c : w, dy ? c : w); }); ctx.rect(c - w / 2, c - w / 2, w, w); ctx.clip();
        ctx.strokeStyle = 'rgba(70,64,54,0.55)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
        for (let i = 0; i < 8; i++) { const y = s * i / 8; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); for (let k = 0; k < 5; k++) { const x = s * ((k + (i % 2) * 0.5 + rr() * 0.1) / 5); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s / 8); ctx.stroke(); } }
        ctx.restore();
    } else {
        ctx.fillStyle = 'rgba(70,45,20,0.3)'; for (let i = 0; i < 12; i++) { const x = s * (0.2 + rng() * 0.6), y = s * (0.2 + rng() * 0.6); ctx.beginPath(); ctx.ellipse(x, y, s * 0.02, s * 0.012, 0, 0, 7); ctx.fill(); }
        ctx.strokeStyle = 'rgba(60,40,15,0.3)'; ctx.lineWidth = Math.max(0.8, s * 0.03);
        [-0.16, 0.16].forEach(o => { arms.forEach(([dx, dy, bit]) => { if (!(mask & bit)) return; ctx.beginPath(); ctx.moveTo(c + (dy ? o * s : 0), c + (dx ? o * s : 0)); ctx.lineTo(c + dx * s * 0.51 + (dy ? o * s : 0), c + dy * s * 0.51 + (dx ? o * s : 0)); ctx.stroke(); }); });
    }
    // tufts on the verge
    ctx.strokeStyle = 'rgba(140,210,110,0.8)'; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const x = s * (rng() < 0.5 ? 0.06 + rng() * 0.12 : 0.82 + rng() * 0.12), y = s * (0.1 + rng() * 0.8); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.015, y - s * 0.06); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.02, y - s * 0.06); ctx.stroke(); }
}
function paintSignpost(ctx, s, variant, rng) {
    tlGrassBase(ctx, s, rng, false);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(s * 0.52, s * 0.9, s * 0.2, s * 0.045, 0, 0, 7); ctx.fill();
    ctx.fillStyle = tlGrad(ctx, s * 0.44, 0, s * 0.56, 0, [[0, '#8b5a2b'], [1, '#4f3217']]); ctx.fillRect(s * 0.46, s * 0.14, s * 0.08, s * 0.76);
    const board = (y, dir, c1) => {
        ctx.save(); ctx.translate(s * 0.5, y); ctx.scale(dir, 1);
        ctx.fillStyle = tlGrad(ctx, 0, -s * 0.05, 0, s * 0.05, [[0, c1], [1, '#6b4423']]);
        ctx.beginPath(); ctx.moveTo(-s * 0.04, -s * 0.055); ctx.lineTo(s * 0.3, -s * 0.055); ctx.lineTo(s * 0.4, 0); ctx.lineTo(s * 0.3, s * 0.055); ctx.lineTo(-s * 0.04, s * 0.055); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(30,15,5,0.7)'; ctx.lineWidth = Math.max(0.7, s * 0.014); ctx.stroke();
        ctx.fillStyle = 'rgba(40,20,5,0.75)'; ctx.fillRect(s * 0.02, -s * 0.012, s * 0.22, Math.max(1, s * 0.016)); ctx.fillRect(s * 0.02, s * 0.018, s * 0.15, Math.max(1, s * 0.014));
        ctx.restore();
    };
    board(s * 0.26, 1, '#c8955a'); board(s * 0.44, -1, '#b88349'); board(s * 0.62, 1, '#c8955a');
    ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.moveTo(s * 0.44, s * 0.14); ctx.lineTo(s * 0.5, s * 0.07); ctx.lineTo(s * 0.56, s * 0.14); ctx.closePath(); ctx.fill();
}
function paintRuins(ctx, s, variant, rng) {
    ctx.fillStyle = tlGrad(ctx, 0, 0, s, s, [[0, '#6a6b5a'], [1, '#4a4b3d']]); ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(150,200,110,0.7)'; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const x = s * rng(), y = s * (0.4 + rng() * 0.5); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.02, y - s * 0.07); ctx.stroke(); }
    const block = (x, y, w, h, c1, c2) => {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + w * 0.08, y + h * 0.9, w, h * 0.18);
        ctx.fillStyle = tlGrad(ctx, x, y, x + w, y + h, [[0, c1], [1, c2]]); ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(20,20,15,0.6)'; ctx.lineWidth = Math.max(0.7, s * 0.014); ctx.strokeRect(x, y, w, h);
    };
    const v = variant % 8;
    if (v >= 4) { paintRuinsMore(ctx, s, v, rng, block); }
    else if (v === 0) {                         // a pair of broken columns
        [[0.28, 0.5], [0.62, 0.62]].forEach(([x, top]) => { block(s * x, s * top, s * 0.12, s * (0.86 - top), '#cfc9b6', '#8c8672'); block(s * (x - 0.02), s * (top - 0.04), s * 0.16, s * 0.05, '#d8d2bf', '#9a947f'); });
    } else if (v === 1) {                  // a stump of wall
        block(s * 0.12, s * 0.56, s * 0.76, s * 0.22, '#bdb6a2', '#7d7763');
        block(s * 0.12, s * 0.4, s * 0.3, s * 0.18, '#c6bfab', '#857f6b'); block(s * 0.56, s * 0.48, s * 0.32, s * 0.1, '#c6bfab', '#857f6b');
        ctx.strokeStyle = 'rgba(20,20,15,0.5)'; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(s * (0.12 + i * 0.126), s * 0.56); ctx.lineTo(s * (0.12 + i * 0.126), s * 0.78); ctx.stroke(); }
    } else if (v === 2) {                  // half an arch
        block(s * 0.2, s * 0.3, s * 0.13, s * 0.56, '#cfc9b6', '#8c8672');
        ctx.strokeStyle = '#b8b29e'; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * 0.25, Math.PI, Math.PI * 1.55); ctx.stroke();
        ctx.strokeStyle = 'rgba(20,20,15,0.5)'; ctx.lineWidth = Math.max(0.7, s * 0.012); ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * 0.3, Math.PI, Math.PI * 1.55); ctx.stroke();
        block(s * 0.55, s * 0.74, s * 0.2, s * 0.12, '#bdb6a2', '#7d7763');
    } else {                               // tumbled stones
        [[0.18, 0.62, 0.2, 0.14], [0.45, 0.7, 0.24, 0.13], [0.34, 0.5, 0.16, 0.12], [0.66, 0.58, 0.18, 0.15]].forEach(([x, y, w, h]) => block(s * x, s * y, s * w, s * h, '#c6bfab', '#7d7763'));
    }
    ctx.fillStyle = 'rgba(80,140,60,0.5)'; ctx.beginPath(); ctx.ellipse(s * 0.3, s * 0.82, s * 0.12, s * 0.04, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(s * 0.7, s * 0.78, s * 0.1, s * 0.035, 0, 0, 7); ctx.fill();
}

// four more kinds of ruin: a standing-stone circle, a collapsed tower, a sunken stair and a barrow mound
function paintRuinsMore(ctx, s, v, rng, block) {
    if (v === 4) {                         // standing stones in a ring
        for (let i = 0; i < 7; i++) {
            const a = i / 7 * Math.PI * 2, x = s * (0.5 + Math.cos(a) * 0.3), y = s * (0.62 + Math.sin(a) * 0.17), h = s * (0.16 + (i % 3) * 0.05);
            block(x - s * 0.035, y - h, s * 0.07, h, '#bdb9aa', '#77735f');
        }
        ctx.fillStyle = 'rgba(140,200,255,0.18)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.62, s * 0.2, s * 0.09, 0, 0, 7); ctx.fill();
    } else if (v === 5) {                  // a collapsed tower: a ring of wall, rubble spilling out
        ctx.fillStyle = '#6b6b5c'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.64, s * 0.3, s * 0.14, 0, 0, 7); ctx.fill();
        block(s * 0.22, s * 0.3, s * 0.2, s * 0.4, '#cfc9b6', '#8c8672'); block(s * 0.42, s * 0.46, s * 0.16, s * 0.22, '#c6bfab', '#857f6b'); block(s * 0.58, s * 0.38, s * 0.2, s * 0.32, '#cfc9b6', '#8c8672');
        [[0.3, 0.78], [0.5, 0.82], [0.7, 0.78], [0.62, 0.72]].forEach(([x, y]) => block(s * x, s * y, s * 0.1, s * 0.07, '#bdb6a2', '#7d7763'));
    } else if (v === 6) {                  // a stair sinking into the ground, framed by two pillars
        ctx.fillStyle = '#2b2a24'; ctx.beginPath(); ctx.moveTo(s * 0.3, s * 0.5); ctx.lineTo(s * 0.7, s * 0.5); ctx.lineTo(s * 0.78, s * 0.82); ctx.lineTo(s * 0.22, s * 0.82); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 5; i++) { const y = s * (0.5 + i * 0.065); ctx.fillStyle = i % 2 ? '#8b866f' : '#a39d86'; ctx.fillRect(s * (0.3 - i * 0.016), y, s * (0.4 + i * 0.032), s * 0.05); }
        block(s * 0.16, s * 0.28, s * 0.1, s * 0.5, '#cfc9b6', '#8c8672'); block(s * 0.74, s * 0.4, s * 0.1, s * 0.38, '#cfc9b6', '#8c8672');
    } else {                               // a barrow: a grassy mound with a stone doorway
        ctx.fillStyle = tlGrad(ctx, 0, s * 0.3, 0, s * 0.85, [[0, '#6c8a4a'], [1, '#42602c']]);
        ctx.beginPath(); ctx.moveTo(s * 0.08, s * 0.85); ctx.quadraticCurveTo(s * 0.5, s * 0.12, s * 0.92, s * 0.85); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,30,10,0.6)'; ctx.lineWidth = Math.max(0.8, s * 0.015); ctx.stroke();
        block(s * 0.38, s * 0.58, s * 0.24, s * 0.27, '#d0cab6', '#8c8672');
        ctx.fillStyle = '#0d0c0a'; ctx.fillRect(s * 0.43, s * 0.65, s * 0.14, s * 0.2);
    }
}

// ---- tiles for the new features ----
function paintLoneTree(ctx, s, variant, rng, kind, phase) {
    if (kind === 'dry') { paintSavanna(ctx, s, 0, rng); wfAcacia(ctx, s, s * 0.5, s * 0.88, s * 0.72); return; }
    if (kind === 'snow') { wfSnowBase(ctx, s, rng); wfSpruce(ctx, s, s * 0.5, s * 0.9, s * 0.78, true); return; }
    tlGrassBase(ctx, s, rng, false);
    const sway = Math.sin(phase * 1 + variant) * s * 0.008;
    const autumn = variant >= 6, c1 = autumn ? '#e08a2c' : (variant % 2 ? '#5fa53a' : '#4c9433'), c2 = autumn ? '#9a4a14' : '#2a5e22';
    ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.9, s * 0.3, s * 0.07, 0, 0, 7); ctx.fill();
    ctx.fillStyle = tlGrad(ctx, s * 0.44, 0, s * 0.58, 0, [[0, '#7a4f26'], [1, '#432a12']]);
    ctx.beginPath(); ctx.moveTo(s * 0.44, s * 0.9); ctx.quadraticCurveTo(s * 0.47, s * 0.6, s * 0.43, s * 0.45); ctx.lineTo(s * 0.57, s * 0.45); ctx.quadraticCurveTo(s * 0.54, s * 0.6, s * 0.58, s * 0.9); ctx.closePath(); ctx.fill();
    [[0.3, 0.38, 0.2], [0.7, 0.38, 0.2], [0.5, 0.22, 0.26], [0.36, 0.26, 0.2], [0.64, 0.26, 0.2], [0.5, 0.42, 0.22]].forEach(([x, y, r], i) => {
        const cx = s * x + sway * (i % 2 ? 1 : -1), cy = s * y;
        ctx.fillStyle = tlRad(ctx, cx - s * 0.05, cy - s * 0.06, 0, s * r * 1.2, [[0, c1], [1, c2]]); ctx.beginPath(); ctx.arc(cx, cy, s * r, 0, 7); ctx.fill();
    });
}
function paintEncampment(ctx, s, variant, rng, phase) {
    tlGrassBase(ctx, s, rng, true);
    ctx.fillStyle = 'rgba(70,45,20,0.55)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.74, s * 0.42, s * 0.18, 0, 0, 7); ctx.fill();            // trampled earth
    const tent = (cx, base, w, h, c1, c2) => {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, base, w * 0.6, h * 0.12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = tlGrad(ctx, cx - w / 2, 0, cx + w / 2, 0, [[0, c1], [1, c2]]);
        ctx.beginPath(); ctx.moveTo(cx - w / 2, base); ctx.lineTo(cx, base - h); ctx.lineTo(cx + w / 2, base); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,10,5,0.75)'; ctx.lineWidth = Math.max(0.8, s * 0.016); ctx.stroke();
        ctx.fillStyle = '#1a0f08'; ctx.beginPath(); ctx.moveTo(cx - w * 0.1, base); ctx.lineTo(cx, base - h * 0.45); ctx.lineTo(cx + w * 0.1, base); ctx.closePath(); ctx.fill();
    };
    tent(s * 0.28, s * 0.62, s * 0.34, s * 0.34, '#a8744a', '#6b4326');
    tent(s * 0.74, s * 0.58, s * 0.3, s * 0.3, '#8a5b3a', '#55331b');
    // a banner on a pole
    ctx.strokeStyle = '#3b2412'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.beginPath(); ctx.moveTo(s * 0.52, s * 0.62); ctx.lineTo(s * 0.52, s * 0.12); ctx.stroke();
    ctx.fillStyle = '#9f1d1d'; ctx.beginPath(); ctx.moveTo(s * 0.52, s * 0.14); ctx.lineTo(s * (0.74 + Math.sin(phase * 2) * 0.02), s * 0.2); ctx.lineTo(s * 0.52, s * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a0a0a'; ctx.lineWidth = Math.max(0.7, s * 0.012); ctx.stroke();
    // the campfire, with its skulls and spikes
    ctx.fillStyle = '#44403c'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(s * (0.5 + Math.cos(a) * 0.09), s * (0.82 + Math.sin(a) * 0.035), s * 0.022, 0, 7); ctx.fill(); }
    vgGlow(ctx, s * 0.5, s * 0.78, s * 0.22, '253,160,60', 0.4);
    tlFlame(ctx, s * 0.5, s * 0.82, s * 0.16 * (1 + 0.2 * Math.sin(phase * 3)), s * 0.04, Math.sin(phase * 2) * 0.5, true);
    ctx.strokeStyle = '#4b3621'; ctx.lineWidth = Math.max(1, s * 0.02);
    [[0.08, 0.9], [0.92, 0.9], [0.14, 0.7]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(s * x, s * y); ctx.lineTo(s * x, s * (y - 0.16)); ctx.stroke(); ctx.fillStyle = '#e7e5e4'; ctx.beginPath(); ctx.arc(s * x, s * (y - 0.18), s * 0.035, 0, 7); ctx.fill(); });
}
function paintAbandonedCamp(ctx, s, variant, rng) {
    tlGrassBase(ctx, s, rng, false);
    ctx.fillStyle = 'rgba(70,50,30,0.35)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.74, s * 0.4, s * 0.16, 0, 0, 7); ctx.fill();
    // a collapsed tent
    ctx.fillStyle = tlGrad(ctx, 0, s * 0.4, 0, s * 0.8, [[0, '#cfc6a6'], [1, '#948b6c']]);
    ctx.beginPath(); ctx.moveTo(s * 0.14, s * 0.78); ctx.lineTo(s * 0.34, s * 0.42); ctx.lineTo(s * 0.5, s * 0.62); ctx.lineTo(s * 0.62, s * 0.46); ctx.lineTo(s * 0.66, s * 0.78); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,15,0.7)'; ctx.lineWidth = Math.max(0.8, s * 0.015); ctx.stroke();
    ctx.strokeStyle = '#5b4325'; ctx.lineWidth = Math.max(1, s * 0.022); ctx.beginPath(); ctx.moveTo(s * 0.34, s * 0.42); ctx.lineTo(s * 0.4, s * 0.86); ctx.stroke();
    // a cold fire ring with a dead log
    ctx.fillStyle = '#57534e'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(s * (0.76 + Math.cos(a) * 0.09), s * (0.82 + Math.sin(a) * 0.035), s * 0.022, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2a2724'; ctx.beginPath(); ctx.ellipse(s * 0.76, s * 0.82, s * 0.07, s * 0.025, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(160,160,160,0.6)'; ctx.lineWidth = Math.max(0.7, s * 0.012); ctx.beginPath(); ctx.moveTo(s * 0.76, s * 0.78); ctx.quadraticCurveTo(s * 0.72, s * 0.7, s * 0.77, s * 0.62); ctx.stroke();      // a last wisp of smoke
    // a chest and a pack left behind - the loot
    ctx.fillStyle = tlGrad(ctx, 0, s * 0.62, 0, s * 0.86, [[0, '#9a6a34'], [1, '#5c3a1a']]); tlRR(ctx, s * 0.5, s * 0.64, s * 0.2, s * 0.15, s * 0.015); ctx.fill();
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = Math.max(0.8, s * 0.014); ctx.stroke();
    ctx.fillStyle = '#d4a93a'; ctx.fillRect(s * 0.58, s * 0.68, s * 0.04, s * 0.06);
    ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.82, s * 0.09, s * 0.07, 0.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a1a0a'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,120,0.9)'; [[0.62, 0.62], [0.66, 0.6], [0.3, 0.76]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(s * x, s * y, Math.max(1, s * 0.012), 0, 7); ctx.fill(); });      // a glint
}
function paintLighthouse(ctx, s, variant, rng, phase) {
    tlGrassBase(ctx, s, rng, false);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.92, s * 0.3, s * 0.06, 0, 0, 7); ctx.fill();
    ctx.fillStyle = tlGrad(ctx, 0, s * 0.82, 0, s * 0.95, [[0, '#8d877a'], [1, '#55524a']]); ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.88, s * 0.26, s * 0.08, 0, 0, 7); ctx.fill();     // rocks
    // tower: a tapering cone striped red and white
    const top = s * 0.28, bot = s * 0.88, wTop = s * 0.1, wBot = s * 0.2;
    for (let i = 0; i < 5; i++) {
        const y0 = top + (bot - top) * i / 5, y1 = top + (bot - top) * (i + 1) / 5;
        const w0 = wTop + (wBot - wTop) * i / 5, w1 = wTop + (wBot - wTop) * (i + 1) / 5;
        ctx.fillStyle = tlGrad(ctx, s * 0.5 - w1, 0, s * 0.5 + w1, 0, i % 2 ? [[0, '#c0392b'], [0.5, '#e74c3c'], [1, '#8e2a20']] : [[0, '#e8e4d8'], [0.5, '#ffffff'], [1, '#aaa598']]);
        ctx.beginPath(); ctx.moveTo(s * 0.5 - w0, y0); ctx.lineTo(s * 0.5 + w0, y0); ctx.lineTo(s * 0.5 + w1, y1); ctx.lineTo(s * 0.5 - w1, y1); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,20,10,0.7)'; ctx.lineWidth = Math.max(0.8, s * 0.015);
    ctx.beginPath(); ctx.moveTo(s * 0.5 - wTop, top); ctx.lineTo(s * 0.5 - wBot, bot); ctx.moveTo(s * 0.5 + wTop, top); ctx.lineTo(s * 0.5 + wBot, bot); ctx.stroke();
    ctx.fillStyle = '#2b2a28'; ctx.fillRect(s * 0.46, s * 0.76, s * 0.08, s * 0.12);                                                      // door
    ctx.fillStyle = '#1c1917'; ctx.fillRect(s * 0.3, s * 0.27, s * 0.4, s * 0.035);                                                      // gallery
    ctx.fillStyle = '#fde68a'; ctx.fillRect(s * 0.43, s * 0.16, s * 0.14, s * 0.11);                                                      // the lamp room
    ctx.strokeStyle = '#1c1917'; ctx.strokeRect(s * 0.43, s * 0.16, s * 0.14, s * 0.11);
    ctx.fillStyle = '#9f1d1d'; ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.16); ctx.lineTo(s * 0.5, s * 0.07); ctx.lineTo(s * 0.6, s * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
    // the turning beam: it sweeps to one side and then the other
    const k = Math.cos(phase), len = s * 0.55 * Math.abs(k), dir = k >= 0 ? 1 : -1;
    vgGlow(ctx, s * 0.5, s * 0.21, s * 0.2, '255,236,150', 0.5);
    if (len > s * 0.05) {
        ctx.fillStyle = tlGrad(ctx, s * 0.5, 0, s * 0.5 + dir * len, 0, [[0, 'rgba(255,240,170,0.7)'], [1, 'rgba(255,240,170,0)']]);
        ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.2); ctx.lineTo(s * 0.5 + dir * len, s * 0.12); ctx.lineTo(s * 0.5 + dir * len, s * 0.3); ctx.closePath(); ctx.fill();
    }
}

// ---- terrain text for the look panel, and colours for the minimap ----
function wfTerrainInfo() {
    return {
        [TILE.DESERT]: ['Desert', 'Dunes and dry wind. Easy going, but there is no water to be had.'],
        [TILE.SAVANNA]: ['Savannah', 'Golden grass and lone acacias. Easy going.'],
        [TILE.JUNGLE]: ['Jungle', 'A wall of leaves and vines. Slow going.'],
        [TILE.LUSH]: ['Rainforest floor', 'Ferns and big leaves under the canopy.'],
        [TILE.TAIGA]: ['Taiga', 'Snow-laden spruce forest. Slow going.'],
        [TILE.SNOW]: ['Snowfield', 'Crisp snow over frozen ground.'],
        [TILE.ICE]: ['Ice', 'Glaring blue ice and wind. Mind thy footing.'],
        [TILE.BEACH]: ['Beach', 'Sand and shells along the sea.'],
        [TILE.SIGNPOST]: ['Signpost', 'Boards pointing the way to the nearest settlements. Bump into it to read it.'],
        [TILE.TRACK]: ['Dirt track', 'A worn road between settlements.'],
        [TILE.HIGHROAD]: ['High road', 'A cobbled road that links the great settlements.'],
        [TILE.RUINS]: ['Ruins', 'Tumbled stones of a lost age. By night the dead walk here.'],
        [TILE.ENCAMP]: ['Monster encampment', 'A camp of raiders and beasts. More of them keep turning up while thou art near.'],
        [TILE.ABANDONED]: ['Abandoned camp', 'Nobody has been here for a while - something may still lie in the ashes. Step onto it to search.'],
        [TILE.LIGHTHOUSE]: ['Lighthouse', 'A tall tower whose lamp guides the ships along this coast.'],
        [TILE.LONETREE]: ['Lone tree', 'A single old tree standing by itself in the open.'],
        [TILE.LONETREE_DRY]: ['Lone acacia', 'A single flat-topped tree in the dry plain.'],
        [TILE.LONETREE_SNOW]: ['Lone spruce', 'A single spruce, white with snow.']
    };
}
function wfMinimapColor(t, explored) {
    const c = {
        [TILE.DESERT]: ['#e0c47e', '#8a7640'], [TILE.SAVANNA]: ['#b9a64a', '#6f6630'], [TILE.JUNGLE]: ['#0e7a3e', '#094d28'], [TILE.LUSH]: ['#22a35a', '#146136'],
        [TILE.TAIGA]: ['#2f7a63', '#1c4a3c'], [TILE.SNOW]: ['#e8f1f7', '#8a97a1'], [TILE.ICE]: ['#bfe6f5', '#6b8e9c'], [TILE.BEACH]: ['#ead9a6', '#8a7f5c'],
        [TILE.TRACK]: ['#c28a3c', '#7a5624'], [TILE.HIGHROAD]: ['#e5d9b8', '#8a8470'], [TILE.SIGNPOST]: ['#c28a3c', '#7a5624'], [TILE.RUINS]: ['#a8a29e', '#6b6762'],
        [TILE.ENCAMP]: ['#ef4444', '#7f1d1d'], [TILE.ABANDONED]: ['#fbbf24', '#78530f'], [TILE.LIGHTHOUSE]: ['#ffffff', '#9aa0a6']
    }[t];
    return c ? c[explored ? 0 : 1] : null;
}
