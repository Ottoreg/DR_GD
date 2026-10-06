  // ---------- Zones personnalisées : modèle ----------
  // Une zone est une liste de cases "f,s" relatives à la case ciblée :
  // f = vers l'avant (en s'éloignant du lanceur), s = sur le côté.
  const ZR = 6; // rayon de l'éditeur
  const ZGEN = { cone: 'Cône', line: 'Ligne', perp: 'Ligne perpendiculaire', circle: 'Cercle', cross: 'Croix', square: 'Carré', ring: 'Anneau', half: 'Demi-cercle (vers l\'avant)' };
  function genZone(type, n) {
    const out = [];
    for (let f = -ZR; f <= ZR; f++) for (let s = -ZR; s <= ZR; s++) {
      const a = Math.abs(f), b = Math.abs(s);
      const ok = {
        cone: f >= 0 && f <= n && b <= f,
        line: s === 0 && f >= 0 && f <= n,
        perp: f === 0 && b <= n,
        circle: a + b <= n,
        cross: (f === 0 || s === 0) && a + b <= n,
        square: a <= n && b <= n,
        ring: a + b === n,
        half: f >= 0 && a + b <= n
      }[type];
      if (ok) out.push(f + ',' + s);
    }
    return out;
  }
  const DEFAULT_ZONES = () => [
    { id: 'cone3', name: 'Cône 3', oriented: true, cells: genZone('cone', 3) },
    { id: 'perp2', name: 'Ligne perpendiculaire 2', oriented: true, cells: genZone('perp', 2) },
    { id: 'ring2', name: 'Anneau 2', oriented: false, cells: genZone('ring', 2) }
  ];

  // ---------- État ----------
  const STORE = 'retro-po-v2';
  const DEFAULT = {
    showRay: true, grid: true, showNumbers: true, sym: true,
    tool: 'caster', caster: '16,1', objs: null,
    stats: { force: 0, intel: 0, chance: 0, agi: 0, dmg: 0, pctDmg: 0, soins: 0, invoc: 1, pv: 200, pa: 6, pm: 3 },
    rt: {}, rules: true, showHp: true, // état de combat des personnages (PV, PA/PM, lancers) et options
    spells: null, cur: 0,
    zones: null, zoneCur: 0, zMirror: true, tab: 'spell',
    glyphs: [], traps: [], turn: 1, log: [],
    summons: null, invCur: 0,   // entités invocables (définitions)
    inv: {},                    // invocations posées sur la carte : case → { sid, lvl }
    active: null,               // case de l'invocation contrôlée (null = le lanceur)
    maps: null, mapCur: 0,      // cartes enregistrées (disposition de départ)
    classes: null, classCur: 0, charLvl: 200,
    view: 'preview'             // interface affichée : classes | spells | preview | maps
  };
  let S = structuredClone(DEFAULT);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) S = Object.assign(S, saved, { stats: Object.assign({}, DEFAULT.stats, saved.stats) });
  } catch (e) {}
  if (!Array.isArray(S.spells) || !S.spells.length) S.spells = DEFAULT_SPELLS();
  S.spells = S.spells.map(s => newSpell(s));
  if (!(S.cur >= 0 && S.cur < S.spells.length)) S.cur = 0;
  if (!Array.isArray(S.zones) || !S.zones.length) S.zones = DEFAULT_ZONES();
  if (!(S.zoneCur >= 0 && S.zoneCur < S.zones.length)) S.zoneCur = 0;
  if (!Array.isArray(S.glyphs)) S.glyphs = [];
  if (!Array.isArray(S.traps)) S.traps = [];
  if (!Array.isArray(S.log)) S.log = [];
  if (!(S.turn >= 1)) S.turn = 1;
  const zoneById = id => S.zones.find(z => z.id === id);
  if (!byKey.has(S.caster)) S.caster = DEFAULT.caster;
  if (!Array.isArray(S.summons) || !S.summons.length) S.summons = DEFAULT_SUMMONS();
  S.summons = S.summons.map(newSummon);
  if (!(S.invCur >= 0 && S.invCur < S.summons.length)) S.invCur = 0;
  if (!S.inv || typeof S.inv !== 'object') S.inv = {};
  const summonById = id => S.summons.find(s => s.id === id);
  const summonKind = iv => { const d = iv && summonById(iv.sid); return d ? d.kind : 'creature'; };
  const summonStats = iv => { const d = iv && summonById(iv.sid); return d ? d.levels[Math.min(5, Math.max(0, iv.lvl - 1))] : { pa: 0, pm: 0, pv: 0 }; };
  // Case du personnage qui joue : l'invocation contrôlée, sinon le lanceur
  const activeKey = () => (S.active && S.inv[S.active] && S.objs[S.active] === 'ally') ? S.active : S.caster;

  const ICONS = ['✨','🔥','💧','🌪️','🪨','⚡','❄️','☠️','🩸','💚','⚔️','🗡️','🏹','🛡️','🔮','🌀','💥','🌿','🐾','👊','🪤','💣','🐗','🗿','🧱','🦷','📦','🐺','🦂','🌳','🕷️','🐉','💀'];

  // ---------- Icônes pixel art ----------
  // Une icône perso = { id, name, size (16 ou 32), px: [couleur '#rrggbb' ou '' par pixel], v (version) }.
  // Une icône de sort / classe / entité vaut soit un emoji, soit 'px:<id>'.
  if (!Array.isArray(S.pixelIcons)) S.pixelIcons = [];
  const newPxIcon = (o = {}) => {
    const size = o.size === 32 ? 32 : 16;
    const px = Array.isArray(o.px) && o.px.length === size * size
      ? o.px.map(c => /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '') : Array(size * size).fill('');
    return { id: o.id || uid('px'), name: o.name || 'Nouvelle icône', size, px, v: 1 };
  };
  S.pixelIcons = S.pixelIcons.map(newPxIcon);
  const pxById = id => S.pixelIcons.find(p => p.id === id);
  const isPx = icon => typeof icon === 'string' && icon.startsWith('px:');
  const pxCache = new Map(); // id → { canvas, url, v }
  function pxRender(p) {
    const hit = pxCache.get(p.id);
    if (hit && hit.v === p.v) return hit;
    const c = document.createElement('canvas'); c.width = c.height = p.size;
    const g = c.getContext('2d');
    p.px.forEach((col, i) => { if (col) { g.fillStyle = col; g.fillRect(i % p.size, Math.floor(i / p.size), 1, 1); } });
    const out = { canvas: c, url: c.toDataURL(), v: p.v };
    pxCache.set(p.id, out);
    return out;
  }
  // Icône en HTML (emoji échappé ou image pixelisée) / en texte pour les <option>
  function ic(icon) {
    if (isPx(icon)) { const p = pxById(icon.slice(3)); return p ? `<img class="px-ic" src="${pxRender(p).url}" alt="">` : '❔'; }
    return esc(icon || '');
  }
  const icT = icon => isPx(icon) ? '🎨 ' + ((pxById(icon.slice(3)) || {}).name || '?') : (icon || '');
  const iconOptions = sel => ICONS.map(i => `<option${i === sel ? ' selected' : ''}>${i}</option>`).join('') +
    (S.pixelIcons.length ? `<optgroup label="Mes icônes (pixel art)">${S.pixelIcons.map(p =>
      `<option value="px:${esc(p.id)}"${'px:' + p.id === sel ? ' selected' : ''}>🎨 ${esc(p.name)}</option>`).join('')}</optgroup>` : '');
  // Recrée les listes d'icônes (sort, entité, classe) avec la bibliothèque à jour
  function refreshIconSelects() {
    document.getElementById('iconSel').innerHTML = iconOptions(Sp().icon);
    document.getElementById('invIcon').innerHTML = iconOptions(S.summons[S.invCur] && S.summons[S.invCur].icon);
    document.getElementById('clIcon').innerHTML = iconOptions(S.classes[S.classCur] && S.classes[S.classCur].icon);
  }
  // Ajoute des icônes importées (celles dont l'identifiant existe déjà sont ignorées)
  function mergeIcons(list) {
    let n = 0;
    for (const p of Array.isArray(list) ? list : []) if (p && p.id && !pxById(p.id)) { S.pixelIcons.push(newPxIcon(p)); n++; }
    return n;
  }
  const Sp = () => S.spells[S.cur];                 // sort courant
  const P = () => Sp().levels[Sp().lvl];            // niveau courant du sort
  let pattern = new Set(P().pattern);

  function save() {
    P().pattern = [...pattern];
    // interface Cartes : la carte éditée est la carte enregistrée
    if (S.view === 'maps') { curMap().objs = S.objs; curMap().caster = S.caster; }
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
  }

