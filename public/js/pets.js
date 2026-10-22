// Pets: cosmetic dogs and cats that trot behind the hero (never in combat). A pet is identified by a key 's:breed:colour'
// (s = d dog | c cat | p parrot). Every breed has a few colourings, so there are dozens of different animals.
// Loaded before game.js; uses the vg* drawing helpers at call time.

const PET_BREEDS = {
    d: {
        labrador: { name: 'Labrador', ear: 'floppy', snout: 1.0, scale: 1.05, tail: 'long', fur: 'short', colors: [
            { n: 'Yellow', c1: '#e8c46c', c2: '#c9a24d', pat: 'solid' }, { n: 'Black', c1: '#33302e', c2: '#1b1918', pat: 'solid' }, { n: 'Chocolate', c1: '#6b4528', c2: '#472c17', pat: 'solid' }] },
        terrier: { name: 'Terrier', ear: 'fold', snout: .8, scale: .82, tail: 'up', fur: 'short', colors: [
            { n: 'White & Tan', c1: '#f4efe6', c2: '#b7814d', pat: 'patch' }, { n: 'Black & Tan', c1: '#2a2624', c2: '#b7814d', pat: 'points' }] },
        husky: { name: 'Husky', ear: 'point', snout: .85, scale: 1.0, tail: 'curl', fur: 'fluffy', colors: [
            { n: 'Grey & White', c1: '#9aa3ad', c2: '#f4f4f5', pat: 'mask' }, { n: 'Black & White', c1: '#26282c', c2: '#f4f4f5', pat: 'mask' }, { n: 'Red & White', c1: '#c0713a', c2: '#fafafa', pat: 'mask' }] },
        shepherd: { name: 'Shepherd', ear: 'point', snout: 1.05, scale: 1.12, tail: 'bushy', fur: 'short', colors: [
            { n: 'Black & Tan', c1: '#c9955a', c2: '#1f1b19', pat: 'saddle' }, { n: 'Sable', c1: '#a8794a', c2: '#3a2a1c', pat: 'saddle' }] },
        dalmatian: { name: 'Dalmatian', ear: 'floppy', snout: .95, scale: 1.05, tail: 'long', fur: 'short', colors: [
            { n: 'Black Spots', c1: '#faf7f2', c2: '#1c1917', pat: 'spots' }, { n: 'Liver Spots', c1: '#faf7f2', c2: '#6b3b22', pat: 'spots' }] },
        corgi: { name: 'Corgi', ear: 'point', snout: .85, scale: .95, legs: 'short', tail: 'stub', fur: 'short', colors: [
            { n: 'Red & White', c1: '#d9893f', c2: '#fbf6ee', pat: 'mask' }, { n: 'Tricolour', c1: '#3a2f2a', c2: '#fbf6ee', pat: 'points' }] },
        poodle: { name: 'Poodle', ear: 'round', snout: .9, scale: .9, tail: 'pom', fur: 'fluffy', colors: [
            { n: 'White', c1: '#fafafa', c2: '#d4d4d8', pat: 'solid' }, { n: 'Black', c1: '#2e2e33', c2: '#18181b', pat: 'solid' }, { n: 'Apricot', c1: '#e8b887', c2: '#c68c55', pat: 'solid' }] },
        beagle: { name: 'Beagle', ear: 'floppy', snout: .9, scale: .88, tail: 'up', fur: 'short', colors: [
            { n: 'Tricolour', c1: '#f6f0e6', c2: '#8a5a32', pat: 'saddle' }] }
    },
    c: {
        tabby: { name: 'Tabby', ear: 'point', snout: .5, scale: .8, tail: 'long', fur: 'short', colors: [
            { n: 'Orange', c1: '#e8964a', c2: '#a4561c', pat: 'stripes' }, { n: 'Grey', c1: '#9ca3ad', c2: '#4b5563', pat: 'stripes' }, { n: 'Brown', c1: '#8a6a45', c2: '#3d2b17', pat: 'stripes' }] },
        siamese: { name: 'Siamese', ear: 'point', snout: .55, scale: .8, tail: 'long', fur: 'short', colors: [
            { n: 'Seal Point', c1: '#efe2cc', c2: '#4a3528', pat: 'points' }, { n: 'Blue Point', c1: '#eef0f3', c2: '#6b7a90', pat: 'points' }] },
        persian: { name: 'Persian', ear: 'round', snout: .4, scale: .88, tail: 'bushy', fur: 'fluffy', colors: [
            { n: 'White', c1: '#fbfbfb', c2: '#d4d4d8', pat: 'solid' }, { n: 'Smoke Grey', c1: '#8b929c', c2: '#5b6370', pat: 'solid' }, { n: 'Cream', c1: '#f2dfb8', c2: '#d9bd86', pat: 'solid' }] },
        black: { name: 'Shadow Cat', ear: 'point', snout: .5, scale: .78, tail: 'long', fur: 'short', colors: [
            { n: 'Black', c1: '#2b2b30', c2: '#131316', pat: 'solid' }] },
        calico: { name: 'Calico', ear: 'point', snout: .5, scale: .8, tail: 'long', fur: 'short', colors: [
            { n: 'Calico', c1: '#fbf7f0', c2: '#e08a3c', c3: '#26262a', pat: 'calico' }] },
        tuxedo: { name: 'Tuxedo', ear: 'point', snout: .5, scale: .82, tail: 'long', fur: 'short', colors: [
            { n: 'Black & White', c1: '#26262a', c2: '#fafafa', pat: 'tuxedo' }] },
        mainecoon: { name: 'Maine Coon', ear: 'tuft', snout: .6, scale: 1.0, tail: 'bushy', fur: 'fluffy', colors: [
            { n: 'Brown Tabby', c1: '#8d6a43', c2: '#3f2c18', pat: 'stripes' }, { n: 'Silver', c1: '#a8afb8', c2: '#4a5260', pat: 'stripes' }] },
        russian: { name: 'Russian Blue', ear: 'point', snout: .5, scale: .82, tail: 'long', fur: 'short', colors: [
            { n: 'Blue Grey', c1: '#8591a3', c2: '#5d6879', pat: 'solid' }] }
    }
};
PET_BREEDS.p = {
    macaw: { name: 'Macaw', scale: 1, tail: 1.1, colors: [
        { n: 'Scarlet', c1: '#dc2626', c2: '#2563eb', c3: '#facc15', bk: '#f1ead8' }, { n: 'Blue-and-Gold', c1: '#2563eb', c2: '#1e40af', c3: '#f5b81b', bk: '#262626' }, { n: 'Green-winged', c1: '#b91c1c', c2: '#16a34a', c3: '#f59e0b', bk: '#f1ead8' }] },
    grey: { name: 'African Grey', scale: .9, tail: .8, colors: [
        { n: 'Grey', c1: '#9ca3af', c2: '#6b7280', c3: '#e5e7eb', bk: '#262626', tl: '#dc2626' }] },
    cockatiel: { name: 'Cockatiel', scale: .8, tail: .9, colors: [
        { n: 'Grey', c1: '#9ca3af', c2: '#6b7280', c3: '#fde047', bk: '#6b7280', cheek: '#fb923c' }, { n: 'Lutino', c1: '#fde68a', c2: '#fef9c3', c3: '#fde047', bk: '#d6b370', cheek: '#fb923c' }] },
    budgie: { name: 'Budgie', scale: .7, tail: .8, colors: [
        { n: 'Green', c1: '#4ade80', c2: '#166534', c3: '#fde047', bk: '#f1c27d' }, { n: 'Sky Blue', c1: '#60a5fa', c2: '#1e3a8a', c3: '#f1f5f9', bk: '#f1c27d' }, { n: 'Yellow', c1: '#fde047', c2: '#ca8a04', c3: '#fef9c3', bk: '#f1c27d' }] },
    lorikeet: { name: 'Lorikeet', scale: .85, tail: .9, colors: [
        { n: 'Rainbow', c1: '#22c55e', c2: '#2563eb', c3: '#f97316', bk: '#f97316' }] }
};
const PET_PRICE = 500;
function petParse(key) {
    const m = /^([dcp]):([a-z]+):(\d)$/.exec(key || '');
    if (!m) return null;
    const br = PET_BREEDS[m[1]][m[2]];
    if (!br || !br.colors[+m[3]]) return null;
    return { species: m[1], breed: m[2], ci: +m[3], br, col: br.colors[+m[3]] };
}
function petName(key) { const p = petParse(key); return p ? (p.col.n === p.br.name ? p.col.n : `${p.col.n} ${p.br.name}`) : 'Pet'; }
function petAllKeys(species) {
    const out = [];
    Object.keys(PET_BREEDS[species]).forEach(b => PET_BREEDS[species][b].colors.forEach((_, i) => out.push(`${species}:${b}:${i}`)));
    return out;
}

