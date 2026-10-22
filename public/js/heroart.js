// =====================================================================================================
// HERO ART - a layered, equipment-driven paper doll in the game's vector style.
// What the hero wears and holds is what you see: armour tier (cloth ... astral aegis), helmet (can be hidden),
// weapon in hand (dagger ... rifle), gender build, race, hair colour and beard.
// Uses the vg* drawing helpers and WEAPONS/ARMORS from game.js (resolved at call time).
// =====================================================================================================

const HAIR_COLORS = [
    ['Black', '#1c1b22'], ['Dark brown', '#3b2417'], ['Brown', '#6b4226'], ['Auburn', '#8a3b1e'], ['Red', '#b8321e'],
    ['Ginger', '#d9722b'], ['Blonde', '#e0b955'], ['Platinum', '#ece6cf'], ['Grey', '#9aa0a6'], ['White', '#f1f5f9'],
    ['Blue', '#3b82f6'], ['Green', '#22a06b'], ['Violet', '#9b5de5'], ['Pink', '#f472b6']
];
const BEARDS = [
    ['none', 'Clean-shaven'], ['stubble', 'Stubble'], ['mustache', 'Moustache'], ['goatee', 'Goatee'],
    ['short', 'Short beard'], ['full', 'Full beard'], ['long', 'Long beard']
];
const BEARD_IDS = BEARDS.map(b => b[0]);
const HAIR_STYLES = [
    ['short', 'Short, side-swept'], ['long', 'Long, flowing'], ['bob', 'Bob'], ['ponytail', 'Ponytail'], ['bun', 'Top knot'],
    ['braids', 'Twin braids'], ['curly', 'Curly'], ['mohawk', 'Mohawk'], ['buzz', 'Buzz cut'], ['bald', 'Bald']
];
const HAIR_STYLE_IDS = HAIR_STYLES.map(s => s[0]);
function defaultHairStyle(gender) { return gender === 'F' ? 'long' : 'short'; }
function hairStyleOf(look, fem) { return look && HAIR_STYLE_IDS.includes(look.hs) ? look.hs : defaultHairStyle(fem ? 'F' : 'M'); }
const HAIR_RE = /^#[0-9a-fA-F]{6}$/;
const SKIN_TONES = { Human: ['#fde3c4', '#c08a5c'], Elf: ['#fbeee0', '#d1a888'], Dwarf: ['#f0c9a4', '#b0764a'], Halfling: ['#fcd9b6', '#bf8a5e'], Automaton: ['#cbd5e1', '#64748b'] };
// the colour of a class's cloth (tunic / robe) and its accent
const HERO_CLOTH = {
    Fighter: ['#c9b48a', '#6b5a3a', '#dc2626'], Paladin: ['#e8e2d0', '#8d8470', '#0ea5e9'], Ranger: ['#34a36b', '#14532d', '#a16207'],
    Rogue: ['#64748b', '#1e293b', '#fbbf24'], Cleric: ['#2fb5a5', '#115e59', '#fbbf24'], Wizard: ['#9d4edd', '#3b0764', '#fde047'],
    Bard: ['#14b8a6', '#134e4a', '#be185d'], Tinker: ['#b45309', '#451a03', '#fbbf24']
};

// the bits of a hero that decide how it looks (also sent to other players)
// the tailor's look for a slot, stored as 'k:base:variant:rarity' (k = w | a | h)
function heroCosParse(str, kind) {
    const m = /^([wah]):(\d{1,2}):([0-6]):([0-2])$/.exec(str || '');
    return (m && m[1] === kind) ? { b: +m[2], v: +m[3], r: +m[4] } : null;
}
// looks of weapons (wv) and armour (av): 0 plain, 1 frost, 2 flame, 3 shadow, 4 gilded, 5 verdant, 6 the harbour master's captain look
const WV_PAL = [null,
    { name: 'Frost', blade: [[0, '#f0fdff'], [.5, '#9be4fa'], [1, '#2a8fc4']], guard: '#94a3b8', grip: '#1e3a5f', gem: '#7dd3fc', glow: '125,211,252', filter: 'hue-rotate(165deg) saturate(1.5) brightness(1.1)' },
    { name: 'Flame', blade: [[0, '#fff7d6'], [.45, '#fb923c'], [1, '#b91c1c']], guard: '#7f1d1d', grip: '#3b0d0d', gem: '#fde047', glow: '251,113,60', filter: 'hue-rotate(-25deg) saturate(2.2)' },
    { name: 'Shadow', blade: [[0, '#a78bfa'], [.5, '#3b2a66'], [1, '#0f0a1f']], guard: '#4c1d95', grip: '#0b0713', gem: '#c084fc', glow: '168,85,247', filter: 'brightness(.5) contrast(1.3) hue-rotate(250deg) saturate(1.6)' },
    { name: 'Gilded', blade: [[0, '#fffbe0'], [.5, '#fde047'], [1, '#a16207']], guard: '#fbbf24', grip: '#7c2d12', gem: '#f87171', glow: '253,224,71', filter: 'sepia(.9) saturate(2.4) hue-rotate(-8deg) brightness(1.1)' },
    { name: 'Verdant', blade: [[0, '#f0fdf0'], [.5, '#86efac'], [1, '#15803d']], guard: '#166534', grip: '#14301c', gem: '#bef264', glow: '132,204,22', filter: 'hue-rotate(80deg) saturate(1.6)' },
    { name: "Captain's", blade: [[0, '#ffffff'], [.5, '#e2e8f0'], [1, '#94a3b8']], guard: '#fbbf24', grip: '#7f1d1d', gem: '#fde68a', glow: '251,191,36', filter: 'none', captain: true }];
const AV_PAL = [null,
    { name: 'Frostguard', A: '#bae6fd', B: '#0c4a6e', acc: '#e0f2fe', emblem: 'snow' },
    { name: 'Crimson', A: '#fca5a5', B: '#7f1d1d', acc: '#fbbf24', emblem: 'sun' },
    { name: 'Nightsong', A: '#6b7280', B: '#111827', acc: '#a855f7', emblem: 'rune' },
    { name: 'Gilded', A: '#fde68a', B: '#92400e', acc: '#fff7cc', emblem: 'crown' },
    { name: 'Verdant', A: '#86efac', B: '#14532d', acc: '#fde047', emblem: 'leaf' },
    { name: "Captain's", A: '#3d6be0', B: '#13265e', acc: '#fbbf24', emblem: 'captain' }];

function heroLook(h) {
    if (!h) return {};
    const rar = (m) => (m ? ((m.pre && m.suf) ? 2 : 1) : 0);
    const cw = heroCosParse(h.cosW, 'w'), ca = heroCosParse(h.cosA, 'a'), ch = heroCosParse(h.cosH, 'h'), cs = heroCosParse(h.cosS, 's');
    return {
        g: h.gender === 'F' ? 'F' : 'M', hs: HAIR_STYLE_IDS.includes(h.hairStyle) ? h.hairStyle : defaultHairStyle(h.gender), hair: HAIR_RE.test(h.hair || '') ? h.hair : '#6b4226', beard: BEARD_IDS.includes(h.beard) ? h.beard : 'none',
        hh: !!h.hideHelm, ps: !!(h.poisoned && h.hp > 0), toad: !!(h.toad && h.hp > 0),
        // the cosmetic weapon / armour / headgear / shield (visuals only) replaces what is actually worn
        hd: ch ? ch.b : (h.hMag ? h.hMag.b : (h.headIdx === undefined ? -1 : h.headIdx | 0)),
        w: cw ? cw.b : (h.wMag ? h.wMag.b : Math.max(0, h.weaponIdx | 0)),
        a: ca ? ca.b : (h.aMag ? h.aMag.b : Math.max(0, h.armorIdx | 0)),
        sh: cs ? cs.b : (h.sMag ? h.sMag.b : (h.shieldIdx === undefined ? -1 : h.shieldIdx | 0)),
        wv: cw ? cw.v : (h.wMag && typeof itemVariant === 'function' ? itemVariant(h.wMag) : 0),
        av: ca ? ca.v : (h.aMag && typeof itemVariant === 'function' ? itemVariant(h.aMag) : 0),
        sv: cs ? cs.v : (h.sMag && typeof itemVariant === 'function' ? itemVariant(h.sMag) : 0),
        wr: cw ? cw.r : rar(h.wMag),
        ar: ca ? ca.r : rar(h.aMag),
        sr: cs ? cs.r : rar(h.sMag),
        nw: !cw && !h.wMag && h.weaponIdx < 0, nc: !ca && !h.aMag && h.armorIdx < 0, kw: true,
        gm: !!h.gm
    };
}

