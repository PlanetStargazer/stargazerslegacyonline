// =====================================================================================================
// THE DEATH SCREEN - two valkyries carry the fallen champion up into the heavens.
// showDeathScreen({ name, cls, race, look }, onOk) fills the screen, plays the scene and calls onOk when the
// player confirms. Uses the vg* helpers from game.js and the face/hair helpers from heroart.js.
// =====================================================================================================

// One valkyrie, facing right, centred on (0,0); `S` is her height in pixels.
function drawValkyrie(ctx, S, t, hairCol, phase) {
    const O = VG_OUT, lw = Math.max(1, S * 0.012);
    const P = (pts, fill, stroke, w) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S)));
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w || lw; ctx.lineJoin = 'round'; ctx.stroke(); }
    };
    const L = (x0, y0, x1, y1, a, b) => vgLin(ctx, x0 * S, y0 * S, x1 * S, y1 * S, [[0, a], [1, b]]);
    const flap = Math.sin(t * 3.2 + phase);
    const gold = ['#fff3b0', '#d4961a'], white = ['#ffffff', '#c7d7f2'];

    // wings: two fans of feathers swept up and back, beating slowly
    for (const layer of [0, 1]) {
        const n = 8, base = layer ? 0.9 : 1.0;
        for (let i = 0; i < n; i++) {
            const k = i / (n - 1);
            const ang = -Math.PI * (0.98 - 0.52 * k) + flap * 0.22 * (0.4 + k) + layer * 0.06;
            const len = (0.34 + 0.24 * Math.sin(k * Math.PI * 0.9 + 0.3)) * base, wd = 0.058 * base;
            ctx.save();
            ctx.translate(-0.045 * S, -0.115 * S);
            ctx.rotate(ang);
            P([[0, 0], [len * 0.35, -wd], [len * 0.8, -wd * 0.85], [len, 0], [len * 0.8, wd * 0.85], [len * 0.35, wd]],
                L(0, 0, len, 0, layer ? '#b4c6ea' : '#ffffff', layer ? '#8ea4d4' : '#dbe6fa'), 'rgba(71,85,125,.75)', lw * 0.8);
            ctx.beginPath(); ctx.moveTo(len * 0.06 * S, 0); ctx.lineTo(len * 0.92 * S, 0); ctx.strokeStyle = 'rgba(100,116,170,.5)'; ctx.lineWidth = lw * 0.6; ctx.stroke();
            ctx.restore();
        }
    }
    // flowing robe, folds, gold hem and a trailing sash
    const wave = Math.sin(t * 2.6 + phase) * 0.03, wave2 = Math.sin(t * 2.1 + phase + 1) * 0.025;
    P([[-0.07, -0.01], [0.07, -0.01], [0.085, 0.1], [0.12, 0.26], [0.07 + wave, 0.42], [-0.02 + wave2, 0.46], [-0.13 + wave, 0.43 + wave2], [-0.2 + wave2, 0.3], [-0.12, 0.12]], L(0, 0, 0, 0.46, '#ffffff', '#b9cdee'), O, lw);
    ctx.save();
    ctx.beginPath(); [[-0.07, -0.01], [0.07, -0.01], [0.085, 0.1], [0.12, 0.26], [0.07 + wave, 0.42], [-0.02 + wave2, 0.46], [-0.13 + wave, 0.43 + wave2], [-0.2 + wave2, 0.3], [-0.12, 0.12]].forEach(([x, y], i) => (i ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S))); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = 'rgba(100,125,180,.35)'; ctx.lineWidth = lw * 0.8;
    [[-0.04, 0.02, -0.08 + wave2, 0.45], [0.0, 0.03, -0.02 + wave2, 0.46], [0.04, 0.02, 0.05 + wave, 0.44], [0.07, 0.05, 0.11 + wave, 0.4]].forEach(([x0, y0, x1, y1]) => { ctx.beginPath(); ctx.moveTo(x0 * S, y0 * S); ctx.quadraticCurveTo((x0 + x1) / 2 * S + wave * S, (y0 + y1) / 2 * S, x1 * S, y1 * S); ctx.stroke(); });
    ctx.fillStyle = L(0.5, 0, 0.12, 0, 'rgba(0,0,0,0)', 'rgba(60,80,140,.25)'); ctx.fillRect(0, 0, 0.14 * S, 0.5 * S);
    ctx.strokeStyle = '#e8b830'; ctx.lineWidth = lw * 2;
    ctx.beginPath(); ctx.moveTo(-0.2 * S + wave2 * S, 0.3 * S); ctx.quadraticCurveTo(-0.13 * S, 0.45 * S, -0.02 * S + wave2 * S, 0.46 * S); ctx.quadraticCurveTo(0.04 * S, 0.45 * S, 0.07 * S + wave * S, 0.42 * S); ctx.stroke();
    ctx.restore();
    P([[-0.06, 0.0], [-0.24 + wave * 2, 0.16], [-0.34 + wave * 2, 0.3 + wave], [-0.2, 0.2], [-0.07, 0.07]], L(-0.3, 0, 0, 0.1, '#fde68a', '#f59e0b'), O, lw * 0.8);
    // back arm with a spear raised behind her
    ctx.beginPath(); ctx.moveTo(-0.03 * S, -0.1 * S); ctx.lineTo(0.09 * S, -0.2 * S);
    ctx.strokeStyle = O; ctx.lineWidth = S * 0.04 + lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#f4e3c6'; ctx.lineWidth = S * 0.04; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.06 * S, 0.06 * S); ctx.lineTo(0.2 * S, -0.52 * S); ctx.strokeStyle = O; ctx.lineWidth = S * 0.02 + lw; ctx.stroke(); ctx.strokeStyle = '#9a6b2f'; ctx.lineWidth = S * 0.02; ctx.stroke();
    P([[0.2, -0.6], [0.228, -0.5], [0.2, -0.485], [0.172, -0.5]], L(0.17, -0.6, 0.23, -0.5, '#ffffff', '#94a3b8'), O, lw * 0.8);
    // torso: golden breastplate over a white tunic
    P([[-0.085, -0.15], [0.085, -0.15], [0.07, 0.01], [-0.07, 0.01]], L(-0.08, -0.15, 0.08, 0, gold[0], gold[1]), O, lw);
    P([[-0.09, -0.15], [0.0, -0.1], [0.09, -0.15], [0.06, -0.05], [0.0, -0.02], [-0.06, -0.05]], 'rgba(255,255,255,.35)', null);
    ctx.beginPath(); ctx.moveTo(0, -0.14 * S); ctx.lineTo(0, 0.0); ctx.strokeStyle = 'rgba(120,70,10,.5)'; ctx.lineWidth = lw * 0.8; ctx.stroke();
    P([[-0.085, -0.005], [0.085, -0.005], [0.09, 0.025], [-0.09, 0.025]], '#a16207', O, lw * 0.7);
    // neck, face, hair
    const hx = 0.01, hy = -0.235, hr = 0.062;
    P([[-0.02, -0.17], [0.03, -0.17], [0.03, -0.14], [-0.02, -0.14]], '#e9bf98', O, lw * 0.7);
    heroHairBack(ctx, S, hx, hy, hr, hairCol);
    heroFaceDraw(ctx, S, hx, hy, hr, { race: 'Human', fem: true, skin: '#fde3c4', skinD: '#c08a5c', hair: hairCol });
    heroHairFront(ctx, S, hx, hy, hr, hairCol, true);
    // winged helm: a golden band with a small wing at each temple
    P([[hx - hr * 1.0, hy - hr * 0.55], [hx + hr * 1.0, hy - hr * 0.55], [hx + hr * 0.9, hy - hr * 0.8], [hx, hy - hr * 1.12], [hx - hr * 0.9, hy - hr * 0.8]], L(0, hy - hr * 1.1, 0, hy - hr * 0.5, gold[0], gold[1]), O, lw * 0.8);
    for (const sg of [-1, 1]) {
        P([[hx + sg * hr * 0.95, hy - hr * 0.7], [hx + sg * hr * 2.2, hy - hr * 1.7 + flap * hr * 0.15], [hx + sg * hr * 1.9, hy - hr * 0.9], [hx + sg * hr * 2.2, hy - hr * 0.5], [hx + sg * hr * 1.0, hy - hr * 0.35]], '#ffffff', 'rgba(71,85,125,.8)', lw * 0.7);
    }
    // front arm, reaching forward to lift the fallen
    ctx.beginPath(); ctx.moveTo(0.04 * S, -0.115 * S); ctx.lineTo(0.2 * S, -0.02 * S);
    ctx.strokeStyle = O; ctx.lineWidth = S * 0.045 + lw; ctx.stroke(); ctx.strokeStyle = '#fbe4c4'; ctx.lineWidth = S * 0.045; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.1 * S, -0.075 * S); ctx.lineTo(0.17 * S, -0.035 * S); ctx.strokeStyle = '#e8b830'; ctx.lineWidth = S * 0.05; ctx.stroke();   // golden bracer
    vgBall(ctx, 0.205 * S, -0.015 * S, S * 0.03, '#fde3c4', '#c08a5c', O, lw * 0.8);
    P([[0.07, -0.16], [0.11, -0.175], [0.125, -0.13], [0.075, -0.12]], L(0.07, -0.17, 0.12, -0.12, gold[0], gold[1]), O, lw * 0.8);   // pauldron
}

