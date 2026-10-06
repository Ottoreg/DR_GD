  // ---------- Fiche du sort ----------
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const bounceLabel = p => `${p.bounces} rebond${p.bounces > 1 ? 's' : ''}, bond ${p.bounceRange} PO` +
    `${p.bounceDecay ? `, -${p.bounceDecay} %/bond` : ''} (${{ enemies: 'ennemis', allies: 'alliés', all: 'tous' }[p.bounceTarget]})` +
    `${p.bounceFromEmpty ? ', depuis une case vide possible' : ', cible un personnage'}`;

  function renderCard() {
    const p = P(), tags = [];
    if (p.mode === 'custom') tags.push(`PO personnalisée (${pattern.size} cases)`);
    else {
      const mx = maxPO(p);
      tags.push(`PO ${p.min === mx ? mx : p.min + ' à ' + mx}`);
      if (p.mod) tags.push('PO modifiable');
      if (p.line) tags.push('En ligne');
      if (p.diag) tags.push('En diagonale');
    }
    tags.push(p.los ? 'Ligne de vue' : 'Sans ligne de vue');
    if (p.free) tags.push('Case libre');
    if (p.bounce) tags.push(`↪ ${bounceLabel(p)}`);

    const fx = fxItems(p);
    const zone = zoneLabel(p);
    const foot = [
      `Zone : ${zone}`,
      p.perTurn ? `${p.perTurn} lancer(s) / tour` : null,
      p.perTarget ? `${p.perTarget} lancer(s) / cible` : null,
      p.cooldown ? `Relance : ${p.cooldown} tour(s)` : null,
      p.cc ? `Critique 1/${p.cc}` : null,
      p.ec ? `Échec 1/${p.ec}` : null
    ].filter(Boolean).join(' · ');

    const sp = Sp();
    document.getElementById('card').innerHTML = `
      <div class="card-h"><span class="left">${iconHTML(sp)}<span class="name">${esc(sp.name || 'Sans nom')}</span><span class="lvl-badge">Niv. ${sp.lvl + 1}</span></span><span class="pa">${p.pa} PA</span></div>
      <div class="card-meta">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <div class="desc">${esc(sp.desc)}</div>
      <ul>${fx || '<li class="hint">Aucun effet</li>'}</ul>
      <div class="foot">${foot}</div>`;
  }

  // Lignes d'effets d'un niveau, avec les valeurs calculées selon les caractéristiques
  function fxItems(p) {
    const hasStats = Object.values(S.stats).some(v => v);
    return p.effects.map(e => {
      const a = Math.min(e.min, e.max), b = Math.max(e.min, e.max);
      const [lo, hi] = range(e);
      const calc = hasStats ? ` <small>(→ ${fmt(lo, hi)})</small>` : '';
      const who = e.target === 'all' ? '' : ` <small>· ${FX_TARGETS[e.target].toLowerCase()}</small>`;
      if (e.type === 'heal') return `<li><span class="el" style="background:#62d65a"></span>Soins : ${fmt(a, b)} PV${calc}${who}</li>`;
      const dot = `<span class="el" style="background:${ELEMENTS[e.el].c}"></span>`;
      if (e.type === 'poison') return `<li>${dot}Poison ${ELEMENTS[e.el].n} : ${fmt(a, b)} / tour, ${e.dur} tours${calc}${who}</li>`;
      if (e.type === 'steal') return `<li>${dot}Vol de vie ${ELEMENTS[e.el].n} : ${fmt(a, b)}${calc}${who}</li>`;
      if (e.type === 'summon') return `<li>${summonFxText(e)}</li>`;
      if (e.type === 'trap') return `<li><span class="el glyph-sw" style="background:${fxGlyphColor(e)}"></span>${e.gIcon ? ic(e.gIcon) : "🪤"} Piège ${e.gType === 'heal' ? 'de soin' : ELEMENTS[e.el].n} (${trapZoneLabel(e)}) : ${fmt(a, b)} ${e.gType === 'heal' ? 'PV' : 'dommages'} au déclenchement${calc}${who}</li>`;
      if (e.type === 'glyph') return e.gType === 'heal'
        ? `<li><span class="el glyph-sw" style="background:${fxGlyphColor(e)}"></span>${e.gIcon ? ic(e.gIcon) : "◈"} Glyphe de soin : ${fmt(a, b)} PV / tour, ${e.dur} tours${calc}${who}</li>`
        : `<li><span class="el glyph-sw" style="background:${fxGlyphColor(e)}"></span>${e.gIcon ? ic(e.gIcon) : "◈"} Glyphe ${ELEMENTS[e.el].n} : ${fmt(a, b)} dommages / tour, ${e.dur} tours${calc}${who}</li>`;
      return `<li>${dot}Dommages ${ELEMENTS[e.el].n} : ${fmt(a, b)}${calc}${who}</li>`;
    }).join('');
  }
  const zoneLabel = p => {
    if (p.aoe.startsWith('z:')) { const z = zoneById(p.aoe.slice(2)); return z ? `${esc(z.name)} (${z.cells.length} cases)` : 'Zone supprimée'; }
    return { none: 'Case unique', circle: `Cercle de ${p.aoeSize}`, cross: `Croix de ${p.aoeSize}`, line: `Ligne de ${p.aoeSize}` }[p.aoe];
  };
  const poLabel = p => p.mode === 'custom' ? 'personnalisée' : (p.min === maxPO(p) ? String(maxPO(p)) : `${p.min} à ${maxPO(p)}`);

  // Icône : fond coloré selon l'élément du premier effet
  function iconHTML(sp, big = false) {
    const e = sp.levels[sp.lvl].effects[0];
    const c = !e ? '#9a8a6a' : e.type === 'heal' ? '#4fb548' : ELEMENTS[e.el].c;
    return `<span class="sp-icon${big ? ' big' : ''}" style="background:radial-gradient(circle at 35% 30%, #fff8 0%, ${c} 45%, #2a1d0c 130%)">${ic(sp.icon || '✨')}</span>`;
  }

  // ---------- Tableau éditable des valeurs par niveau ----------
  function fxShort(e) {
    if (!e) return '?';
    if (e.type === 'heal') return `<span class="el" style="background:#62d65a"></span>Soins`;
    if (e.type === 'glyph' && e.gType === 'heal') return `<span class="el" style="background:#4fd05a"></span>◈ Soin`;
    if (e.type === 'trap' && e.gType === 'heal') return `<span class="el" style="background:#4fd05a"></span>🪤 Soin`;
    if (e.type === 'summon') return '🐾 Invocation';
    const n = { dmg: 'Dom.', poison: 'Poison', steal: 'Vol', glyph: '◈ Glyphe', trap: '🪤 Piège' }[e.type];
    return `<span class="el" style="background:${ELEMENTS[e.el].c}"></span>${n} ${ELEMENTS[e.el].n}`;
  }
  function levelTableHTML() {
    const sp = Sp(), n = Math.max(0, ...sp.levels.map(l => l.effects.length));
    const refFx = i => (sp.levels[sp.lvl].effects[i] || sp.levels.find(l => l.effects[i]).effects[i]);
    const num = (l, k, e, extra = '') => `<input type="number" data-l="${l}" data-k="${k}"${e !== undefined ? ` data-e="${e}"` : ''} value="${e !== undefined ? sp.levels[l].effects[e][k] : sp.levels[l][k]}"${extra}>`;
    let head = '<th>Niv.</th><th>PA</th><th>PO</th>';
    for (let i = 0; i < n; i++) head += `<th>${fxShort(refFx(i))}</th>`;
    const rows = sp.levels.map((lv, l) => {
      let r = `<td class="lv" data-lvl="${l}" title="Afficher le niveau ${l + 1}">${l + 1}</td><td>${num(l, 'pa')}</td>`;
      r += lv.mode === 'custom' ? '<td class="hint">perso</td>' : `<td>${num(l, 'min')}–${num(l, 'max')}</td>`;
      for (let i = 0; i < n; i++) {
        const e = lv.effects[i];
        if (!e) { r += '<td class="hint">—</td>'; continue; }
        if (e.type === 'summon') {
          const d = summonById(e.sid);
          r += `<td class="hint">${d ? ic(d.icon) + ' niv ' + (e.sLvl === 'spell' || !e.sLvl ? l + 1 : e.sLvl) : '—'}</td>`;
          continue;
        }
        r += `<td>${num(l, 'min', i)}–${num(l, 'max', i)}${e.type === 'poison' || e.type === 'glyph' ? ' ×' + num(l, 'dur', i, ' title="Durée (tours)"') : ''}</td>`;
      }
      return `<tr class="${l === sp.lvl ? 'cur' : ''}">${r}</tr>`;
    }).join('');
    return `<table class="lt"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  // Re-dessine les tableaux, sauf celui où l'utilisateur est en train de taper
  function renderLevelTables() {
    document.querySelectorAll('[data-lt]').forEach(w => { if (!w.contains(document.activeElement)) w.innerHTML = levelTableHTML(); });
  }
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (!el.closest('[data-lt]') || el.dataset.l === undefined) return;
    const v = parseInt(el.value, 10); if (Number.isNaN(v)) return;
    const lv = Sp().levels[+el.dataset.l], k = el.dataset.k;
    if (el.dataset.e !== undefined) lv.effects[+el.dataset.e][k] = Math.max(k === 'dur' ? 1 : 0, v);
    else {
      lv[k] = Math.max(0, v);
      if (k === 'min' && lv.max < lv.min) lv.max = lv.min;
      if (k === 'max' && lv.min > lv.max) lv.min = lv.max;
    }
    if (+el.dataset.l === Sp().lvl) renderEffects();
    refresh();
  });
  document.addEventListener('click', ev => {
    const td = ev.target.closest('[data-lt] td.lv'); if (td) selectLevel(+td.dataset.lvl);
  });

  // ---------- Page des sorts ----------
  const bookEl = document.getElementById('book');
  const bookOpen = () => !bookEl.classList.contains('hidden');
  function renderBook() {
    if (!bookOpen()) return;
    document.getElementById('bookList').innerHTML = S.spells.map((s, i) => `
      <div class="bl-item${i === S.cur ? ' cur' : ''}" data-bsp="${i}">
        ${iconHTML(s)}
        <div class="t"><span class="n">${esc(s.name || 'Sans nom')}</span><span class="s">Niveau ${s.lvl + 1} · ${s.levels[s.lvl].pa} PA</span></div>
      </div>`).join('');
    const sp = Sp(), p = P();
    const flag = (ok, txt) => `<span class="${ok ? 'yes' : 'no'}">${ok ? '✔' : '✖'} ${txt}</span>`;
    document.getElementById('bookInfo').innerHTML = `
      <div class="bd-head">${iconHTML(sp, true)}
        <div><div class="bd-name">${esc(sp.name || 'Sans nom')}</div><div class="bd-sub">Niveau ${sp.lvl + 1} · ${p.pa} PA · PO ${poLabel(p)}</div></div>
      </div>
      <div class="bd-lvls"><span>Niveau</span>${sp.levels.map((_, i) => `<button data-blvl="${i}" class="${i === sp.lvl ? 'on' : ''}">${i + 1}</button>`).join('')}</div>
      ${sp.desc ? `<div class="bd-desc">${esc(sp.desc)}</div>` : ''}
      <div class="bd-sec">Effets</div>
      <ul class="bd-fx">${fxItems(p) || '<li class="hint">Aucun effet</li>'}</ul>
      <div class="bd-sec">Caractéristiques</div>
      <div class="bd-grid">
        <div><span>Coût</span><b>${p.pa} PA</b></div>
        <div><span>Portée</span><b>${poLabel(p)}</b></div>
        <div><span>Zone</span><b>${zoneLabel(p)}</b></div>
        <div><span>Coups critiques</span><b>${p.cc ? '1/' + p.cc : '—'}</b></div>
        <div><span>Échecs critiques</span><b>${p.ec ? '1/' + p.ec : '—'}</b></div>
        <div><span>Relance</span><b>${p.cooldown ? p.cooldown + ' tour(s)' : '—'}</b></div>
        <div><span>Lancers par tour</span><b>${p.perTurn || '∞'}</b></div>
        <div><span>Lancers par cible</span><b>${p.perTarget || '∞'}</b></div>
        <div><span>Rebonds</span><b>${p.bounce ? bounceLabel(p) : '—'}</b></div>
      </div>
      <div class="bd-flags">
        ${flag(p.los, 'Ligne de vue')}${flag(p.mod, 'Portée modifiable')}${flag(p.line, 'Lancer en ligne')}${flag(p.diag, 'Lancer en diagonale')}${flag(p.free, 'Case libre')}
      </div>`;
  }
  function openBook() { bookEl.classList.remove('hidden'); renderBook(); renderLevelTables(); document.getElementById('bookClose').focus(); }
  function closeBook() { bookEl.classList.add('hidden'); }
  document.getElementById('bookOpen').addEventListener('click', openBook);
  document.getElementById('bookOpenTop').addEventListener('click', openBook);
  document.getElementById('bookClose').addEventListener('click', closeBook);
  bookEl.addEventListener('click', ev => {
    if (ev.target === bookEl) return closeBook();
    const it = ev.target.closest('[data-bsp]'); if (it) return selectSpell(+it.dataset.bsp);
    const lb = ev.target.closest('[data-blvl]'); if (lb) return selectLevel(+lb.dataset.blvl);
    if (ev.target.id === 'bookUse') closeBook();
  });
  document.getElementById('bookNew').addEventListener('click', () => document.getElementById('spNew').click());
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && bookOpen()) { closeBook(); return; }
    const t = ev.target;
    if ((ev.key === 's' || ev.key === 'S') && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
      ev.preventDefault(); bookOpen() ? closeBook() : openBook();
    }
  });

  // ---------- Éditeur d'effets ----------
  const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${typeof v === 'string' ? v : v.n}</option>`).join('');

  const TRAP_KINDS = { dmg: 'de dommages', heal: 'de soin' };
  const trapShapeOptions = sel => opts(TRAP_SHAPES, sel) + (S.zones.length
    ? `<optgroup label="Zones personnalisées">${S.zones.map(z => `<option value="z:${esc(z.id)}"${'z:' + z.id === sel ? ' selected' : ''}>${esc(z.name)}</option>`).join('')}</optgroup>` : '');

  // Texte d'un effet d'invocation (fiche du sort, page des sorts)
  function summonFxText(e) {
    const d = summonById(e.sid);
    if (!d) return '🐾 Invocation : <span class="ko">aucune entité choisie</span>';
    const lvl = summonLevel(e), st = d.levels[lvl - 1];
    return `🐾 Invoque <b>${ic(d.icon)} ${esc(d.name)}</b> <small>(${INV_KINDS[d.kind].n.toLowerCase()}, niv ${lvl} · ${st.pa} PA · ${st.pm} PM · ${st.pv} PV)</small>`;
  }
  const summonOptions = sel => S.summons.map(d => `<option value="${esc(d.id)}"${d.id === sel ? ' selected' : ''}>${icT(d.icon)} ${esc(d.name)} (${INV_KINDS[d.kind].n})</option>`).join('')
    || '<option value="">— aucune entité —</option>';

  function renderEffects() {
    document.getElementById('fxList').innerHTML = P().effects.map((e, i) => e.type === 'summon' ? `
      <div class="fx" data-i="${i}">
        <select data-f="type">${opts(FX_TYPES, e.type)}</select>
        <span></span>
        <button class="del" data-del title="Retirer cet effet">✕</button>
        <div class="vals">
          <label class="gcol grow">Entité <select data-f="sid" style="width:auto;flex:1">${summonOptions(e.sid)}</select></label>
          <label class="gcol">Niveau <select data-f="sLvl" style="width:auto">${opts({ spell: '= niveau du sort', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }, String(e.sLvl || 'spell'))}</select></label>
        </div>
      </div>` : `
      <div class="fx" data-i="${i}">
        <select data-f="type">${opts(FX_TYPES, e.type)}</select>
        <select data-f="el"${e.type === 'heal' ? ' class="hidden"' : ''}>${opts(ELEMENTS, e.el)}</select>
        ${e.type === 'heal' ? '<span></span>' : ''}
        <button class="del" data-del title="Retirer cet effet">✕</button>
        <div class="vals">
          <input type="number" data-f="min" value="${e.min}" min="0"> à
          <input type="number" data-f="max" value="${e.max}" min="0">
          ${e.type === 'glyph' || e.type === 'trap' ? `<select data-f="gType" style="width:auto">${opts(e.type === 'trap' ? TRAP_KINDS : GLYPH_KINDS, e.gType || 'dmg')}</select>
            <label class="gcol" title="Couleur au sol">Couleur
              <select data-f="gColorMode" style="width:auto">${opts({ auto: e.type === 'trap' ? 'Auto (violet / vert)' : 'Auto (rouge / vert)', custom: 'Perso' }, e.gColorMode || 'auto')}</select>
              ${e.gColorMode === 'custom'
                ? `<input type="color" data-f="gColor" value="${e.gColor || autoColor(e)}">`
                : `<span class="el glyph-sw" style="background:${fxGlyphColor(e)}"></span>`}
            </label>
            <label class="gcol" title="Icône affichée au sol (${e.type === 'trap' ? 'au centre du piège' : 'sur chaque case du glyphe'})">Icône
              <select data-f="gIcon" style="width:auto;max-width:110px">${`<option value="">${e.type === 'trap' ? 'Mâchoires' : 'Rune'} (défaut)</option>` + iconOptions(e.gIcon || '')}</select>
              <button class="px-open-fx" data-pxfx="${i}" title="Créer / modifier une icône en pixel art">🎨</button>
            </label>` : ''}
          ${e.type === 'trap' ? `<label class="gcol" title="Forme et taille de la zone du piège (déclenchement et effet), centrée sur la case du piège">Zone
              <select data-f="tAoe" style="width:auto">${trapShapeOptions(e.tAoe || 'none')}</select>
              ${(e.tAoe || 'none') === 'none' || String(e.tAoe).startsWith('z:') ? '' : `<input type="number" data-f="tSize" value="${e.tSize ?? 1}" min="1" max="6">`}
            </label>` : ''}
          ${e.type === 'poison' || e.type === 'glyph' ? `<label>pendant <input type="number" data-f="dur" value="${e.dur}" min="1" max="20"> t.</label>` : ''}
          <select data-f="target" style="width:auto;flex:1">${opts(FX_TARGETS, e.target)}</select>
        </div>
      </div>`).join('') || '<span class="hint">Aucun effet.</span>';
  }

  const fxList = document.getElementById('fxList');
  // ---------- Synchronisation des choix entre niveaux ----------
  const FX_SYNC_FIELDS = ['type', 'el', 'gType', 'target', 'gColorMode', 'gColor', 'gIcon', 'tAoe', 'sid', 'sLvl']; // choix d'un effet
  const SP_SYNC_KEYS = ['bounce', 'bounceTarget', 'bounceLos', 'bounceFromEmpty'];   // choix du rebond
  const otherLevels = () => Sp().syncLevels ? Sp().levels.filter(l => l !== P()) : [];
  // Recopie les choix de l'effet i du niveau courant sur les autres niveaux (sans toucher aux valeurs)
  function syncEffect(i) {
    const src = P().effects[i];
    for (const lv of otherLevels()) {
      if (!lv.effects[i]) { lv.effects[i] = structuredClone(src); continue; }
      for (const f of FX_SYNC_FIELDS) if (src[f] !== undefined) lv.effects[i][f] = src[f];
    }
  }

  function onFx(ev) {
    const row = ev.target.closest('.fx'); if (!row) return;
    const i = +row.dataset.i, e = P().effects[i], f = ev.target.dataset.f;
    if (!f) return;
    if (['min', 'max', 'dur', 'tSize'].includes(f)) { const v = parseInt(ev.target.value, 10); if (Number.isNaN(v)) return; e[f] = v; }
    else e[f] = ev.target.value;
    if (f === 'type' && ev.type === 'change') {
      e.target = FX_DEFAULT_TARGET[e.type];
      if ((e.type === 'glyph' || e.type === 'trap') && !e.gType) e.gType = 'dmg';
      if (e.type === 'trap' && !e.tAoe) { e.tAoe = 'none'; e.tSize = 1; }
      if (e.type === 'summon') { if (!summonById(e.sid)) e.sid = S.summons[0] ? S.summons[0].id : ''; if (!e.sLvl) e.sLvl = 'spell'; }
      renderEffects();
    }
    if (f === 'tAoe' && ev.type === 'change') { if (!(e.tSize >= 1)) e.tSize = 1; renderEffects(); }
    if (f === 'gType' && ev.type === 'change') { e.target = e.gType === 'heal' ? 'allies' : 'all'; renderEffects(); }
    if (f === 'gColorMode' && ev.type === 'change') {
      if (e.gColorMode === 'custom' && !e.gColor) e.gColor = autoColor(e);
      renderEffects();
    }
    if (FX_SYNC_FIELDS.includes(f)) syncEffect(i);
    refresh();
  }
  fxList.addEventListener('input', onFx);
  fxList.addEventListener('change', ev => { if (['type', 'gType', 'gColorMode', 'gIcon', 'tAoe', 'sid', 'sLvl'].includes(ev.target.dataset.f)) onFx(ev); });
  fxList.addEventListener('click', ev => {
    if (!ev.target.hasAttribute('data-del')) return;
    const i = +ev.target.closest('.fx').dataset.i;
    P().effects.splice(i, 1);
    for (const lv of otherLevels()) if (lv.effects[i]) lv.effects.splice(i, 1);
    renderEffects(); refresh();
  });
  document.getElementById('fxAdd').addEventListener('click', () => {
    const fx = { type: 'dmg', el: 'neutre', min: 5, max: 10, dur: 3, target: 'all' };
    P().effects.push(fx);
    // ajouté à la même position sur les autres niveaux (qui n'ont pas déjà un effet à cet endroit)
    const i = P().effects.length - 1;
    for (const lv of otherLevels()) if (!lv.effects[i]) { while (lv.effects.length < i) lv.effects.push(structuredClone(fx)); lv.effects.push(structuredClone(fx)); }
    renderEffects(); refresh();
  });