// a hero under the gypsy's curse: a warty green toad, throat throbbing
function drawToadVector(ctx, px, py, size) {
    const s = size, t = (typeof vgTick === 'function' ? vgTick() : 0), O = VG_OUT, lw = Math.max(0.9, s * 0.026);
    ctx.save(); ctx.translate(px, py);
    vgGround(ctx, s, 0.3);
    const puff = Math.sin(t * 0.12) * s * 0.012;
    ctx.translate(0, Math.sin(t * 0.06) * s * 0.008);
    vgEll(ctx, s * .5, s * .72, s * .3, s * .17, vgLin(ctx, 0, s * .55, 0, s * .9, [[0, '#6b9a3a'], [1, '#2f5a1c']]), O, lw);                        // body
    [[-1, 1]].forEach(() => {});
    [-1, 1].forEach(sg => {                                                                                                                        // folded hind legs
        vgEll(ctx, s * (.5 + sg * .3), s * .8, s * .12, s * .09, '#4f7a2c', O, lw);
        vgEll(ctx, s * (.5 + sg * .38), s * .9, s * .1, s * .04, '#5c8a33', O, lw * .8);
        vgEll(ctx, s * (.5 + sg * .15), s * .9, s * .09, s * .035, '#5c8a33', O, lw * .8);
    });
    vgEll(ctx, s * .5, s * (.74 + .02), s * .16 + puff, s * .1 + puff, '#d9e8a8', null);                                                           // pale belly / throat
    vgEll(ctx, s * .5, s * .52, s * .22, s * .15, vgLin(ctx, 0, s * .4, 0, s * .66, [[0, '#7aab43'], [1, '#3c6a22']]), O, lw);                         // head
    vgPath(ctx, s, [[.32, .58], [.5, .63], [.68, .58]], '#1c2d10', lw * 1.3);                                                                      // the wide mouth
    [-1, 1].forEach(sg => {                                                                                                                        // bulging eyes
        vgBall(ctx, s * (.5 + sg * .12), s * .4, s * .07, '#fde68a', '#d97706', O, lw);
        vgEll(ctx, s * (.5 + sg * .12), s * .4, s * .012, s * .05, '#111827');
    });
    [[.36, .66], [.6, .7], [.45, .78], [.68, .6], [.3, .74]].forEach(([x, y]) => vgEll(ctx, s * x, s * y, s * .018, s * .012, '#3a6a20'));     // warts
    ctx.restore();
}
function drawHeroCharacterVector(ctx, px, py, size, clsName, isDead = false, race = null, look = null) {
    look = look || {};
    if (look.toad) { drawToadVector(ctx, px, py, size); return; }
    ctx.save();
    ctx.translate(px, py);
    const s = size;
    const lw = Math.max(0.9, s * 0.026);
    const O = VG_OUT;
    vgGround(ctx, s, 0.3);

    if (isDead) {
        vgPoly(ctx, s, [[.30, .88], [.30, .42], [.38, .29], [.50, .25], [.62, .29], [.70, .42], [.70, .88]],
            vgLin(ctx, s * .3, 0, s * .7, 0, [[0, '#cbd5e1'], [1, '#475569']]), O, lw);
        vgPath(ctx, s, [[.50, .34], [.50, .62]], '#1e293b', lw * 1.3);
        vgPath(ctx, s, [[.40, .43], [.60, .43]], '#1e293b', lw * 1.3);
        vgPath(ctx, s, [[.58, .62], [.54, .70], [.60, .78]], '#334155', lw * .8);
        vgPoly(ctx, s, [[.20, .88], [.80, .88], [.76, .93], [.24, .93]], '#334155', O, lw);
        ctx.restore();
        return;
    }

    const gm = !!look.gm;                                    // Gamemasters always wear a plain blue hood and robe
    const cls = gm ? 'GM' : clsName;
    const fem = look.g === 'F';
    const tier = gm ? 0 : Math.max(0, Math.min(5, look.a | 0));
    const wp = (typeof WEAPONS !== 'undefined' && WEAPONS[look.w | 0]) || { name: 'Dagger' };
    const hair = HAIR_RE.test(look.hair || '') ? look.hair : '#6b4226';
    const auto = race === 'Automaton';
    const beardId = (!fem && !auto && BEARD_IDS.includes(look.beard)) ? look.beard : 'none';
    const showHelm = gm || !look.hh;
    // the headgear: what it looks like comes from the item (vis), not from the armour or the class any more
    const headItem = (typeof HEADS !== 'undefined' && look.hd >= 0) ? HEADS[look.hd] : null;
    const vis = gm ? 'hood' : (headItem ? headItem.vis : null);
    const [skin, skinD] = SKIN_TONES[race] || SKIN_TONES.Human;
    let [cLight, cDark, cAcc] = gm ? ['#3b6fe0', '#1e3a8a', '#60a5fa'] : (HERO_CLOTH[cls] || HERO_CLOTH.Fighter);
    const avp = gm ? null : (AV_PAL[look.av | 0] || null);
    const robe = gm || (tier === 0 && (cls === 'Wizard' || cls === 'Cleric'));
    const t = vgTick();

    // race build: halflings are small, dwarves broad
    const rsY = race === 'Halfling' ? 0.88 : 1, rsX = (race === 'Dwarf' ? 1.1 : 1) * rsY;
    ctx.translate(s * .5, s * .93);
    ctx.scale(rsX, rsY);
    ctx.translate(-s * .5, -s * .93 + Math.sin(t * 0.07) * s * 0.012);

    const rect = (x, y, w, h, f, st) => vgPoly(ctx, s, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], f, st === undefined ? O : st, lw);
    const lin = (x0, y0, x1, y1, a, b) => vgLin(ctx, x0 * s, y0 * s, x1 * s, y1 * s, [[0, a], [1, b]]);
    const arm = (x0, y0, x1, y1, c, hand) => {
        ctx.beginPath(); ctx.moveTo(x0 * s, y0 * s); ctx.lineTo(x1 * s, y1 * s);
        ctx.strokeStyle = O; ctx.lineWidth = s * 0.075 + lw; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = s * 0.075; ctx.stroke();
        vgBall(ctx, x1 * s, y1 * s, s * 0.04, hand || skin, hand ? '#475569' : skinD, O, lw * 0.8);
    };

    // ------------------------------------------------------------ palettes by armour tier
    const metal = tier >= 3;
    let mainA = tier === 0 ? cLight : (tier === 1 ? '#a8703a' : (tier === 2 ? '#9a6532' : (tier === 3 ? '#dbe3ec' : (tier === 4 ? '#f1f5f9' : '#f0f9ff'))));
    let mainB = tier === 0 ? cDark : (tier === 1 ? '#4e2f14' : (tier === 2 ? '#3f2511' : (tier === 3 ? '#6b7a8c' : (tier === 4 ? '#64748b' : '#38a1e0'))));
    if (avp) { mainA = avp.A; mainB = avp.B; cAcc = avp.acc; if (tier <= 2) { cLight = avp.A; cDark = avp.B; } }
    const trouser = metal ? (tier === 3 ? '#8795a8' : '#a8b4c4') : (tier === 0 ? vgShade(cDark, .1) : '#3b3a42');
    const bootC = metal ? (tier === 3 ? '#475569' : '#94a3b8') : '#4a2e18';
    const sleeve = tier === 0 ? cLight : (tier === 1 ? cLight : (tier === 2 ? cLight : mainA));

    // hair that hangs behind the head is drawn first (before capes and the body)
    const hstyle = hairStyleOf(look, fem);
    if (!auto && !(showHelm && (vis === 'helm' || vis === 'greathelm'))) heroHairBack(ctx, s, .5, .29, fem ? .088 : .096, hair, hstyle);
    const nc = !!look.nc;                                   // creation screen: show the hero without clothes
    bodyArt: {
        if (nc) { heroBareBody(ctx, s, { skin, skinD, fem, race, lw, O, lin, arm }); break bodyArt; }
        // ------------------------------------------------------------ behind the body: capes, quivers, lutes, packs
        const capeCol = { Fighter: ['#dc2626', '#450a0a'], Paladin: ['#38bdf8', '#0c4a6e'], Bard: ['#be185d', '#500724'], Rogue: ['#334155', '#020617'], Ranger: ['#166534', '#052e16'] }[cls];
        if (capeCol && (tier >= 1 || cls === 'Bard' || cls === 'Rogue' || cls === 'Ranger')) {
            vgPoly(ctx, s, [[.33, .40], [.67, .40], [.76, .86], [.24, .86]], lin(0, .4, 0, .86, capeCol[0], capeCol[1]), O, lw);
            vgPath(ctx, s, [[.50, .44], [.50, .84]], 'rgba(2,6,23,.3)', lw);
        }
        if (cls === 'Ranger') {   // quiver
            vgPoly(ctx, s, [[.60, .30], [.70, .27], [.74, .66], [.64, .68]], '#78350f', O, lw);
            for (let i = 0; i < 3; i++) vgPath(ctx, s, [[.65 + i * .03, .29 - i * .01], [.65 + i * .03, .19 - i * .01]], '#e2e8f0', lw);
        }
        if (cls === 'Bard') {     // lute slung across the back, neck above the shoulder
            vgPath(ctx, s, [[.64, .62], [.72, .26]], '#78350f', lw * 2.4);
            vgBall(ctx, s * .72, s * .25, s * .03, '#fde68a', '#92400e', O, lw * .7);
            vgEll(ctx, s * .62, s * .66, s * .09, s * .12, lin(.5, 0, .72, 0, '#fbbf24', '#92400e'), O, lw, 0.4);
            vgEll(ctx, s * .62, s * .66, s * .028, s * .028, '#451a03', null);
        }
        if (cls === 'Tinker') {   // brass pack with a hissing pipe
            vgPoly(ctx, s, [[.60, .32], [.76, .32], [.78, .66], [.62, .68]], lin(.6, 0, .78, 0, '#fbbf24', '#78350f'), O, lw);
            vgPath(ctx, s, [[.69, .32], [.69, .20], [.77, .16]], '#a8a29e', lw * 2.2);
            vgBall(ctx, s * .69, s * .50, s * .045, '#fde68a', '#92400e', O, lw * .7);
            for (let k = 0; k < 3; k++) {
                const q = ((t * 0.02) + k / 3) % 1;
                ctx.fillStyle = `rgba(226,232,240,${0.55 * (1 - q)})`;
                ctx.beginPath(); ctx.arc(s * (.78 + q * .06), s * (.15 - q * .1), s * (.02 + q * .03), 0, 7); ctx.fill();
            }
        }

        // ------------------------------------------------------------ legs and boots
        const lx = fem ? 0.015 : 0;
        vgPoly(ctx, s, [[.40 + lx, .62], [.49, .62], [.48, .88], [.37 + lx, .88]], trouser, O, lw);
        vgPoly(ctx, s, [[.51, .62], [.60 - lx, .62], [.63 - lx, .88], [.52, .88]], trouser, O, lw);
        vgPoly(ctx, s, [[.35 + lx, .86], [.48, .86], [.49, .94], [.32 + lx, .94]], bootC, O, lw);
        vgPoly(ctx, s, [[.52, .86], [.65 - lx, .86], [.68 - lx, .94], [.51, .94]], bootC, O, lw);
        if (tier >= 4) { vgPath(ctx, s, [[.41, .72], [.46, .72]], 'rgba(255,255,255,.7)', lw); vgPath(ctx, s, [[.54, .72], [.59, .72]], 'rgba(255,255,255,.7)', lw); }
        // leg volume: inner shadow, knee creases, boot cuffs and soles
        ctx.fillStyle = 'rgba(2,6,23,.22)';
        ctx.fillRect(s * (.465 + lx * .5), s * .62, s * .025, s * .25);
        ctx.fillRect(s * .51, s * .62, s * .022, s * .25);
        [[.38 + lx, .745, .47, .75], [.53, .745, .62 - lx, .75]].forEach(([x0, y0, x1, y1]) => vgPath(ctx, s, [[x0, y0], [x1, y1]], 'rgba(2,6,23,.22)', lw * .6));
        [[.345 + lx, .86, .485, .86], [.515, .86, .655 - lx, .86]].forEach(([x0, y0, x1, y1]) => vgPath(ctx, s, [[x0, y0], [x1, y1]], 'rgba(255,255,255,.28)', lw * .7));
        [[.325 + lx, .935, .49, .935], [.51, .935, .675 - lx, .935]].forEach(([x0, y0, x1, y1]) => vgPath(ctx, s, [[x0, y0], [x1, y1]], 'rgba(2,6,23,.55)', lw * 1.1));

        // ------------------------------------------------------------ skirt / robe / tassets
        if (robe) {
            vgPoly(ctx, s, fem ? [[.38, .60], [.62, .60], [.72, .91], [.28, .91]] : [[.36, .60], [.64, .60], [.74, .91], [.26, .91]], lin(0, .6, 0, .91, mainA, mainB), O, lw);
            vgPath(ctx, s, [[.50, .62], [.50, .90]], 'rgba(15,23,42,.3)', lw);
            vgPoly(ctx, s, [[.28, .89], [.72, .89], [.73, .92], [.27, .92]], cAcc, null);
        } else if (tier === 0) {
            vgPoly(ctx, s, fem ? [[.37, .62], [.63, .62], [.69, .80], [.31, .80]] : [[.37, .62], [.63, .62], [.66, .76], [.34, .76]], lin(0, .62, 0, .8, mainA, mainB), O, lw);
        } else if (tier <= 2) {
            vgPoly(ctx, s, fem ? [[.38, .62], [.62, .62], [.68, .78], [.32, .78]] : [[.37, .62], [.63, .62], [.66, .76], [.34, .76]], lin(0, .62, 0, .78, '#8a5a2b', '#3b2412'), O, lw);
            for (let k = 0; k < 4; k++) vgPath(ctx, s, [[.36 + k * .09, .64], [.35 + k * .09, .77]], 'rgba(0,0,0,.25)', lw * .8);
        } else if (tier === 3) {
            vgPoly(ctx, s, fem ? [[.38, .62], [.62, .62], [.69, .79], [.31, .79]] : [[.37, .62], [.63, .62], [.67, .78], [.33, .78]], lin(0, .62, 0, .78, mainA, mainB), O, lw);
        } else {
            [[.34, .74], [.44, .78], [.54, .78]].forEach(([x], i) => {
                const xs = [.33, .44, .55][i];
                vgPoly(ctx, s, [[xs, .62], [xs + .12, .62], [xs + .13, .78 - i * .0], [xs - .01, .78]], lin(0, .62, 0, .78, mainA, mainB), O, lw);
            });
            if (tier === 5) vgPath(ctx, s, [[.33, .78], [.67, .78]], '#fbbf24', lw * 1.2);
        }

        // ------------------------------------------------------------ torso
        const torso = fem ? [[.37, .40], [.63, .40], [.605, .54], [.635, .65], [.365, .65], [.395, .54]] : [[.34, .40], [.66, .40], [.635, .65], [.365, .65]];
        if (robe) {
            vgPoly(ctx, s, torso, lin(0, .4, 0, .65, mainA, mainB), O, lw);
            if (cls === 'Cleric') { vgPoly(ctx, s, [[.45, .40], [.55, .40], [.56, .91], [.44, .91]], '#f8fafc', O, lw * .8); }
            else { ctx.fillStyle = cAcc; [[.40, .50], [.60, .56], [.46, .72], [.58, .80], [.42, .84]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * s, y * s, Math.max(.7, s * .013), 0, 7); ctx.fill(); }); }
        } else {
            vgPoly(ctx, s, torso, tier === 0 ? lin(0, .4, 0, .65, mainA, mainB) : lin(.34, 0, .66, 0, mainA, mainB), O, lw);
        }
        if (tier === 0 && !robe) {
            vgPath(ctx, s, [[.50, .42], [.50, .62]], 'rgba(15,23,42,.35)', lw);
            if (cls === 'Bard') for (let k = 0; k < 3; k++) vgPath(ctx, s, [[.46, .47 + k * .06], [.54, .47 + k * .06]], '#fde68a', lw * .8);
        } else if (tier === 1 || tier === 2) {
            vgPath(ctx, s, [[.50, .42], [.50, .64]], 'rgba(0,0,0,.4)', lw);
            for (let k = 0; k < 4; k++) vgPath(ctx, s, [[.46, .45 + k * .05], [.54, .46 + k * .05]], '#d6b98a', lw * .7);
            if (tier === 2) {
                ctx.fillStyle = '#fbbf24';
                for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ctx.beginPath(); ctx.arc((fem ? .42 : .40) * s + c * s * (fem ? .05 : .067), (.45 + r * .05) * s, Math.max(.6, s * .009), 0, 7); ctx.fill(); }
                // studded pauldrons
                vgBall(ctx, s * .335, s * .42, s * .055, '#a7743d', '#4e2f14', O, lw); vgBall(ctx, s * .665, s * .42, s * .055, '#a7743d', '#4e2f14', O, lw);
            }
        } else if (tier === 3) {
            ctx.save();
            ctx.beginPath(); torso.forEach((p, i) => (i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s))); ctx.closePath(); ctx.clip();
            ctx.strokeStyle = 'rgba(30,41,59,.45)'; ctx.lineWidth = Math.max(.6, lw * .7);
            for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) { ctx.beginPath(); ctx.arc((.34 + c * .042 + (r % 2) * .02) * s, (.42 + r * .04) * s, s * .016, 0, Math.PI); ctx.stroke(); }
            ctx.restore();
            vgPoly(ctx, s, [[.44, .40], [.56, .40], [.57, .75], [.43, .75]], lin(0, .4, 0, .75, cLight, cDark), O, lw * .8);   // tabard in class colours
            vgPath(ctx, s, [[.50, .43], [.50, .72]], cAcc, lw * 1.2);
            rect(.37, .62, .26, .035, '#78350f');
        } else {
            vgPath(ctx, s, [[.50, .42], [.50, .62]], 'rgba(15,23,42,.4)', lw);
            vgPath(ctx, s, [[.40, .50], [.60, .50]], 'rgba(15,23,42,.3)', lw * .8);
            vgPath(ctx, s, [[.37, .43], [.46, .43]], 'rgba(255,255,255,.7)', lw * 1.2);
            rect(.37, .61, .26, .04, tier === 5 ? '#fbbf24' : '#d97706');
            if (tier === 5) { vgGlow(ctx, s * .5, s * .52, s * .22, '125,211,252', .35 + .1 * Math.sin(t * .1)); vgPoly(ctx, s, [[.50, .45], [.53, .51], [.59, .52], [.54, .56], [.56, .62], [.50, .59], [.44, .62], [.46, .56], [.41, .52], [.47, .51]], '#fde68a', null); }
        }
        // volume: light from the upper left, shadow on the right and under the chest, a few cloth folds
        ctx.save();
        ctx.beginPath(); torso.forEach((p, i) => (i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s))); ctx.closePath(); ctx.clip();
        ctx.fillStyle = vgLin(ctx, s * .34, 0, s * .66, 0, [[0, 'rgba(255,255,255,.16)'], [.4, 'rgba(255,255,255,0)'], [1, 'rgba(2,6,23,.34)']]);
        ctx.fillRect(0, s * .38, s, s * .3);
        ctx.fillStyle = vgLin(ctx, 0, s * .54, 0, s * .66, [[0, 'rgba(2,6,23,0)'], [1, 'rgba(2,6,23,.28)']]);
        ctx.fillRect(0, s * .54, s, s * .12);
        if (!metal) [[.41, .47, .39, .60], [.59, .46, .61, .60], [.46, .52, .45, .62]].forEach(([x0, y0, x1, y1]) => vgPath(ctx, s, [[x0, y0], [(x0 + x1) / 2 + .01, (y0 + y1) / 2], [x1, y1]], 'rgba(2,6,23,.2)', lw * .6));
        else vgPath(ctx, s, [[.36, .42], [.46, .41]], 'rgba(255,255,255,.4)', lw);
        ctx.restore();
        if (look.ar) vgGlow(ctx, s * .5, s * .52, s * .34, look.ar === 2 ? '250,204,21' : '96,165,250', .16 + .05 * Math.sin(t * .09));
        // class trinkets on the chest / belt
        if (cls === 'Cleric' && tier <= 2) { vgPath(ctx, s, [[.50, .47], [.50, .58]], '#fbbf24', lw * 1.4); vgPath(ctx, s, [[.46, .51], [.54, .51]], '#fbbf24', lw * 1.4); }
        if (cls === 'Wizard' && tier <= 2) { rect(.38, .60, .24, .035, '#fbbf24'); vgPoly(ctx, s, [[.58, .63], [.65, .63], [.65, .72], [.58, .72]], '#7f1d1d', O, lw * .7); }
        if (cls === 'Tinker' && tier <= 3) { rect(.38, .60, .24, .04, '#292524'); rect(.40, .64, .05, .08, '#a8a29e'); rect(.55, .64, .05, .07, '#a8a29e'); }
        if (cls === 'Rogue' && tier <= 2) { rect(.38, .60, .24, .04, '#78350f'); rect(.47, .60, .06, .04, '#fbbf24', null); }
        if (cls === 'Paladin' && tier <= 2) { vgPath(ctx, s, [[.50, .43], [.50, .60]], '#fde047', lw * 1.6); vgPath(ctx, s, [[.43, .50], [.57, .50]], '#fde047', lw * 1.6); }

        // ------------------------------------------------------------ arms (the sword arm reaches out to the weapon)
        const handMetal = tier >= 4 ? '#cbd5e1' : (tier === 3 ? '#94a3b8' : null);
        arm(.35, .44, .26, .58, tier >= 3 ? mainA : sleeve, handMetal);
        arm(.65, .44, .76, .56, tier >= 3 ? mainA : sleeve, handMetal);
        if (tier >= 4) { vgBall(ctx, s * .335, s * .42, s * .075, '#f8fafc', '#64748b', O, lw); vgBall(ctx, s * .665, s * .42, s * .075, '#f8fafc', '#64748b', O, lw); }
        if (tier === 3) { vgBall(ctx, s * .335, s * .42, s * .06, '#cbd5e1', '#64748b', O, lw); vgBall(ctx, s * .665, s * .42, s * .06, '#cbd5e1', '#64748b', O, lw); }
        if (tier === 1 || tier === 2) { vgPath(ctx, s, [[.27, .55], [.31, .50]], '#8a5a2b', s * .05); vgPath(ctx, s, [[.75, .54], [.70, .49]], '#8a5a2b', s * .05); }
    }

    // a heraldic emblem on the chest for the themed armour looks
    if (avp && !nc) {
        const ex = .5, ey = .53, c = avp.acc;
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (avp.emblem === 'snow') { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; vgPath(ctx, s, [[ex - Math.cos(a) * .05, ey - Math.sin(a) * .05], [ex + Math.cos(a) * .05, ey + Math.sin(a) * .05]], c, lw * 1.1); } }
        else if (avp.emblem === 'sun') { vgBall(ctx, s * ex, s * ey, s * .028, '#fff3b0', c, O, lw * .6); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; vgPath(ctx, s, [[ex + Math.cos(a) * .04, ey + Math.sin(a) * .04], [ex + Math.cos(a) * .062, ey + Math.sin(a) * .062]], c, lw); } }
        else if (avp.emblem === 'rune') { vgPath(ctx, s, [[ex, ey - .06], [ex, ey + .06]], c, lw * 1.2); vgPath(ctx, s, [[ex - .04, ey - .02], [ex, ey + .02], [ex + .04, ey - .03]], c, lw * 1.2); vgGlow(ctx, s * ex, s * ey, s * .08, '168,85,247', .35 + .15 * Math.sin(t * .1)); }
        else if (avp.emblem === 'crown') { vgPoly(ctx, s, [[ex - .05, ey + .03], [ex - .05, ey - .03], [ex - .025, ey], [ex, ey - .05], [ex + .025, ey], [ex + .05, ey - .03], [ex + .05, ey + .03]], c, O, lw * .6); }
        else if (avp.emblem === 'captain') {      // white cross-belts, brass buttons, gold epaulettes and a red sash: the harbour master's coat
            vgPath(ctx, s, [[.38, .43], [.60, .68]], '#f8fafc', lw * 1.5); vgPath(ctx, s, [[.62, .43], [.40, .68]], '#f8fafc', lw * 1.5);
            vgBall(ctx, s * .5, s * .56, s * .022, '#fde68a', '#b45309', O, lw * .5);
            [.47, .63].forEach(y => { vgEll(ctx, s * .44, y * s, s * .01, s * .01, c); vgEll(ctx, s * .56, y * s, s * .01, s * .01, c); });
            vgEll(ctx, s * .345, s * .42, s * .055, s * .022, c, O, lw * .5); vgEll(ctx, s * .655, s * .42, s * .055, s * .022, c, O, lw * .5);
            rect(.34, .66, .32, .035, '#b91c1c');
        }
        else if (avp.emblem === 'leaf') { vgPoly(ctx, s, [[ex, ey - .06], [ex + .045, ey - .01], [ex, ey + .06], [ex - .045, ey - .01]], c, O, lw * .6); vgPath(ctx, s, [[ex, ey - .05], [ex, ey + .06]], 'rgba(20,60,20,.7)', lw * .7); }
        // matching trim at the hem
        vgPath(ctx, s, [[.36, .70], [.64, .70]], c, lw * 1.4);
        ctx.restore();
    }

    // ------------------------------------------------------------ head: face, beard, hair
    const hx = .5, hy = .29, hr = fem ? .088 : .096;
    const noHead = (nc && !look.kw) || !showHelm;
    const helmKind = noHead ? null : (vis === 'coif' ? 'coif' : (vis === 'helm' || vis === 'greathelm' ? 'helm' : null));
    if (helmKind === 'coif') vgBall(ctx, s * hx, s * (hy + .005), s * (hr + .035), '#cbd5e1', '#64748b', O, lw);
    vgPoly(ctx, s, [[.46, .36], [.54, .36], [.552, .41], [.448, .41]], vgLin(ctx, 0, s * .36, 0, s * .41, [[0, skinD], [1, vgShade(skinD, -.3)]]), O, lw * .7);   // neck
    if (auto) {
        vgBall(ctx, s * hx, s * hy, s * hr, skin, skinD, O, lw);
        automatonFace(ctx, s, hx, hy, hr, lw, hair);
    } else {
        heroFaceDraw(ctx, s, hx, hy, hr, { race, fem, skin, skinD, hair, ps: !!look.ps });
    }
    const capKind = noHead || helmKind ? null : (['wizhat', 'circlet', 'hood', 'beret', 'goggles', 'cap', 'tricorn'].includes(vis) ? vis : null);
    if (beardId !== 'none') heroBeardDraw(ctx, s, hx, hy, hr, beardId, hair);
    if (!auto && !helmKind && capKind !== 'hood') heroHairFront(ctx, s, hx, hy, hr, hair, fem, hstyle);

    // ------------------------------------------------------------ headgear
    if (helmKind === 'coif') {
        // mail hood framing the face, forehead band
        vgPath(ctx, s, [[hx - hr, hy - hr * .55], [hx, hy - hr * .95], [hx + hr, hy - hr * .55]], 'rgba(30,41,59,.55)', lw * 1.6);
    } else if (helmKind === 'helm') {
        const hi = vis === 'greathelm', hA = hi ? '#f0f9ff' : '#f1f5f9', hB = hi ? '#38a1e0' : '#64748b';
        vgPoly(ctx, s, [[hx - hr - .02, hy + .03], [hx - hr - .025, hy - .05], [hx - .07, hy - hr - .045], [hx + .07, hy - hr - .045], [hx + hr + .025, hy - .05], [hx + hr + .02, hy + .03], [hx + hr - .005, hy - .035], [hx - hr + .005, hy - .035]], lin(0, hy - .15, 0, hy, hA, hB), O, lw);
        vgPoly(ctx, s, [[hx - hr - .02, hy + .0], [hx - hr + .015, hy + .0], [hx - hr + .01, hy + .075], [hx - hr - .02, hy + .06]], hB, O, lw * .7);   // cheek guards
        vgPoly(ctx, s, [[hx + hr + .02, hy + .0], [hx + hr - .015, hy + .0], [hx + hr - .01, hy + .075], [hx + hr + .02, hy + .06]], hB, O, lw * .7);
        vgPath(ctx, s, [[hx, hy - .05], [hx, hy + .035]], hi ? '#fbbf24' : '#94a3b8', lw * 1.5);   // nose guard
        if (hi) {   // winged crest
            vgPoly(ctx, s, [[hx - hr - .01, hy - .06], [hx - hr - .1, hy - .15], [hx - hr - .05, hy - .03]], '#fef3c7', O, lw * .7);
            vgPoly(ctx, s, [[hx + hr + .01, hy - .06], [hx + hr + .1, hy - .15], [hx + hr + .05, hy - .03]], '#fef3c7', O, lw * .7);
        } else if (cls === 'Fighter') {
            vgPoly(ctx, s, [[hx, hy - hr - .04], [hx + .08, hy - hr - .12], [hx + .13, hy - hr - .05], [hx + .05, hy - hr + .0]], '#dc2626', O, lw * .7);
        } else if (cls === 'Paladin') {
            vgPoly(ctx, s, [[hx - .02, hy - hr - .03], [hx - .1, hy - hr - .13], [hx - .01, hy - hr - .06]], '#fef3c7', O, lw * .6);
            vgPoly(ctx, s, [[hx + .02, hy - hr - .03], [hx + .1, hy - hr - .13], [hx + .01, hy - hr - .06]], '#fef3c7', O, lw * .6);
        }
    } else if (capKind === 'cap') {
        // a close leather cap with a stitched seam and a short brim
        vgPoly(ctx, s, [[hx - hr - .012, hy - .01], [hx - hr - .01, hy - .07], [hx - .05, hy - hr - .035], [hx + .05, hy - hr - .035], [hx + hr + .01, hy - .07], [hx + hr + .012, hy - .01], [hx, hy - .045]], vgLin(ctx, 0, s * (hy - hr - .04), 0, s * hy, [[0, '#a8703a'], [1, '#6b4423']]), O, lw);
        vgPath(ctx, s, [[hx, hy - hr - .03], [hx, hy - .045]], 'rgba(40,22,8,.6)', lw * .8);
        vgPath(ctx, s, [[hx - hr - .012, hy - .012], [hx, hy - .045], [hx + hr + .012, hy - .012]], '#4a2e18', lw * 1.3);
    } else if (capKind === 'wizhat') {
        // a classic wizard's hat: wide drooping brim, a tall cone that bends over at the tip, a gold buckled band and a few stars
        const by0 = hy - hr * 1.12;                                   // where the brim crosses the forehead
        ctx.save();
        ctx.translate(s * hx, s * by0); ctx.scale(.72, .72); ctx.rotate(-0.1); ctx.translate(-s * hx, -s * by0);
        // brim: a wide ellipse, darker underneath
        const brim = vgLin(ctx, 0, s * (by0 - .05), 0, s * (by0 + .05), [[0, '#7e3bc4'], [1, '#3b0f66']]);
        vgEll(ctx, s * hx, s * by0 + s * .006, s * .245, s * .045, brim, O, lw);
        vgEll(ctx, s * hx, s * by0 + s * .012, s * .17, s * .03, 'rgba(15,5,40,.35)', null);
        // the cone, leaning and flopping over at the top
        ctx.beginPath();
        ctx.moveTo(s * .385, s * (by0 + .004));
        ctx.bezierCurveTo(s * .395, s * (by0 - .07), s * .43, s * .09, s * .49, s * .06);
        ctx.bezierCurveTo(s * .53, s * .04, s * .60, s * .02, s * .665, s * .055);
        ctx.bezierCurveTo(s * .68, s * .075, s * .66, s * .09, s * .635, s * .085);
        ctx.bezierCurveTo(s * .60, s * .08, s * .575, s * .105, s * .59, s * .14);
        ctx.bezierCurveTo(s * .605, s * (by0 - .03), s * .615, s * (by0 - .01), s * .615, s * (by0 + .004));
        ctx.closePath();
        ctx.fillStyle = vgLin(ctx, s * .385, 0, s * .615, 0, [[0, '#b278ee'], [.45, '#8b3fd6'], [1, '#4c1d95']]); ctx.fill();
        ctx.strokeStyle = O; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
        // fold shadow where the tip bends, and a soft highlight down the left side
        ctx.beginPath(); ctx.moveTo(s * .575, s * .105); ctx.bezierCurveTo(s * .59, s * .09, s * .62, s * .09, s * .64, s * .086); ctx.strokeStyle = 'rgba(30,10,60,.55)'; ctx.lineWidth = lw * 1.2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * .405, s * (by0 - .01)); ctx.bezierCurveTo(s * .415, s * .13, s * .44, s * .1, s * .48, s * .075); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = lw * 1.4; ctx.stroke();
        // stars and a moon on the cloth
        ctx.fillStyle = '#fde047';
        [[.46, by0 - .05, .011], [.53, by0 - .1, .009], [.5, by0 - .03, .007]].forEach(([x, y, r]) => {
            ctx.beginPath();
            for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; ctx[k ? 'lineTo' : 'moveTo'](s * x + Math.cos(a) * rr * s, s * y + Math.sin(a) * rr * s); }
            ctx.closePath(); ctx.fill();
        });
        // gold band with a square buckle
        ctx.beginPath(); ctx.moveTo(s * .388, s * (by0 - .012)); ctx.quadraticCurveTo(s * hx, s * (by0 + .03), s * .612, s * (by0 - .012));
        ctx.lineTo(s * .614, s * (by0 + .008)); ctx.quadraticCurveTo(s * hx, s * (by0 + .048), s * .386, s * (by0 + .008)); ctx.closePath();
        ctx.fillStyle = vgLin(ctx, 0, s * (by0 - .02), 0, s * (by0 + .04), [[0, '#fde68a'], [1, '#b45309']]); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .7; ctx.stroke();
        vgPoly(ctx, s, [[hx - .018, by0 + .006], [hx + .018, by0 + .006], [hx + .018, by0 + .03], [hx - .018, by0 + .03]], '#fef3c7', O, lw * .6);
        vgPoly(ctx, s, [[hx - .008, by0 + .014], [hx + .008, by0 + .014], [hx + .008, by0 + .024], [hx - .008, by0 + .024]], '#92400e', null);
        ctx.restore();
    } else if (capKind === 'circlet') {
        vgEll(ctx, s * hx, s * (hy - hr * .95), s * .12, s * .028, null, '#fde047', lw * 1.4);
        vgBall(ctx, s * hx, s * (hy - hr * 1.05), s * .017, '#fef3c7', '#d97706', null);
    } else if (capKind === 'hood') {
        const hc = gm ? ['#3b6fe0', '#1e3a8a'] : (cls === 'Ranger' ? ['#34d399', '#047857'] : ['#64748b', '#1e293b']);
        vgPoly(ctx, s, [[hx, .10], [hx - hr - .07, hy - .04], [hx - hr - .05, hy + .1], [hx - hr + .01, hy + .06], [hx - hr + .02, hy - hr * .2], [hx, hy - hr * .95], [hx + hr - .02, hy - hr * .2], [hx + hr - .01, hy + .06], [hx + hr + .05, hy + .1], [hx + hr + .07, hy - .04]], lin(0, .1, 0, hy + .1, hc[0], hc[1]), O, lw);
    } else if (capKind === 'beret') {
        vgPoly(ctx, s, [[hx - hr - .02, hy - .06], [hx + hr + .03, hy - .06], [hx + hr + .005, hy - hr - .06], [hx, hy - hr - .1], [hx - hr + .01, hy - hr - .06]], '#be185d', O, lw);
        vgPoly(ctx, s, [[hx + hr - .02, hy - hr - .05], [hx + hr + .16, hy - hr - .15], [hx + hr + .13, hy - hr - .07], [hx + hr + .02, hy - hr + .0]], '#fde047', O, lw * .7);
    } else if (capKind === 'tricorn') {
        drawTricorn(ctx, s, O, lw, Math.sin(t * .05) * .008);
    } else if (capKind === 'goggles') {
        vgPoly(ctx, s, [[hx - hr - .01, hy - .05], [hx + hr + .01, hy - .05], [hx + hr - .01, hy - hr - .06], [hx, hy - hr - .09], [hx - hr + .01, hy - hr - .06]], '#78350f', O, lw);
        rect(hx - hr - .02, hy - .06, hr * 2 + .04, .026, '#451a03');
        vgPath(ctx, s, [[hx - hr, hy - .03], [hx + hr, hy - .03]], '#44403c', lw * 1.3);
        vgBall(ctx, s * (hx - hr * .45), s * (hy - .035), s * .032, '#bae6fd', '#0369a1', '#b45309', lw);
        vgBall(ctx, s * (hx + hr * .45), s * (hy - .035), s * .032, '#bae6fd', '#0369a1', '#b45309', lw);
    }

    // ------------------------------------------------------------ shield (equipped shield slot)
    const twoHand = ['Hunting Bow', 'Silver Halberd', 'Musket Rifle', 'Blunderbuss'].includes(wp.name);
    const shIdx = (look.sh !== undefined && look.sh !== null) ? (look.sh | 0) : -1;
    if (!nc && !twoHand && shIdx >= 0) {
        const sGlow = look.sr === 2 ? '250,204,21' : '96,165,250';
        if (look.sr) vgGlow(ctx, s * .21, s * .58, s * .16, sGlow, .22 + .08 * Math.sin(t * .1));
        if (shIdx === 0) {
            // Buckler: small round metal target shield
            vgBall(ctx, s * .21, s * .58, s * .085, '#e2e8f0', '#475569', O, lw);
            vgBall(ctx, s * .21, s * .58, s * .035, '#f8fafc', '#334155', O, lw * .7);
        } else if (shIdx === 1) {
            // Round Shield: stout wooden and iron shield
            vgBall(ctx, s * .21, s * .58, s * .13, '#92400e', '#451a03', O, lw);
            vgBall(ctx, s * .21, s * .58, s * .13, null, '#cbd5e1', lw * 1.8);
            vgBall(ctx, s * .21, s * .58, s * .045, '#f1f5f9', '#475569', O, lw * .8);
        } else if (shIdx === 2) {
            // Heater Shield: knightly heraldic kite / heater shield
            const sGrad = lin(.12, 0, .30, 0, (cls === 'Paladin' || cls === 'Cleric') ? '#f8fafc' : '#3b82f6', (cls === 'Paladin' || cls === 'Cleric') ? '#94a3b8' : '#1d4ed8');
            vgPoly(ctx, s, [[.12, .46], [.30, .46], [.30, .62], [.21, .77], [.12, .62]], sGrad, O, lw);
            vgPath(ctx, s, [[.21, .50], [.21, .68]], cAcc, lw * 1.6);
            vgPath(ctx, s, [[.15, .57], [.27, .57]], cAcc, lw * 1.6);
        } else if (shIdx === 3) {
            // Tower Shield: massive full-body wall shield
            vgPoly(ctx, s, [[.10, .42], [.29, .42], [.29, .80], [.195, .84], [.10, .80]], lin(.10, 0, .29, 0, '#64748b', '#1e293b'), O, lw);
            vgPath(ctx, s, [[.10, .42], [.29, .42], [.29, .80], [.195, .84], [.10, .80]], '#cbd5e1', lw * 1.5);
            vgBall(ctx, s * .195, s * .60, s * .045, '#f8fafc', '#475569', O, lw);
            vgPath(ctx, s, [[.195, .46], [.195, .76]], '#94a3b8', lw * 1.2);
        } else {
            // Astral Barrier: gleaming starlight bulwark
            vgPoly(ctx, s, [[.12, .45], [.30, .45], [.31, .62], [.21, .78], [.11, .62]], lin(.12, 0, .31, 0, '#38bdf8', '#0c4a6e'), O, lw);
            vgGlow(ctx, s * .21, s * .58, s * .12, '125,211,252', .4 + .15 * Math.sin(t * .12));
            vgPoly(ctx, s, [[.21, .52], [.23, .57], [.28, .58], [.24, .61], [.25, .66], [.21, .63], [.17, .66], [.18, .61], [.14, .58], [.19, .57]], '#fde047', null);
            vgPath(ctx, s, [[.12, .45], [.30, .45], [.31, .62], [.21, .78], [.11, .62]], '#fbbf24', lw * 1.2);
        }
    }

    // ------------------------------------------------------------ the weapon in hand (right hand at about .77,.56)
    const glowRgb = look.wr === 2 ? '250,204,21' : '96,165,250';
    const wpal = WV_PAL[look.wv | 0] || null;
    const bladeWeapon = ['Dagger', 'Broadsword', 'Astral Blade'].includes(wp.name);
    const blade = (x, y0, y1, w, tint) => {
        vgPoly(ctx, s, [[x - w, y1], [x - w, y0 + .04], [x, y0], [x + w, y0 + .04], [x + w, y1]],
            vgLin(ctx, (x - w) * s, 0, (x + w) * s, 0, (wpal && wpal.blade) || tint || [[0, '#f8fafc'], [.5, '#cbd5e1'], [1, '#64748b']]), O, lw);
        vgPath(ctx, s, [[x, y0 + .05], [x, y1 - .02]], 'rgba(15,23,42,0.35)', lw * .7);
    };
    const hand = [.77, .56];
    if (look.nw || gm || (nc && !look.kw)) { ctx.restore(); return; }
    const gC = (wpal && wpal.guard) || null, rC = (wpal && wpal.grip) || null;
    ctx.save();
    if (wpal && !bladeWeapon) ctx.filter = wpal.filter;             // maces, bows, guns and polearms are recoloured as a whole
    switch (wp.name) {
        case 'Dagger':
            blade(.79, .38, .55, .018);
            rect(.745, .55, .09, .022, gC || '#d97706'); rect(.783, .572, .022, .06, rC || '#78350f');
            break;
        case 'Heavy Mace':
            vgPath(ctx, s, [[.78, .66], [.78, .34]], '#78350f', s * .034);
            vgBall(ctx, s * .78, s * .27, s * .075, '#cbd5e1', '#475569', O, lw);
            for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3; vgPoly(ctx, s, [[.78 + Math.cos(an) * .06, .27 + Math.sin(an) * .06], [.78 + Math.cos(an) * .105, .27 + Math.sin(an) * .105], [.78 + Math.cos(an + .3) * .06, .27 + Math.sin(an + .3) * .06]], '#e2e8f0', O, lw * .6); }
            break;
        case 'Hunting Bow': {
            ctx.strokeStyle = '#a16207'; ctx.lineWidth = s * .035; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(s * .70, s * .52, s * .30, -Math.PI * .38, Math.PI * .38); ctx.stroke();
            const ax = .70 + .30 * Math.cos(Math.PI * .38), ay = .52 + .30 * Math.sin(Math.PI * .38);
            vgPath(ctx, s, [[ax, .52 - (ay - .52)], [.745, .52], [ax, ay]], '#f1f5f9', lw * .6);
            break;
        }
        case 'Musket Pistol':
            vgPoly(ctx, s, [[.76, .52], [.90, .47], [.91, .52], [.80, .58]], lin(0, .5, 0, .58, '#94a3b8', '#334155'), O, lw);
            vgPoly(ctx, s, [[.72, .52], [.77, .52], [.80, .64], [.74, .64]], '#78350f', O, lw);
            vgBall(ctx, s * .915, s * .495, s * .012, '#0f172a', '#000', null);
            break;
        case 'Broadsword':
            if (wpal && wpal.captain) {         // a curved cutlass with a brass knuckle-guard
                vgPoly(ctx, s, [[.78, .56], [.77, .30], [.80, .16], [.87, .10], [.85, .20], [.83, .34], [.83, .56]], vgLin(ctx, s * .77, 0, s * .87, 0, wpal.blade), O, lw);
                vgPath(ctx, s, [[.80, .50], [.805, .22]], 'rgba(15,23,42,.35)', lw * .7);
                rect(.73, .55, .14, .03, '#fbbf24'); vgPath(ctx, s, [[.74, .56], [.72, .66], [.78, .70]], '#fbbf24', lw * 1.6);
                rect(.778, .58, .03, .09, '#7f1d1d'); vgBall(ctx, s * .793, s * .68, s * .028, '#fde68a', '#92400e', O, lw * .7);
                break;
            }
            blade(.79, .16, .55, .026);
            rect(.73, .55, .12, .03, gC || '#d97706'); rect(.778, .58, .03, .09, rC || '#78350f'); vgBall(ctx, s * .793, s * .68, s * .028, (wpal && wpal.gem) || '#fbbf24', '#92400e', O, lw * .7);
            break;
        case 'Blunderbuss':
            vgPoly(ctx, s, [[.52, .62], [.80, .50], [.92, .36], [.97, .44], [.82, .58], [.58, .70]], lin(0, .4, 0, .7, '#b8c0cc', '#475569'), O, lw);
            vgPoly(ctx, s, [[.84, .40], [.98, .30], [1.0, .42], [.88, .54]], '#475569', O, lw * .8);
            vgPoly(ctx, s, [[.46, .66], [.58, .60], [.62, .70], [.50, .78]], '#78350f', O, lw);
            break;
        case 'Silver Halberd':
            vgPath(ctx, s, [[.80, .92], [.80, .12]], '#78350f', s * .03);
            vgPoly(ctx, s, [[.80, .14], [.96, .10], [.98, .30], [.80, .32]], lin(.8, 0, .98, 0, '#f8fafc', '#64748b'), O, lw);
            vgPoly(ctx, s, [[.80, .05], [.835, .15], [.765, .15]], '#e2e8f0', O, lw * .8);
            break;
        case 'Musket Rifle':
            vgPoly(ctx, s, [[.52, .70], [.70, .60], [.72, .66], [.58, .78]], '#78350f', O, lw);
            vgPoly(ctx, s, [[.68, .58], [.96, .30], [.99, .35], [.72, .66]], lin(0, .3, 0, .65, '#d0d7e2', '#475569'), O, lw);
            vgBall(ctx, s * .79, s * .52, s * .018, '#fbbf24', '#92400e', O, lw * .5);
            break;
        case 'Astral Blade':
            blade(.79, .12, .55, .03, [[0, '#ecfeff'], [.5, '#67e8f9'], [1, '#0e7490']]);
            vgGlow(ctx, s * .79, s * .33, s * .2, wpal ? wpal.glow : '103,232,249', .35 + .1 * Math.sin(t * .12));
            rect(.73, .55, .12, .03, gC || '#fbbf24'); rect(.778, .58, .03, .09, rC || '#1e3a8a'); vgBall(ctx, s * .793, s * .68, s * .03, (wpal && wpal.gem) || '#e0f2fe', '#0284c7', O, lw * .7);
            break;
        default:
            blade(.79, .30, .55, .02);
    }
    ctx.restore();
    // themed weapons shed light and motes of their element
    if (wpal && !wpal.captain) {
        const tipY0 = wp.name === 'Dagger' ? .38 : (wp.name === 'Broadsword' ? .16 : (wp.name === 'Astral Blade' ? .12 : (['Hunting Bow', 'Musket Pistol'].includes(wp.name) ? .5 : (wp.name === 'Heavy Mace' ? .27 : .3))));
        vgGlow(ctx, s * .8, s * (tipY0 + .08), s * .2, wpal.glow, .22 + .08 * Math.sin(t * .09));
        for (let i = 0; i < 4; i++) {
            const ph = ((t * 0.02) + i / 4) % 1, mx = .8 + Math.sin(i * 2.1 + t * .03) * .05, my = tipY0 + .16 - ph * .26;
            ctx.fillStyle = `rgba(${wpal.glow},${(1 - ph) * .9})`; ctx.fillRect(s * mx - 1, s * my - 1, Math.max(1.5, s * .014), Math.max(1.5, s * .014));
        }
    }
    if (look.wr) {
        const tipY = ['Hunting Bow', 'Musket Pistol'].includes(wp.name) ? .5 : (wp.name === 'Heavy Mace' ? .27 : .3);
        vgGlow(ctx, s * (wp.name === 'Silver Halberd' ? .88 : .8), s * tipY, s * .17, glowRgb, .28 + .12 * Math.sin(t * .1));
    }
    void hand;
    ctx.restore();
}

