  // ---------- Interface Classes ----------
  // (la liste d'icônes de classe est remplie par refreshIconSelects)
  const classBadge = (c, size = '') => `<span class="cl-badge ${size}" style="background:radial-gradient(circle at 35% 30%, ${shadeHex(c.color, .45)} 0%, ${c.color} 55%, ${shadeHex(c.color, -.45)} 100%)">${ic(c.icon)}</span>`;
  const spellById = id => S.spells.find(s => s.id === id);
  const sortedClassSpells = c => c.spells.slice().sort((a, b) => a.lvl - b.lvl);

  function renderClassView() {
    $('clList').innerHTML = S.classes.map((c, i) => `
      <div class="cl-item${i === S.classCur ? ' cur' : ''}" data-cl="${i}">
        ${classBadge(c)}
        <div class="t"><span class="n">${esc(c.name)}</span><span class="s">${c.spells.length} sort${c.spells.length > 1 ? 's' : ''}</span></div>
      </div>`).join('') || '<span class="hint">Aucune classe. Crée-en une avec « Nouvelle ».</span>';
    const c = curClass();
    $('clEditor').style.display = c ? '' : 'none';
    ['clDup', 'clDel', 'clExport'].forEach(id => $(id).disabled = !c);
    if (!c) return;
    $('clBadge').outerHTML = classBadge(c, 'big').replace('<span', '<span id="clBadge"');
    writeInput($('clName'), c.name);
    $('clIcon').value = c.icon;
    $('clColor').value = c.color;
    writeInput($('clDesc'), c.desc);
    if (!$('clSpells').contains(document.activeElement)) {
      $('clSpells').innerHTML = sortedClassSpells(c).map(x => {
        const sp = spellById(x.sid); if (!sp) return '';
        const l1 = sp.levels[0], l6 = sp.levels[5];
        return `<div class="cl-sp">
          ${iconHTML(sp)}
          <span class="nm">${esc(sp.name)}</span>
          <span class="meta">${l1.pa} PA · PO ${poLabel(l1)}${poLabel(l6) !== poLabel(l1) ? ' → ' + poLabel(l6) : ''}</span>
          <label>niv. <input type="number" min="1" max="200" value="${x.lvl}" data-cllvl="${esc(x.sid)}"></label>
          <button data-cledit="${esc(x.sid)}" title="Ouvrir ce sort dans l'interface Sorts">✏️</button>
          <button data-cldel="${esc(x.sid)}" title="Retirer de la classe">✕</button>
        </div>`;
      }).join('') || '<span class="hint">Aucun sort pour l\'instant : ajoute-en depuis la bibliothèque ci-dessous.</span>';
    }
    const free = S.spells.filter(s => !c.spells.some(x => x.sid === s.id));
    $('clAddSel').innerHTML = free.map(s => `<option value="${esc(s.id)}">${icT(s.icon)} ${esc(s.name)}</option>`).join('') || '<option value="">— tous les sorts sont déjà dans la classe —</option>';
    $('clAdd').disabled = !free.length;
  }
  $('clList').addEventListener('click', ev => { const it = ev.target.closest('[data-cl]'); if (it) { S.classCur = +it.dataset.cl; refresh(); } });
  $('clNew').addEventListener('click', () => { S.classes.push(newClass()); S.classCur = S.classes.length - 1; refresh(); });
  $('clDup').addEventListener('click', () => {
    const c = newClass(Object.assign(structuredClone(curClass()), { id: uid('cl') })); c.name += ' (copie)';
    S.classes.splice(S.classCur + 1, 0, c); S.classCur++; refresh();
  });
  $('clDel').addEventListener('click', () => {
    if (!curClass() || !confirm(`Supprimer la classe « ${curClass().name} » ? (ses sorts restent dans la bibliothèque)`)) return;
    S.classes.splice(S.classCur, 1); S.classCur = Math.max(0, Math.min(S.classCur, S.classes.length - 1)); refresh();
  });
  $('clName').addEventListener('input', () => { curClass().name = $('clName').value; refresh(); });
  $('clDesc').addEventListener('input', () => { curClass().desc = $('clDesc').value; save(); });
  $('clIcon').addEventListener('change', () => { curClass().icon = $('clIcon').value; refresh(); });
  $('clColor').addEventListener('input', () => { curClass().color = $('clColor').value; refresh(); });
  $('clAdd').addEventListener('click', () => {
    const sid = $('clAddSel').value; if (!sid) return;
    curClass().spells.push({ sid, lvl: clampInt($('clAddLvl').value, 1, 200, 1) }); refresh();
  });
  $('clSpells').addEventListener('input', ev => {
    const sid = ev.target.dataset.cllvl; if (!sid) return;
    const x = curClass().spells.find(s => s.sid === sid); if (x) { x.lvl = clampInt(ev.target.value, 1, 200, x.lvl); save(); }
  });
  $('clSpells').addEventListener('change', () => refresh()); // re-trie après la saisie d'un niveau
  $('clSpells').addEventListener('click', ev => {
    const del = ev.target.closest('[data-cldel]');
    if (del) { curClass().spells = curClass().spells.filter(s => s.sid !== del.dataset.cldel); refresh(); return; }
    const ed = ev.target.closest('[data-cledit]');
    if (ed) { const i = S.spells.findIndex(s => s.id === ed.dataset.cledit); if (i >= 0) { S.tab = 'spell'; setView('spells'); selectSpell(i); } }
  });
  $('clTest').addEventListener('click', () => { S.active = null; setView('preview'); });

  // Icônes pixel art utilisées par des classes, sorts et entités donnés
  function usedIcons(classes, spellIds, sumIds) {
    const refs = new Set([
      ...classes.map(c => c.icon),
      ...S.spells.filter(s => spellIds.has(s.id)).flatMap(s => [s.icon, ...s.levels.flatMap(l => l.effects.map(e => e.gIcon))]),
      ...S.summons.filter(d => sumIds.has(d.id)).map(d => d.icon)
    ].filter(isPx).map(r => r.slice(3)));
    return S.pixelIcons.filter(p => refs.has(p.id));
  }
  // Export : les classes + tout ce dont elles dépendent (sorts, sorts des invocations, invocations, zones, icônes)
  function classBundle(list) {
    const spellIds = new Set(list.flatMap(c => c.spells.map(s => s.sid)));
    const sumIds = new Set();
    const collect = () => {
      for (const sp of S.spells) if (spellIds.has(sp.id))
        for (const l of sp.levels) for (const e of l.effects) if (e.type === 'summon' && e.sid) sumIds.add(e.sid);
      for (const d of S.summons) if (sumIds.has(d.id)) d.spells.forEach(id => spellIds.add(id));
    };
    collect(); collect();
    P().pattern = [...pattern];
    return {
      format: 'atelier-sorts-retro/classes', version: 1,
      classes: list, spells: S.spells.filter(s => spellIds.has(s.id)),
      summons: S.summons.filter(d => sumIds.has(d.id)), zones: S.zones,
      icons: usedIcons(list, spellIds, sumIds)
    };
  }
  $('clExport').addEventListener('click', () => downloadJSON(`classe-${fileName(curClass().name)}.json`, classBundle([curClass()])));
  $('clExportAll').addEventListener('click', () => downloadJSON('classes-retro.json', classBundle(S.classes)));
  $('clImport').addEventListener('click', () => $('clImportFile').click());
  $('clImportFile').addEventListener('change', async () => {
    const f = $('clImportFile').files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.classes)) throw new Error('ce fichier ne contient pas de classes');
      // dépendances : on n'ajoute que ce qui n'existe pas déjà (même identifiant)
      let nSp = 0, nInv = 0, nZ = 0;
      for (const z of data.zones || []) if (z && z.id && Array.isArray(z.cells) && !zoneById(z.id)) {
        S.zones.push({ id: String(z.id), name: String(z.name || 'Zone importée'), oriented: z.oriented !== false, cells: z.cells.map(String) }); nZ++;
      }
      for (const d of data.summons || []) if (d && d.id && !summonById(d.id)) { S.summons.push(newSummon(d)); nInv++; }
      const nIc = mergeIcons(data.icons);
      for (const s of data.spells || []) if (s && s.id && !spellById(s.id)) { S.spells.push(newSpell(s)); nSp++; }
      const added = data.classes.filter(c => c && typeof c === 'object').map(c => {
        const n = newClass(c);
        if (S.classes.some(x => x.id === n.id)) n.id = uid('cl');
        n.spells = n.spells.filter(x => spellById(x.sid));
        return n;
      });
      S.classes.push(...added);
      S.classCur = S.classes.length - added.length;
      refreshIconSelects(); renderSpellList(); renderEffects(); refresh();
      alert(`${added.length} classe(s) importée(s) · ${nSp} nouveau(x) sort(s) · ${nInv} invocation(s) · ${nZ} zone(s) · ${nIc} icône(s).`);
    } catch (e) { alert('Fichier invalide : ' + e.message); }
    $('clImportFile').value = '';
  });

  // ---------- Prévisualisation : classe testée ----------
  const learned = x => x.lvl <= S.charLvl;
  // Si le sort sélectionné n'appartient pas à la classe testée, on prend son premier sort appris
  function ensureClassSpell() {
    const c = curClass(); if (!c || !c.spells.length) return;
    if (c.spells.some(x => x.sid === Sp().id && learned(x))) return;
    const first = sortedClassSpells(c).find(learned);
    const i = first ? S.spells.findIndex(s => s.id === first.sid) : -1;
    if (i >= 0 && i !== S.cur) { P().pattern = [...pattern]; S.cur = i; pattern = new Set(P().pattern); renderSpellList(); renderEffects(); }
  }
  function renderPreviewAside() {
    $('pvClass').innerHTML = S.classes.map((c, i) => `<option value="${i}"${i === S.classCur ? ' selected' : ''}>${icT(c.icon)} ${esc(c.name)}</option>`).join('')
      || '<option>— aucune classe —</option>';
    const c = curClass();
    writeInput($('pvLvl'), S.charLvl);
    if (!c) {
      $('pvClassHead').innerHTML = '<span class="hint">Crée une classe dans l\'interface 🛡️ Classes.</span>';
      $('pvSpells').innerHTML = '';
    } else {
      const nLearn = c.spells.filter(learned).length;
      $('pvClassHead').innerHTML = `<div class="pv-head">${classBadge(c)}<div><b>${esc(c.name)}</b><div class="hint">${nLearn}/${c.spells.length} sort(s) appris au niveau ${S.charLvl}</div></div></div>` +
        (c.desc ? `<div class="hint" style="font-style:italic">${esc(c.desc)}</div>` : '');
      $('pvSpells').innerHTML = sortedClassSpells(c).map(x => {
        const sp = spellById(x.sid); if (!sp) return '';
        const ok = learned(x), cur = sp.id === Sp().id && S.active === null;
        // état du sort pour le lanceur ce tour-ci (PA, relance, lancers par tour)
        const why = ok ? castBlock(sp, sp.levels[sp.lvl], S.caster, null) : '';
        const c2 = (rtOf(S.caster) || { casts: {} }).casts[sp.id], lv = sp.levels[sp.lvl];
        const left = S.rules && lv.perTurn ? ` · ${Math.max(0, lv.perTurn - ((c2 && c2.n) || 0))}/${lv.perTurn}` : '';
        return `<button class="pv-sp${cur ? ' on' : ''}${ok ? '' : ' locked'}${why ? ' cant' : ''}" data-pvsp="${esc(sp.id)}"${ok ? '' : ' disabled'} title="${!ok ? 'Appris au niveau ' + x.lvl : why || 'Sélectionner ce sort'}">
          ${iconHTML(sp)}<span class="t"><span class="n">${esc(sp.name)}</span><span class="s">${!ok ? '🔒 niv. ' + x.lvl
            : why ? `<span class="why">⛔ ${why.startsWith('Relance') ? '⏳ ' + why.replace('Relance : encore ', '') : why.startsWith('Pas assez') ? 'PA' : why.startsWith('Déjà') ? 'max atteint' : 'K.O.'}</span>`
            : `niv. ${sp.lvl + 1}/6 · ${lv.pa} PA${left}`}</span></span></button>`;
      }).join('') || '<span class="hint">Cette classe n\'a aucun sort.</span>';
    }
    $('pvLvlSeg').innerHTML = Array.from({ length: NB_LEVELS }, (_, i) => `<button data-pvl="${i}" class="${i === Sp().lvl ? 'on' : ''}">${i + 1}</button>`).join('');
    $('pvCard').innerHTML = $('card').innerHTML;
  }
  $('pvClass').addEventListener('change', () => { S.classCur = +$('pvClass').value; S.active = null; ensureClassSpell(); refresh(); });
  $('pvLvl').addEventListener('input', () => { S.charLvl = clampInt($('pvLvl').value, 1, 200, S.charLvl); ensureClassSpell(); refresh(); });
  $('pvSpells').addEventListener('click', ev => {
    const b = ev.target.closest('[data-pvsp]'); if (!b) return;
    const i = S.spells.findIndex(s => s.id === b.dataset.pvsp);
    if (i >= 0) { S.active = null; selectSpell(i); renderCombat(); }
  });
  $('pvLvlSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-pvl]'); if (b) selectLevel(+b.dataset.pvl); });
  $('pvEdit').addEventListener('click', () => { S.tab = 'spell'; setView('spells'); });

