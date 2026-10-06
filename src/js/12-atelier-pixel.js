  // ======================================================================
  // ---------- Atelier d'icônes pixel art ----------
  // ======================================================================
  const PX_VIEW = 448; // taille d'affichage de la grille d'édition (px CSS)
  const PX_PALETTE = [
    '#000000', '#3b2a1a', '#6b4a22', '#a07443', '#d8b27a', '#f3e2b8', '#ffffff', '#a3a3a3',
    '#5c5c5c', '#7a1f1a', '#c8321f', '#ff6a2a', '#ffb347', '#ffe066', '#9ee04a', '#4f9a3a',
    '#1f5f2a', '#1d6f6a', '#3fb8c8', '#3f93e6', '#2653a8', '#1b2a5a', '#6a4ab8', '#9b4ad8',
    '#d85ab8', '#ff9ec8', '#f0c496', '#b27a3a', '#5a3f22', '#e8552b', '#57b548', '#2a2a2a'
  ];
  const pxEl = $('pxEd'), pxCv = $('pxCv'), pxCtx = pxCv.getContext('2d');
  pxCv.width = pxCv.height = PX_VIEW * dpr;
  let pxCur = null, pxTool = 'pen', pxColor = '#c8321f', pxMirror = false, pxGridOn = true;
  let pxDown = false, pxStrokeErase = false, pxLast = null, pxHover = null, pxTarget = null;
  let pxUndo = [], pxRedo = [];
  if (!Array.isArray(S.pxRecent)) S.pxRecent = [];
  const curPx = () => pxById(pxCur);
  const pxOpen = () => !pxEl.classList.contains('hidden');

  function pxDraw() {
    const p = curPx(), n = p ? p.size : 16, cs = PX_VIEW / n;
    pxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {       // damier = transparence
      pxCtx.fillStyle = (x + y) % 2 ? '#cfc6b0' : '#e8e1ce'; pxCtx.fillRect(x * cs, y * cs, cs, cs);
    }
    if (!p) return;
    p.px.forEach((c, i) => { if (c) { pxCtx.fillStyle = c; pxCtx.fillRect((i % n) * cs, Math.floor(i / n) * cs, cs, cs); } });
    if (pxGridOn) {
      for (let k = 0; k <= n; k++) {
        pxCtx.strokeStyle = k % 8 === 0 ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.14)'; pxCtx.lineWidth = 1;
        pxCtx.beginPath(); pxCtx.moveTo(k * cs + .5, 0); pxCtx.lineTo(k * cs + .5, PX_VIEW); pxCtx.stroke();
        pxCtx.beginPath(); pxCtx.moveTo(0, k * cs + .5); pxCtx.lineTo(PX_VIEW, k * cs + .5); pxCtx.stroke();
      }
    }
    if (pxMirror) {
      pxCtx.setLineDash([6, 4]); pxCtx.strokeStyle = '#ff8a2a'; pxCtx.lineWidth = 2;
      pxCtx.beginPath(); pxCtx.moveTo(PX_VIEW / 2, 0); pxCtx.lineTo(PX_VIEW / 2, PX_VIEW); pxCtx.stroke(); pxCtx.setLineDash([]);
    }
    if (pxHover) {
      const cells = [pxHover]; if (pxMirror) cells.push([n - 1 - pxHover[0], pxHover[1]]);
      pxCtx.strokeStyle = '#fff'; pxCtx.lineWidth = 2;
      for (const [x, y] of cells) pxCtx.strokeRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
    }
  }

  function pxRenderPanel() {
    const p = curPx();
    $('pxLib').innerHTML = S.pixelIcons.map(x => `<button data-pxid="${esc(x.id)}" class="${x.id === pxCur ? 'on' : ''}" title="${esc(x.name)}"><img src="${pxRender(x).url}" alt=""><span>${esc(x.name.slice(0, 8))}</span></button>`).join('')
      || '<span class="empty">Aucune icône : clique « Nouvelle ».</span>';
    ['pxDup', 'pxDel', 'pxName', 'pxFlip', 'pxClear', 'pxImport', 'pxExportOne', 'pxExportPng'].forEach(id => $(id).disabled = !p);
    $('pxExportAll').disabled = !S.pixelIcons.length;
    writeInput($('pxName'), p ? p.name : '');
    document.querySelectorAll('[data-pxs]').forEach(b => b.classList.toggle('on', p && +b.dataset.pxs === p.size));
    document.querySelectorAll('[data-pxt]').forEach(b => b.classList.toggle('on', b.dataset.pxt === pxTool));
    $('pxMirror').classList.toggle('on', pxMirror);
    $('pxGrid').classList.toggle('on', pxGridOn);
    $('pxUndo').disabled = !pxUndo.length; $('pxRedo').disabled = !pxRedo.length;
    $('pxColor').value = pxColor;
    $('pxPal').innerHTML = PX_PALETTE.map(c => `<button data-pxc="${c}" class="${c === pxColor ? 'on' : ''}" style="background:${c}" title="${c}"></button>`).join('');
    $('pxRecent').innerHTML = S.pxRecent.map(c => `<button data-pxc="${c}" style="background:${c}" title="${c}"></button>`).join('');
    // aperçu à taille réelle, ×2, et dans les cadres d'icône de sort et de classe
    if (p) {
      const url = pxRender(p).url, col = pxTarget === 'class' && curClass() ? curClass().color : '#b86d22';
      $('pxPrev').innerHTML = `<img src="${url}" width="${p.size}" height="${p.size}" title="Taille réelle">
        <img src="${url}" width="${p.size * 2}" height="${p.size * 2}" title="×2">
        <span class="sp-icon big" style="background:radial-gradient(circle at 35% 30%, #fff8 0%, #b86d22 45%, #2a1d0c 130%)"><img src="${url}" alt=""></span>
        <span class="cl-badge big" style="background:radial-gradient(circle at 35% 30%, ${shadeHex(col, .45)} 0%, ${col} 55%, ${shadeHex(col, -.45)} 100%)"><img src="${url}" alt=""></span>`;
    } else $('pxPrev').innerHTML = '<span class="hint">Aucune icône sélectionnée.</span>';
    const fx = pxTargetFx();
    const tgt = pxTarget === 'spell' ? `le sort « ${esc(Sp().name)} »`
      : pxTarget === 'class' && curClass() ? `la classe « ${esc(curClass().name)} »`
      : pxTarget === 'summon' && S.summons[S.invCur] ? `l'entité « ${esc(S.summons[S.invCur].name)} »`
      : fx ? `le ${fx.type === 'trap' ? 'piège' : 'glyphe'} de « ${esc(Sp().name)} »` : '';
    // pour un glyphe / piège : aperçu posé sur une case de sa couleur
    if (p && fx) $('pxPrev').insertAdjacentHTML('beforeend',
      `<span class="px-ground" style="--c:${fxGlyphColor(fx)}"><img src="${pxRender(p).url}" alt=""></span>`);
    $('pxUse').innerHTML = `✔ Utiliser pour ${tgt}`;
    $('pxUse').classList.toggle('hidden', !tgt || !p);
    pxDraw();
  }

  // Répercute une modification d'icône dans toute l'application
  function pxApplyEverywhere() {
    refreshIconSelects();
    renderSpellList(); renderEffects(); renderCombat(); refresh();
  }
  function pxTouch() { const p = curPx(); if (p) p.v++; }
  function pxSnapshot() { const p = curPx(); if (!p) return; pxUndo.push({ id: p.id, size: p.size, px: p.px.slice() }); if (pxUndo.length > 60) pxUndo.shift(); pxRedo = []; }
  function pxRestore(from, to) {
    const snap = from.pop(); if (!snap) return;
    const p = pxById(snap.id); if (!p) return;
    to.push({ id: p.id, size: p.size, px: p.px.slice() });
    p.size = snap.size; p.px = snap.px; p.v++; pxCur = p.id;
    pxRenderPanel(); pxApplyEverywhere();
  }

  function pxCellAt(ev) {
    const p = curPx(); if (!p) return null;
    const r = pxCv.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * p.size), y = Math.floor((ev.clientY - r.top) / r.height * p.size);
    return x >= 0 && y >= 0 && x < p.size && y < p.size ? [x, y] : null;
  }
  function pxSet(x, y, col) {
    const p = curPx(), n = p.size;
    p.px[y * n + x] = col;
    if (pxMirror) p.px[y * n + (n - 1 - x)] = col;
  }
  function pxLine(a, b, col) { // tracé continu entre deux cases (Bresenham)
    let [x0, y0] = a; const [x1, y1] = b;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { pxSet(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function pxFill(x, y, col) { // pot de peinture (4 voisins)
    const p = curPx(), n = p.size, target = p.px[y * n + x];
    if (target === col) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= n || cy >= n || p.px[cy * n + cx] !== target) continue;
      p.px[cy * n + cx] = col;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    if (pxMirror) { /* le remplissage suit la forme telle quelle ; pas de miroir */ }
  }
  function pxAddRecent(c) { S.pxRecent = [c, ...S.pxRecent.filter(x => x !== c)].slice(0, 10); }

  pxCv.addEventListener('contextmenu', e => e.preventDefault());
  pxCv.addEventListener('pointerdown', ev => {
    const c = pxCellAt(ev); if (!c) return;
    const p = curPx();
    if (pxTool === 'pick') {
      const col = p.px[c[1] * p.size + c[0]];
      if (col) { pxColor = col; pxTool = 'pen'; }
      pxRenderPanel(); return;
    }
    pxSnapshot();
    if (pxTool === 'fill' && ev.button !== 2) { pxFill(c[0], c[1], pxColor); pxAddRecent(pxColor); pxTouch(); pxRenderPanel(); pxApplyEverywhere(); return; }
    try { pxCv.setPointerCapture(ev.pointerId); } catch (e) {}
    pxDown = true; pxStrokeErase = ev.button === 2 || pxTool === 'erase';
    if (!pxStrokeErase) pxAddRecent(pxColor);
    pxSet(c[0], c[1], pxStrokeErase ? '' : pxColor); pxLast = c;
    pxTouch(); pxDraw();
  });
  pxCv.addEventListener('pointermove', ev => {
    const c = pxCellAt(ev);
    if (String(c) === String(pxHover) && !pxDown) return;
    pxHover = c;
    if (pxDown && c) { pxLine(pxLast || c, c, pxStrokeErase ? '' : pxColor); pxLast = c; pxTouch(); }
    pxDraw();
  });
  const pxEnd = () => { if (!pxDown) return; pxDown = false; pxLast = null; pxRenderPanel(); pxApplyEverywhere(); };
  pxCv.addEventListener('pointerup', pxEnd);
  pxCv.addEventListener('pointercancel', pxEnd);
  pxCv.addEventListener('pointerleave', () => { pxHover = null; if (!pxDown) pxDraw(); });

  // outils, couleurs, options
  document.querySelectorAll('[data-pxt]').forEach(b => b.addEventListener('click', () => { pxTool = b.dataset.pxt; pxRenderPanel(); }));
  $('pxPal').addEventListener('click', ev => { const b = ev.target.closest('[data-pxc]'); if (b) { pxColor = b.dataset.pxc; if (pxTool !== 'fill') pxTool = 'pen'; pxRenderPanel(); } });
  $('pxRecent').addEventListener('click', ev => { const b = ev.target.closest('[data-pxc]'); if (b) { pxColor = b.dataset.pxc; if (pxTool !== 'fill') pxTool = 'pen'; pxRenderPanel(); } });
  $('pxColor').addEventListener('input', () => { pxColor = $('pxColor').value.toLowerCase(); if (pxTool === 'erase' || pxTool === 'pick') pxTool = 'pen'; pxRenderPanel(); });
  $('pxMirror').addEventListener('click', () => { pxMirror = !pxMirror; pxRenderPanel(); });
  $('pxGrid').addEventListener('click', () => { pxGridOn = !pxGridOn; pxRenderPanel(); });
  $('pxUndo').addEventListener('click', () => pxRestore(pxUndo, pxRedo));
  $('pxRedo').addEventListener('click', () => pxRestore(pxRedo, pxUndo));

  // bibliothèque
  $('pxLib').addEventListener('click', ev => { const b = ev.target.closest('[data-pxid]'); if (b) { pxCur = b.dataset.pxid; pxRenderPanel(); } });
  function pxCreate(o) { const p = newPxIcon(o); S.pixelIcons.push(p); pxCur = p.id; refreshIconSelects(); pxRenderPanel(); save(); return p; }
  $('pxNew').addEventListener('click', () => pxCreate({ size: curPx() ? curPx().size : 16, name: 'Icône ' + (S.pixelIcons.length + 1) }));
  $('pxDup').addEventListener('click', () => { const p = curPx(); if (p) pxCreate({ size: p.size, px: p.px.slice(), name: p.name + ' (copie)' }); });
  $('pxDel').addEventListener('click', () => {
    const p = curPx(); if (!p || !confirm(`Supprimer l'icône « ${p.name} » ? Les sorts, classes et entités qui l'utilisent reprennent une icône par défaut.`)) return;
    const ref = 'px:' + p.id;
    S.spells.forEach(s => { if (s.icon === ref) s.icon = '✨'; });
    S.classes.forEach(c => { if (c.icon === ref) c.icon = '⚔️'; });
    S.summons.forEach(d => { if (d.icon === ref) d.icon = '🐾'; });
    // glyphes / pièges : retour à l'icône par défaut (effets des sorts et éléments posés)
    S.spells.forEach(s => s.levels.forEach(l => l.effects.forEach(e => { if (e.gIcon === ref) e.gIcon = ''; })));
    [...S.glyphs, ...S.traps].forEach(g => { if (g.icon === ref) g.icon = ''; });
    const i = S.pixelIcons.indexOf(p);
    S.pixelIcons.splice(i, 1); pxCache.delete(p.id);
    pxCur = (S.pixelIcons[i] || S.pixelIcons[i - 1] || {}).id || null;
    pxUndo = pxUndo.filter(s => s.id !== p.id); pxRedo = pxRedo.filter(s => s.id !== p.id);
    pxRenderPanel(); pxApplyEverywhere();
  });
  $('pxName').addEventListener('input', () => { const p = curPx(); if (p) { p.name = $('pxName').value; pxRenderPanel(); refreshIconSelects(); save(); } });
  $('pxName').addEventListener('change', pxApplyEverywhere);
  document.querySelectorAll('[data-pxs]').forEach(b => b.addEventListener('click', () => {
    const p = curPx(), n2 = +b.dataset.pxs; if (!p || p.size === n2) return;
    pxSnapshot();
    const n1 = p.size, out = Array(n2 * n2).fill('');
    for (let y = 0; y < n2; y++) for (let x = 0; x < n2; x++) out[y * n2 + x] = p.px[Math.floor(y * n1 / n2) * n1 + Math.floor(x * n1 / n2)];
    p.size = n2; p.px = out; p.v++;
    pxRenderPanel(); pxApplyEverywhere();
  }));
  $('pxFlip').addEventListener('click', () => {
    const p = curPx(); if (!p) return; pxSnapshot();
    const n = p.size, out = p.px.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = p.px[y * n + (n - 1 - x)];
    p.px = out; p.v++; pxRenderPanel(); pxApplyEverywhere();
  });
  $('pxClear').addEventListener('click', () => { const p = curPx(); if (!p) return; pxSnapshot(); p.px.fill(''); p.v++; pxRenderPanel(); pxApplyEverywhere(); });

  // import d'une image : réduite à la taille de l'icône (les pixels peu opaques deviennent transparents)
  $('pxImport').addEventListener('click', () => $('pxImportFile').click());
  $('pxImportFile').addEventListener('change', () => {
    const f = $('pxImportFile').files[0], p = curPx(); if (!f || !p) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const n = p.size, c = document.createElement('canvas'); c.width = c.height = n;
        const g = c.getContext('2d'), k = Math.min(n / img.width, n / img.height);
        const w = img.width * k, h = img.height * k;
        g.drawImage(img, (n - w) / 2, (n - h) / 2, w, h);
        const d = g.getImageData(0, 0, n, n).data;
        pxSnapshot();
        for (let i = 0; i < n * n; i++) p.px[i] = d[i * 4 + 3] < 128 ? '' : '#' + [0, 1, 2].map(o => d[i * 4 + o].toString(16).padStart(2, '0')).join('');
        p.v++; pxRenderPanel(); pxApplyEverywhere();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    $('pxImportFile').value = '';
  });

  // export / import des icônes
  const iconBundle = list => ({ format: 'atelier-sorts-retro/icons', version: 1, icons: list.map(({ id, name, size, px }) => ({ id, name, size, px })) });
  $('pxExportOne').addEventListener('click', () => { const p = curPx(); if (p) downloadJSON(`icone-${fileName(p.name)}.json`, iconBundle([p])); });
  $('pxExportAll').addEventListener('click', () => downloadJSON('icones-retro.json', iconBundle(S.pixelIcons)));
  $('pxExportPng').addEventListener('click', () => {
    const p = curPx(); if (!p) return;
    const k = 8, c = document.createElement('canvas'); c.width = c.height = p.size * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(pxRender(p).canvas, 0, 0, c.width, c.height);
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `icone-${fileName(p.name)}.png`; a.click();
  });
  $('pxImportJson').addEventListener('click', () => $('pxImportJsonFile').click());
  $('pxImportJsonFile').addEventListener('change', async () => {
    const f = $('pxImportJsonFile').files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      // formats acceptés : { icons: [...] } (atelier, export de sorts ou de classes) ou une icône seule { size, px }
      const raw = Array.isArray(data && data.icons) ? data.icons : (data && Array.isArray(data.px) ? [data] : null);
      if (!raw || !raw.length) throw new Error('ce fichier ne contient pas d\'icône');
      let added = 0, same = 0, first = null;
      for (const o of raw) {
        if (!o || !Array.isArray(o.px)) continue;
        const n = newPxIcon(o), ex = pxById(n.id);
        // déjà présente à l'identique : ignorée ; même identifiant mais dessin différent : ajoutée comme copie
        if (ex && ex.size === n.size && ex.px.join() === n.px.join()) { same++; continue; }
        if (ex) { n.id = uid('px'); n.name += ' (importée)'; }
        S.pixelIcons.push(n); added++; first = first || n;
      }
      if (first) pxCur = first.id;
      pxRenderPanel(); pxApplyEverywhere();
      alert(`${added} icône(s) importée(s)${same ? ` · ${same} déjà présente(s)` : ''}.`);
    } catch (e) { alert('Fichier invalide : ' + e.message); }
    $('pxImportJsonFile').value = '';
  });

  // ouvrir / utiliser / fermer
  // Cible de l'atelier : 'spell' | 'class' | 'summon' | { fx: index d'effet } | null (atelier libre)
  function pxTargetFx() {
    if (!pxTarget || typeof pxTarget !== 'object') return null;
    const e = P().effects[pxTarget.fx];
    return e && (e.type === 'glyph' || e.type === 'trap') ? e : null;
  }
  function openPx(target) {
    pxTarget = target;
    const fx = pxTargetFx();
    const cur = fx ? fx.gIcon : target === 'spell' ? Sp().icon : target === 'class' ? (curClass() || {}).icon
      : target === 'summon' ? (S.summons[S.invCur] || {}).icon : '';
    if (isPx(cur) && pxById(cur.slice(3))) pxCur = cur.slice(3);
    else if (!curPx()) pxCur = S.pixelIcons.length ? S.pixelIcons[0].id : null;
    if (!pxCur) pxCreate({ size: 16, name: 'Icône 1' });
    pxEl.classList.remove('hidden');
    pxRenderPanel();
  }
  const closePx = () => { pxEl.classList.add('hidden'); pxHover = null; save(); };
  document.querySelectorAll('.px-open').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); openPx(b.dataset.pxfor); }));
  $('pxClose').addEventListener('click', closePx);
  pxEl.addEventListener('click', ev => { if (ev.target === pxEl) closePx(); });
  $('pxUse').addEventListener('click', () => {
    const p = curPx(); if (!p) return;
    const ref = 'px:' + p.id;
    if (pxTarget === 'spell') Sp().icon = ref;
    else if (pxTarget === 'class' && curClass()) curClass().icon = ref;
    else if (pxTarget === 'summon' && S.summons[S.invCur]) S.summons[S.invCur].icon = ref;
    else if (pxTargetFx()) { pxTargetFx().gIcon = ref; syncEffect(pxTarget.fx); }
    closePx(); pxApplyEverywhere();
  });
  // bouton 🎨 d'un glyphe / piège (éditeur d'effets) et atelier libre (barre de navigation)
  fxList.addEventListener('click', ev => { const b = ev.target.closest('.px-open-fx'); if (b) { ev.preventDefault(); openPx({ fx: +b.dataset.pxfx }); } });
  $('pxWorkshop').addEventListener('click', () => openPx(null));
  document.addEventListener('keydown', ev => {
    if (!pxOpen()) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName);
    if (ev.key === 'Escape') { closePx(); ev.stopImmediatePropagation(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); pxRestore(pxUndo, pxRedo); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); pxRestore(pxRedo, pxUndo); return; }
    if (typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = { b: 'pen', e: 'erase', g: 'fill', i: 'pick' }[ev.key.toLowerCase()];
    if (t) { pxTool = t; pxRenderPanel(); }
    ev.stopImmediatePropagation(); // pas de raccourci « S » (page des sorts) pendant l'édition
  }, true);