// the harbour master's tricorn: a felt crown, three cocked brims edged in gold braid, a cockade and a curling plume (also worn by the NPC)
function drawTricorn(ctx, s, O, lw, sway) {
    ctx.save(); ctx.translate(s * .5, s * .205); ctx.scale(.78, .78); ctx.translate(-s * .5, -s * .255);          // it sits on the brow, clear of the eyes
    vgPoly(ctx, s, [[.35, .21], [.37, .12], [.43, .085], [.57, .085], [.63, .12], [.65, .21]], vgLin(ctx, 0, s * .085, 0, s * .21, [[0, '#26304f'], [1, '#0b1330']]), O, lw);
    vgPoly(ctx, s, [[.14, .27], [.27, .12], [.43, .165], [.50, .145], [.57, .165], [.73, .12], [.86, .27], [.71, .24], [.60, .215], [.50, .245], [.40, .215], [.29, .24]], vgLin(ctx, 0, s * .12, 0, s * .27, [[0, '#1d2a52'], [1, '#080d22']]), O, lw);
    vgPath(ctx, s, [[.14, .27], [.27, .12], [.43, .165], [.50, .145], [.57, .165], [.73, .12], [.86, .27]], '#fbbf24', lw * 1.5);
    vgPath(ctx, s, [[.29, .24], [.40, .215], [.50, .245], [.60, .215], [.71, .24]], 'rgba(251,191,36,.7)', lw);
    vgPath(ctx, s, [[.36, .20], [.64, .20]], '#fbbf24', lw * 1.1);
    vgBall(ctx, s * .30, s * .17, s * .032, '#fef2f2', '#dc2626', O, lw * .6); vgEll(ctx, s * .30, s * .17, s * .013, s * .013, '#ef4444');
    vgBall(ctx, s * .5, s * .115, s * .014, '#fde68a', '#b45309', O, lw * .5);
    ctx.beginPath(); ctx.moveTo(s * .27, s * .15);
    ctx.bezierCurveTo(s * (.20 + sway), s * .02, s * (.50 + sway), s * -.02, s * .66, s * .07);
    ctx.bezierCurveTo(s * .50, s * .035, s * .32, s * .06, s * .29, s * .15); ctx.closePath();
    ctx.fillStyle = vgLin(ctx, s * .25, 0, s * .66, 0, [[0, '#ffffff'], [1, '#cbd5e1']]); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .6; ctx.stroke();
    ctx.restore();
}