// the whole scene at time t (seconds) on a W x H canvas
function drawDeathScene(ctx, W, H, t, who) {
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const lift = ease((t - 1.4) / 2.4);                      // 0 = still on the ground, 1 = rising through the sky
    const up = ease((t - 1.4) / 9);                          // how far into the heavens we are
    const m = Math.min(W, H);

    // sky: dusk at the bottom brightens into golden light as they climb
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const top = mix([22, 28, 70], [254, 243, 199], up), mid = mix([62, 44, 110], [253, 224, 160], up), bot = mix([120, 70, 110], [255, 250, 235], up);
    sky.addColorStop(0, `rgb(${top})`); sky.addColorStop(0.55, `rgb(${mid})`); sky.addColorStop(1, `rgb(${bot})`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // stars fade as the day-light of the heavens takes over
    for (let i = 0; i < 90; i++) {
        const a = ((i * 9301 + 49297) % 233280) / 233280, b = ((i * 4903 + 1013) % 233280) / 233280;
        ctx.fillStyle = `rgba(255,255,255,${(0.2 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))) * (1 - up)})`;
        ctx.fillRect(a * W, b * H * 0.7, 1.6, 1.6);
    }
    // light shafts from above
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = -3; i <= 3; i++) {
        const ang = i * 0.16 + Math.sin(t * 0.25 + i) * 0.03, x0 = W / 2 + i * m * 0.02;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(255,244,200,${0.2 + 0.15 * up})`); g.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - m * 0.02, -10); ctx.lineTo(x0 + m * 0.02, -10);
        ctx.lineTo(x0 + Math.tan(ang) * H + m * 0.12, H); ctx.lineTo(x0 + Math.tan(ang) * H - m * 0.12, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // clouds drifting down past the climbers (parallax in three layers)
    const cloud = (cx, cy, s, a) => {
        for (let k = 0; k < 6; k++) {
            const ox = (k - 2.5) * s * 0.45, oy = Math.sin(k * 2.1) * s * 0.12, r = s * (0.45 + 0.12 * Math.cos(k * 1.7));
            const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
            g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, 7); ctx.fill();
        }
    };
    for (let layer = 0; layer < 3; layer++) {
        const speed = (0.05 + layer * 0.07) * H, size = m * (0.16 + layer * 0.1), n = 5;
        for (let i = 0; i < n; i++) {
            const seed = i * 977 + layer * 313, x = ((seed % 1000) / 1000) * W * 1.1 - W * 0.05;
            const y = ((((seed * 7) % 1000) / 1000) * H * 1.4 + (t - 1.2) * speed * lift) % (H * 1.4) - H * 0.2;
            cloud(x + Math.sin(t * 0.2 + i) * 8, y, size, 0.18 + layer * 0.12);
        }
    }

    // the hillside where the hero fell, sinking away as they rise
    const groundY = H * 0.78 + lift * H * 0.9;
    if (groundY < H + 40) {
        ctx.fillStyle = '#1b2a1f';
        ctx.beginPath(); ctx.moveTo(0, H + 40); ctx.lineTo(0, groundY + 30);
        for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, groundY - Math.sin(x * 0.004 + 1) * m * 0.05 - Math.sin(x * 0.011) * m * 0.02);
        ctx.lineTo(W, H + 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2f4a30'; ctx.fillRect(0, groundY + 10 - 0, 0, 0);
    }

    // hero, lying on the valkyries' arms
    const hs = m * 0.44, cx = W / 2, bob = Math.sin(t * 1.4) * m * 0.008;
    const heroY = H * 0.72 - lift * H * 0.22 + bob;
    const ven = ease((t - 0.2) / 1.6);                         // valkyries swoop in first
    const vs = m * 0.52;
    const vy = heroY + hs * 0.17 + vs * 0.015 - (1 - ven) * H * 0.8;
    const dx = hs * 0.27 + vs * 0.205;
    // soul glow
    const glow = ctx.createRadialGradient(cx, heroY, 0, cx, heroY, m * 0.6);
    glow.addColorStop(0, `rgba(255,236,170,${0.25 + 0.3 * lift})`); glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, heroY, m * 0.6, 0, 7); ctx.fill();

    ctx.save();
    ctx.translate(cx, heroY); ctx.rotate(-Math.PI / 2 + Math.sin(t * 1.1) * 0.02);
    ctx.globalAlpha = 0.97;
    try { drawHeroCharacterVector(ctx, -hs / 2, -hs / 2, hs, who.cls, false, who.race, who.look || {}); } catch (e) { /* art is optional */ }
    ctx.restore();
    ctx.save(); ctx.translate(cx - dx, vy); drawValkyrie(ctx, vs, t, '#e8c15a', 0); ctx.restore();
    ctx.save(); ctx.translate(cx + dx, vy); ctx.scale(-1, 1); drawValkyrie(ctx, vs, t, '#a8321e', 1.7); ctx.restore();
    // rising feathers
    for (let i = 0; i < 16; i++) {
        const k = (t * 0.12 + i / 16) % 1, fx = W * (0.15 + 0.7 * ((i * 53) % 100) / 100) + Math.sin(t * 1.5 + i) * 18, fy = H * k * 1.1 - H * 0.05;
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(t + i) * 0.8); ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - Math.abs(k - 0.5) * 1.6)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, m * 0.012, m * 0.004, 0, 0, 7); ctx.fill(); ctx.restore();
    }
}

const Death = { active: false, raf: 0, t0: 0, who: null, cb: null };

function showDeathScreen(who, onOk) {
    const ov = document.getElementById('death-overlay');
    if (!ov || Death.active) { if (onOk) onOk(); return; }
    Death.active = true; Death.who = who; Death.cb = onOk; Death.t0 = performance.now();
    document.getElementById('death-name').textContent = `${who.name} the ${who.race} ${who.cls}`;
    ov.classList.remove('hidden');
    const ok = document.getElementById('death-ok');
    ok.classList.add('invisible');
    const cv = document.getElementById('death-canvas'), ctx = cv.getContext('2d');
    const text = document.getElementById('death-text');
    text.style.opacity = '0';
    const frame = () => {
        if (!Death.active) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, h = window.innerHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = (performance.now() - Death.t0) / 1000;
        drawDeathScene(ctx, w, h, t, Death.who);
        text.style.opacity = String(Math.max(0, Math.min(1, (t - 0.8) / 1.5)));
        if (t > 2.6) ok.classList.remove('invisible');
        Death.raf = requestAnimationFrame(frame);
    };
    frame();
}

function closeDeathScreen() {
    if (!Death.active) return;
    const t = (performance.now() - Death.t0) / 1000;
    if (t < 2.6) return;                                    // let the scene play before it can be skipped
    Death.active = false;
    cancelAnimationFrame(Death.raf);
    document.getElementById('death-overlay').classList.add('hidden');
    const cb = Death.cb; Death.cb = null;
    if (cb) cb();
}

// while the scene is up, Enter / Space / Esc confirm it and nothing else reaches the game
window.addEventListener('keydown', (e) => {
    if (!Death.active) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') closeDeathScreen();
}, true);
window.addEventListener('DOMContentLoaded', () => {
    const ok = document.getElementById('death-ok');
    if (ok) ok.addEventListener('click', closeDeathScreen);
});