// The pets use the very same dog and cat art as the animals roaming the towns (drawAnimalVector in game.js);
// breed and colouring only change the palette and the size.
const PET_PALS = {};
function petPalette(P) {
    const col = P.col, c1 = col.c1, c2 = col.c2, dog = P.species === 'd';
    const sh = (c, a) => (typeof vgShade === 'function' ? vgShade(c, a) : c);
    const pt = col.pat === 'points', pal = { body: c1, dark: pt || col.pat === 'stripes' ? c2 : sh(c1, -.3) };
    pal.belly = (col.pat === 'mask' || col.pat === 'tuxedo') ? c2 : sh(c1, .25);
    if (pal.belly === c1) pal.belly = sh(c1, .25);
    if (dog) {
        pal.ear = (pt || col.pat === 'mask' || col.pat === 'saddle' || col.pat === 'patch' || col.pat === 'spots') ? c2 : sh(c1, -.3);
        if (col.pat === 'patch' || col.pat === 'saddle' || col.pat === 'spots') pal.patch = c2;
        if (col.pat === 'spots') pal.spots = c2;
    } else {
        pal.eye = pt ? '#7dd3fc' : '#a3e635';
        if (col.pat === 'stripes') pal.stripe = true;
        if (col.pat === 'calico') pal.patches = [c2, col.c3 || c2];
        if (col.pat === 'tuxedo') pal.patches = [c2];
    }
    return pal;
}
// draws one pet standing in a size x size box at (px, py), facing right (face = -1 flips it), t = animation clock, moving = trotting
// still = ms the owner has stood still: a pet stands for the first 5 s, then sits (and a cat sits grooming itself now and then); undefined = just sits
function drawPetVector(ctx, px, py, size, key, t, face, moving, still) {
    const P = petParse(key);
    if (!P) return;
    if (P.species === 'p') { drawParrot(ctx, px, py, size * P.br.scale, P.col, P.br, t, moving ? 'fly' : 'perch', face); return; }
    const pk = P.species + P.breed + P.ci;
    const pal = PET_PALS[pk] || (PET_PALS[pk] = petPalette(P));
    const as = size * 0.74 * P.br.scale;                                  // pets are smaller than a tile
    drawAnimalVector(ctx, px + (size - as) / 2, py + (size - as) * 0.95, as, P.species === 'd' ? 'dog' : 'cat', pal, face, moving ? t : (still < 5000 ? 0 : t), moving || still < 5000 ? 'walk' : (still > 8000 && P.species === 'c' && Math.floor(Date.now() / 3500 + (P.ci + P.breed.length) * 0.37) % 2 === 0 ? 'groom' : 'sit'));
}

