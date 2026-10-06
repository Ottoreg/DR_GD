  // ---------- Liaison des champs ----------
  const $ = id => document.getElementById(id);
  const readInput = el => el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseInt(el.value, 10) : el.value;
  const writeInput = (el, v) => { if (el === document.activeElement && el.type !== 'checkbox') return; el.type === 'checkbox' ? (el.checked = !!v) : (el.value = v); };

  function bind(attr, getObj, after) {
    document.querySelectorAll(`[${attr}]`).forEach(el => {
      const k = el.getAttribute(attr);
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
        const v = readInput(el);
        if (typeof v === 'number' && Number.isNaN(v)) return;
        getObj()[k] = v;
        after && after(k, v);
        refresh();
      });
    });
  }
  bind('data-sp', P, (k, v) => {
    const p = P();
    if (k === 'min' && p.max < v) p.max = v;
    if (k === 'max' && p.min > v) p.min = v;
    if (['min', 'max', 'line', 'diag', 'los', 'mod'].includes(k)) $('preset').value = '';
    if (SP_SYNC_KEYS.includes(k)) for (const lv of otherLevels()) lv[k] = v;
  });
  bind('data-sn', Sp, k => { if (k === 'name') renderSpellList(); });
  bind('data-st', () => S.stats);
  bind('data-s', () => S);

  function syncUI() {
    const p = P();
    renderAoeOptions();
    document.querySelectorAll('[data-sp]').forEach(el => writeInput(el, p[el.getAttribute('data-sp')]));
    $('spellAside').dataset.tab = S.tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
    document.querySelectorAll('[data-sn]').forEach(el => writeInput(el, Sp()[el.getAttribute('data-sn')]));
    document.querySelectorAll('#lvlSeg button').forEach((b, i) => b.classList.toggle('on', i === Sp().lvl));
    $('lvlCopy').disabled = Sp().lvl === NB_LEVELS - 1;
    document.querySelectorAll(".lvlTag").forEach(t => t.textContent = "niv. " + (Sp().lvl + 1));
    document.querySelectorAll('[data-st]').forEach(el => writeInput(el, S.stats[el.getAttribute('data-st')]));
    document.querySelectorAll('[data-s]').forEach(el => writeInput(el, S[el.getAttribute('data-s')]));
    $('bonus').disabled = !p.mod;
    $('aoeSize').disabled = p.aoe === 'none' || p.aoe.startsWith('z:');
    $('bounceBox').classList.toggle('hidden', !p.bounce);
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === p.mode));
    $('stdBox').classList.toggle('hidden', p.mode !== 'standard');
    $('customBox').classList.toggle('hidden', p.mode !== 'custom');
    $('editTool').classList.toggle('hidden', p.mode !== 'custom' || S.view !== 'spells');
    if ((p.mode !== 'custom' || S.view !== 'spells') && S.tool === 'edit') S.tool = S.view === 'maps' ? 'rock' : 'caster';
    if (S.view === 'maps' && !MAP_TOOLS.includes(S.tool)) S.tool = 'rock';
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
    $('spDel').disabled = S.spells.length < 2;
  }

  function refresh() { syncUI(); renderCard(); renderLevelTables(); renderBook(); renderZoneTab(); renderSummonTab(); renderViews(); save(); requestRender(); }

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    P().mode = b.dataset.mode;
    if (P().mode === 'custom') { if (!pattern.size) copyStandard(); S.tool = 'edit'; }
    refresh();
  }));
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => { S.tool = b.dataset.tool; refresh(); }));

  function copyStandard() {
    pattern = new Set();
    const m = maxPO();
    for (let a = -m; a <= m; a++) for (let b = -m; b <= m; b++) if (inStandardShape(a, b)) pattern.add(a + ',' + b);
  }
  $('fromStd').addEventListener('click', () => { copyStandard(); refresh(); });
  $('clearPat').addEventListener('click', () => { pattern.clear(); refresh(); });

  const PRESETS = {
    'self':       { min: 0, max: 0, line: false, diag: false, los: true },
    'cac':        { min: 1, max: 1, line: false, diag: false, los: true },
    '1-3':        { min: 1, max: 3, line: false, diag: false, los: true },
    '1-5':        { min: 1, max: 5, line: false, diag: false, los: true },
    '1-8':        { min: 1, max: 8, line: false, diag: false, los: true },
    '2-6':        { min: 2, max: 6, line: false, diag: false, los: true },
    'line4':      { min: 1, max: 4, line: true,  diag: false, los: true },
    'line6nolos': { min: 1, max: 6, line: true,  diag: false, los: false },
    'diag4':      { min: 1, max: 4, line: false, diag: true,  los: true },
    'star5':      { min: 1, max: 5, line: true,  diag: true,  los: true }
  };
  $('preset').addEventListener('change', () => {
    const v = $('preset').value;
    if (v === 'custom') { P().mode = 'custom'; if (!pattern.size) copyStandard(); S.tool = 'edit'; }
    else if (PRESETS[v]) Object.assign(P(), PRESETS[v], { mode: 'standard', mod: false, bonus: 0 });
    refresh();
  });

  // ---------- Grimoire ----------
  function renderSpellList() {
    $('spellSel').innerHTML = S.spells.map((s, i) => `<option value="${i}"${i === S.cur ? ' selected' : ''}>${esc(s.name || 'Sans nom')}</option>`).join('');
  }
  function selectSpell(i) {
    P().pattern = [...pattern];
    S.cur = i;
    pattern = new Set(P().pattern);
    $('preset').value = '';
    renderSpellList(); renderEffects(); refresh();
  }
  $('spellSel').addEventListener('change', () => selectSpell(+$('spellSel').value));

  // ---------- Niveaux ----------
  function selectLevel(l) {
    P().pattern = [...pattern];
    Sp().lvl = l;
    pattern = new Set(P().pattern);
    $('preset').value = '';
    renderEffects(); refresh();
  }
  $('lvlSeg').innerHTML = Array.from({ length: NB_LEVELS }, (_, i) => `<button data-lvl="${i}" title="Niveau ${i + 1}">${i + 1}</button>`).join('');
  $('lvlSeg').addEventListener('click', e => { const b = e.target.closest('[data-lvl]'); if (b) selectLevel(+b.dataset.lvl); });
  $('card').addEventListener('click', e => { const tr = e.target.closest('tr[data-lvl]'); if (tr) selectLevel(+tr.dataset.lvl); });
  $('lvlCopy').addEventListener('click', () => {
    P().pattern = [...pattern];
    const s = Sp();
    for (let l = s.lvl + 1; l < NB_LEVELS; l++) s.levels[l] = structuredClone(P());
    refresh();
  });
  $('lvlInterp').addEventListener('click', () => {
    if (!interpolate(Sp())) { alert('Les niveaux 1 et 6 doivent avoir la même liste d\'effets (même nombre et mêmes types) pour calculer la progression.'); return; }
    renderEffects(); refresh();
  });
  $('spNew').addEventListener('click', () => { P().pattern = [...pattern]; S.spells.push(newSpell()); selectSpell(S.spells.length - 1); });
  $('spDup').addEventListener('click', () => {
    P().pattern = [...pattern];
    const c = structuredClone(Sp()); c.name += ' (copie)'; c.id = uid('sp');
    S.spells.splice(S.cur + 1, 0, c); selectSpell(S.cur + 1);
  });
  $('spDel').addEventListener('click', () => {
    if (S.spells.length < 2 || !confirm(`Supprimer le sort « ${Sp().name} » ? Il sera aussi retiré des classes et des invocations qui l'utilisent.`)) return;
    const gone = Sp().id;
    for (const c of S.classes) c.spells = c.spells.filter(x => x.sid !== gone);
    for (const d of S.summons) d.spells = d.spells.filter(x => x !== gone);
    S.spells.splice(S.cur, 1);
    S.cur = Math.min(S.cur, S.spells.length - 1);
    pattern = new Set(P().pattern);
    renderSpellList(); renderEffects(); refresh();
  });
  $('spExport').addEventListener('click', () => {
    P().pattern = [...pattern];
    const blob = new Blob([JSON.stringify({ spells: S.spells, zones: S.zones, summons: S.summons, icons: S.pixelIcons }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sorts-retro.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('spImport').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const f = $('importFile').files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      // Formats acceptés : { spells, zones } (actuel), liste de sorts, ou un seul sort
      const raw = Array.isArray(data) ? data : Array.isArray(data.spells) ? data.spells : [data];
      // identifiants de sorts déjà pris : on en génère de nouveaux et on garde la correspondance pour les invocations
      const remap = {};
      const list = raw.filter(s => s && typeof s === 'object').map(s => {
        const sp = newSpell(s);
        if (S.spells.some(x => x.id === sp.id)) { const old = sp.id; sp.id = uid('sp'); remap[old] = sp.id; }
        return sp;
      });
      if (!list.length) throw new Error('vide');
      mergeIcons(data.icons);
      if (Array.isArray(data.summons)) for (const d of data.summons) {
        if (!d || typeof d !== 'object' || (d.id && summonById(d.id))) continue;
        const n = newSummon(d);
        n.spells = n.spells.map(id => remap[id] || id);
        S.summons.push(n);
      }
      if (Array.isArray(data.zones)) for (const z of data.zones) {
        if (z && z.id && Array.isArray(z.cells) && !zoneById(z.id))
          S.zones.push({ id: String(z.id), name: String(z.name || 'Zone importée'), oriented: z.oriented !== false, cells: z.cells.map(String) });
      }
      P().pattern = [...pattern];
      S.spells.push(...list);
      refreshIconSelects();
      selectSpell(S.spells.length - list.length);
    } catch (e) { alert('Fichier invalide : ' + e.message); }
    $('importFile').value = '';
  });

  // ---------- Carte ----------
  $('clearMap').addEventListener('click', () => { S.objs = {}; S.inv = {}; S.rt = {}; S.active = null; renderCombat(); refresh(); });
  $('randomMap').addEventListener('click', randomLayout);
  function randomLayout() {
    S.inv = {}; S.rt = {}; S.active = null;
    const o = {}, r = Math.random;
    for (const c of cells) {
      if (c.k === S.caster) continue;
      const v = r();
      if (v < .09) o[c.k] = 'rock'; else if (v < .12) o[c.k] = 'hole';
    }
    const free = cells.filter(c => !o[c.k] && c.k !== S.caster);
    for (const kind of ['enemy', 'enemy', 'enemy', 'ally', 'ally']) {
      const c = free.splice(Math.floor(r() * free.length), 1)[0];
      if (c) o[c.k] = kind;
    }
    S.objs = o; renderCombat(); refresh();
  }

  // ---------- Zones personnalisées : éditeur ----------
  const zcv = document.getElementById('zcv');
  const zctx = zcv.getContext('2d');
  const ZW = 30, ZH = 15, ZEW = 2 * ZR * ZW + ZW + 4, ZEH = 2 * ZR * ZH + ZH + 4;
  zcv.width = ZEW * dpr; zcv.height = ZEH * dpr;
  // (f,s) → écran, avec « vers l'avant » orienté vers le haut-droite (EDITOR_DIR)
  const zPos = (f, s) => ({ x: ZEW / 2 + (s + f) * ZW / 2, y: ZEH / 2 + (s - f) * ZH / 2 });
  let zHover = null, zDrag = false, zAdd = true;

  const curZone = () => S.zones[S.zoneCur];
  const newZoneId = () => 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function renderZoneEditor() {
    const z = curZone();
    zctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zctx.fillStyle = '#1d2610'; zctx.fillRect(0, 0, ZEW, ZEH);
    const inZone = new Set(z ? z.cells : []);
    for (let f = -ZR; f <= ZR; f++) for (let s = -ZR; s <= ZR; s++) {
      const { x, y } = zPos(f, s);
      diamond(zctx, x, y, ZW, ZH);
      zctx.fillStyle = (f + s) % 2 ? '#56702c' : '#5b7630'; zctx.fill();
      if (inZone.has(f + ',' + s)) {
        diamond(zctx, x, y, ZW - 2, ZH - 1);
        zctx.fillStyle = 'rgba(226,78,36,.85)'; zctx.fill();
        zctx.strokeStyle = 'rgba(255,200,150,.9)'; zctx.lineWidth = 1; zctx.stroke();
      } else {
        diamond(zctx, x, y, ZW - 1, ZH - .5);
        zctx.strokeStyle = 'rgba(255,255,230,.15)'; zctx.lineWidth = 1; zctx.stroke();
      }
    }
    // case ciblée
    const t = zPos(0, 0);
    diamond(zctx, t.x, t.y, ZW - 2, ZH - 1);
    zctx.strokeStyle = '#ffd24a'; zctx.lineWidth = 2.5; zctx.stroke();
    // lanceur fantôme + flèche vers la cible
    const g = zPos(-3, 0);
    zctx.setLineDash([4, 3]); zctx.strokeStyle = 'rgba(255,240,190,.85)'; zctx.lineWidth = 1.5;
    zctx.beginPath(); zctx.moveTo(g.x + 6, g.y - 4); zctx.lineTo(t.x - 10, t.y + 4); zctx.stroke(); zctx.setLineDash([]);
    const ang = Math.atan2((t.y + 4) - (g.y - 4), (t.x - 10) - (g.x + 6));
    zctx.save(); zctx.translate(t.x - 8, t.y + 3); zctx.rotate(ang);
    zctx.fillStyle = 'rgba(255,240,190,.95)';
    zctx.beginPath(); zctx.moveTo(0, 0); zctx.lineTo(-8, -4); zctx.lineTo(-8, 4); zctx.closePath(); zctx.fill();
    zctx.restore();
    zctx.globalAlpha = z && z.oriented ? 1 : .45;
    zctx.beginPath(); zctx.ellipse(g.x, g.y, 9, 4.5, 0, 0, 7); zctx.strokeStyle = '#ffd24a'; zctx.lineWidth = 2; zctx.stroke();
    zctx.fillStyle = '#3f6fb3'; zctx.fillRect(g.x - 4, g.y - 16, 8, 12);
    zctx.beginPath(); zctx.arc(g.x, g.y - 20, 5, 0, 7); zctx.fillStyle = '#f3c99b'; zctx.fill();
    zctx.globalAlpha = 1;
    zctx.font = 'bold 10px Verdana, sans-serif'; zctx.textAlign = 'center'; zctx.textBaseline = 'middle'; zctx.lineJoin = 'round';
    zctx.lineWidth = 3; zctx.strokeStyle = '#000'; zctx.strokeText('Lanceur', g.x, g.y + 13);
    zctx.fillStyle = '#ffe9a8'; zctx.fillText('Lanceur', g.x, g.y + 13);
    if (zHover) {
      const h = zPos(zHover[0], zHover[1]);
      diamond(zctx, h.x, h.y, ZW - 2, ZH - 1);
      zctx.strokeStyle = '#fff'; zctx.lineWidth = 1.5; zctx.stroke();
    }
  }

  function zPick(e) {
    const r = zcv.getBoundingClientRect();
    const X = ((e.clientX - r.left) * ZEW / r.width - ZEW / 2) / (ZW / 2);
    const Y = ((e.clientY - r.top) * ZEH / r.height - ZEH / 2) / (ZH / 2);
    const s = Math.round((X + Y) / 2), f = Math.round((X - Y) / 2);
    return Math.abs(f) <= ZR && Math.abs(s) <= ZR ? [f, s] : null;
  }
  function zApply(c, first) {
    const z = curZone(); if (!z || !c) return;
    const keys = [c[0] + ',' + c[1]];
    if (S.zMirror && c[1] !== 0) keys.push(c[0] + ',' + (-c[1]));
    const set = new Set(z.cells);
    if (first) zAdd = !set.has(keys[0]);
    keys.forEach(k => zAdd ? set.add(k) : set.delete(k));
    z.cells = [...set];
  }
  zcv.addEventListener('pointerdown', e => {
    const c = zPick(e); if (!c) return;
    try { zcv.setPointerCapture(e.pointerId); } catch (err) {}
    zDrag = true;
    zApply(c, true); zHover = c; renderZoneEditor(); renderZoneInfo();
  });
  zcv.addEventListener('pointermove', e => {
    const c = zPick(e);
    if (String(c) !== String(zHover)) { zHover = c; if (zDrag) { zApply(c, false); renderZoneInfo(); } renderZoneEditor(); }
  });
  const zStop = () => { if (zDrag) { zDrag = false; refresh(); } };
  zcv.addEventListener('pointerup', zStop);
  zcv.addEventListener('pointercancel', zStop);
  zcv.addEventListener('pointerleave', () => { if (!zDrag) { zHover = null; renderZoneEditor(); } });

  function renderZoneInfo() {
    const z = curZone();
    $('zInfo').textContent = z ? `${z.cells.length} case(s) · ${z.oriented ? 'pivote selon la direction du lancer' : 'toujours dans le même sens'}` : '';
  }

  function renderAoeOptions() {
    const sel = $('aoeSel');
    const base = '<option value="none">Case unique</option><option value="circle">Cercle</option><option value="cross">Croix</option><option value="line">Ligne</option>';
    const custom = S.zones.length
      ? `<optgroup label="Zones personnalisées">${S.zones.map(z => `<option value="z:${esc(z.id)}">${esc(z.name || 'Sans nom')}</option>`).join('')}</optgroup>`
      : '';
    sel.innerHTML = base + custom;
    sel.value = P().aoe;
    if (sel.value !== P().aoe) sel.value = 'none';
  }

  function renderZoneTab() {
    const z = curZone();
    $('zoneSel').innerHTML = S.zones.map((x, i) => `<option value="${i}"${i === S.zoneCur ? ' selected' : ''}>${esc(x.name || 'Sans nom')} (${x.cells.length})</option>`).join('');
    writeInput($('zName'), z ? z.name : '');
    $('zOriented').checked = !!(z && z.oriented);
    $('zMirror').checked = !!S.zMirror;
    $('zDel').disabled = S.zones.length < 2;
    const used = z && P().aoe === 'z:' + z.id;
    $('zUse').textContent = `${used ? '✔ Utilisée par' : 'Utiliser pour'} « ${Sp().name} » niv. ${Sp().lvl + 1}`;
    $('zUse').disabled = !z || used;
    renderZoneInfo();
    renderZoneEditor();
  }

  $('zGen').innerHTML = Object.entries(ZGEN).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('zoneSel').addEventListener('change', () => { S.zoneCur = +$('zoneSel').value; refresh(); });
  $('zNew').addEventListener('click', () => {
    S.zones.push({ id: newZoneId(), name: 'Nouvelle zone', oriented: true, cells: ['0,0'] });
    S.zoneCur = S.zones.length - 1; refresh();
  });
  $('zDup').addEventListener('click', () => {
    const c = structuredClone(curZone()); c.id = newZoneId(); c.name += ' (copie)';
    S.zones.splice(S.zoneCur + 1, 0, c); S.zoneCur++; refresh();
  });
  $('zDel').addEventListener('click', () => {
    const z = curZone();
    if (S.zones.length < 2 || !confirm(`Supprimer la zone « ${z.name} » ? Les sorts qui l'utilisent repasseront en case unique.`)) return;
    for (const sp of S.spells) for (const l of sp.levels) if (l.aoe === 'z:' + z.id) l.aoe = 'none';
    S.zones.splice(S.zoneCur, 1);
    S.zoneCur = Math.min(S.zoneCur, S.zones.length - 1); refresh();
  });
  $('zName').addEventListener('input', () => { curZone().name = $('zName').value; refresh(); });
  $('zOriented').addEventListener('change', () => { curZone().oriented = $('zOriented').checked; refresh(); });
  $('zMirror').addEventListener('change', () => { S.zMirror = $('zMirror').checked; save(); });
  $('zGenBtn').addEventListener('click', () => {
    const n = Math.max(0, Math.min(ZR, parseInt($('zGenSize').value, 10) || 0));
    curZone().cells = genZone($('zGen').value, n); refresh();
  });
  $('zClear').addEventListener('click', () => { curZone().cells = []; refresh(); });
  $('zUse').addEventListener('click', () => { P().aoe = 'z:' + curZone().id; refresh(); });

  // ---------- Onglet Invocations : édition des entités ----------
  const curSummon = () => S.summons[S.invCur];
  function renderSummonTab() {
    const d = curSummon();
    $('invSel').innerHTML = S.summons.map((x, i) => `<option value="${i}"${i === S.invCur ? ' selected' : ''}>${icT(x.icon)} ${esc(x.name)} — ${INV_KINDS[x.kind].n}</option>`).join('')
      || '<option>— aucune entité —</option>';
    $('invDel').disabled = !d;
    $('invDup').disabled = !d;
    for (const id of ['invName', 'invIcon']) $(id).disabled = !d;
    if (!d) { $('invLevels').innerHTML = ''; $('invSpells').innerHTML = ''; $('invKindHint').textContent = ''; return; }
    writeInput($('invName'), d.name);
    $('invIcon').value = d.icon;
    document.querySelectorAll('#invKind [data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === d.kind));
    $('invKindHint').textContent = INV_KINDS[d.kind].hint;
    // tableau PA / PM / PV (non régénéré pendant la saisie)
    if (!$('invLevels').contains(document.activeElement)) {
      $('invLevels').innerHTML = `<table class="lt"><thead><tr><th>Niv.</th><th>PA</th><th>PM</th><th>PV</th></tr></thead><tbody>${
        d.levels.map((l, i) => `<tr><td class="lv" style="cursor:default">${i + 1}</td>${['pa', 'pm', 'pv'].map(k =>
          `<td><input type="number" min="0" max="${k === 'pv' ? 9999 : 30}" data-il="${i}" data-ik="${k}" value="${l[k]}"></td>`).join('')}</tr>`).join('')
      }</tbody></table>`;
    }
    const obst = d.kind === 'obstacle';
    $('invSpells').innerHTML = S.spells.map(s => `<label${obst ? ' style="opacity:.5"' : ''}><input type="checkbox" data-invsp="${esc(s.id)}"${d.spells.includes(s.id) ? ' checked' : ''}${obst ? ' disabled' : ''}> ${ic(s.icon)} ${esc(s.name)}</label>`).join('');
  }
  $('invSel').addEventListener('change', () => { S.invCur = +$('invSel').value; refresh(); });
  $('invNew').addEventListener('click', () => { S.summons.push(newSummon()); S.invCur = S.summons.length - 1; renderEffects(); refresh(); });
  $('invDup').addEventListener('click', () => {
    const c = newSummon(Object.assign(structuredClone(curSummon()), { id: uid('inv') })); c.name += ' (copie)';
    S.summons.splice(S.invCur + 1, 0, c); S.invCur++; renderEffects(); refresh();
  });
  $('invDel').addEventListener('click', () => {
    const d = curSummon();
    if (!d || !confirm(`Supprimer l'entité « ${d.name} » ? Ses invocations sur la carte disparaissent et les sorts qui l'invoquaient n'auront plus d'entité.`)) return;
    for (const [k, iv] of Object.entries(S.inv)) if (iv.sid === d.id) { delete S.objs[k]; removeSummonAt(k); }
    for (const sp of S.spells) for (const l of sp.levels) for (const e of l.effects) if (e.type === 'summon' && e.sid === d.id) e.sid = '';
    S.summons.splice(S.invCur, 1);
    S.invCur = Math.max(0, Math.min(S.invCur, S.summons.length - 1));
    renderEffects(); renderCombat(); refresh();
  });
  $('invName').addEventListener('input', () => { curSummon().name = $('invName').value; renderEffects(); renderCombat(); refresh(); });
  $('invIcon').addEventListener('change', () => { curSummon().icon = $('invIcon').value; renderEffects(); renderCombat(); refresh(); });
  $('invKind').addEventListener('click', ev => {
    const b = ev.target.closest('[data-kind]'); const d = curSummon(); if (!b || !d) return;
    d.kind = b.dataset.kind;
    // met à jour les invocations déjà posées (obstacle ↔ personnage)
    for (const [k, iv] of Object.entries(S.inv)) if (iv.sid === d.id) {
      S.objs[k] = d.kind === 'obstacle' ? 'sobst' : 'ally';
      if (d.kind === 'obstacle' && S.active === k) S.active = null;
    }
    renderEffects(); renderCombat(); refresh();
  });
  $('invLevels').addEventListener('input', ev => {
    const el = ev.target; if (el.dataset.il === undefined) return;
    const v = parseInt(el.value, 10); if (Number.isNaN(v)) return;
    curSummon().levels[+el.dataset.il][el.dataset.ik] = Math.max(0, v);
    renderCombat(); refresh();
  });
  $('invSpells').addEventListener('change', ev => {
    const id = ev.target.dataset.invsp; const d = curSummon(); if (!id || !d) return;
    d.spells = ev.target.checked ? [...new Set([...d.spells, id])] : d.spells.filter(x => x !== id);
    renderCombat(); refresh();
  });

  // ---------- Onglets ----------
  const setTab = t => { S.tab = t; refresh(); };
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('goZones').addEventListener('click', () => {
    const i = S.zones.findIndex(z => 'z:' + z.id === P().aoe);
    if (i >= 0) S.zoneCur = i;
    setTab('zones');
  });

  $('nextTurn').addEventListener('click', nextTurn);
  $('clearGlyphs').addEventListener('click', () => { S.glyphs = []; S.traps = []; logLine('Glyphes et pièges retirés.'); renderCombat(); save(); });
  $('resetTurns').addEventListener('click', () => { S.glyphs = []; S.traps = []; S.turn = 1; S.log = []; S.rt = {}; renderCombat(); refresh(); });
  $('healAll').addEventListener('click', () => {
    for (const [k, r] of Object.entries(S.rt)) { if (!occupied(k)) continue; r.hp = r.hpMax; r.poisons = []; r.ko = false; }
    logLine('❤ Tous les personnages sont soignés.'); renderCombat(); refresh();
  });