// Automata: a riveted steel face plate with glowing runes (the "hair" colour picks the glow)
function automatonFace(ctx, s, hx, hy, hr, lw, glow) {
    const t = vgTick();
    const cx = s * hx, cy = s * hy, r = s * hr;
    vgBall(ctx, cx, cy, r, '#e2e8f0', '#64748b', VG_OUT, lw);
    vgPath(ctx, s, [[hx, hy - hr * .95], [hx, hy + hr * .95]], 'rgba(15,23,42,0.45)', lw * .7);
    vgBall(ctx, cx - r * .62, cy + r * .45, r * .1, '#cbd5e1', '#475569', null);
    vgBall(ctx, cx + r * .62, cy + r * .45, r * .1, '#cbd5e1', '#475569', null);
    const g = HAIR_RE.test(glow || '') ? glow : '#22d3ee';
    const n = parseInt(g.slice(1), 16), rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    const pulse = 0.65 + 0.35 * Math.sin(t * 0.09);
    vgGlow(ctx, cx, cy + r * .05, r * 1.1, rgb, 0.35 * pulse);
    vgEyes(ctx, cx, cy + r * .05, r * .38, r * .14, g);
    vgEyes(ctx, cx, cy + r * .05, r * .38, r * .07, '#ffffff');
}