// a parrot in a size x size box (feet at the bottom middle when perched), facing right (face = -1 flips it)
function drawParrot(ctx, px, py, size, col, br, t, mode, face) {
    const s = size, O = 'rgba(25,18,14,.9)', lw = Math.max(0.7, s * 0.03), fly = mode === 'fly';
    const sh = (c, a) => (typeof vgShade === 'function' ? vgShade(c, a) : c);
    ctx.save();
    ctx.translate(px + s / 2, py); ctx.scale(face < 0 ? -1 : 1, 1); ctx.translate(-s / 2, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const ell = (x, y, rx, ry, rot, fill) => { ctx.beginPath(); ctx.ellipse(s * x, s * y, s * rx, s * ry, rot || 0, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = O; ctx.lineWidth = lw; ctx.stroke(); };
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](s * p[0], s * p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw; ctx.stroke(); };
    const tl = br.tail, tailC = col.tl || col.c2;
    const beak = (x, y) => {                                                    // a hooked beak, root at (x, y)
        ctx.beginPath(); ctx.moveTo(s * x, s * (y - .05)); ctx.quadraticCurveTo(s * (x + .17), s * (y - .06), s * (x + .13), s * (y + .09)); ctx.quadraticCurveTo(s * (x + .1), s * (y + .03), s * x, s * (y + .05)); ctx.closePath();
        ctx.fillStyle = col.bk; ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = lw; ctx.stroke();
    };
    const eye = (x, y) => { ell(x, y, .035, .035, 0, '#fff'); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * (x + .006), s * y, s * .019, 0, 7); ctx.fill(); };
    if (fly) {
        const ph = Math.sin(t * 0.55), bob = Math.sin(t * 0.55 + 1.2) * s * .02;
        ctx.translate(0, bob);
        poly([[.34, .56], [.04, .72 + (tl - 1) * .1], [.1, .86 + (tl - 1) * .1], [.38, .62]], tailC);                                // tail trailing behind
        const wing = (k, c) => {                                                                                                       // k: 1 near wing, .6 far wing
            const tipY = .5 - .42 * ph * k - .06, tipX = .2 + (1 - k) * .1;
            poly([[.56, .5], [.44, .5 - .3 * ph * k - .1], [tipX, tipY], [.3, .5 - .08 * ph * k], [.42, .62]], c);
        };
        wing(.6, sh(col.c2, -.25));
        ell(.52, .56, .24, .13, -.18, col.c1);
        ell(.58, .6, .12, .07, -.18, col.c3);
        wing(1, col.c2);
        ell(.74, .45, .11, .105, 0, col.c1);
        if (col.cheek) ell(.76, .49, .035, .03, 0, col.cheek);
        beak(.82, .46); eye(.77, .42);
    } else {
        poly([[.34, .66], [.24, .88 + (tl - 1) * .1 + .1], [.36, .93 + (tl - 1) * .1 + .06], [.46, .74]], tailC);                       // tail hanging behind the perch
        ell(.47, .55, .19, .3, -.12, col.c1);
        ell(.56, .6, .1, .2, -.12, col.c3);
        ell(.4, .56, .1, .23, -.1, col.c2);                                                                                           // folded wing
        ctx.strokeStyle = sh(col.c2, -.35); ctx.lineWidth = Math.max(.5, s * .015); ctx.beginPath(); ctx.moveTo(s * .36, s * .5); ctx.lineTo(s * .34, s * .66); ctx.moveTo(s * .41, s * .5); ctx.lineTo(s * .4, s * .7); ctx.stroke();
        ell(.57, .25, .15, .15, 0, col.c1);
        if (col.cheek) ell(.6, .3, .045, .04, 0, col.cheek);
        beak(.67, .27); eye(.62, .22);
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = Math.max(.8, s * .035);
        ctx.beginPath(); ctx.moveTo(s * .5, s * .84); ctx.lineTo(s * .5, s * .92); ctx.moveTo(s * .58, s * .82); ctx.lineTo(s * .6, s * .92); ctx.stroke();
    }
    ctx.restore();
}

