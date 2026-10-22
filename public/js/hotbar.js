// =====================================================================================================
// THE ACTION BAR - ten slots, keys 1-9 and 0. Starts with Auto-Attack in slot 1; the player fills the rest with
// spells, bardic songs and healing potions (click an empty slot, or right-click any slot, to choose; drag to rearrange).
// Uses the game's own functions (toggleAutoAttack, beginSpellTargeting, ...) so every slot behaves exactly like
// the matching command in the Cast menu.
// =====================================================================================================
const Hotbar = (() => {
    const N = 10;
    const defaults = () => [{ t: 'auto' }, ...Array(N - 1).fill(null)];
    let slots = defaults();
    let sig = '';
    let dragFrom = -1;

    const allSpells = () => [...SPELLS.cler, ...SPELLS.wiz, ...SPELLS.tink];
    const spellById = (id) => allSpells().find(s => s.id === id) || null;
    const songById = (id) => SONGS.find(s => s.id === id) || null;
    const el = (id) => document.getElementById(id);
    const keyOf = (i) => String((i + 1) % 10);
    const myHero = () => state.party.find(h => h.owner === Net.myId()) || state.party[0] || null;

    function sanitize(arr) {
        const out = defaults();
        if (!Array.isArray(arr)) return out;
        for (let i = 0; i < N; i++) {
            const e = arr[i];
            if (e === null) { out[i] = null; continue; }
            if (!e || typeof e !== 'object') continue;
            if (e.t === 'auto' || e.t === 'potion') out[i] = { t: e.t };
            else if (e.t === 'spell' && spellById(e.id)) out[i] = { t: 'spell', id: e.id };
            else if (e.t === 'song' && songById(e.id)) out[i] = { t: 'song', id: e.id };
        }
        return out;
    }
    function save() { return slots.map(e => (e ? { ...e } : null)); }
    function load(arr) { slots = sanitize(arr); sig = ''; render(); }
    function reset() { slots = defaults(); sig = ''; render(); }
    function set(i, e) { slots[i] = e; sig = ''; render(); Net.saveSoon(); }

    // ---------------------------------------------------------------- what a slot would do right now
    function context() {
        const inCombat = state.mode === 'COMBAT';
        const hero = inCombat ? state.party[state.combat.activeHeroIdx] : myHero();
        return { inCombat, hero };
    }
    function status(e) {          // { ok, why }
        const { inCombat, hero } = context();
        if (!hero) return { ok: false, why: '' };
        if (e.t === 'auto') return { ok: inCombat, why: inCombat ? '' : 'Auto-attack works in battle' };
        if (e.t === 'potion') {
            if (healCount() <= 0) return { ok: false, why: 'No Healing Potions left' };
            return { ok: true, why: '' };
        }
        if (e.t === 'spell') {
            const sp = spellById(e.id);
            if (!sp || hero.lvl < spellUnlockLevel(hero, sp) || !getSpellPool(hero).some(s => s.id === sp.id)) return { ok: false, why: 'Not known by ' + hero.name };
            if (!spellUsable(sp, state.mode)) return { ok: false, why: spellNote(sp, state.mode) || 'Cannot be cast here' };
            if (hero.mp < sp.cost) return { ok: false, why: 'Not enough mana' };
            return { ok: true, why: '' };
        }
        if (e.t === 'song') {
            const sg = songById(e.id);
            if (!sg || !songKnown(hero, sg)) return { ok: false, why: 'Not known by ' + hero.name };
            if (!inCombat && !sg.field) return { ok: false, why: 'Battle only' };
            if (hero.mp < sg.cost) return { ok: false, why: 'Not enough mana' };
            return { ok: true, why: '' };
        }
        return { ok: false, why: '' };
    }

    // ---------------------------------------------------------------- using a slot
    function use(i) {
        const e = slots[i];
        if (!e) { openPicker(i); return; }
        if (e.t === 'auto') { toggleAutoAttack(); return; }
        const { inCombat, hero } = context();
        if (combatLocked()) return;
        if (inCombat && state.combat.targeting) return;
        if (state.camping.active || state.dialogue.active || state.inventoryMenu.active || state.chestPrompt.active || state.campPrompt.active || state.rest) return;
        if (!el('spell-modal').classList.contains('hidden')) return;
        if (inCombat && notMyTurn()) return;
        if (!hero) return;
        const st = status(e);
        if (!st.ok) { sfx.play('miss'); if (st.why) addLog(st.why + '.', 'text-slate-400'); return; }
        if (e.t === 'potion') {
            if (inCombat) {
                if (hero.hp <= 0) return;
                const pid = bestHealId(Math.max(...state.party.map(p => p.maxHp - p.hp), 0));
                if (!pid) return;
                if (Net.guard('potion', { id: pid })) { potAdd(pid, -1); return; }
                potAdd(pid, -1);
                combatPotion(pid);
                return;
            }
            const mine = state.party.filter(h => h.hp > 0 && h.hp < h.maxHp && (!h.owner || h.owner === Net.myId()));
            if (!mine.length) { sfx.play('miss'); addLog('Nobody needs healing.', 'text-slate-400'); return; }
            const who = mine.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            drinkPotion(bestHealId(who.maxHp - who.hp), who);
            return;
        }
        if (e.t === 'spell') {
            const sp = spellById(e.id);
            if (inCombat) { beginSpellTargeting(hero, sp); } else castFieldWithTarget(hero, sp);
            return;
        }
        if (e.t === 'song') {
            const sg = songById(e.id);
            if (inCombat) { performSong(hero, sg); } else castSongField(hero, sg);
        }
    }
    function key(k) {
        if (!/^[0-9]$/.test(k)) return false;
        use((Number(k) + 9) % 10);
        return true;
    }

    // ---------------------------------------------------------------- drawing
    function entryInfo(e) {
        const { hero } = context();
        if (e.t === 'auto') return { icon: `<span class="hb-i" style="--c:244,63,94">${icon('target')}</span>`, name: 'Auto-Attack', tip: tipBox('Auto-Attack', 'Action bar', null, 'In battle: select a foe, then use this to strike it with the equipped weapon every turn. If it is out of range thy champion waits until it comes closer. Any other command stops it.') };
        if (e.t === 'potion') return { icon: `<span class="hb-i" style="--c:52,211,153">${icon('flask')}</span>`, name: 'Healing Potion', count: healCount(), tip: tipBox('Healing Potion', 'Action bar', [['In the bag', String(state.inventory.potions || 0)]], `Restores ${POTION_TXT} HP to thyself (or the most wounded ally).`) };
        if (e.t === 'spell') {
            const sp = spellById(e.id);
            return { icon: spellIcon(sp), name: sp.name, tip: hero ? spellTip(hero, sp) : sp.name };
        }
        const sg = songById(e.id);
        return { icon: `<span class="hb-i" style="--c:${sg.rgb}">${icon(sg.glyph)}</span>`, name: sg.name, tip: hero ? songTip(hero, sg) : sg.name };
    }
    function render() {
        const bar = el('hotbar');
        if (!bar) return;
        const rows = slots.map(e => (e ? { e, st: status(e) } : null));
        const s = JSON.stringify(rows.map(r => r && [r.e, r.st.ok, r.st.why])) + (state.combat && state.combat.auto ? 'A' : '') + healCount() + state.mode + (typeof myHero === 'function' && myHero() ? myHero().lvl : '');
        if (s === sig) return;
        sig = s;
        bar.innerHTML = '';
        slots.forEach((e, i) => {
            const slot = document.createElement('div');
            slot.className = 'hb-slot' + (e ? '' : ' empty');
            slot.dataset.slot = i;
            let inner = `<span class="hb-key">${keyOf(i)}</span>`;
            if (e) {
                const info = entryInfo(e), st = rows[i].st;
                if (!st.ok) slot.classList.add('off');
                if (e.t === 'auto' && state.combat && state.combat.auto && state.mode === 'COMBAT') slot.classList.add('on');
                inner += info.icon + (info.count !== undefined ? `<span class="hb-count">${info.count}</span>` : '');
                slot.dataset.tip = info.tip + (st.why ? `<div class="tip-d" style="color:#fca5a5">${escHtml(st.why)}</div>` : '') + '<div class="tip-d" style="color:#64748b">Right-click to change &middot; drag to move</div>';
                slot.draggable = true;
            } else {
                inner += '<span class="hb-plus">+</span>';
                slot.dataset.tip = tipBox('Empty slot', 'Action bar ' + keyOf(i), null, 'Click to place a spell, potion or Auto-Attack here.');
            }
            slot.innerHTML = inner;
            slot.addEventListener('click', () => use(i));
            slot.addEventListener('contextmenu', (ev) => { ev.preventDefault(); openPicker(i); });
            slot.addEventListener('dragstart', (ev) => { dragFrom = i; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', String(i)); } catch (err) { /* ignore */ } });
            slot.addEventListener('dragover', (ev) => { if (dragFrom >= 0) { ev.preventDefault(); slot.classList.add('drop'); } });
            slot.addEventListener('dragleave', () => slot.classList.remove('drop'));
            slot.addEventListener('drop', (ev) => {
                ev.preventDefault();
                if (dragFrom >= 0 && dragFrom !== i) { const a = slots[dragFrom]; slots[dragFrom] = slots[i]; slots[i] = a; sig = ''; render(); Net.saveSoon(); }
                dragFrom = -1;
            });
            slot.addEventListener('dragend', () => { dragFrom = -1; });
            bar.appendChild(slot);
        });
    }

    // ---------------------------------------------------------------- the chooser
    function closePicker() { const p = el('hotbar-picker'); if (p) p.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', escKey, true); }
    function outside(ev) { const p = el('hotbar-picker'); if (p && !p.contains(ev.target)) closePicker(); }
    function escKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); closePicker(); } }
    function openPicker(i) {
        closePicker();
        const hero = myHero();
        if (!hero) return;
        const p = document.createElement('div');
        p.id = 'hotbar-picker';
        p.innerHTML = `<div class="hp-h">Action bar slot ${keyOf(i)}</div>`;
        const add = (iconHtml, label, sub, entry) => {
            const b = document.createElement('button');
            b.className = 'hp-row';
            b.innerHTML = `${iconHtml}<span class="hp-n">${label}</span><span class="hp-s">${sub || ''}</span>`;
            b.addEventListener('click', () => { closePicker(); set(i, entry); });
            p.appendChild(b);
        };
        const head = (t) => { const d = document.createElement('div'); d.className = 'hp-g'; d.textContent = t; p.appendChild(d); };
        head('Actions');
        add(`<span class="hb-i sm" style="--c:244,63,94">${icon('target')}</span>`, 'Auto-Attack', 'battle', { t: 'auto' });
        add(`<span class="hb-i sm" style="--c:52,211,153">${icon('flask')}</span>`, 'Healing Potion', `${healCount()} owned`, { t: 'potion' });
        const songs = (CLASSES[hero.cls] && CLASSES[hero.cls].songs) || hero.debug ? knownSongs(hero) : [];
        if (songs.length) { head('Songs'); songs.forEach(sg => add(`<span class="hb-i sm" style="--c:${sg.rgb}">${icon(sg.glyph)}</span>`, sg.name, `${sg.cost} MP`, { t: 'song', id: sg.id })); }
        const spells = getKnownSpells(hero).sort((a, b) => a.circle - b.circle || a.cost - b.cost);
        if (spells.length) { head('Spells'); spells.forEach(sp => add(spellIcon(sp, true), sp.name, `${sp.cost} MP`, { t: 'spell', id: sp.id })); }
        if (slots[i]) {
            const c = document.createElement('button');
            c.className = 'hp-row clear'; c.textContent = '✕ Clear this slot';
            c.addEventListener('click', () => { closePicker(); set(i, null); });
            p.appendChild(c);
        }
        document.body.appendChild(p);
        const slotEl = document.querySelector(`.hb-slot[data-slot="${i}"]`);
        const r = slotEl ? slotEl.getBoundingClientRect() : { left: 100, top: window.innerHeight - 100, width: 0 };
        const w = p.offsetWidth, h = p.offsetHeight;
        p.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px';
        p.style.top = Math.max(6, r.top - h - 8) + 'px';
        setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', escKey, true); }, 0);
    }

    return { render, key, save, load, reset, use };
})();