// =====================================================================================================
// FACES, HAIR AND BEARDS - drawn from smooth curves instead of balls and flat polygons.
// All coordinates inside these helpers are in head radii around the centre of the head (x right, y down).
// =====================================================================================================
const FACE_SHAPES = {          // jw: jaw width, chin: chin depth, slant: eye tilt, eyeY: eye line
    Human: { jw: .74, chin: 1.04, slant: 0, eyeY: -.02 },
    Elf: { jw: .56, chin: 1.10, slant: .07, eyeY: -.02 },
    Dwarf: { jw: .93, chin: .98, slant: -.03, eyeY: .0 },
    Halfling: { jw: .86, chin: .97, slant: 0, eyeY: .04 }
};
const EYE_COLORS = ['#5b3a1e', '#3f6fb5', '#4f8a4b', '#6b7280', '#7a5a1c', '#2f2a26'];
const ELF_EYES = ['#2fa56a', '#4aa3d8', '#8b6fe0', '#d4a017'];

function faceHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
}
// closed smooth curve through points given in pixels
function fcSmooth(ctx, pts) {
    const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    ctx.beginPath(); ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    ctx.closePath();
}
// a left/right symmetric ring: `outer` runs from the top down to the centre line, `inner` (optional) from the top to the centre
function fcSym(outer, inner) {
    const L = a => a.map(p => [-p[0], p[1]]);
    const cut = a => (a.length && a[a.length - 1][0] === 0 ? a.slice(0, -1) : a);
    let pts = outer.concat(L(cut(outer)).reverse());
    if (inner && inner.length) pts = pts.concat(L(inner), cut(inner).reverse());
    return pts;
}
function fcFaceOutline(ctx, cx, cy, r, jw, chin) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r * .62, cy - r, cx + r * .99, cy - r * .62, cx + r * .97, cy - r * .12);
    ctx.bezierCurveTo(cx + r * .96, cy + r * .36, cx + r * (jw + .12), cy + r * .72, cx + r * jw * .5, cy + r * (chin - .1));
    ctx.quadraticCurveTo(cx + r * jw * .2, cy + r * chin, cx, cy + r * chin);
    ctx.quadraticCurveTo(cx - r * jw * .2, cy + r * chin, cx - r * jw * .5, cy + r * (chin - .1));
    ctx.bezierCurveTo(cx - r * (jw + .12), cy + r * .72, cx - r * .96, cy + r * .36, cx - r * .97, cy - r * .12);
    ctx.bezierCurveTo(cx - r * .99, cy - r * .62, cx - r * .62, cy - r, cx, cy - r);
    ctx.closePath();
}
function fcApply(pts, cx, cy, r) { return pts.map(p => [cx + p[0] * r, cy + p[1] * r]); }

