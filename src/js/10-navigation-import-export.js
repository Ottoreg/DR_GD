  // ======================================================================
  // ---------- Navigation entre interfaces ----------
  // ======================================================================
  const MAP_TOOLS = ['caster', 'rock', 'hole', 'ally', 'enemy', 'erase'];

  // Partie en cours = copie de la carte choisie (on peut la modifier sans toucher à la carte enregistrée)
  function loadMapLive() {
    const m = curMap();
    setMapSize(m.w, m.h);
    S.objs = structuredClone(m.objs);
    S.caster = byKey.has(m.caster) ? m.caster : centerCell().k;
    delete S.objs[S.caster];
    S.inv = {}; S.rt = {}; S.active = null; S.glyphs = []; S.traps = [];
    moveSel = null; hover = null;
  }
  // Interface Cartes : on édite directement la carte enregistrée
  function enterMapEdit() {
    const m = curMap();
    setMapSize(m.w, m.h);
    for (const k of Object.keys(m.objs)) if (!byKey.has(k)) delete m.objs[k];
    if (!byKey.has(m.caster)) m.caster = centerCell().k;
    S.objs = m.objs; S.caster = m.caster;
    S.inv = {}; S.rt = {}; S.active = null; S.glyphs = []; S.traps = [];
    moveSel = null; hover = null;
  }

  function setView(v) {
    const prev = S.view;
    if (prev === 'maps') save();            // enregistre la carte éditée avant de la quitter
    S.view = v;
    document.body.dataset.view = v;
    if (v === 'maps' && prev !== 'maps') enterMapEdit();
    else if (v !== 'maps' && prev === 'maps') loadMapLive();
    if (v === 'preview') ensureClassSpell();
    document.querySelectorAll('#views [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    renderCombat(); refresh();
  }
  document.querySelectorAll('#views [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  // Rafraîchissements propres aux nouvelles interfaces (appelés par refresh)
  function renderViews() {
    if (S.view !== 'classes' && S.view !== 'maps') { renderHud(); renderRtTable(); }
    renderMapPanels();
    if (S.view === 'classes') renderClassView();
    if (S.view === 'preview') renderPreviewAside();
  }

  // ---------- Terrain (partie en cours) & éditeur de cartes ----------
  const mapOptions = () => S.maps.map((m, i) => `<option value="${i}"${i === S.mapCur ? ' selected' : ''}>${esc(m.name)} (${m.w}×${m.h})</option>`).join('');
  function renderMapPanels() {
    $('mapSel').innerHTML = mapOptions();
    $('meSel').innerHTML = mapOptions();
    const m = curMap();
    writeInput($('meName'), m.name);
    writeInput($('meW'), m.w);
    writeInput($('meH'), m.h);
    $('meDel').disabled = S.maps.length < 2;
    $('meInfo').textContent = `${cells.length} cases · ${m.w} cases par ligne × ${m.h} lignes doubles`;
  }
  $('mapSel').addEventListener('change', () => { S.mapCur = +$('mapSel').value; loadMapLive(); renderCombat(); refresh(); });
  $('mapReset').addEventListener('click', () => { loadMapLive(); logLine('↺ Carte remise à son état d\'origine.'); renderCombat(); refresh(); });
  $('meSel').addEventListener('change', () => { save(); S.mapCur = +$('meSel').value; enterMapEdit(); refresh(); });
  $('meNew').addEventListener('click', () => {
    save(); S.maps.push(newMap({ name: 'Nouvelle carte' })); S.mapCur = S.maps.length - 1; enterMapEdit(); refresh();
  });
  $('meDup').addEventListener('click', () => {
    save(); const c = newMap(Object.assign(structuredClone(curMap()), { id: uid('map') })); c.name += ' (copie)';
    S.maps.splice(S.mapCur + 1, 0, c); S.mapCur++; enterMapEdit(); refresh();
  });
  $('meDel').addEventListener('click', () => {
    if (S.maps.length < 2 || !confirm(`Supprimer la carte « ${curMap().name} » ?`)) return;
    S.maps.splice(S.mapCur, 1); S.mapCur = Math.min(S.mapCur, S.maps.length - 1); enterMapEdit(); refresh();
  });
  $('meName').addEventListener('input', () => { curMap().name = $('meName').value; refresh(); });
  function resizeMap() {
    const m = curMap();
    m.w = clampInt($('meW').value, 5, 30, m.w); m.h = clampInt($('meH').value, 5, 30, m.h);
    enterMapEdit(); refresh();
  }
  $('meW').addEventListener('change', resizeMap);
  $('meH').addEventListener('change', resizeMap);
  $('meClear').addEventListener('click', () => { for (const k of Object.keys(S.objs)) delete S.objs[k]; refresh(); });
  $('meRandom').addEventListener('click', () => {
    for (const k of Object.keys(S.objs)) delete S.objs[k];
    const r = Math.random, free = [];
    for (const c of cells) {
      if (c.k === S.caster) continue;
      const v = r();
      if (v < .09) S.objs[c.k] = 'rock'; else if (v < .12) S.objs[c.k] = 'hole'; else free.push(c);
    }
    for (const kind of ['enemy', 'enemy', 'enemy', 'ally', 'ally']) {
      const c = free.splice(Math.floor(r() * free.length), 1)[0]; if (c) S.objs[c.k] = kind;
    }
    refresh();
  });

  // ---------- Export / import (fichiers JSON) ----------
  function downloadJSON(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fileName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'export';

  // ---------- Export / import des cartes ----------
  const mapBundle = list => ({ format: 'atelier-sorts-retro/maps', version: 1, maps: list });
  $('meExport').addEventListener('click', () => { save(); downloadJSON(`carte-${fileName(curMap().name)}.json`, mapBundle([curMap()])); });
  $('meExportAll').addEventListener('click', () => { save(); downloadJSON('cartes-retro.json', mapBundle(S.maps)); });
  $('meImport').addEventListener('click', () => $('meImportFile').click());
  $('meImportFile').addEventListener('change', async () => {
    const f = $('meImportFile').files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      // formats acceptés : { maps: [...] } ou une carte seule { w, h, objs, … }
      const raw = Array.isArray(data && data.maps) ? data.maps : (data && data.objs && data.w ? [data] : null);
      if (!raw || !raw.length) throw new Error('ce fichier ne contient pas de carte');
      const added = raw.filter(m => m && typeof m === 'object').map(m => {
        const n = newMap(m);
        if (S.maps.some(x => x.id === n.id)) n.id = uid('map');
        return n;
      });
      save();
      S.maps.push(...added);
      S.mapCur = S.maps.length - added.length;
      enterMapEdit(); refresh();
      alert(`${added.length} carte(s) importée(s).`);
    } catch (e) { alert('Fichier invalide : ' + e.message); }
    $('meImportFile').value = '';
  });

