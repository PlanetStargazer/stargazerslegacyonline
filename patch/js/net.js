// =====================================================================================================
// THE STARGAZER'S LEGACY ONLINE - network layer
//
//  * accounts, server saves, the shared world clock and weather
//  * presence (other players on the map / in towns), chat, groups
//  * shared battles: the ambushed player's browser HOSTS the tactical combat, other players join as guests.
//    The host runs the rules and publishes a snapshot of the battlefield after every action; guests send their
//    choices ("intents") through the server and mirror the snapshots. If the host disappears the server hands the
//    battle to another participant, who simply carries on from the last snapshot.
//
//  game.js calls into the `Net` object below; every call is a harmless no-op while nobody is logged in.
// =====================================================================================================
const Net = (() => {
    'use strict';
    const API = 'api.php';
    const TOKEN_KEY = 'SGL_TOKEN';
    const TURN_LIMIT_MS = 45000;      // idle players lose their turn in a shared battle
    const AFK_LIMIT_MS = 8000;        // ... and after the first timeout they are skipped quickly
    const JOIN_RANGE = 1;             // walk this close to a fight to be asked to join
    const GROUP_RANGE = 10;           // group members this close are pulled into the fight automatically

    let token = null;
    try { token = window.localStorage.getItem(TOKEN_KEY); } catch (e) { /* storage unavailable */ }
    let me = null;
    const S = {
        ready: false, polling: false, fails: 0, lastOk: 0, timer: null, saveTimer: null,
        chatSince: 0, evSince: 0, chatUnread: 0,
        near: [], online: [], battles: [], group: null, invites: [], seenInvites: new Set(),
        declined: new Set(), prompt: null,
        battle: null, remoteEnd: false, applyingSnap: false, logBuf: [],
        bubbles: {}, saveDirty: false, lastSave: 0, saveMsg: '', saving: false, plSig: '', grpSig: '',
        authMode: 'login', whisperTo: '', chars: [], max: 6, charId: null, creating: false, friends: [], frSig: ''
    };

    const $ = (id) => document.getElementById(id);
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ------------------------------------------------------------------------------ API
    async function api(action, body) {
        try {
            const res = await fetch(`${API}?a=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-SGL-Token': token || '' },
                body: JSON.stringify(body || {}),
                keepalive: action === 'save'
            });
            let data = null;
            try { data = await res.json(); } catch (e) { data = { ok: false, error: 'Bad server answer.' }; }
            if (data && data.maintenance) { enterMaintenance(); return data; }
            if (res.status === 401 && data && data.auth && me) authLost(data.error);
            return data || { ok: false, error: 'No answer.' };
        } catch (e) {
            return { ok: false, error: 'network', net: true };
        }
    }

    // ------------------------------------------------------------------------------ maintenance
    // While the administrator has closed the realm the title screen shows a sign (and two dwarves hammering it), and no login is offered.
    let maintOn = false, maintRaf = 0, maintPoll = 0, maintDeadline = 0, maintTimer = 0;
    // the 30 second warning: a red countdown in the middle of the screen; at zero everybody goes back to the start menu
    function setMaintCountdown(left) {
        const box = $('maint-warn');
        if (left === null || left === undefined) {
            maintDeadline = 0; clearInterval(maintTimer); maintTimer = 0; box.classList.add('hidden'); return;
        }
        const target = performance.now() + left * 1000;
        if (!maintDeadline || Math.abs(target - maintDeadline) > 1500) maintDeadline = target;
        box.classList.remove('hidden');
        if (maintTimer) return;
        const tick = () => {
            const s = Math.max(0, Math.ceil((maintDeadline - performance.now()) / 1000));
            $('maint-warn-time').textContent = String(s);
            if (s <= 0) {
                clearInterval(maintTimer); maintTimer = 0; maintDeadline = 0; box.classList.add('hidden');
                (me ? saveNow(false) : Promise.resolve()).catch(() => {}).then(() => enterMaintenance());
            }
        };
        tick(); maintTimer = setInterval(tick, 250);
    }
    function enterMaintenance() {
        if (maintOn) return;
        maintOn = true;
        setMaintCountdown(null);
        if (me) { stopLoops(); me = null; token = null; try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } S.battle = null; if (state.mode === 'COMBAT') state.mode = state.combat.fromMode || 'OVERWORLD'; }
        $('login-modal').dataset.maint = '1';
        showLogin('');
        $('login-modal').dataset.maint = '1';
        if (introDone) setIntroStage('form');
        const cv = $('maint-canvas'), g = cv.getContext('2d');
        const frame = (ts) => { if (!maintOn) return; drawMaintenanceScene(g, cv.width, cv.height, ts); maintRaf = requestAnimationFrame(frame); };
        maintRaf = requestAnimationFrame(frame);
        clearInterval(maintPoll);
        maintPoll = setInterval(async () => {
            try { const r = await fetch(`${API}?a=status`, { method: 'POST', body: '{}' }); const d = await r.json(); if (d && d.ok && !d.maintenance) leaveMaintenance(); } catch (e) { /* still closed */ }
        }, 15000);
    }
    function leaveMaintenance() {
        if (!maintOn) return;
        maintOn = false; cancelAnimationFrame(maintRaf); clearInterval(maintPoll);
        delete $('login-modal').dataset.maint;
        resume().then(ok => { if (!ok) { showLogin(''); if (introDone) setIntroStage('form'); } });
    }
    const MAINT_DWARF = { g: 'M', hair: '#a8521e', hs: 'short', beard: 'full', hh: true, nw: true, w: 0, a: 1 };
    function drawMaintenanceScene(g, w, h, ts) {
        const t = ts / 1000;
        g.clearRect(0, 0, w, h);
        // night sky wash, hills and a patch of trodden earth
        const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0b1230'); sky.addColorStop(1, '#1b2a52'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
        g.fillStyle = '#12203f'; g.beginPath(); g.moveTo(0, h * .62); g.quadraticCurveTo(w * .25, h * .5, w * .5, h * .62); g.quadraticCurveTo(w * .8, h * .74, w, h * .56); g.lineTo(w, h); g.lineTo(0, h); g.fill();
        const ground = g.createLinearGradient(0, h * .72, 0, h); ground.addColorStop(0, '#3a4f2a'); ground.addColorStop(1, '#27371c'); g.fillStyle = ground; g.fillRect(0, h * .76, w, h * .24);
        g.fillStyle = 'rgba(120,90,50,.55)'; g.beginPath(); g.ellipse(w / 2, h * .9, w * .4, h * .06, 0, 0, 7); g.fill();
        // the strikes: both dwarves swing in turn, the sign shudders when a blow lands
        const period = 1.1, ph = [((t) / period) % 1, ((t + period / 2) / period) % 1];
        const hit = ph.map(p => p > .78 && p < .9 ? 1 - Math.abs(p - .84) / .06 : 0);
        const shake = (hit[0] + hit[1]) * 3 * Math.sin(t * 90);
        // the sign: two posts and a plank board
        const sx = w / 2 + shake, top = h * .12, bw = w * .5, bh = h * .46;
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(w / 2, h * .86, bw * .5, h * .03, 0, 0, 7); g.fill();
        [-1, 1].forEach(s => { g.fillStyle = '#5a3a1c'; g.fillRect(w / 2 + s * bw * .36 - 7, top + bh * .6, 14, h * .86 - top - bh * .6); g.strokeStyle = '#2b1a0a'; g.lineWidth = 2; g.strokeRect(w / 2 + s * bw * .36 - 7, top + bh * .6, 14, h * .86 - top - bh * .6); });
        const board = g.createLinearGradient(0, top, 0, top + bh); board.addColorStop(0, '#b98a52'); board.addColorStop(1, '#8a5f33');
        g.fillStyle = board; g.fillRect(sx - bw / 2, top, bw, bh); g.strokeStyle = '#3b2410'; g.lineWidth = 4; g.strokeRect(sx - bw / 2, top, bw, bh);
        g.strokeStyle = 'rgba(60,35,12,.55)'; g.lineWidth = 1.5; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(sx - bw / 2, top + bh * i / 5); g.lineTo(sx + bw / 2, top + bh * i / 5); g.stroke(); }
        g.fillStyle = '#2b1a0a'; [[-.45, .1], [.45, .1], [-.45, .88], [.45, .88]].forEach(([a, b]) => { g.beginPath(); g.arc(sx + bw * a * .96, top + bh * b, 4, 0, 7); g.fill(); });
        g.fillStyle = '#2b1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `bold ${Math.round(h * .07)}px Cinzel, Georgia, serif`; g.fillText('CURRENTLY IN', sx, top + bh * .33);
        g.font = `bold ${Math.round(h * .085)}px Cinzel, Georgia, serif`; g.fillText('MAINTENANCE', sx, top + bh * .66);
        // two dwarves, one on each side, facing the sign
        const ds = h * .55, dy = h * .78 - ds * .92;
        const dwarf = (side, p, hitK) => {
            const x0 = side < 0 ? w * .03 : w - w * .03 - ds;
            g.save();
            if (side > 0) { g.translate(x0 + ds, dy); g.scale(-1, 1); } else g.translate(x0, dy);
            if (typeof drawHeroCharacterVector === 'function') drawHeroCharacterVector(g, 0, 0, ds, 'Fighter', false, 'Dwarf', MAINT_DWARF);
            // the hammer: raised, then brought down onto the board
            const hx = ds * .72, hy = ds * .5;
            const swing = p < .78 ? -1.5 + Math.sin(p / .78 * Math.PI) * .25 : (p < .9 ? -1.5 + (p - .78) / .12 * 2.0 : .5 - (p - .9) / .1 * 2.0);
            g.translate(hx, hy); g.rotate(swing);
            g.fillStyle = '#7a4a22'; g.fillRect(-4, -ds * .46, 8, ds * .5); g.strokeStyle = '#2b1a0a'; g.lineWidth = 2; g.strokeRect(-4, -ds * .46, 8, ds * .5);
            g.fillStyle = '#9aa3ad'; g.fillRect(-ds * .1, -ds * .56, ds * .2, ds * .13); g.strokeRect(-ds * .1, -ds * .56, ds * .2, ds * .13);
            g.restore();
            if (hitK > 0) {                                       // sparks off the board
                const bx = side < 0 ? sx - bw / 2 : sx + bw / 2, by = top + bh * (side < 0 ? .45 : .6);
                for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + t * 5, r = 6 + (1 - hitK) * 24 + i * 2; g.fillStyle = `rgba(253,224,71,${hitK})`; g.fillRect(bx + Math.cos(a) * r * (side < 0 ? -1 : 1), by + Math.sin(a) * r, 3, 3); }
            }
        };
        dwarf(-1, ph[0], hit[0]); dwarf(1, ph[1], hit[1]);
        // a few stars
        g.fillStyle = 'rgba(226,232,240,.8)'; for (let i = 0; i < 24; i++) { const x = ((i * 97) % 100) / 100 * w, y = ((i * 53) % 40) / 100 * h; g.globalAlpha = .4 + .5 * Math.sin(t * 2 + i); g.fillRect(x, y, 2, 2); } g.globalAlpha = 1;
    }

    // ------------------------------------------------------------------------------ login / logout
    function showAuthError(msg) {
        const el = $('auth-error');
        el.textContent = msg || '';
        el.classList.toggle('hidden', !msg);
    }
    function setAuthMode(mode) {
        S.authMode = mode;
        $('auth-tab-login').classList.toggle('on', mode === 'login');
        $('auth-tab-register').classList.toggle('on', mode === 'register');
        $('auth-pass2-wrap').classList.toggle('hidden', mode !== 'register');
        $('auth-submit').textContent = mode === 'login' ? 'ENTER THE REALM' : 'CREATE ACCOUNT & ENTER';
        $('auth-pass').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
        showAuthError('');
    }
    async function submitAuth(ev) {
        ev.preventDefault();
        const name = $('auth-name').value.trim(), pass = $('auth-pass').value;
        if (!name || !pass) { showAuthError('Enter an account name and a password.'); return; }
        if (S.authMode === 'register' && pass !== $('auth-pass2').value) { showAuthError('The two passwords differ.'); return; }
        $('auth-submit').disabled = true;
        const r = await api(S.authMode, { name, password: pass });
        $('auth-submit').disabled = false;
        if (!r.ok) { showAuthError(r.net ? 'Cannot reach the server.' : r.error); return; }
        $('auth-pass').value = ''; $('auth-pass2').value = '';
        token = r.token;
        try { window.localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* ignore */ }
        afterLogin(r);
    }

    function resetLocalGame() {
        state.mode = 'OVERWORLD';
        state.party = state.draftParty.map(d => createCharacter(d.name, d.race, d.cls, d));
        state.gold = 100;
        state.inventory = { weapons: {}, armors: {}, heads: {}, pets: [], pot: {}, order: [], sextant: false, sextantOn: false, potions: 2, rations: 2, meat: 0, leather: 0, magic: [] };
        state.light = { steps: 0, level: 0 }; state.rested = { ms: 0 };
        state.camping.active = false; state.camp.active = false; state.sleeping = false; state.rest = null;
        state.dialogue.active = false; state.inventoryMenu.active = false;
        state.overworld.x = START_X; state.overworld.y = START_Y; state.overworld.inShip = false; state.overworld.ships = []; state.overworld.passengerOf = 0;
        if (state.overworld.explored) state.overworld.explored.fill(0);
        state.overworld.roamers = [];
        Hotbar.reset();
        ['sleep-overlay'].forEach(id => { const o = $(id); if (o) { o.style.opacity = '0'; o.style.pointerEvents = 'none'; } });
        $('chat-log').innerHTML = '';
        $('message-log').innerHTML = '';
        S.chatSince = 0; S.chatPrimed = false; S.evSince = 0; S.near = []; S.online = []; S.battles = []; S.group = null; S.invites = []; S.battle = null;
        updateFogOfWar();
    }

    function afterLogin(r) {
        me = r.me;
        S.chars = r.chars || []; S.max = r.max || 6;
        introDone = true;
        $('login-modal').classList.add('hidden');
        worldClockSet(r.world.now, r.world.epoch, r.world.turnMs, 0);
        setServerWeather(r.world.weather.kind, r.world.weather.left);
        if (r.active && r.active.save) startCharacter(r.active.id, r.active.save);
        else if (S.chars.length) showCharSelect();
        else newCharacter();
    }

    // ------------------------------------------------------------------------------ characters
    function charError(msg) { const e = $('char-error'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }
    function showCharSelect(msg) {
        stopLoops();
        S.charId = null; S.creating = false; S.battle = null;
        if (state.mode === 'COMBAT') state.mode = state.combat.fromMode || 'OVERWORLD';
        $('party-modal').classList.add('hidden');
        $('login-modal').classList.add('hidden');
        $('char-modal').classList.remove('hidden');
        $('stat-online').textContent = 'offline';
        $('conn-dot').className = 'conn-dot';
        $('conn-banner').classList.add('hidden');
        $('char-sub').textContent = `Account ${me ? me.name : ''} - ${S.chars.length} of ${S.max} heroes`;
        charError(msg || '');
        const grid = $('char-grid');
        grid.innerHTML = '';
        S.chars.forEach(c => {
            const card = document.createElement('div');
            card.className = 'w-44 bg-slate-900/90 gold-border rounded-xl p-3 flex flex-col items-center gap-1.5';
            const cv = document.createElement('canvas');
            cv.width = 112; cv.height = 112; cv.style.cssText = 'width:112px;height:112px';
            try { drawHeroCharacterVector(cv.getContext('2d'), 0, 0, 112, c.cls, false, c.race, c.look || {}); } catch (e) { /* art is optional */ }
            card.appendChild(cv);
            card.insertAdjacentHTML('beforeend', `<div class="font-cinzel font-bold text-amber-300 text-sm truncate max-w-full">${esc(c.name)}</div>
                <div class="text-[10px] text-slate-400">Lvl ${c.lvl} ${esc(c.race)} ${esc(c.cls)}</div>
                <div class="flex gap-1.5 mt-1 w-full">
                    <button data-play class="btn-retro flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">PLAY</button>
                    <button data-del class="px-2 py-1.5 rounded bg-rose-950/90 hover:bg-rose-900 border border-rose-500/60 text-rose-200 text-xs" title="Delete this hero">&#10005;</button>
                </div>`);
            card.querySelector('[data-play]').addEventListener('click', () => playCharacter(c.id));
            card.querySelector('[data-del]').addEventListener('click', () => deleteCharacter(c));
            grid.appendChild(card);
        });
        if (S.chars.length < S.max) {
            const nb = document.createElement('button');
            nb.className = 'w-44 min-h-[210px] rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 text-amber-300 font-cinzel font-bold text-sm flex flex-col items-center justify-center gap-2';
            nb.innerHTML = '<span class="text-4xl leading-none">+</span>NEW HERO';
            nb.addEventListener('click', newCharacter);
            grid.appendChild(nb);
        }
    }
    async function playCharacter(id) {
        charError('');
        const r = await api('char_select', { id });
        if (!r.ok) { charError(r.net ? 'Cannot reach the server.' : r.error); return; }
        startCharacter(id, r.save);
    }
    function startCharacter(id, save) {
        $('char-modal').classList.add('hidden');
        $('party-modal').classList.add('hidden');
        resetLocalGame();
        S.charId = id; S.creating = false;
        S.ready = true;
        if (!save || !applySave(save)) { showCharSelect('That hero could not be loaded.'); return; }
        S.saveMsg = 'Loaded from the server';
        updateUI();
        startLoops();
        pollSoon(50);
    }
    // an in-game confirmation popup (replaces the browser's confirm box); resolves true / false
    function gameConfirm(o) {
        return new Promise(resolve => {
            const box = $('confirm-modal');
            $('confirm-title').textContent = o.title;
            $('confirm-lines').innerHTML = (o.lines || []).map((l, i) => `<div class="${i === 0 ? 'confirm-name' : (i === 1 ? 'confirm-sub' : 'confirm-text')}">${String(l).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</div>`).join('');
            const cv = $('confirm-canvas'), g = cv.getContext('2d');
            g.clearRect(0, 0, cv.width, cv.height);
            if (o.draw) o.draw(g, cv.width, cv.height);
            cv.style.display = o.draw ? '' : 'none';
            const ok = $('confirm-ok'), no = $('confirm-cancel');
            ok.textContent = o.ok || 'OK'; no.textContent = o.cancel || 'CANCEL';
            ok.className = 'btn-retro flex-1 py-2 rounded-lg font-bold text-xs tracking-wider ' + (o.danger ? 'bg-rose-700 hover:bg-rose-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950');
            const done = (v) => { box.classList.add('hidden'); ok.onclick = no.onclick = null; window.removeEventListener('keydown', key, true); resolve(v); };
            const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } };
            ok.onclick = () => done(true); no.onclick = () => done(false);
            window.addEventListener('keydown', key, true);
            box.classList.remove('hidden');
            no.focus();
        });
    }
    async function deleteCharacter(c) {
        const sure = await gameConfirm({
            title: 'FAREWELL, CHAMPION?',
            lines: [`${c.name} the ${c.race} ${c.cls}`, `Level ${c.lvl}`, 'Deleting this hero is forever. Gear, gold and glory are lost.'],
            ok: 'DELETE FOR GOOD', cancel: 'KEEP THE HERO', danger: true,
            draw: (g, w, h) => { g.fillStyle = 'rgba(2,6,23,.6)'; g.fillRect(0, 0, w, h); try { drawHeroCharacterVector(g, -20, 6, 190, c.cls, false, c.race, c.look || {}); } catch (e) { /* art is optional */ } }
        });
        if (!sure) return;
        const r = await api('char_delete', { id: c.id });
        if (!r.ok) { charError(r.net ? 'Cannot reach the server.' : r.error); return; }
        S.chars = r.chars || [];
        showCharSelect();
    }
    // the creation screen; the hero is stored on the server by saveNow() once "BEGIN THE LEGACY" is pressed
    function newCharacter() {
        stopLoops();
        $('char-modal').classList.add('hidden');
        resetLocalGame();
        S.charId = null; S.creating = true;
        $('btn-creation-back').classList.toggle('hidden', !S.chars.length);
        renderPartyDraftModal();
        $('party-modal').classList.remove('hidden');
    }
    async function switchHero() {
        if (!me) return;
        await saveNow(false);
        const r = await api('char_select', { id: 0 });
        if (!r.ok) { addLog(r.net ? 'Cannot reach the server.' : r.error, 'text-rose-400'); return; }
        S.chars = r.chars || S.chars;
        showCharSelect();
    }

    async function resume() {
        if (!token) return false;
        const r = await api('resume', {});
        if (!r.ok) { token = null; try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } return false; }
        afterLogin(r);
        return true;
    }

    function stopLoops() {
        S.ready = false;
        clearTimeout(S.timer); clearInterval(S.saveTimer); S.timer = null; S.saveTimer = null;
    }
    function showLogin(msg) {
        $('char-modal').classList.add('hidden');
        $('login-modal').classList.remove('hidden');
        setIntroStage(introDone ? 'form' : 'splash');
        $('party-modal').classList.add('hidden');
        setAuthMode('login');
        showAuthError(msg || '');
        $('stat-online').textContent = 'offline';
        $('conn-dot').className = 'conn-dot';
    }
    function authLost(msg) {
        stopLoops();
        me = null; token = null;
        try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
        if (state.mode === 'COMBAT') { state.mode = state.combat.fromMode || 'OVERWORLD'; }
        S.battle = null;
        showLogin(msg || 'Thy session has ended.');
    }
    async function logout(reason) {
        if (!me) return;
        await saveNow(false);
        if (S.battle) { try { await api('battle_leave', { id: S.battle.id }); } catch (e) { /* ignore */ } }
        await api('logout', {});
        stopLoops();
        me = null; token = null;
        try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
        S.battle = null;
        if (state.mode === 'COMBAT') state.mode = 'OVERWORLD';
        showLogin(typeof reason === 'string' ? reason : '');
    }

    // ------------------------------------------------------------------------------ title screen
    // The scene behind the login box: twinkling stars in three depths, a moon, an aurora, shooting stars,
    // two ridges of mountains with a lit tower, and embers rising from the valley.
    let introDone = false;
    function loginScene() {
        const cv = $('login-stars');
        if (!cv) return;
        const g = cv.getContext('2d');
        const rnd = (() => { let a = 20240517; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
        const stars = Array.from({ length: 260 }, () => ({ x: rnd(), y: rnd() * 0.85, z: rnd(), p: rnd() * 6, hue: rnd() < 0.15 ? '186,230,253' : (rnd() < 0.15 ? '254,240,200' : '226,232,240') }));
        const ridge = (seed, n) => { const pts = []; let h = 0.5; for (let i = 0; i <= n; i++) { h += (rnd() - 0.5) * 0.35; h = Math.max(0.1, Math.min(0.9, h)); pts.push(h); } return pts; };
        const far = ridge(1, 40), near = ridge(2, 24);
        const embers = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), v: 0.0006 + rnd() * 0.0012, p: rnd() * 6 }));
        let shoot = null, nextShoot = 120, t = 0, mx = 0, my = 0;
        window.addEventListener('pointermove', (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; });
        const ridgePath = (pts, w, h, base, amp, px) => {
            g.beginPath(); g.moveTo(-10, h);
            pts.forEach((v, i) => g.lineTo((i / (pts.length - 1)) * (w + 20) - 10 + px, base - v * amp));
            g.lineTo(w + 10, h); g.closePath();
        };
        const draw = () => {
            requestAnimationFrame(draw);
            if ($('login-modal').classList.contains('hidden')) return;
            const w = cv.clientWidth, h = cv.clientHeight;
            if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
            g.clearRect(0, 0, w, h);
            t++;
            // aurora ribbons
            for (let k = 0; k < 3; k++) {
                const y0 = h * (0.2 + k * 0.07), col = k === 1 ? '167,139,250' : '52,211,153';
                const grad = g.createLinearGradient(0, y0 - h * 0.12, 0, y0 + h * 0.14);
                grad.addColorStop(0, `rgba(${col},0)`); grad.addColorStop(0.5, `rgba(${col},${0.10 + 0.04 * Math.sin(t * 0.01 + k)})`); grad.addColorStop(1, `rgba(${col},0)`);
                g.fillStyle = grad; g.beginPath(); g.moveTo(0, y0 + h * 0.14);
                for (let x = 0; x <= w; x += 20) g.lineTo(x, y0 + Math.sin(x * 0.006 + t * 0.008 + k * 2) * h * 0.05 + Math.sin(x * 0.015 - t * 0.012) * h * 0.015);
                g.lineTo(w, y0 + h * 0.14); g.closePath(); g.fill();
            }
            // stars
            stars.forEach(s => {
                const px = mx * 14 * s.z, py = my * 8 * s.z, tw = 0.5 + 0.5 * Math.sin(t * (0.02 + s.z * 0.03) + s.p), sz = 0.6 + s.z * 1.5;
                g.fillStyle = `rgba(${s.hue},${0.2 + 0.7 * tw * (0.5 + s.z * 0.5)})`;
                g.fillRect(s.x * w + px, s.y * h + py, sz, sz);
                if (s.z > 0.92 && tw > 0.8) { g.fillRect(s.x * w + px - sz * 2, s.y * h + py + sz * 0.3, sz * 5, 0.6); g.fillRect(s.x * w + px + sz * 0.3, s.y * h + py - sz * 2, 0.6, sz * 5); }
            });
            // moon
            const mxp = w * 0.8 + mx * -18, myp = h * 0.2 + my * -10, mr = Math.min(w, h) * 0.07;
            let gl = g.createRadialGradient(mxp, myp, mr * 0.8, mxp, myp, mr * 4.5);
            gl.addColorStop(0, 'rgba(186,230,253,.28)'); gl.addColorStop(1, 'rgba(186,230,253,0)');
            g.fillStyle = gl; g.beginPath(); g.arc(mxp, myp, mr * 4.5, 0, 7); g.fill();
            gl = g.createRadialGradient(mxp - mr * 0.3, myp - mr * 0.3, mr * 0.1, mxp, myp, mr);
            gl.addColorStop(0, '#fffbeb'); gl.addColorStop(1, '#bfdbfe');
            g.fillStyle = gl; g.beginPath(); g.arc(mxp, myp, mr, 0, 7); g.fill();
            g.fillStyle = 'rgba(100,116,139,.22)';
            [[-.35, -.1, .22], [.2, .25, .3], [.1, -.4, .14], [-.2, .4, .12]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(mxp + dx * mr, myp + dy * mr, rr * mr, 0, 7); g.fill(); });
            // shooting star
            if (!shoot && --nextShoot <= 0) { shoot = { x: w * (0.2 + rnd() * 0.6), y: h * rnd() * 0.3, life: 0 }; nextShoot = 200 + rnd() * 400; }
            if (shoot) {
                shoot.life++; shoot.x += 9; shoot.y += 4;
                const a = Math.max(0, 1 - shoot.life / 50), tail = g.createLinearGradient(shoot.x, shoot.y, shoot.x - 120, shoot.y - 53);
                tail.addColorStop(0, `rgba(255,255,255,${a})`); tail.addColorStop(1, 'rgba(255,255,255,0)');
                g.strokeStyle = tail; g.lineWidth = 2; g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - 120, shoot.y - 53); g.stroke();
                if (shoot.life > 50) shoot = null;
            }
            // mountains: far ridge, near ridge, tower
            const base = h * 0.98;
            g.fillStyle = '#0b1535'; ridgePath(far, w, h, base - h * 0.04, h * 0.34, mx * -10); g.fill();
            g.fillStyle = '#060c22'; ridgePath(near, w, h, base + h * 0.02, h * 0.3, mx * -22); g.fill();
            const tx = w * 0.14 + mx * -22, ty = h * 0.82;
            g.fillStyle = '#030616';
            g.fillRect(tx - 9, ty - h * 0.12, 18, h * 0.2); g.beginPath(); g.moveTo(tx - 13, ty - h * 0.12); g.lineTo(tx, ty - h * 0.17); g.lineTo(tx + 13, ty - h * 0.12); g.closePath(); g.fill();
            g.fillStyle = `rgba(253,224,71,${0.75 + 0.25 * Math.sin(t * 0.07)})`; g.fillRect(tx - 2, ty - h * 0.1, 4, 7);
            gl = g.createRadialGradient(tx, ty - h * 0.09, 0, tx, ty - h * 0.09, 40);
            gl.addColorStop(0, 'rgba(253,224,71,.25)'); gl.addColorStop(1, 'rgba(253,224,71,0)'); g.fillStyle = gl; g.beginPath(); g.arc(tx, ty - h * 0.09, 40, 0, 7); g.fill();
            // embers
            embers.forEach(e => {
                e.y -= e.v; if (e.y < -0.02) { e.y = 1.02; e.x = rnd(); }
                const a = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.05 + e.p));
                g.fillStyle = `rgba(251,191,36,${a})`; g.fillRect(e.x * w + Math.sin(t * 0.02 + e.p) * 12, e.y * h, 1.6, 1.6);
            });
        };
        draw();
    }

    // the title screen waits for a click or key press (browsers only allow sound after one), then plays the overture
    function setIntroStage(stage) { $('login-modal').dataset.stage = stage; }
    function refreshLoginMusic() {
        const b = $('login-music');
        if (b && typeof music !== 'undefined') b.classList.toggle('off', !music.enabled);
    }
    function beginIntro() {
        if (introDone) return;
        introDone = true;
        if (typeof sfx !== 'undefined') sfx.init();
        setIntroStage('form');
        const n = $('auth-name'); if (n) n.focus();
    }
    function initIntro() {
        const go = (e) => {
            if (introDone || $('login-modal').classList.contains('hidden')) return;
            if (e.target && e.target.id === 'login-music') return;
            if (e.type === 'keydown' && (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')) return;
            beginIntro();
        };
        // try to start the audio at once (allowed when the browser trusts the site); otherwise the first gesture resumes it
        ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(ev => window.addEventListener(ev, go, { passive: true }));
        $('login-music').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof toggleMusic === 'function') toggleMusic();
            if (!introDone) beginIntro();
            refreshLoginMusic();
        });
        refreshLoginMusic();
    }

    // ------------------------------------------------------------------------------ boot
    function boot() {
        $('auth-form').addEventListener('submit', submitAuth);
        $('char-logout').addEventListener('click', () => logout());
        initActivity();
        $('friend-add').addEventListener('click', () => { const i = $('friend-input'); const v = i.value.trim(); if (v) { friendAction({ act: 'add', name: v }); i.value = ''; } });
        $('friend-input').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); $('friend-add').click(); } else if (e.key === 'Escape') { $('friend-input').blur(); } });
        $('btn-creation-back').addEventListener('click', () => { if (S.chars.length) showCharSelect(); });
        $('auth-tab-login').addEventListener('click', () => setAuthMode('login'));
        $('auth-tab-register').addEventListener('click', () => setAuthMode('register'));
        document.querySelectorAll('.side-tab[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
        $('chat-send').addEventListener('click', sendChatFromInput);
        $('chat-input').addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); sendChatFromInput(); $('chat-input').blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); $('chat-input').blur(); }
        });
        $('join-yes').addEventListener('click', () => answerJoin(true));
        $('join-no').addEventListener('click', () => answerJoin(false));
        $('invite-yes').addEventListener('click', () => answerInvite(true));
        $('invite-no').addEventListener('click', () => answerInvite(false));
        window.addEventListener('pagehide', () => { if (me && S.ready) saveNow(false); });
        loginScene();
        initIntro();
        setAuthMode('login');
        showLogin('');
        api('status', {}).then(st => { if (st && st.maintenance) enterMaintenance(); else resume(); });
    }

    // keyboard: the login box and the join prompt own the keys while they are open
    function keyCapture(e) {
        if (!$('login-modal').classList.contains('hidden')) return true;
        if (S.prompt && state.mode !== 'COMBAT') {
            const k = e.key.toLowerCase();
            if (k === 'y') { e.preventDefault(); answerJoin(true); return true; }
            if (k === 'n' || e.key === 'Escape') { e.preventDefault(); answerJoin(false); return true; }
        }
        return false;
    }

    // ------------------------------------------------------------------------------ where am I?
    function modeNow() { return state.mode === 'COMBAT' ? state.combat.fromMode : state.mode; }
    function sceneKey() {
        const m = modeNow();
        if (m === 'OVERWORLD') return 'OW';
        if (m === 'TOWN') return 'T:' + state.town.name;
        return 'D:' + state.dungeon.name + ':' + state.dungeon.level;
    }
    function posXY() {
        const m = modeNow();
        if (m === 'OVERWORLD') return [state.overworld.x, state.overworld.y];
        if (m === 'TOWN') return [state.town.x, state.town.y];
        return [state.dungeon.x, state.dungeon.y];
    }
    function myParty() {
        if (me && S.battle && state.mode === 'COMBAT') {
            const mine = state.party.filter(h => h.owner === me.id);
            if (mine.length) return mine;
        }
        return state.party;
    }
    function buildPos() {
        const party = myParty();
        const leader = party.find(h => h.hp > 0) || party[0] || { cls: 'Fighter', race: 'Human', lvl: 1 };
        const [x, y] = posXY();
        return {
            mode: state.mode, scene: sceneKey(), loc: modeNow() === 'TOWN' ? state.town.name : (modeNow() === 'DUNGEON' ? `${state.dungeon.name} F${state.dungeon.level}` : ''),
            x, y, cls: leader.cls, race: leader.race, look: heroLook(leader), lvl: Math.max(...party.map(h => h.lvl), 1),
            ship: state.overworld.inShip && modeNow() === 'OVERWORLD' ? 1 : 0,
            los: modeNow() === 'OVERWORLD' ? getTimeOfDayInfo().los : 5,
            pet: (leader.pet && !state.overworld.inShip && (modeNow() === 'OVERWORLD' || modeNow() === 'TOWN')) ? leader.pet : '',
            sname: state.overworld.inShip ? (state.overworld.passengerOf ? (state.overworld.passengerShip || '') : ((playerShip() || {}).name || '')) : '',
            aboard: state.overworld.inShip ? (state.overworld.passengerOf || 0) : 0,
            rest: (state.camp.active || state.sleeping) ? 1 : 0,
            idle: idleSecs(),
            battle: S.battle && S.battle.id ? S.battle.id : 0,
            hp: party.reduce((s, h) => s + Math.max(0, h.hp), 0), mhp: party.reduce((s, h) => s + h.maxHp, 0),
            heroes: party.map(h => ({ n: h.name, c: h.cls, l: h.lvl, hp: Math.max(0, h.hp), m: h.maxHp }))
        };
    }

    // ------------------------------------------------------------------------------ the poll loop
    function startLoops() {
        clearInterval(S.saveTimer);
        S.saveTimer = setInterval(() => { if (me && S.ready) saveNow(false); }, 30000);
        if (!S.tickTimer) S.tickTimer = setInterval(tick250, 250);
    }
    function pollSoon(ms) {
        clearTimeout(S.timer);
        S.timer = setTimeout(pollOnce, ms);
    }
    function pollDelay() {
        if (S.battle) return 600;
        return document.hidden ? 4000 : 1500;
    }

    async function pollOnce() {
        if (!me || !S.ready) return;
        if (S.polling) { pollSoon(300); return; }
        S.polling = true;
        const body = { pos: buildPos(), chat: S.chatSince, ev: S.evSince };
        const B = S.battle;
        if (B && B.id) body.battle = { id: B.id, seq: B.seq, iseq: B.iseq };
        const t0 = performance.now();
        const r = await api('poll', body);
        S.polling = false;
        if (!me) return;
        if (!r.ok && r.needChar) { api('chars', {}).then(c => { if (c.ok) S.chars = c.chars || []; showCharSelect(); }); return; }
        if (!r.ok) {
            S.fails++;
            if (S.fails >= 3) { $('conn-banner').classList.remove('hidden'); $('conn-dot').className = 'conn-dot bad'; }
            pollSoon(Math.min(5000, 800 * S.fails));
            return;
        }
        S.fails = 0; S.lastOk = Date.now();
        $('conn-banner').classList.add('hidden'); $('conn-dot').className = 'conn-dot on';
        try { applyPoll(r, performance.now() - t0); } catch (e) { console.error('poll apply', e); }
        pollSoon(pollDelay());
    }

    function applyPoll(r, rtt) {
        worldClockSet(r.now, r.epoch, r.turnMs, rtt);
        setServerWeather(r.weather.kind, r.weather.left);
        if (me) setMaintCountdown(r.maintLeft === undefined ? null : r.maintLeft);
        state.overworld.bags = r.bags || [];
        applyCampsGone(r.camps || []);
        applyGmState(r.me);
        S.near = r.near || [];
        trackTrails();
        S.online = r.online || [];
        followShipOwner();
        S.battles = r.battles || [];
        applyRoamers(r);
        S.friends = r.friends || [];
        renderFriendsTab();
        S.group = r.group || null;
        S.invites = r.invites || [];
        $('stat-online').textContent = `${S.online.length + 1} online`;
        // chat
        const backlog = !S.chatPrimed;           // the first poll after a reload or login carries the recent history
        S.chatPrimed = true;
        (r.chat || []).forEach(m => { if (m.id > S.chatSince) S.chatSince = m.id; if (!m.skip) addChat(m, backlog); });
        // events
        (r.events || []).forEach(ev => { if (ev.id > S.evSince) S.evSince = ev.id; handleEvent(ev); });
        renderPlayersTab();
        renderGroupBox();
        handleInvites();
        if (r.battle) battlePoll(r.battle);
        else if (S.battle && S.battle.id && !S.battle.exiting) {
            // the server forgot the battle: fall back to a normal exit
            if (state.mode === 'COMBAT') remoteExit({ outcome: 'escape' });
        }
        checkBattleProximity();
    }

    // ------------------------------------------------------------------------------ roaming monsters (the server owns them)
    // ------------------------------------------------------------------------------ inactivity
    // 2 minutes without input: shown as AFK (name tag and sleepy z's) to everybody; 5 minutes: logged out.
    const AFK_SECS = 120, KICK_SECS = 300;
    let lastInput = Date.now();
    function idleSecs() { return (state.mode === 'COMBAT' || state.camp.active || state.sleeping) ? 0 : Math.floor((Date.now() - lastInput) / 1000); }
    function selfAfk() { return idleSecs() >= AFK_SECS; }
    function zzz(ctx, sx, sy, size) {
        ctx.save(); ctx.fillStyle = '#bae6fd'; ctx.font = `bold ${Math.round(size * 0.28)}px 'Cinzel', serif`; ctx.textAlign = 'center';
        for (let k = 0; k < 3; k++) {
            const f = ((animTick * 0.012) + k / 3) % 1;
            ctx.globalAlpha = 0.95 * (1 - f);
            ctx.strokeStyle = 'rgba(2,6,23,.8)'; ctx.lineWidth = 2;
            const x = sx + size * 0.75 + f * size * 0.25, y = sy + size * 0.1 - f * size * 0.4, ch = k === 2 ? 'Z' : 'z';
            ctx.strokeText(ch, x, y); ctx.fillText(ch, x, y);
        }
        ctx.restore();
    }
    function initActivity() {
        const bump = () => { lastInput = Date.now(); };
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, bump, { capture: true, passive: true }));
        let lastMove = 0;
        window.addEventListener('mousemove', () => { const t = Date.now(); if (t - lastMove > 1000) { lastMove = t; lastInput = t; } }, { passive: true });
    }

    // abandoned camps somebody has already searched are gone for everybody
    let campsKey = '';
    function setCampTile(i, gone) {
        const c = (state.overworld.abandoned || [])[i];
        if (!c || !state.overworld.grid) return;
        state.overworld.grid[c.y * state.overworld.width + c.x] = gone ? TILE.GRASS : TILE.ABANDONED;
    }
    function applyCampsGone(list) {
        const key = list.map(c => c.join(':')).join(',');
        if (key === campsKey) return;
        const idxOf = (xy) => (state.overworld.abandoned || []).findIndex(c => c.x === xy[0] && c.y === xy[1]);
        const was = new Set((campsKey ? campsKey.split(',') : []).map(k => idxOf(k.split(':').map(Number))));
        const now = new Set(list.map(idxOf));
        was.forEach(i => { if (i >= 0 && !now.has(i)) setCampTile(i, false); });
        now.forEach(i => { if (i >= 0) setCampTile(i, true); });
        campsKey = key;
    }
    let campBusy = false;
    async function lootCamp(x, y) {
        const ow = state.overworld, i = (ow.abandoned || []).findIndex(c => c.x === x && c.y === y);
        if (i < 0 || campBusy) return;
        campBusy = true;
        try {
            const camps = (ow.abandoned || []).map(c => [c.x, c.y]);          // sent along so that a server that lost its list can restore it
            let r = await api('camp_loot', { x, y, camps });
            if (!r.ok && /too far/i.test(r.error || '')) {                      // the server may not know yet that we arrived: tell it where we are, and ask once more
                pollOnce(); await new Promise(res => setTimeout(res, 1300));
                r = await api('camp_loot', { x, y, camps });
            }
            if (!r.ok) { addLog(`Thou searchest the camp, but ${r.net ? 'the connection fails' : (r.error || 'something goes wrong')} - step off and on again to retry.`, "text-slate-400"); return; }
            setCampTile(i, true);
            if (r.claimed) campLootReward();
            else addLog('Somebody searched this camp before thee - only ashes and tracks are left.', "text-slate-400");
        } finally { campBusy = false; }
    }

    let ambushBusy = false, mapSent = false;
    function applyRoamers(r) {
        if (r.needMap && !mapSent) uploadRoamMap();
        state.overworld.roamers = (r.roamers || []).map(m => ({ id: m.id, x: m.x, y: m.y, kind: m.kind || 0, tier: roamerSpecies(m), rank: m.kind === 1 ? 0 : m.tier }));
        checkRoamerAmbush();
    }
    // one bit per tile: can a monster stand there (the terrain is the same in every browser)
    async function uploadRoamMap() {
        const ow = state.overworld;
        if (!ow.grid) return;
        mapSent = true;
        const w = ow.width, h = ow.height, bytes = new Uint8Array((w * h + 7) >> 3);
        const ok = new Set([TILE.GRASS, TILE.FOREST, TILE.MOUNTAIN, TILE.SWAMP, TILE.DESERT, TILE.SAVANNA, TILE.JUNGLE, TILE.LUSH, TILE.TAIGA, TILE.SNOW, TILE.ICE, TILE.BEACH]);     // not the roads: monsters keep off them
        for (let i = 0; i < w * h; i++) if (ok.has(ow.grid[i])) bytes[i >> 3] |= 1 << (i & 7);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        // ruins first, then dungeon entrances: the server lets monsters spawn around them (a roamer's `lair` is its index in this list)
        const lairs = (ow.lairList || []).map(l => [l.x, l.y, l.type, l.tier || 0, l.type === 2 ? l.species : -1]);
        const camps = (ow.abandoned || []).map(c => [c.x, c.y]);
        const r = await api('roam_map', { w, h, bits: btoa(bin), maxTier: MAX_WILD_TIER, lairs, camps, ver: 6 });
        if (!r.ok) mapSent = false;
    }
    function ambushReady() {
        if (state.mode !== 'OVERWORLD' || S.battle || ambushBusy || state.overworld.inShip) return false;
        if (state.camp.active || state.camping.active || state.sleeping || state.rest || state.dialogue.active || state.inventoryMenu.active || state.chestPrompt.active || state.campPrompt.active || state.look.active) return false;
        return !['inventory-modal', 'dialogue-modal', 'worldmap-modal', 'ship-name-modal', 'spell-modal', 'help-modal', 'settings-modal', 'loot-modal', 'camp-modal', 'chest-modal', 'party-modal', 'char-modal', 'login-modal', 'death-overlay']
            .some(id => { const e = $(id); return e && !e.classList.contains('hidden'); });
    }
    // a monster that reached the party while it stood still
    function checkRoamerAmbush() {
        if (!S.ready || !ambushReady()) return;
        const ow = state.overworld, hit = ow.roamers.find(m => m.x === ow.x && m.y === ow.y && m.kind !== 1);          // wildlife never ambushes
        if (hit) ambushRoamer(hit);
    }
    async function ambushRoamer(m) {
        if (ambushBusy) return;
        ambushBusy = true;
        try {
            const c = await api('roam_claim', { id: m.id });
            state.overworld.roamers = state.overworld.roamers.filter(q => q.id !== m.id);
            if (!c.ok || !c.claimed) return;                      // somebody else got there first
            if (state.mode === 'OVERWORLD' && !S.battle) initiateCombat(m.tier, 'OVERWORLD', m, false);
        } finally { ambushBusy = false; }
    }

    function handleEvent(ev) {
        const d = ev.data || {};
        if (ev.kind === 'group') { if (d.msg) addSystem(d.msg); }
        else if (ev.kind === 'battle_join') {
            if (!S.battle && state.mode !== 'COMBAT') joinBattle(d.battle, true, d.host);
        } else if (ev.kind === 'assist') {
            applyAssist(d);
        }
    }

    function applyAssist(d) {
        const party = state.party;
        if (d.kind === 'heal') {
            let total = 0;
            party.forEach(h => { if (h.hp > 0) { const b = h.hp; h.hp = Math.min(h.maxHp, h.hp + (d.amount || 0)); total += h.hp - b; } });
            addLog(`♪ ${d.from}'s ${d.text || 'magic'} soothes ${hn()} (+${total} HP).`, 'text-pink-300 font-bold');
        } else if (d.kind === 'song') {
            party.forEach(h => { if (h.hp > 0) { h.poisoned = false; if (h.maxMp > 0) h.mp = Math.min(h.maxMp, h.mp + Math.max(1, Math.ceil(h.maxMp * (d.pct || 10) / 100))); } });
            addLog(`♪ ${d.from} plays ${d.text || 'a hymn'}: poison is purged and mana returns.`, 'text-pink-300 font-bold');
        } else if (d.kind === 'food') {
            state.inventory.rations = Math.min(MAX_RATIONS, (state.inventory.rations || 0) + 1);
            addLog(`${d.from} shares a magical meal (+1 ration).`, 'text-amber-200 font-bold');
        }
        sfx.play('heal');
        updateUI();
        saveSoon();
    }

    function assistGroup(kind, data) {
        if (!me || !S.group) return;
        const [x, y] = posXY(), scene = sceneKey();
        S.group.members.forEach(m => {
            if (m.id === me.id || !m.online || m.scene !== scene) return;
            if (scene === 'OW' && Math.max(Math.min(Math.abs(m.x - x), state.overworld.width - Math.abs(m.x - x)), Math.abs(m.y - y)) > GROUP_RANGE) return;
            api('assist', Object.assign({ to: m.id, kind }, data));
        });
    }

    // ------------------------------------------------------------------------------ saving
    async function saveNow(manual) {
        if (!me || (!S.ready && !S.creating) || S.saving) return false;
        if (!state.party || !state.party.length) return false;
        if (!$('party-modal').classList.contains('hidden')) return false;   // still creating the party
        S.saving = true;
        let ok = false;
        try {
            if (S.creating) {      // first save of a new hero: the server makes the character
                const c = await api('char_create', { data: buildSave() });
                if (!c.ok) { S.saveMsg = c.error || 'Could not create the hero'; addLog(`The server refused the new hero: ${c.error || 'no answer'}`, 'text-rose-400'); return false; }
                S.charId = c.id; S.chars = c.chars || S.chars; S.creating = false; S.ready = true;
                S.lastSave = Date.now(); S.saveDirty = false; S.saveMsg = 'Saved';
                startLoops(); pollSoon(50);
                return true;
            }
            const r = await api('save', { data: buildSave() });
            ok = !!r.ok;
            if (ok) { S.lastSave = Date.now(); S.saveDirty = false; S.saveMsg = 'Saved'; }
            else { S.saveMsg = r.net ? 'Server unreachable' : (r.error || 'Save refused'); if (!r.net && manual !== false) addLog(`The server refused the save: ${r.error}`, 'text-rose-400'); }
        } finally { S.saving = false; }
        return ok;
    }
    let saveSoonTimer = null;
    function saveSoon() {
        S.saveDirty = true;
        if (!me || saveSoonTimer) return;
        saveSoonTimer = setTimeout(() => { saveSoonTimer = null; saveNow(false); }, 2500);
    }
    function saveStatusText() {
        if (!me) return 'not logged in';
        return S.lastSave ? `${S.saveMsg} at ${new Date(S.lastSave).toLocaleTimeString()}` : (S.saveMsg || 'not saved yet');
    }

    // ------------------------------------------------------------------------------ chat
    const CH_LABEL = { world: 'World', local: 'Here', group: 'Group', whisper: 'Whisper', system: '' };
    function showTab(tab) {
        document.querySelectorAll('.side-tab[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        ['log', 'chat', 'players', 'friends'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== tab));
        if (tab === 'chat') { S.chatUnread = 0; $('chat-badge').classList.add('hidden'); const l = $('chat-log'); l.scrollTop = l.scrollHeight; }
        if (tab === 'players') { S.plSig = ''; S.grpSig = ''; renderPlayersTab(); renderGroupBox(); }
        if (tab === 'friends') { S.frSig = ''; renderFriendsTab(); }
    }
    function currentTab() { const b = document.querySelector('.side-tab.on[data-tab]'); return b ? b.dataset.tab : 'log'; }
    // history = the backlog the server sends after a reload or login: shown in the log, but nobody speaks, whispers or beeps again
    function addChat(m, history) {
        const log = $('chat-log');
        const row = document.createElement('div');
        row.className = `chat-line chat-${m.ch}`;
        const d = new Date((m.ts || Date.now() / 1000) * 1000);
        const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        if (m.ch === 'system') {
            row.innerHTML = `<span class="ts">${ts}</span>${esc(m.text)}`;
        } else {
            const mine = me && m.fromId === me.id;
            const label = m.ch === 'whisper' ? (mine ? `to ${esc(m.to || '?')}` : 'whispers') : CH_LABEL[m.ch];
            row.innerHTML = `<span class="ts">${ts}</span><span style="opacity:.7">[${label}]</span> <span class="chat-name" data-name="${esc(m.from)}">${esc(m.from)}</span>: ${esc(m.text)}`;
            const nm = row.querySelector('.chat-name');
            nm.addEventListener("click", () => { focusChat(`/w "${m.from}" `); });
            // a speech bubble over their head for a few seconds
            if (!history) S.bubbles[m.from] = { text: m.text.length > 46 ? m.text.slice(0, 44) + '…' : m.text, until: performance.now() + 6000, ch: m.ch };
        }
        log.appendChild(row);
        while (log.childNodes.length > 300) log.removeChild(log.firstChild);
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
        if (atBottom || currentTab() === 'chat') log.scrollTop = log.scrollHeight;
        if (!history && currentTab() !== 'chat' && !(me && m.fromId === me.id)) {
            S.chatUnread++;
            const b = $('chat-badge'); b.textContent = S.chatUnread > 9 ? '9+' : S.chatUnread; b.classList.remove('hidden');
        }
        if (!history && m.ch === 'whisper' && !(me && m.fromId === me.id)) { sfx.play('gold'); addLog(`✉ ${m.from} whispers: ${m.text}`, 'text-pink-300'); }
    }
    function addSystem(text) {
        addChat({ id: 0, ch: 'system', text, ts: Date.now() / 1000 });
        addLog(text, 'text-amber-300');
    }
    function focusChat(prefix) {
        showTab('chat');
        const i = $('chat-input');
        if (prefix) i.value = prefix;
        i.focus();
        i.setSelectionRange(i.value.length, i.value.length);
    }
    async function sendChatFromInput() {
        const inp = $('chat-input');
        let text = inp.value.trim();
        if (!text) { inp.blur(); return; }
        inp.value = '';
        if (!me) return;
        let ch = $('chat-ch').value, to = null;
        let m;
        if ((m = /^\/(w|whisper|msg|tell)\s+(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/i.exec(text))) { ch = 'whisper'; to = m[2] || m[3]; text = m[4]; }
        else if ((m = /^\/(g|group|p)\s+([\s\S]+)$/i.exec(text))) { ch = 'group'; text = m[2]; }
        else if ((m = /^\/(l|local|say|s)\s+([\s\S]+)$/i.exec(text))) { ch = 'local'; text = m[2]; }
        else if ((m = /^\/(world|all|a)\s+([\s\S]+)$/i.exec(text))) { ch = 'world'; text = m[2]; }
        else if ((m = /^\/invite\s+(?:"([^"]+)"|(\S+))/i.exec(text))) { groupAction({ act: 'invite', name: m[1] || m[2] }); return; }
        else if ((m = /^\/(friend|addfriend)\s+(?:"([^"]+)"|(\S+))/i.exec(text))) { friendAction({ act: 'add', name: m[2] || m[3] }); return; }
        else if ((m = /^\/(unfriend|delfriend)\s+(?:"([^"]+)"|(\S+))/i.exec(text))) { friendAction({ act: 'remove', name: m[2] || m[3] }); return; }
        else if (/^\/friends/i.test(text)) { showTab('friends'); return; }
        else if (/^\/(leave|part)/i.test(text)) { groupAction({ act: 'leave' }); return; }
        else if (/^\/(who|online)/i.test(text)) {
            addSystem(`Online (${S.online.length + 1}): ${[hn()].concat(S.online.map(p => `${p.name} (Lv${p.lvl} ${p.cls})`)).join(', ')}`);
            return;
        } else if (/^\/gm\s*$/i.test(text)) { gmCommand('toggle'); return;
        } else if ((m = /^\/teleport\s+(?:"([^"]+)"|(\S[\s\S]*?))\s*$/i.exec(text))) { gmCommand('teleport', (m[1] || m[2]).trim()); return;
        } else if (/^\/teleport\s*$/i.test(text)) { if (S.gm) addSystem('Usage: /teleport character_name'); else addSystem('Unknown command. Try /help.'); return;
        } else if (/^\/(help|\?)/i.test(text)) {
            if (S.gm) addSystem('Gamemaster: /gm switches GM mode on and off, /teleport name jumps next to a character (put names with spaces in \"quotes\").');
            addSystem('Chat: /w name text (whisper; put names with spaces in \"quotes\"), /g text (group), /l text (nearby), /invite name, /friend name, /unfriend name, /leave, /who. The box next to SEND picks the default channel.');
            return;
        } else if (text.startsWith('/')) { addSystem('Unknown command. Try /help.'); return; }
        const r = await api('chat', { ch, to, text });
        if (!r.ok) addSystem(r.net ? 'The server could not be reached.' : r.error);
        else pollSoon(80);
    }

    // ------------------------------------------------------------------------------ gamemasters
    // The server decides who is a Gamemaster (flag set on the admin page) and whether GM mode is on. In GM mode the hero is
    // marked `gm`: drawn in a plain blue hood and robe (heroart.js) and never reduced below 1 HP (game.js).
    function applyGmState(m) {
        S.gm = !!(m && m.gm);
        S.gmOn = !!(m && m.gmOn);
        let changed = false;
        state.party.forEach(h => {
            if (h.owner && me && h.owner !== me.id) return;
            if (S.gmOn) { if (!h.gm) { h.gm = true; if (h.hp <= 0) h.hp = h.maxHp; changed = true; } }
            else if (h.gm) { delete h.gm; changed = true; }
        });
        if (changed) updateUI();
    }
    async function gmCommand(cmd, name) {
        if (!S.gm) { addSystem('Unknown command. Try /help.'); return; }
        const r = await api('gm', { cmd, name });
        if (!r.ok) { addSystem(r.net ? 'The server could not be reached.' : r.error); return; }
        if (cmd === 'toggle') { applyGmState({ gm: true, gmOn: r.gmOn }); addSystem(r.msg); pollSoon(80); return; }
        gmTeleport(r.target);
    }
    function gmTeleport(t) {
        if (S.battle || state.mode === 'COMBAT') { addSystem('Thou canst not teleport during a battle.'); return; }
        if (state.overworld.inShip) { addSystem('Disembark from thy ship first.'); return; }
        const ow = state.overworld, sc = String(t.scene || '');
        if (sc === 'OW') {
            const w = ow.width, h = ow.height, bad = [TILE.WATER, TILE.RIVER, TILE.SIGNPOST, TILE.LIGHTHOUSE];
            const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
            if (!t.ship) spots.push([0, 0]);
            const at = spots.map(([dx, dy]) => [((t.x + dx) % w + w) % w, Math.max(0, Math.min(h - 1, t.y + dy))]).find(([x, y]) => !bad.includes(getWorldTile(x, y)));
            if (!at) { addSystem(`No dry land next to ${t.name}.`); return; }
            ow.x = at[0]; ow.y = at[1];
            state.mode = 'OVERWORLD';
            updateFogOfWar();
        } else if (sc.startsWith('T:')) {
            const name = sc.slice(2), lm = ow.landmarks.find(l => l.name === name);
            if (!lm) { addSystem(`${t.name} stands in a place that cannot be found.`); return; }
            if (!(state.mode === 'TOWN' && state.town.name === name)) generateTown(lm);
            state.town.x = t.x; state.town.y = t.y;
            state.mode = 'TOWN';
        } else if (sc.startsWith('D:')) {
            const i = sc.lastIndexOf(':'), name = sc.slice(2, i), level = parseInt(sc.slice(i + 1), 10) || 1;
            if (!(state.mode === 'DUNGEON' && state.dungeon.name === name && state.dungeon.level === level)) {
                state.dungeon.name = name; state.dungeon.level = level; state.dungeon.grids = {};
                getDungeonLevelGrid(level);
            }
            state.dungeon.x = t.x; state.dungeon.y = t.y;
            state.mode = 'DUNGEON';
        } else { addSystem(`${t.name} cannot be reached.`); return; }
        addSystem(`Thou teleportest to ${t.name}.`);
        updateUI();
        saveSoon();
        pollSoon(80);
    }

    // ------------------------------------------------------------------------------ players & groups
    function where(p) {
        if (p.mode === 'COMBAT') return 'in battle';
        if (p.mode === 'TOWN') return p.loc || 'town';
        if (p.mode === 'DUNGEON') return p.loc || 'dungeon';
        return 'overworld';
    }
    async function groupAction(body) {
        const r = await api('group', body);
        if (r.msg) addSystem(r.msg);
        if (!r.ok && r.error) addSystem(r.error);
        pollSoon(80);
        return r;
    }
    // ------------------------------------------------------------------------------ friends
    async function friendAction(body) {
        const r = await api('friend', body);
        if (r.msg) addSystem(r.msg);
        if (!r.ok && r.error) addSystem(r.error);
        S.frSig = ''; pollSoon(80);
        return r;
    }
    function renderFriendsTab() {
        const list = $('friends-list');
        if (!list || currentTab() !== 'friends') return;
        const sig = JSON.stringify(S.friends);
        if (sig === S.frSig) return;
        S.frSig = sig;
        list.innerHTML = '';
        if (!S.friends.length) { const e = document.createElement('div'); e.className = 'text-slate-500 text-[11px] px-1'; e.textContent = 'No friends yet. Type a character name above, press +Friend in the Players tab, or use /friend name.'; list.appendChild(e); return; }
        S.friends.forEach(f => {
            const row = document.createElement('div');
            row.className = 'pl-row';
            const dot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:${f.online ? '#34d399' : '#475569'}"></span>`;
            const info = f.online ? `Lv${f.lvl} ${esc(f.cls || '')} &middot; ${f.battle ? '⚔ in battle' : esc(where(f))}` : (f.lvl ? `Lv${f.lvl} ${esc(f.cls || '')} &middot; offline` : 'offline');
            row.innerHTML = `<span style="color:${f.online ? '#e2e8f0' : '#64748b'};font-weight:700;white-space:nowrap">${dot}${f.afk ? '[AFK] ' : ''}${esc(f.name)}</span><span style="flex:1;min-width:0;font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${info}</span>`;
            if (f.online) {
                const w = document.createElement('button'); w.className = 'pl-btn'; w.textContent = 'Whisper'; w.onclick = () => focusChat(`/w "${f.name}" `); row.appendChild(w);
                if (!S.group || !S.group.members.some(m => m.id === f.id)) { const i = document.createElement('button'); i.className = 'pl-btn go'; i.textContent = 'Invite'; i.onclick = () => groupAction({ act: 'invite', name: f.name }); row.appendChild(i); }
            }
            const x = document.createElement('button'); x.className = 'pl-btn'; x.textContent = '✕'; x.title = 'Remove from friends'; x.onclick = () => friendAction({ act: 'remove', id: f.id }); row.appendChild(x);
            list.appendChild(row);
        });
    }
    function renderPlayersTab() {
        const list = $('players-list');
        if (!list) return;
        const pb = $('players-badge');
        const sig = JSON.stringify(S.online.map(p => [p.id, p.lvl, p.mode, p.loc, p.grp, p.afk])) + (S.group ? S.group.id : 0);
        if (currentTab() !== 'players' || sig === S.plSig) return;
        S.plSig = sig;
        pb.classList.add('hidden');
        list.innerHTML = '';
        const head = document.createElement('div');
        head.className = 'pl-row me';
        head.innerHTML = `<span style="color:#fcd34d;font-weight:700">${esc(hn())}</span><span class="text-slate-400" style="flex:1;font-size:10px">you</span>`;
        list.appendChild(head);
        if (!S.online.length) { const e = document.createElement('div'); e.className = 'text-slate-500 text-[11px] px-1'; e.textContent = 'Nobody else is online right now.'; list.appendChild(e); }
        S.online.forEach(p => {
            const row = document.createElement('div');
            row.className = 'pl-row' + (p.mine ? ' mine' : '');
            row.innerHTML = `<span style="color:${p.mine ? '#6ee7b7' : '#e2e8f0'};font-weight:700;white-space:nowrap">${p.afk ? "[AFK] " : ""}${esc(p.name)}</span><span style="flex:1;min-width:0;font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Lv${p.lvl} ${esc(p.cls || '')} &middot; ${esc(where(p))}</span>`;
            const w = document.createElement('button'); w.className = 'pl-btn'; w.textContent = 'Whisper'; w.onclick = () => focusChat(`/w "${p.name}" `);
            row.appendChild(w);
            if (!S.friends.some(f => f.id === p.id)) { const fb = document.createElement('button'); fb.className = 'pl-btn'; fb.textContent = '+Friend'; fb.onclick = () => friendAction({ act: 'add', name: p.name }); row.appendChild(fb); }
            if (!p.grp) { const i = document.createElement('button'); i.className = 'pl-btn go'; i.textContent = 'Invite'; i.onclick = () => groupAction({ act: 'invite', name: p.name }); row.appendChild(i); }
            list.appendChild(row);
        });
    }
    // Group members are listed under ADVENTURERS, below thy own champion.
    function renderGroupBox() {
        const hint = $('group-box'), box = $('group-container');
        const g = S.group;
        if (hint) hint.textContent = g ? 'Thy group is shown under ADVENTURERS (left).' : 'Not in a group. Invite a player to adventure together: group members within 10 tiles are pulled into each other\'s battles.';
        if (!box) return;
        const sig = g ? JSON.stringify(g.members.map(m => [m.id, m.hp, m.mhp, m.online, m.mode, m.loc, m.battle, m.lvl, m.afk])) + g.leader + (S.battle ? 1 : 0) + state.mode : 'none';
        if (sig === S.grpSig) return;
        S.grpSig = sig;
        box.innerHTML = '';
        if (!g) return;
        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1e293b;padding-top:6px;margin-top:2px';
        head.innerHTML = '<b style="color:#6ee7b7;font-size:11px;letter-spacing:.08em">GROUP</b>';
        const leave = document.createElement('button');
        leave.className = 'pl-btn'; leave.textContent = 'Leave group'; leave.onclick = () => groupAction({ act: 'leave' });
        head.appendChild(leave);
        box.appendChild(head);
        g.members.filter(m => m.id !== me.id).forEach(m => {
            const pct = m.mhp > 0 ? Math.max(0, Math.min(1, m.hp / m.mhp)) : 0;
            const cls = pct < 0.3 ? ' low' : (pct < 0.6 ? ' mid' : '');
            const card = document.createElement('div');
            card.className = 'pc' + (m.online ? '' : ' dead');
            card.style.cursor = 'default';
            card.innerHTML = `<canvas width="88" height="96" style="width:88px;height:96px;border-radius:10px;background:radial-gradient(ellipse at 50% 30%,#1e2b4a,#0b1220);border:1px solid #334155;flex-shrink:0"></canvas>
                <div style="flex:1;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11.5px">
                        <span style="font-weight:700;color:${m.online ? '#6ee7b7' : '#64748b'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.id === g.leader ? '★ ' : ''}${m.afk ? '[AFK] ' : ''}${esc(m.name)}${m.afk ? ' <span style="color:#bae6fd">z z Z</span>' : ''}</span>
                        <span style="color:#67e8f9;font-size:10px;white-space:nowrap">Lv${m.lvl} ${esc(m.cls || '')}</span>
                    </div>
                    <div class="bar hp${cls}" style="margin-top:4px"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
                    <div class="bar-l"><span>${m.online ? `HP ${m.hp}/${m.mhp}` : 'offline'}</span><span style="color:#94a3b8">${m.online ? (m.battle ? '⚔ in battle' : esc(where(m))) : ''}</span></div>
                </div>`;
            const side = card.lastElementChild;
            if (g.leader === me.id) {
                const k = document.createElement('button'); k.className = 'pl-btn'; k.style.marginTop = '3px'; k.textContent = 'Remove'; k.onclick = () => groupAction({ act: 'kick', id: m.id });
                side.appendChild(k);
            }
            if (m.battle && !S.battle && state.mode !== 'COMBAT') {
                const j = document.createElement('button'); j.className = 'pl-btn go'; j.style.cssText = 'margin-top:3px;margin-left:4px'; j.textContent = 'Join battle'; j.onclick = () => joinBattle(m.battle, false, m.name);
                side.appendChild(j);
            }
            box.appendChild(card);
            try { drawHeroCharacterVector(card.querySelector('canvas').getContext('2d'), -21, 0, 130, m.cls || 'Fighter', false, m.race || 'Human', m.look || {}); } catch (e) { /* art is optional */ }
        });
    }
    function handleInvites() {
        const el = $('invite-prompt');
        const inv = S.invites.find(i => !S.seenInvites.has(i.id));
        if (!inv) { if (!S.invites.length) el.classList.add('hidden'); return; }
        S.curInvite = inv;
        $('invite-text').textContent = `${inv.from} invites thee to join their group.`;
        if (el.classList.contains('hidden')) sfx.play('gold');
        el.classList.remove('hidden');
    }
    async function answerInvite(accept) {
        const inv = S.curInvite;
        $('invite-prompt').classList.add('hidden');
        if (!inv) return;
        S.seenInvites.add(inv.id);
        const r = await groupAction({ act: 'reply', id: inv.id, accept });
        if (r.ok && accept) showTab('players');
    }

    // ------------------------------------------------------------------------------ the map: other players and fights
    function wrapDx(x, px, w) {
        let d = x - px;
        if (d > w / 2) d -= w; else if (d < -w / 2) d += w;
        return d;
    }
    // a group member aboard someone else's ship rides along; when the helmsman leaves the ship (or the sea), so do they
    function shipToBoard() {
        if (!S.group || !me || state.mode !== 'OVERWORLD') return null;
        const w = state.overworld.width;
        return S.near.find(p => p.ship && !p.aboard && p.mode === 'OVERWORLD' && S.group.members.some(m => m.id === p.id) && Math.abs(wrapDx(p.x, state.overworld.x, w)) <= 1 && Math.abs(p.y - state.overworld.y) <= 1) || null;
    }
    function boardShipOf(p) {
        state.overworld.passengerOf = p.id; state.overworld.passengerShip = p.sname || '';
        state.overworld.x = p.x; state.overworld.y = p.y; state.overworld.inShip = true;
        S.shipMissing = 0;
    }
    function followShipOwner() {
        const id = state.overworld.passengerOf;
        if (!id) return;
        const p = S.near.find(q => q.id === id);
        if (p && p.ship && p.mode === 'OVERWORLD' && !p.aboard) {
            S.shipMissing = 0;
            if (p.x !== state.overworld.x || p.y !== state.overworld.y) { state.overworld.x = p.x; state.overworld.y = p.y; state.overworld.passengerShip = p.sname || state.overworld.passengerShip; updateFogOfWar(); updateUI(); }
        } else if (++S.shipMissing >= 2) {
            S.shipMissing = 0;
            leaveShipAsPassenger();
        }
    }
    function nameTag(ctx, text, x, y, color) {
        ctx.save();
        ctx.font = "bold 9px 'JetBrains Mono'";
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(2,6,23,0.92)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color || '#e2e8f0';
        ctx.fillText(text, x, y);
        ctx.restore();
    }
    function bubble(ctx, name, x, y) {
        const b = S.bubbles[name];
        if (!b) return;
        if (performance.now() > b.until) { delete S.bubbles[name]; return; }
        ctx.save();
        ctx.font = "10px 'JetBrains Mono'";
        const w = Math.min(190, ctx.measureText(b.text).width + 12);
        const bx = x - w / 2, by = y - 18;
        ctx.fillStyle = 'rgba(248,250,252,0.95)';
        ctx.beginPath(); ctx.roundRect(bx, by - 14, w, 17, 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 4, by + 3); ctx.lineTo(x, by + 8); ctx.lineTo(x + 4, by + 3); ctx.fill();
        ctx.fillStyle = b.ch === 'group' ? '#0e7490' : (b.ch === 'whisper' ? '#be185d' : '#0f172a');
        ctx.textAlign = 'center';
        ctx.fillText(b.text.length * 5.6 > w ? b.text.slice(0, Math.floor(w / 5.6)) : b.text, x, by - 2);
        ctx.restore();
    }
    // where each nearby player stood a step ago, so their pet can trot behind them
    function trackTrails() {
        S.trail = S.trail || {};
        S.near.forEach(p => {
            const rec = S.trail[p.id] || (S.trail[p.id] = { x: p.x, y: p.y, px: p.x, py: p.y, sc: p.scene });
            if (rec.sc !== p.scene) { rec.x = rec.px = p.x; rec.y = rec.py = p.y; rec.sc = p.scene; }
            else if (rec.x !== p.x || rec.y !== p.y) { rec.px = rec.x; rec.py = rec.y; rec.x = p.x; rec.y = p.y; }
        });
    }
    function playerToken(ctx, p, sx, sy, size) {
        const grp = S.group && S.group.members.some(m => m.id === p.id);
        ctx.save();
        const camped = p.rest && p.mode === 'OVERWORLD' && !p.ship;
        if (camped) {
            drawCampSite(ctx, sx, sy, size, animTick, true);
        } else if (p.ship) {
            drawShipVector(ctx, sx, sy, size, animTick * 0.07);
        } else {
            ctx.globalAlpha = 0.96;
            drawHeroCharacterVector(ctx, sx, sy, size, p.cls, false, p.race, p.look);
        }
        ctx.restore();
        if (p.pet && !p.ship && !camped && typeof drawPetVector === 'function') {
            const rec = S.trail && S.trail[p.id];
            let ox = rec ? rec.px - p.x : 0, oy = rec ? rec.py - p.y : 0;
            if (Math.abs(ox) > 3 || Math.abs(oy) > 3) { ox = 0; oy = 0; }
            const face = ox !== 0 ? (ox < 0 ? 1 : -1) : 1;
            drawPetAt(ctx, sx, sy, size, p.pet, animTick, face, !!(ox || oy), (p.idle || 0) * 1000);
        }
        if (grp) { ctx.strokeStyle = 'rgba(52,211,153,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx + size / 2, sy + size * 0.93, size * 0.32, size * 0.08, 0, 0, 7); ctx.stroke(); }
        // a ship carries only her own name (and how many are aboard besides the helmsman)
        const crew = p.ship ? S.near.filter(q => q.aboard === p.id).length : 0;
        nameTag(ctx, p.ship ? ((p.sname || 'Sea Frigate') + (crew ? ` (+${crew})` : '')) : ((p.afk ? '[AFK] ' : '') + p.name), sx + size / 2, sy - 2, grp ? '#6ee7b7' : '#bae6fd');
        if (p.afk && !camped) zzz(ctx, sx, sy, size);
        if (p.rest && !camped) {
            ctx.save(); ctx.fillStyle = '#bae6fd'; ctx.font = `bold ${Math.round(size * 0.3)}px 'Cinzel'`; ctx.textAlign = 'center';
            const f = (animTick * 0.02) % 1;
            ctx.globalAlpha = 1 - f; ctx.fillText('z', sx + size * 0.8 + f * 6, sy + size * 0.1 - f * 12); ctx.restore();
        }
        bubble(ctx, p.name, sx + size / 2, sy - 8);
    }
    // two tiny figures brawling in a cloud of dust, crossed swords flashing above: someone is fighting here
    function drawMockBattle(ctx, sx, sy, size, b) {
        const t = animTick;
        const host = S.near.find(p => p.name === b.host);
        const cx = sx + size / 2, cy = sy + size / 2;
        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.18);
        ctx.fillStyle = `rgba(190,30,30,${0.18 + 0.12 * pulse})`;
        ctx.beginPath(); ctx.arc(cx, cy + size * 0.1, size * 0.62, 0, 7); ctx.fill();
        // fighters
        const shake = (k) => Math.sin(t * 0.7 + k) * size * 0.025;
        ctx.save(); ctx.translate(shake(0), 0);
        drawHeroCharacterVector(ctx, sx - size * 0.08, sy + size * 0.06, size * 0.72, host ? host.cls : 'Fighter', false, host ? host.race : null, host ? host.look : null);
        ctx.restore();
        ctx.save(); ctx.translate(shake(2.4), 0);
        drawMonsterVectorOnContext(ctx, sx + size * 0.38, sy + size * 0.06, size * 0.72, b.shape || 'orc', '#ef4444');
        ctx.restore();
        // dust puffs
        for (let i = 0; i < 6; i++) {
            const a = t * 0.12 + i * 1.05, r = size * (0.22 + 0.1 * Math.sin(t * 0.2 + i));
            ctx.fillStyle = `rgba(214,200,170,${0.22 + 0.18 * Math.sin(t * 0.1 + i)})`;
            ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 1.5, sy + size * 0.78 + Math.sin(a) * r * 0.35, size * 0.12, 0, 7); ctx.fill();
        }
        // clash sparks
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
            const q = ((t * 0.09) + i * 0.2) % 1, a = i * 1.7 + Math.floor(t * 0.09 + i * 0.2) * 2.3;
            const px = cx + Math.cos(a) * q * size * 0.4, py = cy - size * 0.05 + Math.sin(a) * q * size * 0.3;
            ctx.fillStyle = `rgba(255,${200 + (i * 11) % 55},120,${1 - q})`;
            ctx.fillRect(px, py, 2, 2);
        }
        ctx.globalCompositeOperation = 'source-over';
        // crossed swords
        const bob = Math.sin(t * 0.12) * size * 0.04;
        ctx.translate(cx, sy - size * 0.1 + bob);
        ctx.lineCap = 'round';
        [-1, 1].forEach(d => {
            ctx.save(); ctx.rotate(d * 0.7);
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = Math.max(2, size * 0.06);
            ctx.beginPath(); ctx.moveTo(0, size * 0.18); ctx.lineTo(0, -size * 0.2); ctx.stroke();
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = Math.max(2, size * 0.05);
            ctx.beginPath(); ctx.moveTo(-size * 0.07, size * 0.1); ctx.lineTo(size * 0.07, size * 0.1); ctx.stroke();
            ctx.restore();
        });
        ctx.restore();
        nameTag(ctx, `⚔ ${b.host}${b.n > 1 ? ' +' + (b.n - 1) : ''} vs ${b.label || b.foes + ' foes'}`, cx, sy - size * 0.34, b.group ? '#6ee7b7' : '#fca5a5');
    }

    function renderOverworldExtras(ctx, g) {
        if (!me || !S.ready) return;
        const { px, py, w, centerPx, centerPy, tileSize, halfCols, halfRows, los } = g;
        const inView = (dx, dy) => Math.abs(dx) <= halfCols && Math.abs(dy) <= halfRows;
        const visible = (dx, dy) => dx * dx + dy * dy <= los * los + 1 && (!g.vis || g.vis(dx, dy));
        // fights
        S.battles.forEach(b => {
            const dx = wrapDx(b.x, px, w), dy = b.y - py;
            if (!inView(dx, dy) || !(visible(dx, dy) || b.group)) return;
            if (S.battle && S.battle.id === b.id) return;
            drawMockBattle(ctx, centerPx + dx * tileSize, centerPy + dy * tileSize, tileSize, b);
        });
        // other adventurers (group mates are always shown; strangers only inside the sight radius)
        S.near.forEach(p => {
            if (p.mode === 'COMBAT' || p.battle) return;
            if (p.mode !== 'OVERWORLD') return;
            if (p.aboard) return;                                  // passengers are drawn as part of their ship
            const dx = wrapDx(p.x, px, w), dy = p.y - py;
            if (!inView(dx, dy)) return;
            const grp = S.group && S.group.members.some(m => m.id === p.id);
            if (!visible(dx, dy) && !grp) return;
            playerToken(ctx, p, centerPx + dx * tileSize, centerPy + dy * tileSize, tileSize);
        });
        // my own speech bubble / name
        const mine = myParty()[0];
        {
            const sailing = state.overworld.inShip;
            const shipN = state.overworld.passengerOf ? (state.overworld.passengerShip || 'Sea Frigate') : ((playerShip() || {}).name || 'Sea Frigate');
            const crew = sailing && !state.overworld.passengerOf ? S.near.filter(q => q.aboard === me.id).length : 0;
            nameTag(ctx, sailing ? shipN + (crew ? ` (+${crew})` : '') : ((selfAfk() ? '[AFK] ' : '') + hn()), centerPx + tileSize / 2, centerPy - 2, '#fde68a');
        }
        if (selfAfk()) zzz(ctx, centerPx, centerPy, tileSize);
        bubble(ctx, hn(), centerPx + tileSize / 2, centerPy - 8);
        if (S.battles.length || S.near.length) { /* nothing more */ }
        void mine;
    }
    function renderTownExtras(ctx, g) {
        if (!me || !S.ready) return;
        const { px, py, centerPx, centerPy, tileSize } = g;
        S.near.forEach(p => {
            if (p.mode !== 'TOWN' || p.battle) return;
            const sx = centerPx + (p.x - px) * tileSize, sy = centerPy + (p.y - py) * tileSize;
            if (sx > viewWidth || sy > viewHeight || sx + tileSize < 0 || sy + tileSize < 0) return;
            if (g.sees && !g.sees(p.x, p.y)) return;
            playerToken(ctx, p, sx, sy, tileSize);
        });
        nameTag(ctx, (selfAfk() ? '[AFK] ' : '') + hn(), centerPx + tileSize / 2, centerPy - 2, '#fde68a');
        if (selfAfk()) zzz(ctx, centerPx, centerPy, tileSize);
        bubble(ctx, hn(), centerPx + tileSize / 2, centerPy - 8);
    }

    // ------------------------------------------------------------------------------ joining battles
    function busy() {
        return state.dialogue.active || state.inventoryMenu.active || state.chestPrompt.active || state.campPrompt.active || state.shipNaming.active || state.lootPopup;
    }
    function checkBattleProximity() {
        if (!me || S.battle || state.mode === 'COMBAT' || state.camping.active || state.sleeping) { hidePrompt(); return; }
        const m = state.mode;
        if (m === 'TOWN' || (m === 'OVERWORLD' && state.overworld.inShip)) { hidePrompt(); return; }
        const [x, y] = posXY();
        let best = null, bd = 99;
        S.battles.forEach(b => {
            if (b.full || b.n >= 4) return;
            const dx = m === 'OVERWORLD' ? Math.abs(wrapDx(b.x, x, state.overworld.width)) : Math.abs(b.x - x), dy = Math.abs(b.y - y), d = Math.max(dx, dy);
            if (b.group && d <= GROUP_RANGE && !S.declined.has(b.id)) { S.declined.add(b.id); joinBattle(b.id, true, b.host); return; }
            if (d <= (m === 'DUNGEON' ? 2 : JOIN_RANGE) && !S.declined.has(b.id) && d < bd) { bd = d; best = b; }
        });
        if (best && !busy()) showPrompt(best); else hidePrompt();
    }
    function showPrompt(b) {
        S.prompt = b;
        $('join-text').textContent = `⚔ ${b.host}'s champion is fighting ${b.label || 'monsters'}! Join the battle?`;
        const el = $('join-prompt');
        if (el.classList.contains('hidden')) sfx.play('danger');
        el.classList.remove('hidden');
    }
    function hidePrompt() { S.prompt = null; $('join-prompt').classList.add('hidden'); }
    function answerJoin(yes) {
        const b = S.prompt;
        hidePrompt();
        if (!b) return;
        S.declined.add(b.id);
        if (yes) joinBattle(b.id, false, b.host);
    }

    // ------------------------------------------------------------------------------ battle sync: shared helpers
    const SNAP_KEYS = ['width', 'height', 'terrainType', 'grid', 'isMimicFight', 'activeHeroIdx', 'heroes', 'enemies', 'allies', 'fields', 'freeze', 'eclipse', 'fledCount', 'goldPool', 'turnNo', 'round', 'template'];

    function isShared() {
        if (!me || !S.battle || state.mode !== 'COMBAT') return false;
        return new Set(state.party.map(h => h.owner).filter(Boolean)).size > 1;
    }
    function ownersCount() { return new Set(state.party.map(h => h.owner).filter(Boolean)).size; }
    function isMyTurn() {
        if (!me || !S.battle || state.mode !== 'COMBAT') return true;
        const h = state.party[state.combat.activeHeroIdx];
        if (!h) return false;
        if (S.battle.pending != null) return false;
        return !h.owner || h.owner === me.id;
    }
    function turnOwnerName() {
        const h = state.party[state.combat.activeHeroIdx];
        return h && h.owner && h.owner !== (me && me.id) && h.ownerName ? h.ownerName : '';
    }

    function refOf(pick) {
        if (!pick) return null;
        let i = state.combat.enemies.indexOf(pick);
        if (i >= 0) return { t: 'e', i };
        i = state.party.indexOf(pick);
        if (i >= 0) return { t: 'h', i };
        return null;
    }
    function resolveRef(r) {
        if (!r) return undefined;
        return r.t === 'e' ? state.combat.enemies[r.i] : state.party[r.i];
    }

    // GUEST: forward an action to the host instead of running it; HOST: false (run it yourself)
    function guard(kind, payload) {
        const B = S.battle;
        if (!me || !B || B.role !== 'guest' || B.applying || state.mode !== 'COMBAT') return false;
        if (!isMyTurn()) return true;
        B.pending = state.combat.turnNo;
        B.pendingAt = performance.now();
        state.combat.awaitingAction = null;
        $('action-prompt').classList.add('hidden');
        if (state.combat.targeting) cancelTargeting(true);
        api('battle_intent', { id: B.id, kind, turn: state.combat.turnNo, payload });
        pollSoon(120);
        return true;
    }

    function tagOwn() {
        state.party.forEach(h => { h.owner = me.id; h.ownerName = h.name; });
        state.combat.heroes.forEach(u => { u.owner = me.id; });
    }

    function serializeFx(list) {
        const c = state.combat;
        const ref = (u) => {
            let i = c.heroes.indexOf(u); if (i >= 0) return ['h', i];
            i = c.enemies.indexOf(u); if (i >= 0) return ['e', i];
            i = (c.allies || []).indexOf(u); if (i >= 0) return ['a', i];
            return null;
        };
        const out = [];
        list.forEach(f => {
            const o = Object.assign({}, f);
            if (f.unit) { const r = ref(f.unit); if (!r) return; o.unit = r; }
            o.t0 = f.t0 - animTick;
            if (f.tDie !== undefined) o.tDie = f.tDie - animTick;
            out.push(o);
        });
        return out;
    }

    function buildSnapshot() {
        const c = state.combat;
        const comb = {};
        SNAP_KEYS.forEach(k => { comb[k] = c[k]; });
        const snap = {
            combat: clone(comb),
            party: clone(state.party),
            fx: serializeFx(c.fx || []),
            texts: (c.floatingTexts || []).map(t => Object.assign({}, t, { at: t.at ? t.at - animTick : 0 })),
            logs: S.logBuf.splice(0),
            armageddonUsed: state.armageddonUsed
        };
        snap.combat.turnAge = performance.now() - (c.turnStart || performance.now());
        (snap.combat.fields || []).forEach(f => { if (f.born != null) f.born -= animTick; });
        (snap.combat.allies || []).forEach(a => { if (a.appear) a.appear -= animTick; });
        return snap;
    }

    function applySnapshot(snap, B) {
        const c = state.combat;
        S.applyingSnap = true;
        try {
            const sameTurn = c.turnNo === snap.combat.turnNo && state.party.length === snap.party.length && !B.firstApply;
            if (!sameTurn && c.targeting) cancelTargeting(true);
            state.party = snap.party;
            SNAP_KEYS.forEach(k => { if (snap.combat[k] !== undefined) c[k] = snap.combat[k]; });
            (c.fields || []).forEach(f => { if (f.born != null) f.born += animTick; });
            (c.allies || []).forEach(a => { if (a.appear) a.appear += animTick; });
            [...(c.enemies || []), ...(c.allies || [])].forEach(u => { if (u.uid) unitSeq = Math.max(unitSeq, u.uid); });
            c.fromMode = B.returnMode;
            c.roamerRef = null;
            c.ending = false;
            c.turnStart = performance.now() - (snap.combat.turnAge || 0);
            if (!c.fx) c.fx = [];
            if (!c.floatingTexts) c.floatingTexts = [];
            (snap.fx || []).forEach(f => {
                if (B.seenFx.has(f.id)) return;
                B.seenFx.add(f.id);
                fxSeq = Math.max(fxSeq, f.id);
                const n = Object.assign({}, f);
                n.t0 = f.t0 + animTick;
                if (f.tDie !== undefined) n.tDie = f.tDie + animTick;
                if (f.unit) {
                    const list = f.unit[0] === 'h' ? c.heroes : (f.unit[0] === 'e' ? c.enemies : c.allies);
                    n.unit = list && list[f.unit[1]];
                    if (!n.unit) return;
                }
                c.fx.push(n);
            });
            (snap.texts || []).forEach(t => {
                if (B.seenTx.has(t.id)) return;
                B.seenTx.add(t.id);
                ftSeq = Math.max(ftSeq, t.id);
                c.floatingTexts.push(Object.assign({}, t, { at: t.at ? t.at + animTick : 0 }));
            });
            if (B.seenFx.size > 600) { const lim = fxSeq - 300; B.seenFx.forEach(i => { if (i < lim) B.seenFx.delete(i); }); }
            if (B.seenTx.size > 600) { const lim = ftSeq - 300; B.seenTx.forEach(i => { if (i < lim) B.seenTx.delete(i); }); }
            (snap.logs || []).forEach(l => addLog(l.msg, l.cls));
            state.armageddonUsed = !!snap.armageddonUsed;
        } finally { S.applyingSnap = false; }
        B.firstApply = false;
        if (B.pending != null && c.turnNo !== B.pending) B.pending = null;
    }

    // ------------------------------------------------------------------------------ battle sync: HOST
    function combatStarted() {
        if (!me || !S.ready) return;
        const c = state.combat;
        const B = S.battle = newBattleSession('host', c.fromMode);
        B.seq = 0;
        tagOwn();
        state.party.forEach((h, i) => { if (c.heroes[i]) c.heroes[i].owner = me.id; });
        c.net = true;
        startOnServer(B);
    }
    function newBattleSession(role, returnMode) {
        return { id: null, role, seq: 0, iseq: 0, returnMode, queue: [], afk: {}, dirty: false, inflight: false, chain: Promise.resolve(),
                 seenFx: new Set(), seenTx: new Set(), pending: null, firstApply: true, players: [], exiting: false, joinAt: performance.now(), startedAt: Date.now() };
    }
    async function startOnServer(B) {
        const c = state.combat, tpl = c.template || {};
        const [x, y] = posXY();
        const label = `${c.enemies.length}x ${tpl.name || 'foes'}`;
        const r = await api('battle_start', {
            mode: c.fromMode, scene: sceneKey(), loc: c.fromMode === 'DUNGEON' ? `${state.dungeon.name} F${state.dungeon.level}` : '',
            x, y, label, shape: tpl.shape || 'orc', foes: c.enemies.length, snapshot: buildSnapshot()
        });
        if (!r.ok) { if (S.battle === B) { S.battle = null; } return; }
        B.id = r.id; B.seq = 1;
        if (B.exiting) {          // the fight was over before the server answered
            api('battle_snapshot', { id: B.id, snapshot: B.finalSnap || buildSnapshot(), ended: true, result: B.finalResult || { outcome: 'escape' } });
            return;
        }
        if (B.dirty) flush(B);
        pollSoon(100);
    }
    function publish() {
        const B = S.battle;
        if (!B || B.role !== 'host') return;
        B.dirty = true;
        flush(B);
    }
    function flush(B) {
        if (!B.id || B.inflight || !B.dirty || B.exiting) return;
        B.inflight = true; B.dirty = false;
        const snap = buildSnapshot();
        const logs = snap.logs.slice();
        api('battle_snapshot', { id: B.id, snapshot: snap, foes: state.combat.enemies.length }).then(r => {
            B.inflight = false;
            if (r.ok) { B.seq = Math.max(B.seq, r.seq || 0); }
            else if (r.notHost) { /* a new host took over: the next poll demotes us */ }
            else { S.logBuf = logs.concat(S.logBuf); B.dirty = true; }
            if (B.dirty && S.battle === B) setTimeout(() => flush(B), r.ok ? 0 : 800);
        });
    }

    // tell the player when the turn passes to one of their heroes in a shared battle
    function notifyTurn() {
        if (!me || !isShared()) { S.lastActiveOwner = null; return; }
        const h = state.party[state.combat.activeHeroIdx];
        const owner = h ? h.owner : null;
        if (owner === me.id && S.lastActiveOwner !== me.id) { sfx.play('spell'); addLog(`⚔ Thy turn: ${h.name}!`, 'text-yellow-300 font-bold'); }
        S.lastActiveOwner = owner;
    }

    function combatChanged() {
        const B = S.battle;
        if (!B) return;
        notifyTurn();
        if (B.role === 'host') {
            // all of MY heroes fled (or fell with at least one fled): leave and let the others carry on
            checkMyExit();
            publish();
        }
    }
    function myUnits() {
        return state.party.map((h, i) => ({ h, u: state.combat.heroes[i] })).filter(x => x.h.owner === me.id);
    }
    let leaving = false;
    function checkMyExit() {
        if (!me || leaving || state.mode !== 'COMBAT' || state.combat.ending) return;
        const mine = myUnits();
        if (!mine.length) return;
        const out = mine.every(x => x.h.hp <= 0 || (x.u && x.u.fled));
        const anyFled = mine.some(x => x.u && x.u.fled);
        const othersIn = state.party.some((h, i) => h.owner !== me.id && h.hp > 0 && state.combat.heroes[i] && !state.combat.heroes[i].fled);
        if (out && anyFled && othersIn && state.combat.enemies.length) {
            leaving = true;
            setTimeout(() => { leaving = false; if (state.mode === 'COMBAT') endCombatEscape(`${hn()} slips away from the shared battle.`, true); }, 500);
        }
    }

    // heroes arriving over the network are rebuilt from a whitelist and clamped: the host's browser runs their rules
    function sanitizeJoinHero(raw) {
        const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d; };
        const race = RACES[raw.race] ? raw.race : 'Human', cls = CLASSES[raw.cls] ? raw.cls : 'Fighter';
        const lvl = n(raw.lvl, 1, MAX_LEVEL, 1);
        const maxHp = n(raw.maxHp, 1, 60 * lvl + 100, 10), maxMp = n(raw.maxMp, 0, 40 * lvl + 100, 0);
        const h = {
            name: cleanHeroName(raw.name), race, cls, lvl, xp: n(raw.xp, 0, 1e6, 0),
            hp: n(raw.hp, 0, maxHp, maxHp), maxHp, mp: n(raw.mp, 0, maxMp, maxMp), maxMp,
            str: n(raw.str, 1, 32, 10), dex: n(raw.dex, 1, 32, 10), int: n(raw.int, 1, 32, 10), wis: n(raw.wis, 1, 32, 10),
            weaponIdx: n(raw.weaponIdx, -1, WEAPONS.length - 1, 0), armorIdx: n(raw.armorIdx, -1, ARMORS.length - 1, 0), headIdx: n(raw.headIdx, -1, HEADS.length - 1, -1),
            shieldIdx: n(raw.shieldIdx, -1, (typeof SHIELDS !== 'undefined' ? SHIELDS.length - 1 : 10), -1), rb: 2,
            ...cleanLook(raw),
            poisoned: !!raw.poisoned, toad: !!raw.toad, cMiss: !!raw.cMiss, boots: !!raw.boots, wMag: cleanMagicItem(raw.wMag), aMag: cleanMagicItem(raw.aMag), hMag: cleanMagicItem(raw.hMag), sMag: cleanMagicItem(raw.sMag)
        };
        if (h.wMag) h.weaponIdx = h.wMag.b;
        if (h.aMag) h.armorIdx = h.aMag.b;
        if (h.hMag) h.headIdx = h.hMag.b;
        if (h.sMag) h.shieldIdx = h.sMag.b;
        return h;
    }

    function mergeJoin(userId, name, party) {
        const c = state.combat;
        if (state.party.some(h => h.owner === userId)) return;
        if (ownersCount() >= 4) return;
        const fresh = c.round <= 1 && c.enemies.length && c.enemies.every(e => e.hp >= e.maxHp);
        const spots = [[2, 3], [2, 7], [1, 5], [2, 1], [2, 9], [1, 3], [1, 7], [0, 5]];
        party.slice(0, 1).forEach((raw, k) => {
            const h = sanitizeJoinHero(raw || {});
            h.owner = userId; h.ownerName = String(name).replace(/[<>&"'`\\]/g, '').slice(0, 16);
            delete h.prot; delete h.song;
            state.party.push(h);
            let [x, y] = spots.find(([sx, sy]) => !combatBlocked(sx, sy, null)) || [0, 0];
            for (let tries = 0; tries < 40 && combatBlocked(x, y, null); tries++) { y = (y + 1) % c.height; }
            c.heroes.push({ idx: state.party.length - 1, x, y, fled: false, owner: userId });
            fxAdd({ kind: 'dust', x, y, t0: fxStart(), dur: 20 });
        });
        // a fight that has only just begun grows a foe for every party that joins in
        if (fresh && c.enemies.length < 6) {
            const proto = c.enemies[0];
            for (let k = 0; k < 1; k++) {
                const e = Object.assign({}, proto, { x: 8, y: 1 + (c.enemies.length * 2) % 9, hp: proto.maxHp, sleep: 0, fleeing: false, uid: nextUid() });
                for (let tries = 0; tries < 30 && combatBlocked(e.x, e.y, null); tries++) { e.y = (e.y + 1) % c.height; if (tries % 10 === 9) e.x++; }
                c.enemies.push(e);
            }
        }
        addLog(`⚔ ${name}'s champion joins the battle!`, 'text-emerald-300 font-bold');
        sfx.play('danger');
        updateUI();
    }

    function applyIntent(it) {
        const c = state.combat;
        if (it.kind === 'join') {
            const p = it.p || {};
            mergeJoin(it.user, p.name || 'ally', Array.isArray(p.party) ? p.party : []);
            publish();
            return;
        }
        const hero = state.party[c.activeHeroIdx];
        if (!hero || hero.owner !== it.user || it.turn !== c.turnNo || hero.hp <= 0) return;   // stale or forged
        const B = S.battle;
        B.afk[it.user] = false;
        B.applying = true;
        try {
            const p = it.p || {};
            switch (it.kind) {
                case 'move': combatMoveOrAttack(Math.sign(p.dx | 0), Math.sign(p.dy | 0), false); break;
                case 'atk': executePlayerAttack(Math.sign(p.dx | 0), Math.sign(p.dy | 0)); break;
                case 'tatk': if (!executeTargetedAttack(p.uid | 0)) { addLog(`${hero.name} cannot reach the foe.`, 'text-slate-400'); nextCombatTurn(); } break;
                case 'flee': doFlee(); break;
                case 'pass': addLog(`${hero.name} holds position.`, 'text-slate-400'); nextCombatTurn(); break;
                case 'potion': combatPotion(p.id); break;
                case 'song': { const sg = SONGS.find(x => x.id === p.id); if (sg && songKnown(hero, sg) && hero.mp >= sg.cost) performSong(hero, sg); break; }
                case 'cast': {
                    const sp = getSpellPool(hero).find(x => x.id === p.sp && x.school === p.sch);
                    if (sp && hero.lvl >= spellUnlockLevel(hero, sp) && hero.mp >= sp.cost && spellUsable(sp, 'COMBAT')) castCombatSpell(hero, sp, resolveRef(p.pick));
                    break;
                }
            }
        } catch (e) { console.error('intent', e); }
        B.applying = false;
    }

    function hostTick(b) {
        const B = S.battle;
        if (!B || state.mode !== 'COMBAT') return;
        // requests from the other players
        (b.intents || []).forEach(it => { if (it.id > B.iseq) { B.queue.push(it); B.iseq = it.id; } });
        if (!(state.combat.ending)) {
            while (B.queue.length && !state.combat.ending && state.mode === 'COMBAT') applyIntent(B.queue.shift());
        }
        // players who left or vanished take their heroes off the field
        let changed = false;
        (b.players || []).forEach(pl => {
            if (pl.id === me.id) return;
            const gone = pl.left || pl.idle > 40;
            if (!gone) return;
            state.party.forEach((h, i) => {
                const u = state.combat.heroes[i];
                if (h.owner === pl.id && u && !u.fled) { u.fled = true; changed = true; addLog(`${h.name} withdraws from the battle.`, 'text-slate-400'); }
            });
        });
        if (changed) {
            if (!state.party.some((h, i) => combatHeroActive(i))) { endCombatEscape('The last standing champions escape from the battlefield.'); return; }
            const hu = state.combat.heroes[state.combat.activeHeroIdx];
            if (!hu || hu.fled) { nextCombatTurn(); } else publish();
        }
        // idle players lose their turn
        if (ownersCount() > 1 && !state.combat.ending) {
            const h = state.party[state.combat.activeHeroIdx];
            if (h) {
                const limit = (h.owner && B.afk[h.owner]) ? AFK_LIMIT_MS : TURN_LIMIT_MS;
                if (performance.now() - state.combat.turnStart > limit) {
                    if (h.owner) B.afk[h.owner] = true;
                    addLog(`${h.name} dithers too long and loses the turn.`, 'text-slate-400');
                    state.combat.awaitingAction = null;
                    if (state.combat.targeting) cancelTargeting(true);
                    nextCombatTurn();
                }
            }
        }
    }

    // ------------------------------------------------------------------------------ battle sync: GUEST
    async function joinBattle(id, auto, hostName) {
        if (!me || S.battle || state.mode === 'COMBAT' || !id) return;
        if (state.camping.active || state.sleeping) return;
        const party = clone(state.party);
        party.forEach(h => { delete h.prot; delete h.song; });
        const B = S.battle = newBattleSession('guest', state.mode);
        B.id = id; B.joining = true; B.backup = clone(state.party);
        hidePrompt();
        S.declined.add(id);
        // close anything in the way
        if (state.dialogue.active) closeNpcDialogue();
        if (state.inventoryMenu.active) closeInventoryModal();
        if (state.spellMenu.active) { state.spellMenu.active = false; $('spell-modal').classList.add('hidden'); }
        if (state.look.active) stopLook();
        document.getElementById('worldmap-modal').classList.add('hidden');
        const r = await api('battle_join', { id, party });
        if (!r.ok) {
            if (S.battle === B) S.battle = null;
            addLog(`Thou couldst not join the battle: ${r.error || 'the server is unreachable'}`, 'text-slate-400');
            return;
        }
        addLog(auto ? `⚔ Thy comrade ${hostName || ''} is under attack - ${hn()} rushes to help!` : `⚔ ${hn()} charges into ${hostName ? hostName + "'s " : 'the '}battle!`, 'text-amber-300 font-bold');
        sfx.play('danger');
        pollSoon(100);
    }

    function enterCombatView(snap, B) {
        state.mode = 'COMBAT';
        state.look.active = false;
        state.combat.fx = []; state.combat.floatingTexts = []; state.combat.fxCursor = 0;
        state.combat.targeting = null; state.combat.awaitingAction = null; state.combat.cam = null;
        state.combat.net = true;
        B.joining = false;
        applySnapshot(snap, B);
        selectNearestFoe();
        updateUI();
    }

    function battlePoll(b) {
        const B = S.battle;
        if (!B || B.id !== b.id) return;
        B.players = b.players || [];
        if (b.status === 'gone') { if (state.mode === 'COMBAT') remoteExit({ outcome: 'escape' }); else { S.battle = null; } return; }
        // host change?
        if (b.status === 'active') {
            if (b.host === me.id && B.role !== 'host') becomeHost(B, b);
            else if (b.host !== me.id && B.role === 'host') becomeGuest(B);
        }
        if (B.role === 'guest') {
            if (b.snapshot) {
                B.seq = b.seq;
                if (B.joining) {
                    if (b.snapshot.party.some(h => h.owner === me.id)) enterCombatView(b.snapshot, B);
                } else if (state.mode === 'COMBAT') {
                    applySnapshot(b.snapshot, B);
                    updateUI();
                    notifyTurn();
                    checkMyExit();
                }
            }
            if (B.joining && performance.now() - B.joinAt > 15000) {
                api('battle_leave', { id: B.id });
                S.battle = null;
                addLog('The battle did not answer in time.', 'text-slate-400');
                return;
            }
            if (B.pending != null && performance.now() - B.pendingAt > 6000) B.pending = null;
        } else if (b.status === 'active') {
            hostTick(b);
        }
        if (b.status !== 'active' && !B.exiting) {
            B.exiting = true;
            const res = b.result || { outcome: 'escape' };
            if (B.joining) { S.battle = null; addLog(`The battle ended before ${hn()} arrived.`, 'text-slate-400'); return; }
            setTimeout(() => remoteExit(res), 1300);
        }
    }

    function becomeHost(B, b) {
        B.role = 'host';
        B.queue = []; B.afk = {};
        B.iseq = 0;
        state.combat.ending = false;
        state.combat.turnStart = performance.now();
        addLog('Thou now lead the tactical battle (the previous host dropped out).', 'text-amber-300');
        B.dirty = true;
        flush(B);
    }
    function becomeGuest(B) {
        B.role = 'guest';
        B.seq = 0;
        B.firstApply = true;
        B.pending = null;
        B.seenFx = new Set(); B.seenTx = new Set();
        B.returnMode = B.returnMode || 'OVERWORLD';
    }

    function remoteExit(res) {
        const B = S.battle;
        if (state.mode !== 'COMBAT') { if (B) { S.battle = null; } return; }
        S.remoteEnd = true;
        state.combat.ending = false;
        state.combat.enemies.length && res.outcome === 'victory' && (state.combat.enemies.length = 0);
        switch (res.outcome) {
            case 'victory': finishVictory({ chest: false, spoils: res.spoils || [] }); break;
            case 'defeat': combatDefeat(); break;
            default: endCombatEscape(res.outcome === 'abandoned' ? 'The battle ended without its leader.' : 'The battle is over.'); break;
        }
    }

    // ------------------------------------------------------------------------------ battle sync: leaving
    function restoreOwnParty(B) {
        const mine = state.party.filter(h => h.owner === me.id);
        if (mine.length) {
            mine.forEach(h => { delete h.owner; delete h.ownerName; delete h.prot; delete h.song; });
            state.party = mine;
        } else if (B && B.backup) {
            state.party = B.backup;
        }
    }
    function endingCombat(kind, res) {
        const B = S.battle;
        if (!me || !B) return;
        B.exiting = true;
        const gold = state.combat.goldPool || 0;
        if (B.role === 'host' && !S.remoteEnd) {
            const snap = buildSnapshot();
            if (kind === 'leave') {
                const id = B.id;
                B.finalSnap = snap;
                if (id) B.chain = B.chain.then(() => api('battle_snapshot', { id, snapshot: snap, foes: state.combat.enemies.length })).then(() => api('battle_leave', { id }));
            } else {
                const result = { outcome: kind, gold, chest: false, spoils: (res && res.spoils) || [], mimic: !!state.combat.isMimicFight };
                B.finalSnap = snap; B.finalResult = result;
                if (B.id) B.chain = B.chain.then(() => api('battle_snapshot', { id: B.id, snapshot: snap, ended: true, result }));
            }
        } else if (B.role === 'guest' && kind === 'leave' && B.id && !S.remoteEnd) {
            api('battle_leave', { id: B.id });
        } else if (B.role === 'host' && kind === 'leave' && B.id && !S.remoteEnd) {
            api('battle_leave', { id: B.id });
        }
        restoreOwnParty(B);
    }
    function afterCombat() {
        if (!S.battle && !me) return;
        S.battle = null;
        S.remoteEnd = false;
        leaving = false;
        hideHud();
        saveSoon();
        pollSoon(100);
    }

    // ------------------------------------------------------------------------------ battle HUD
    function hideHud() { const h = $('battle-hud'); if (h) h.classList.add('hidden'); }
    function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    function tick250() {
        if (!me) return;
        if (S.ready && idleSecs() >= KICK_SECS) { logout('Thou wert logged out after five minutes without a move.'); return; }
        const hud = $('battle-hud');
        const B = S.battle;
        if (B && B.joining && !B.exiting) {
            hud.classList.remove('hidden'); hud.textContent = '⚔ Joining the battle...'; return;
        }
        if (!B || state.mode !== 'COMBAT' || !isShared()) { hud.classList.add('hidden'); return; }
        const names = [...new Set(state.party.map(h => h.ownerName).filter(Boolean))];
        const h = state.party[state.combat.activeHeroIdx];
        const limit = (h && h.owner && B.afk[h.owner]) ? AFK_LIMIT_MS : TURN_LIMIT_MS;
        const left = limit - (performance.now() - (state.combat.turnStart || performance.now()));
        const mineOut = myUnits().every(x => x.h.hp <= 0 || (x.u && x.u.fled));
        hud.classList.remove('hidden');
        hud.innerHTML = `⚔ <b>SHARED BATTLE</b> &middot; ${names.map(esc).join(' &amp; ')} &middot; ${h ? `<b style="color:${h.owner === me.id ? '#fde047' : '#e2e8f0'}">${esc(h.ownerName || '')} - ${esc(h.name)}</b> ${fmt(left)}` : ''}${mineOut ? ' &middot; <button id="btn-leave-battle" class="pl-btn go">Leave battle</button>' : ''}`;
        const lb = $('btn-leave-battle');
        if (lb) lb.onclick = () => endCombatEscape(`${hn()} leaves the battle.`, true);
    }

    function logged(msg, cls) {
        const B = S.battle;
        if (B && B.role === 'host' && state.mode === 'COMBAT' && !S.applyingSnap) S.logBuf.push({ msg, cls });
    }

    // what the Look command says about other adventurers / fights on a tile
    function lookInfo(kind, x, y) {
        if (!me || !S.ready) return null;
        const lines = [];
        let title = null, color = '#bae6fd';
        S.near.forEach(p => {
            if (p.mode !== kind || p.battle) return;
            if (p.x !== x || p.y !== y) return;
            if (!title) title = p.name; else lines.push(`also here: ${p.name}`);
            lines.push({ k: 'Adventurer', v: `Lv${p.lvl} ${p.race || ''} ${p.cls}` });
            if (p.mhp) lines.push({ k: 'HP', v: `${p.hp}/${p.mhp}`, c: p.hp < p.mhp * 0.3 ? '#f87171' : null });
            if (p.rest) lines.push('Resting.');
            if (S.group && S.group.members.some(m => m.id === p.id)) { lines.push({ k: 'Group', v: 'a member of thy group', c: '#6ee7b7' }); color = '#6ee7b7'; }
        });
        if (kind === 'OW') {
            S.battles.forEach(b => {
                if (b.x !== x || b.y !== y) return;
                title = `Battle: ${b.host}'s champion`; color = '#fca5a5';
                lines.push({ k: 'Foes', v: b.label || `${b.foes}` });
                lines.push({ k: 'Fighting', v: b.names.join(', ') });
                lines.push(b.full ? 'The battle is full.' : 'Step next to it to be asked whether to join.');
            });
        }
        return title ? { title, color, lines } : null;
    }

    return {
        call: (a, b) => api(a, b), dropBag: (items, x, y) => api('bag_drop', { items, x, y }), lootCamp, shipToBoard, boardShipOf, boot, keyCapture, focusChat, logout, switchHero, lookInfo, ambushRoamer, ambushing: () => ambushBusy,
        logged, myId: () => (me ? me.id : 0), accountName: () => (me ? me.name : ''), myParty, isShared, isMyTurn, turnOwnerName,
        guard, refOf, combatStarted, combatChanged, endingCombat, afterCombat,
        saveNow, saveSoon, saveStatusText, assistGroup,
        renderOverworldExtras, renderTownExtras
    };
})();