// the face: ears, skin with shading, eyes, brows, nose, mouth
function heroFaceDraw(ctx, s, hx, hy, hr, o) {
    const cx = s * hx, cy = s * hy, r = s * hr, O = VG_OUT, lw = Math.max(0.6, s * 0.0125);
    const sh = FACE_SHAPES[o.race] || FACE_SHAPES.Human, fem = !!o.fem, big = r >= 6.5;
    const skin = o.skin, skinD = o.skinD, skinL = vgShade(skin, .14), jw = fem ? sh.jw - .1 : sh.jw;
    const tone = vgShade(skinD, -.25);

    // ears
    if (o.race === 'Elf') {
        for (const sg of [-1, 1]) {
            const e = fcApply([[.88, -.18], [1.35, -.5], [1.9, -.78], [1.5, -.2], [1.2, .26], [.9, .3]].map(p => [p[0] * sg, p[1]]), cx, cy, r);
            fcSmooth(ctx, e); ctx.fillStyle = vgLin(ctx, cx, cy - r, cx, cy + r, [[0, skinL], [1, skinD]]); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .8; ctx.lineJoin = 'round'; ctx.stroke();
            if (big) vgPath(ctx, 1, fcApply([[1.0 * sg, -.12], [1.45 * sg, -.45], [1.2 * sg, -.05]], cx, cy, r), tone, lw * .5);
        }
    } else {
        for (const sg of [-1, 1]) {
            vgEll(ctx, cx + sg * r * .96, cy + r * .08, r * .16, r * .26, vgLin(ctx, cx, cy - r * .2, cx, cy + r * .4, [[0, skin], [1, skinD]]), O, lw * .7);
            if (big) { ctx.beginPath(); ctx.arc(cx + sg * r * .97, cy + r * .08, r * .07, 0, 7); ctx.strokeStyle = tone; ctx.lineWidth = lw * .5; ctx.stroke(); }
        }
    }

    // skin
    fcFaceOutline(ctx, cx, cy, r, jw, sh.chin);
    const g = ctx.createRadialGradient(cx - r * .3, cy - r * .35, r * .1, cx, cy, r * 1.3);
    g.addColorStop(0, skinL); g.addColorStop(.55, skin); g.addColorStop(1, skinD);
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    fcFaceOutline(ctx, cx, cy, r, jw, sh.chin); ctx.clip();
    ctx.fillStyle = vgLin(ctx, cx - r, 0, cx + r, 0, [[0, 'rgba(255,255,255,.07)'], [.55, 'rgba(0,0,0,0)'], [1, 'rgba(30,20,40,.2)']]);
    ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    ctx.fillStyle = vgLin(ctx, 0, cy + r * .5, 0, cy + r * sh.chin, [[0, 'rgba(120,50,30,0)'], [1, 'rgba(120,50,30,.22)']]);
    ctx.fillRect(cx - r * 2, cy + r * .5, r * 4, r * 2);
    // cheeks
    const blush = o.race === 'Halfling' ? .34 : (fem ? .26 : .17);
    ctx.fillStyle = `rgba(236,100,90,${blush})`;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sg * r * .52, cy + r * .34, r * .22, r * .13, 0, 0, 7); ctx.fill(); }
    if (o.ps) {                                                       // poisoned: a sickly green cast over the face
        ctx.fillStyle = 'rgba(110,200,40,.42)'; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
        ctx.fillStyle = vgLin(ctx, 0, cy - r, 0, cy + r, [[0, 'rgba(40,110,20,.12)'], [1, 'rgba(40,110,20,.3)']]); ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    }
    ctx.restore();
    fcFaceOutline(ctx, cx, cy, r, jw, sh.chin); ctx.strokeStyle = O; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();

    // eyes and brows
    const eyeCol = o.race === 'Elf' ? ELF_EYES[faceHash(o.hair + 'e') % 4] : EYE_COLORS[faceHash(o.hair + o.race) % 6];
    const brow = vgShade(o.hair, -.28), ey = cy + r * sh.eyeY, ex = r * .40;
    for (const sg of [-1, 1]) {
        const x = cx + sg * ex, ew = r * (fem ? .23 : .21), eh = r * (fem ? .13 : .11), rot = -sg * sh.slant;
        // brow
        const bw = (o.race === 'Dwarf' ? 2.6 : (fem ? .85 : 1.6)) * lw * (big ? 1 : .8);
        ctx.beginPath(); ctx.moveTo(cx + sg * r * .14, ey - r * (fem ? .19 : .2));
        ctx.quadraticCurveTo(cx + sg * r * .42, ey - r * (fem ? .42 : .34), cx + sg * r * .7, ey - r * (fem ? .2 : .24) - r * sh.slant * 1.2);
        ctx.strokeStyle = brow; ctx.lineWidth = bw; ctx.lineCap = 'round'; ctx.stroke();
        if (!big) { vgEyes(ctx, x, ey, 0, Math.max(0.7, r * .11), '#0f172a'); continue; }
        // socket
        ctx.fillStyle = 'rgba(120,70,60,.14)'; ctx.beginPath(); ctx.ellipse(x, ey - r * .02, ew * 1.35, eh * 1.9, rot, 0, 7); ctx.fill();
        // white of the eye, iris cut off by the lids
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x, ey, ew, eh, rot, 0, 7); ctx.clip();
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(x - ew, ey - eh, ew * 2, eh * 2);
        const ig = ctx.createRadialGradient(x + sg * -ew * .1, ey - eh * .3, 0, x, ey, r * .13);
        ig.addColorStop(0, vgShade(eyeCol, .3)); ig.addColorStop(.7, eyeCol); ig.addColorStop(1, vgShade(eyeCol, -.5));
        ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(x, ey, r * .105, 0, 7); ctx.fill();
        ctx.fillStyle = '#05070d'; ctx.beginPath(); ctx.arc(x, ey, r * .052, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x - r * .035, ey - r * .04, r * .027, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(70,40,40,.25)'; ctx.fillRect(x - ew, ey - eh, ew * 2, eh * .55);   // shadow of the upper lid
        ctx.restore();
        // lids and lashes
        ctx.beginPath(); ctx.ellipse(x, ey, ew, eh, rot, Math.PI * 1.04, Math.PI * 1.96);
        ctx.strokeStyle = '#0b0f1a'; ctx.lineWidth = lw * (fem ? 1.5 : 1.15); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, ey, ew, eh, rot, Math.PI * .1, Math.PI * .9);
        ctx.strokeStyle = 'rgba(80,40,40,.45)'; ctx.lineWidth = lw * .5; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, ey - eh * .6, ew * .95, eh * .9, rot, Math.PI * 1.1, Math.PI * 1.9);
        ctx.strokeStyle = 'rgba(90,50,40,.3)'; ctx.lineWidth = lw * .5; ctx.stroke();    // lid crease
        if (fem) vgPath(ctx, 1, [[x + sg * ew * .9, ey - eh * .3], [x + sg * ew * 1.35, ey - eh * 1.0]], '#0b0f1a', lw * .9);   // lash flick
    }

    // nose
    if (o.race === 'Dwarf') {
        vgBall(ctx, cx, cy + r * .24, r * .2, vgShade(skin, .05), vgShade(skinD, -.05), big ? 'rgba(90,50,30,.55)' : null, lw * .6);
        if (big) { ctx.fillStyle = 'rgba(60,25,20,.55)'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sg * r * .09, cy + r * .33, r * .04, r * .025, 0, 0, 7); ctx.fill(); } }
    } else {
        const nl = o.race === 'Elf' ? .26 : (o.race === 'Halfling' ? .2 : .3);
        ctx.beginPath(); ctx.moveTo(cx + r * .05, cy - r * .02); ctx.quadraticCurveTo(cx + r * .12, cy + r * .15, cx + r * .11, cy + r * nl);
        ctx.quadraticCurveTo(cx, cy + r * (nl + .07), cx - r * .1, cy + r * nl);
        ctx.strokeStyle = tone; ctx.lineWidth = lw * .7; ctx.stroke();
        if (big) { vgPath(ctx, 1, [[cx - r * .03, cy + r * .02], [cx - r * .04, cy + r * (nl - .08)]], 'rgba(255,255,255,.3)', lw * .8); }
    }

    // mouth
    const my = cy + r * .58, mw = r * (fem ? .19 : .24);
    if (fem) {
        ctx.fillStyle = '#c4455a'; ctx.beginPath(); ctx.moveTo(cx - mw, my);
        ctx.quadraticCurveTo(cx - mw * .4, my - r * .1, cx, my - r * .05); ctx.quadraticCurveTo(cx + mw * .4, my - r * .1, cx + mw, my);
        ctx.quadraticCurveTo(cx, my + r * .15, cx - mw, my); ctx.fill();
        if (big) vgPath(ctx, 1, [[cx - mw, my], [cx, my + r * .02], [cx + mw, my]], '#7f1d2d', lw * .6);
    } else {
        ctx.beginPath(); ctx.moveTo(cx - mw, my - r * .02); ctx.quadraticCurveTo(cx, my + r * .08, cx + mw, my - r * .02);
        ctx.strokeStyle = 'rgba(110,45,35,.8)'; ctx.lineWidth = lw * .85; ctx.stroke();
        if (big) { ctx.beginPath(); ctx.moveTo(cx - mw * .6, my + r * .1); ctx.quadraticCurveTo(cx, my + r * .15, cx + mw * .6, my + r * .1); ctx.strokeStyle = 'rgba(120,60,40,.3)'; ctx.lineWidth = lw * .6; ctx.stroke(); }
    }
}