// draws a pet that belongs to a hero standing on the tile with its top-left at (tx, ty): dogs and cats keep to the hero's left leg,
// a parrot flies in circles overhead while the hero moves and settles on the shoulder once he stands still
function drawPetAt(ctx, tx, ty, tile, key, t, face, moving, still) {
    const P = petParse(key);
    if (!P) return;
    if (P.species !== 'p') {
        const ps = tile * 0.75;                                              // pets are small next to a hero
        drawPetVector(ctx, tx - tile * 0.3 + (tile - ps) / 2, ty + tile - ps, ps, key, t, face, moving, still);
        return;
    }
    const flying = moving || still < 5000;
    if (flying) {
        const sz = tile * 0.5 * P.br.scale, a = t * 0.045;
        const cx = tx + tile * (0.5 + 0.36 * Math.sin(a)), cy = ty + tile * (-0.2 + 0.07 * Math.sin(a * 2.1));
        drawParrot(ctx, cx - sz / 2, cy - sz / 2, sz, P.col, P.br, t, 'fly', Math.cos(a) >= 0 ? 1 : -1);
    } else {
        const sz = tile * 0.4 * P.br.scale;
        drawParrot(ctx, tx + tile * 0.7 - sz / 2, ty + tile * 0.43 - sz * 0.9, sz, P.col, P.br, t, 'perch', -1);
    }
}