// beards: shapes that wrap the jaw, shaded and combed with strands
function heroBeardDraw(ctx, s, hx, hy, hr, id, hair) {
    const cx = s * hx, cy = s * hy, r = s * hr, O = VG_OUT, lw = Math.max(0.6, s * 0.0125), big = r >= 6.5;
    const hl = vgShade(hair, .3), hd = vgShade(hair, -.4);
    const ring = (outer, inner) => fcApply(fcSym(outer, inner), cx, cy, r);
    const paint = (pts, y0, y1, comb) => {
        fcSmooth(ctx, pts);
        ctx.fillStyle = vgLin(ctx, 0, cy + r * y0, 0, cy + r * y1, [[0, vgShade(hair, .12)], [.5, hair], [1, hd]]); ctx.fill();
        if (big && comb) {
            ctx.save(); fcSmooth(ctx, pts); ctx.clip();
            for (let i = -5; i <= 5; i++) {
                const x = i / 5;
                ctx.beginPath(); ctx.moveTo(cx + x * r * .8, cy + r * .7);
                ctx.quadraticCurveTo(cx + x * r * 1.0, cy + r * (y0 + y1) * .5, cx + x * r * (.55 - Math.abs(x) * .3), cy + r * y1);
                ctx.strokeStyle = i % 2 ? hd : hl; ctx.globalAlpha = .5; ctx.lineWidth = lw * .55; ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.restore();
        }
        fcSmooth(ctx, pts); ctx.strokeStyle = O; ctx.lineWidth = lw * .75; ctx.lineJoin = 'round'; ctx.stroke();
    };
    const mustache = (curl) => {
        for (const sg of [-1, 1]) {
            const p = fcApply([[0, .34], [.2 * sg, .3], [.5 * sg, .36], [(.68 + curl) * sg, .5 - curl * .6], [.55 * sg, .5], [.3 * sg, .46], [.1 * sg, .5], [0, .46]], cx, cy, r);
            fcSmooth(ctx, p); ctx.fillStyle = vgLin(ctx, 0, cy + r * .3, 0, cy + r * .55, [[0, vgShade(hair, .1)], [1, hd]]); ctx.fill();
            ctx.strokeStyle = O; ctx.lineWidth = lw * .6; ctx.stroke();
        }
        if (big) for (const sg of [-1, 1]) vgPath(ctx, 1, fcApply([[.06 * sg, .38], [.32 * sg, .36], [.55 * sg, .43]], cx, cy, r), hl, lw * .45);
    };
    if (id === 'stubble') {
        const pts = ring([[.97, -.05], [.98, .4], [.84, .82], [.5, 1.1], [0, 1.18]], [[.7, .18], [.55, .5], [.3, .62], [0, .66]]);
        fcSmooth(ctx, pts); ctx.fillStyle = hair; ctx.globalAlpha = .3; ctx.fill(); ctx.globalAlpha = 1;
        if (big) {
            ctx.save(); fcSmooth(ctx, pts); ctx.clip(); ctx.fillStyle = hd; ctx.globalAlpha = .55;
            for (let i = 0; i < 70; i++) { const a = faceHash('st' + i); ctx.fillRect(cx + (((a & 255) / 255) * 2 - 1) * r, cy + r * (.1 + ((a >> 8 & 255) / 255) * 1.1), Math.max(.5, r * .035), Math.max(.5, r * .035)); }
            ctx.restore(); ctx.globalAlpha = 1;
        }
        return;
    }
    if (id === 'short') paint(ring([[.99, -.08], [.98, .4], [.86, .82], [.5, 1.16], [0, 1.26]], [[.78, .1], [.66, .5], [.36, .68], [0, .72]]), .2, 1.26, true);
    if (id === 'full') paint(ring([[1.02, -.12], [1.07, .5], [.93, 1.0], [.55, 1.5], [.2, 1.75], [0, 1.8]], [[.8, .04], [.7, .46], [.36, .64], [0, .66]]), .2, 1.8, true);
    if (id === 'long') {
        paint(ring([[1.02, -.12], [1.09, .6], [.96, 1.4], [.62, 2.3], [.26, 3.1], [0, 3.6]], [[.8, .04], [.7, .46], [.36, .64], [0, .66]]), .2, 3.6, true);
        vgPath(ctx, 1, fcApply([[-.5, 2.0], [0, 2.12], [.5, 2.0]], cx, cy, r), '#fbbf24', lw * 1.5);     // gold clasp
    }
    if (id === 'goatee') paint(ring([[.42, .64], [.38, 1.05], [.16, 1.55], [0, 1.72]], [[0, .7]]), .6, 1.72, true);
    if (id !== 'none') mustache(id === 'goatee' || id === 'mustache' ? .1 : 0);
}

// hair that hangs behind the head: long hair, a bob or a ponytail
function heroHairBack(ctx, s, hx, hy, hr, hair, style) {
    style = style || 'long';
    if (style !== 'long' && style !== 'bob' && style !== 'ponytail') return;
    const cx = s * hx, cy = s * hy, r = s * hr, O = VG_OUT, lw = Math.max(0.6, s * 0.0125);
    const shapes = {
        long: [[0, -1.25], [.95, -1.0], [1.3, 0], [1.4, 1.2], [1.55, 2.6], [1.1, 3.4], [.55, 3.0], [0, 3.15], [-.55, 3.0], [-1.1, 3.4], [-1.55, 2.6], [-1.4, 1.2], [-1.3, 0], [-.95, -1.0]],
        bob: [[0, -1.25], [.95, -1.0], [1.3, 0], [1.42, .9], [1.25, 1.6], [.7, 1.5], [0, 1.4], [-.7, 1.5], [-1.25, 1.6], [-1.42, .9], [-1.3, 0], [-.95, -1.0]],
        ponytail: [[.9, -.7], [1.5, -.35], [1.95, .5], [1.9, 1.5], [1.55, 2.5], [1.3, 1.7], [1.2, .9], [1.0, .2]]
    };
    const pts = fcApply(shapes[style], cx, cy, r), bottom = style === 'long' ? 3.4 : (style === 'bob' ? 1.6 : 2.5);
    fcSmooth(ctx, pts);
    ctx.fillStyle = vgLin(ctx, 0, cy - r, 0, cy + r * bottom, [[0, vgShade(hair, .1)], [.4, hair], [1, vgShade(hair, -.4)]]); ctx.fill();
    ctx.save(); fcSmooth(ctx, pts); ctx.clip();
    for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * r * .3 + (style === 'ponytail' ? r * 1.4 : 0), cy + r * .3);
        ctx.bezierCurveTo(cx + i * r * .5 + (style === 'ponytail' ? r * 1.5 : 0), cy + r * bottom * .4, cx + i * r * .45 + (style === 'ponytail' ? r * 1.7 : r * .2), cy + r * bottom * .7, cx + i * r * .4 + (style === 'ponytail' ? r * 1.55 : 0), cy + r * (bottom - .1));
        ctx.strokeStyle = i % 2 ? vgShade(hair, -.4) : vgShade(hair, .25); ctx.globalAlpha = .45; ctx.lineWidth = lw * .6; ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
    fcSmooth(ctx, pts); ctx.strokeStyle = O; ctx.lineWidth = lw * .8; ctx.lineJoin = 'round'; ctx.stroke();
    if (style === 'ponytail') { vgPath(ctx, 1, fcApply([[1.0, -.05], [1.3, .0], [1.4, .35]], cx, cy, r), '#fbbf24', lw * 2); }   // the tie
}

// the hair on top of the head, by style
function heroHairFront(ctx, s, hx, hy, hr, hair, fem, style) {
    style = style || defaultHairStyle(fem ? 'F' : 'M');
    if (style === 'bald') return;
    const cx = s * hx, cy = s * hy, r = s * hr, O = VG_OUT, lw = Math.max(0.6, s * 0.0125), big = r >= 6.5;
    const hl = vgShade(hair, .3), hd = vgShade(hair, -.4);
    const grad = (y0, y1) => vgLin(ctx, 0, cy + r * y0, 0, cy + r * y1, [[0, vgShade(hair, .2)], [.45, hair], [1, hd]]);
    const outline = (pts, w) => { fcSmooth(ctx, pts); ctx.strokeStyle = O; ctx.lineWidth = lw * (w || .8); ctx.lineJoin = 'round'; ctx.stroke(); };
    const strands = (pts, n, yEnd) => {
        if (!big) return;
        ctx.save(); fcSmooth(ctx, pts); ctx.clip();
        for (let i = -n; i <= n; i++) {
            const t = i / n;
            ctx.beginPath(); ctx.moveTo(cx + t * r * .25, cy - r * 1.18);
            ctx.quadraticCurveTo(cx + t * r * .95, cy - r * .85, cx + t * r * 1.05, cy - r * yEnd + Math.abs(t) * r * .2);
            ctx.strokeStyle = i % 2 ? hd : hl; ctx.globalAlpha = .5; ctx.lineWidth = lw * .55; ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(cx - r * .7, cy - r * .95); ctx.quadraticCurveTo(cx, cy - r * 1.32, cx + r * .7, cy - r * .92);
        ctx.strokeStyle = hl; ctx.globalAlpha = .6; ctx.lineWidth = lw * 1.4; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.restore();
    };
    const OUT = {
        fem: [[-1.1, .6], [-1.16, -.25], [-.95, -.9], [-.4, -1.25], [.35, -1.27], [.95, -.9], [1.16, -.25], [1.1, .6]],
        male: [[-1.07, .38], [-1.13, -.35], [-.82, -.95], [-.2, -1.24], [.5, -1.17], [1.0, -.78], [1.13, -.2], [1.07, .38]],
        tight: [[-1.04, .3], [-1.08, -.35], [-.8, -.95], [-.2, -1.2], [.5, -1.15], [1.0, -.8], [1.1, -.2], [1.04, .3]]
    };
    const IN = {
        fem: [[.95, .28], [.9, -.2], [.6, -.52], [.15, -.46], [-.3, -.64], [-.7, -.32], [-.95, .28]],
        male: [[.92, .14], [.84, -.34], [.52, -.58], [.12, -.5], [-.3, -.66], [-.72, -.4], [-.92, .14]],
        centre: [[.95, .28], [.9, -.2], [.55, -.55], [0, -.7], [-.55, -.55], [-.9, -.2], [-.95, .28]],
        slick: [[.92, .1], [.8, -.4], [.4, -.7], [0, -.72], [-.4, -.7], [-.8, -.4], [-.92, .1]]
    };
    const cap = (o, i, lock) => {
        const pts = fcApply(o.concat(i), cx, cy, r);
        fcSmooth(ctx, pts); ctx.fillStyle = grad(-1.25, .3); ctx.fill();
        strands(pts, 6, o === OUT.fem ? .1 : .15);
        outline(pts);
        if (lock) {      // locks that frame the face
            for (const sg of [-1, 1]) {
                const l = fcApply([[1.0, -.1], [1.2, .5], [1.28, 1.3], [1.12, 2.1], [.95, 1.6], [.9, .9], [.88, .3]].map(p => [p[0] * sg, p[1]]), cx, cy, r);
                fcSmooth(ctx, l); ctx.fillStyle = grad(-.1, 2.1); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .7; ctx.stroke();
                if (big) vgPath(ctx, 1, fcApply([[1.05 * sg, .1], [1.14 * sg, .9], [1.08 * sg, 1.7]], cx, cy, r), hl, lw * .5);
            }
        }
        return pts;
    };
    if (style === 'long') cap(OUT.fem, IN.fem, true);
    else if (style === 'bob') cap(OUT.fem, IN.fem, false);
    else if (style === 'short' || style === 'ponytail') cap(OUT.male, IN.male, false);
    else if (style === 'bun') {
        cap(OUT.tight, IN.slick, false);
        const bx = cx, by = cy - r * 1.42, br = r * .5;
        const bg = ctx.createRadialGradient(bx - br * .3, by - br * .3, br * .1, bx, by, br * 1.1);
        bg.addColorStop(0, vgShade(hair, .25)); bg.addColorStop(1, hd);
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .8; ctx.stroke();
        if (big) { ctx.strokeStyle = hl; ctx.globalAlpha = .5; ctx.lineWidth = lw * .6; ctx.beginPath(); ctx.arc(bx, by, br * .6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.globalAlpha = 1; }
    } else if (style === 'braids') {
        cap(OUT.fem, IN.centre, false);
        for (const sg of [-1, 1]) {
            const links = 8;
            for (let k = 0; k < links; k++) {
                const t = k / (links - 1), x = cx + sg * r * (1.15 + Math.sin(t * 3) * .06), y = cy + r * (.35 + t * 2.3), lr = r * (.26 - t * .08);
                const g = ctx.createRadialGradient(x - lr * .3, y - lr * .3, lr * .1, x, y, lr * 1.1);
                g.addColorStop(0, vgShade(hair, .2)); g.addColorStop(1, hd);
                ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, lr * 1.1, lr * 1.25, 0, 0, 7); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .6; ctx.stroke();
            }
            vgPath(ctx, 1, fcApply([[sg * 1.1, 2.75], [sg * 1.18, 3.0]], cx, cy, r), '#fbbf24', lw * 1.6);   // tie
        }
    } else if (style === 'curly') {
        const puffs = [];
        for (let a = 0; a < 13; a++) { const an = Math.PI * (1.02 + a * 0.077); puffs.push([Math.cos(an) * 1.08, Math.sin(an) * 1.02 - .08, .36 + (a % 3) * .05]); }
        puffs.push([0, -.95, .5], [-.5, -.85, .42], [.5, -.85, .42]);
        ctx.save();
        puffs.forEach(([px, py, pr], i) => {
            const x = cx + px * r, y = cy + py * r, rr = pr * r;
            const g = ctx.createRadialGradient(x - rr * .3, y - rr * .3, rr * .1, x, y, rr * 1.1);
            g.addColorStop(0, i % 2 ? vgShade(hair, .2) : vgShade(hair, .05)); g.addColorStop(1, hd);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw * .6; ctx.stroke();
        });
        ctx.restore();
    } else if (style === 'mohawk') {
        // shaved sides show as a faint shadow, a crest of hair runs from front to back
        ctx.fillStyle = hair; ctx.globalAlpha = .16;
        fcSmooth(ctx, fcApply(OUT.tight.concat(IN.slick), cx, cy, r)); ctx.fill(); ctx.globalAlpha = 1;
        const crest = fcApply([[-.2, -.6], [.2, -.6], [.34, -1.1], [.3, -1.55], [.12, -1.95], [0, -2.05], [-.12, -1.95], [-.3, -1.55], [-.34, -1.1]], cx, cy, r);
        fcSmooth(ctx, crest); ctx.fillStyle = vgLin(ctx, 0, cy - r * 2.05, 0, cy - r * .6, [[0, vgShade(hair, .25)], [1, hd]]); ctx.fill(); outline(crest);
        if (big) for (let k = -2; k <= 2; k++) vgPath(ctx, 1, fcApply([[k * .06, -.65], [k * .09, -1.9]], cx, cy, r), k % 2 ? hd : hl, lw * .5);
    } else if (style === 'buzz') {
        const pts = fcApply(OUT.tight.map(p => [p[0] * .985, p[1] * .96 + .03]).concat(IN.slick), cx, cy, r);
        fcSmooth(ctx, pts); ctx.fillStyle = hair; ctx.globalAlpha = .62; ctx.fill(); ctx.globalAlpha = 1;
        if (big) { ctx.save(); fcSmooth(ctx, pts); ctx.clip(); ctx.fillStyle = hd; ctx.globalAlpha = .45;
            for (let i = 0; i < 60; i++) { const a = faceHash('bz' + i); ctx.fillRect(cx + (((a & 255) / 255) * 2.2 - 1.1) * r, cy - r * (.7 + ((a >> 8 & 255) / 255) * .5), Math.max(.5, r * .03), Math.max(.5, r * .03)); }
            ctx.restore(); ctx.globalAlpha = 1; }
        outline(pts, .55);
    }
}

// the hero without clothes (character creation): skin, simple undergarments, no gear
function heroBareBody(ctx, s, o) {
    const { skin, skinD, fem, lw, O, lin, arm } = o;
    const cloth = '#d6d3c4', clothD = '#8d8a78';
    const sk = (x0, y0, x1, y1) => lin(x0, y0, x1, y1, vgShade(skin, .08), skinD);
    // legs and bare feet
    const lx = fem ? 0.015 : 0;
    vgPoly(ctx, s, [[.40 + lx, .62], [.49, .62], [.48, .90], [.38 + lx, .90]], sk(.38, 0, .5, 0), O, lw);
    vgPoly(ctx, s, [[.51, .62], [.60 - lx, .62], [.62 - lx, .90], [.52, .90]], sk(.5, 0, .62, 0), O, lw);
    vgEll(ctx, s * (.425 + lx / 2), s * .925, s * .075, s * .028, skin, O, lw * .8);
    vgEll(ctx, s * (.575 - lx / 2), s * .925, s * .075, s * .028, skin, O, lw * .8);
    vgPath(ctx, s, [[.44 + lx, .74], [.45, .78]], 'rgba(60,20,10,.18)', lw); vgPath(ctx, s, [[.56 - lx, .74], [.55, .78]], 'rgba(60,20,10,.18)', lw);
    // torso
    const torso = fem ? [[.37, .40], [.63, .40], [.605, .54], [.635, .65], [.365, .65], [.395, .54]] : [[.34, .40], [.66, .40], [.635, .65], [.365, .65]];
    vgPoly(ctx, s, torso, sk(.34, 0, .66, 0), O, lw);
    ctx.save();
    ctx.beginPath(); torso.forEach((p, i) => (i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s))); ctx.closePath(); ctx.clip();
    ctx.fillStyle = vgLin(ctx, s * .34, 0, s * .66, 0, [[0, 'rgba(255,255,255,.14)'], [.5, 'rgba(255,255,255,0)'], [1, 'rgba(60,20,10,.28)']]); ctx.fillRect(0, s * .38, s, s * .3);
    ctx.strokeStyle = 'rgba(80,30,15,.28)'; ctx.lineWidth = lw * .6;
    ctx.beginPath(); ctx.moveTo(s * .5, s * .45); ctx.lineTo(s * .5, s * .62); ctx.stroke();                                    // breastbone / navel line
    if (!fem) { ctx.beginPath(); ctx.moveTo(s * .41, s * .5); ctx.quadraticCurveTo(s * .46, s * .53, s * .5, s * .5); ctx.quadraticCurveTo(s * .54, s * .53, s * .59, s * .5); ctx.stroke(); }
    ctx.restore();
    // undergarments: a plain bandeau and shorts for her, shorts for him
    if (fem) vgPoly(ctx, s, [[.385, .445], [.615, .445], [.61, .51], [.39, .51]], vgLin(ctx, 0, s * .445, 0, s * .51, [[0, cloth], [1, clothD]]), O, lw * .8);
    vgPoly(ctx, s, [[.375, .60], [.625, .60], [.64, .72], [.51, .70], [.49, .70], [.36, .72]], vgLin(ctx, 0, s * .6, 0, s * .72, [[0, cloth], [1, clothD]]), O, lw);
    vgPath(ctx, s, [[.375, .615], [.625, .615]], 'rgba(60,50,30,.5)', lw * .8);
    // bare arms
    arm(.35, .44, .26, .58, skin);
    arm(.65, .44, .74, .58, skin);
}
