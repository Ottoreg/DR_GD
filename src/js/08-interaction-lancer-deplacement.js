  // ---------- Interaction carte ----------
  function pick(e) {
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * LW / r.width;
    const my = (e.clientY - r.top) * LH / r.height - OFFY;
    const X = mx / (W / 2), Y = my / (H / 2);
    return cellAt(Math.round((X + Y) / 2), Math.round((Y - X) / 2)) || null;
  }

  let dragging = false, paintAdd = true, activeTool = null;

  function symmetric(di, dj) {
    const s = new Set([di + ',' + dj]);
    if (S.sym) { s.add((-dj) + ',' + di); s.add((-di) + ',' + (-dj)); s.add(dj + ',' + (-di)); }
    return [...s];
  }

  function applyTool(c, first) {
    const t = activeTool;
    if (t === 'caster') {
      if (walkable(c.k) && !S.objs[c.k] && c.k !== S.caster) { moveRt(S.caster, c.k); S.caster = c.k; renderCombat(); }
    } else if (t === 'edit') {
      const caster = byKey.get(activeKey());
      const ks = symmetric(c.i - caster.i, c.j - caster.j);
      if (first) paintAdd = !pattern.has(ks[0]);
      ks.forEach(k => paintAdd ? pattern.add(k) : pattern.delete(k));
    } else if (t === 'erase') {
      if (S.objs[c.k]) { delete S.objs[c.k]; delete S.rt[c.k]; removeSummonAt(c.k); renderCombat(); }
      else if (S.traps.some(tr => tr.cells.includes(c.k))) {
        S.traps = S.traps.filter(tr => !tr.cells.includes(c.k));
        renderCombat();
      } else if (S.glyphs.some(g => g.cells.includes(c.k))) {
        S.glyphs = S.glyphs.filter(g => !g.cells.includes(c.k));
        renderCombat();
      }
    } else if (t === 'cast') {
      if (first) castSpell(c);
    } else if (t === 'move') {
      if (!first) return;
      if (occupied(c.k)) moveSel = moveSel === c.k ? null : c.k;      // (dé)sélection d'un personnage
      else if (moveSel) { moveSel = walkTo(moveSel, c.k); }         // marche jusqu'à la case
    } else {
      if (c.k === S.caster) return;
      if (first) paintAdd = S.objs[c.k] !== t || !!S.inv[c.k];
      if (paintAdd) { if (S.objs[c.k] !== t || S.inv[c.k]) delete S.rt[c.k]; removeSummonAt(c.k); S.objs[c.k] = t; }
      else if (S.objs[c.k] === t) delete S.objs[c.k];
    }
  }

  // Retire l'invocation d'une case (et rend la main au lanceur si c'était elle qui jouait)
  function removeSummonAt(k) {
    if (!S.inv[k]) return;
    delete S.inv[k];
    if (S.active === k) S.active = null;
    renderCombat();
  }
  // PM disponibles pour se déplacer : PM restants du lanceur / d'une invocation (règles de tour),
  // sinon illimité (alliés et ennemis posés à la main, ou règles désactivées)
  const moverPM = k => S.rules && hasBudget(k) ? rtOf(k).pm : Infinity;

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const c = pick(e); if (!c) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    dragging = true;
    activeTool = e.button === 2 ? 'erase' : S.tool;
    applyTool(c, true);
    hover = c; requestRender();
  });
  cv.addEventListener('pointermove', e => {
    const c = pick(e);
    if (c !== hover) { hover = c; if (dragging && c) applyTool(c, false); requestRender(); }
  });
  const stop = () => { if (dragging) { dragging = false; if (activeTool === 'edit') renderCard(); save(); requestRender(); } };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);
  cv.addEventListener('pointerleave', () => { if (!dragging) { hover = null; requestRender(); } });

  // ---------- Lancer & glyphes ----------
  let glyphSeq = S.glyphs.reduce((m, g) => Math.max(m, g.id || 0), 0);
  const logLine = html => { S.log.push(`<span class="t">T${S.turn}</span> ${html}`); if (S.log.length > 80) S.log.splice(0, S.log.length - 80); };
  const entColor = k => ({ caster: '#9a7400', ally: '#2553b8', enemy: '#a3291f' }[k]);

  // Personnages tombés à 0 PV : vaincus et retirés de la carte (le lanceur reste, K.O.)
  function resolveDeaths() {
    const ents = entities();
    for (const [k, r] of Object.entries(S.rt)) {
      if (!occupied(k)) { delete S.rt[k]; continue; }
      if (r.hp > 0) { r.ko = false; continue; }
      const ent = ents.find(e => e.c.k === k), name = ent ? `<b style="color:${entColor(ent.kind)}">${ent.label}</b>` : 'Un personnage';
      if (k === S.caster) { if (!r.ko) logLine(`💀 ${name} est K.O. !`); r.ko = true; continue; }
      logLine(`💀 ${name} est vaincu.`);
      delete S.objs[k]; delete S.inv[k]; delete S.rt[k];
      if (S.active === k) S.active = null;
      if (moveSel === k) moveSel = null;
    }
  }

  function castSpell(target) {
    const caster = byKey.get(activeKey());
    if (evaluate(target, caster) !== 'ok') { logLine(`<span class="ko">Cible invalide pour « ${esc(Sp().name)} ».</span>`); renderCombat(); return; }
    const why = castCheck(target);
    if (why) { logLine(`<span class="ko">« ${esc(Sp().name)} » impossible : ${why}.</span>`); renderCombat(); return; }
    const glyphFx = P().effects.filter(e => e.type === 'glyph');
    const chain = bounceChain(target, caster);
    const direct = computeImpact(target, caster).filter(r => r.lines.some(l => l.kind !== 'glyph'));
    const by = activeKey() !== S.caster ? ` par ${(entities().find(e => e.c.k === activeKey()) || {}).label}` : '';
    recordCast(Sp(), P(), activeKey(), target);
    logLine(`<b>${esc(Sp().name)}</b> (niv. ${Sp().lvl + 1}) lancé${by}${S.rules ? ` · −${P().pa} PA` : ''}.`);
    if (chain.length > 1) logLine(`&nbsp;&nbsp;↪ ${chain.slice(1).map(s => `${s.ent.label} (×${pct(s.mult)})`).join(' → ')}`);
    // effets appliqués pour de vrai : tirage entre min et max (résistances déjà comptées dans l'aperçu)
    let stolen = 0;
    for (const { ent, lines } of direct) {
      const parts = [];
      for (const l of lines) {
        if (l.kind === 'glyph' || (l.kind === 'heal' && l.steal)) continue; // glyphe : au tour suivant ; vol : calculé ci-dessous
        const tag = l.b ? `<small>↪${l.b}</small>` : '';
        if (l.kind === 'dmg') { const v = hurt(ent.c.k, roll(l.lo, l.hi)); if (l.steal) stolen += v; parts.push(`${tag}<span class="v-dmg">-${v}</span>`); }
        else if (l.kind === 'heal') parts.push(`${tag}<span class="v-heal">+${healK(ent.c.k, roll(l.lo, l.hi))}</span>`);
        else if (l.kind === 'poison') {
          rtOf(ent.c.k).poisons.push({ name: Sp().name, el: l.el, lo: l.lo, hi: l.hi, turns: l.dur });
          parts.push(`${tag}<span class="v-poison">☠ ${fmt(l.lo, l.hi)}×${l.dur}</span>`);
        }
      }
      if (parts.length) logLine(`&nbsp;&nbsp;<b style="color:${entColor(ent.kind)}">${ent.label}</b> ${parts.join(' ')}${hpTxt(ent.c.k)}`);
    }
    if (stolen) logLine(`&nbsp;&nbsp;🩸 Vol de vie : <span class="v-heal">+${healK(activeKey(), Math.floor(stolen / 2))}</span>${hpTxt(activeKey())}`);
    // chaque étape de la chaîne pose ses propres glyphes
    for (const step of chain) for (const e of glyphFx) {
      const zone = aoeCells(step.cell, step.from).filter(c => walkable(c.k)).map(c => c.k);
      const [lo0, hi0] = range(e);
      S.glyphs.push({
        id: ++glyphSeq, name: Sp().name + (step.n ? ` ↪${step.n}` : ''), el: e.el, heal: e.gType === 'heal', icon: e.gIcon || '',
        color: e.gColorMode === 'custom' && e.gColor ? e.gColor : null,
        lo: Math.floor(lo0 * step.mult), hi: Math.floor(hi0 * step.mult),
        turns: Math.max(1, e.dur), target: e.target, cells: zone, center: step.cell.k
      });
      logLine(`&nbsp;&nbsp;◈ Glyphe ${e.gType === 'heal' ? 'de soin' : ELEMENTS[e.el].n}${step.n ? ` (rebond ${step.n})` : ''} posé sur ${zone.length} case(s) pour ${e.dur} tour(s).`);
    }
    // pièges : posés sur la case ciblée (centre), avec leur propre zone
    for (const e of P().effects.filter(x => x.type === 'trap')) {
      const zone = trapZone(target, caster, e).filter(c => walkable(c.k)).map(c => c.k);
      const [lo, hi] = range(e);
      S.traps.push({
        id: ++glyphSeq, name: Sp().name, el: e.el, heal: e.gType === 'heal', icon: e.gIcon || '',
        color: e.gColorMode === 'custom' && e.gColor ? e.gColor : null,
        lo, hi, target: e.target, center: target.k, cells: zone
      });
      logLine(`&nbsp;&nbsp;🪤 Piège ${e.gType === 'heal' ? 'de soin' : ELEMENTS[e.el].n} posé (${trapZoneLabel(e)}, ${zone.length} case(s)).`);
    }
    // invocations : l'entité apparaît sur la case ciblée
    for (const e of P().effects.filter(x => x.type === 'summon')) {
      const d = summonById(e.sid);
      if (!d) { logLine('&nbsp;&nbsp;<span class="ko">🐾 Aucune entité choisie pour cette invocation.</span>'); continue; }
      if (Object.keys(S.inv).length >= S.stats.invoc) { logLine(`&nbsp;&nbsp;<span class="ko">🐾 Limite d'invocations atteinte (${S.stats.invoc}).</span>`); continue; }
      if (occupied(target.k) || !walkable(target.k)) { logLine('&nbsp;&nbsp;<span class="ko">🐾 La case n\'est plus libre.</span>'); continue; }
      const lvl = summonLevel(e), st = d.levels[lvl - 1];
      delete S.rt[target.k];
      S.objs[target.k] = d.kind === 'obstacle' ? 'sobst' : 'ally';
      S.inv[target.k] = { sid: d.id, lvl };
      logLine(`&nbsp;&nbsp;🐾 ${ic(d.icon)} <b>${esc(d.name)}</b> invoqué (niv ${lvl} · ${st.pa} PA · ${st.pm} PM · ${st.pv} PV).`);
    }
    resolveDeaths();
    renderCombat(); refresh();
  }

  // ---------- Déplacement & pièges ----------
  let moveSel = null; // case du personnage sélectionné avec l'outil Déplacer
  const NEIGH = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // Plus court chemin (4 directions) sur les cases praticables et libres ; renvoie les cases après le départ
  function findPath(fromK, toK) {
    if (fromK === toK || !byKey.has(toK) || !walkable(toK) || occupied(toK)) return null;
    const prev = new Map([[fromK, null]]), queue = [fromK];
    while (queue.length) {
      const k = queue.shift();
      if (k === toK) break;
      const c = byKey.get(k);
      for (const [a, b] of NEIGH) {
        const nk = key(c.i + a, c.j + b);
        if (prev.has(nk) || !byKey.has(nk) || !walkable(nk) || occupied(nk)) continue;
        prev.set(nk, k); queue.push(nk);
      }
    }
    if (!prev.has(toK)) return null;
    const path = [];
    for (let k = toK; k !== fromK; k = prev.get(k)) path.unshift(k);
    return path;
  }
  // Fait marcher le personnage case par case ; s'arrête sur le premier piège déclenché. Renvoie sa nouvelle case.
  function walkTo(fromK, toK) {
    const path = findPath(fromK, toK);
    const who = entities().find(e => e.c.k === fromK);
    if (!path) { logLine(`<span class="ko">🚶 Aucun chemin libre pour ${who ? who.label : 'ce personnage'}.</span>`); renderCombat(); return fromK; }
    const pm = moverPM(fromK);
    if (S.rules && hasBudget(fromK) && rtOf(fromK).hp <= 0) { logLine(`<span class="ko">🚶 ${who.label} est K.O. et ne peut pas bouger.</span>`); renderCombat(); return fromK; }
    if (path.length > pm) { logLine(`<span class="ko">🚶 ${who.label} n'a que ${pm} PM (il en faut ${path.length}).</span>`); renderCombat(); return fromK; }
    const kind = fromK === S.caster ? 'caster' : S.objs[fromK];
    const spend = S.rules && hasBudget(fromK);
    let cur = fromK, steps = 0;
    const done = msg => {
      if (spend && S.rt[cur]) S.rt[cur].pm = Math.max(0, S.rt[cur].pm - steps);
      const me = entities().find(e => e.c.k === cur); // nom à jour (la numérotation suit la position)
      logLine(`🚶 <b style="color:${entColor(me.kind)}">${me.label}</b> ${msg}${spend ? ` · −${steps} PM` : ''}`);
    };
    for (const k of path) {
      if (kind === 'caster') S.caster = k;
      else {
        delete S.objs[cur]; S.objs[k] = kind;
        if (S.inv[cur]) { S.inv[k] = S.inv[cur]; delete S.inv[cur]; if (S.active === cur) S.active = k; }
      }
      moveRt(cur, k);
      cur = k; steps++;
      const hit = S.traps.filter(t => t.cells.includes(k));
      if (hit.length) {
        done(`avance de ${steps} case(s) et marche sur ${hit.length > 1 ? hit.length + ' pièges' : 'un piège'} !`);
        hit.forEach(triggerTrap);
        resolveDeaths();
        renderCombat(); refresh();
        return occupied(cur) ? cur : null;
      }
    }
    done(`se déplace de ${steps} case(s).`);
    renderCombat(); refresh();
    return cur;
  }
  function triggerTrap(t) {
    logLine(`💥 Le piège « ${esc(t.name)} » se déclenche.`);
    let any = false;
    for (const ent of entities()) {
      if (!t.cells.includes(ent.c.k)) continue;
      const friendly = ent.kind !== 'enemy';
      if ((t.target === 'enemies' && friendly) || (t.target === 'allies' && !friendly)) continue;
      const k = ent.c.k, v = roll(t.lo, t.hi);
      logLine(`&nbsp;&nbsp;<b style="color:${entColor(ent.kind)}">${ent.label}</b> ` +
        (t.heal ? `<span class="v-heal">+${healK(k, v)} PV</span>` : `<span class="v-dmg">-${hurt(k, applyRes(k, t.el, v))}</span> ${ELEMENTS[t.el].n}`) + hpTxt(k));
      any = true;
    }
    if (!any) logLine('&nbsp;&nbsp;Personne n\'est touché.');
    S.traps = S.traps.filter(x => x !== t);
  }

  function nextTurn() {
    S.turn++;
    logLine(`<b>— Tour ${S.turn} —</b>`);
    const ents = entities();
    // glyphes : effet sur les personnages qui s'y trouvent
    for (const g of S.glyphs) {
      for (const ent of ents) {
        if (!g.cells.includes(ent.c.k)) continue;
        const friendly = ent.kind !== 'enemy';
        if ((g.target === 'enemies' && friendly) || (g.target === 'allies' && !friendly)) continue;
        const k = ent.c.k, v = roll(g.lo, g.hi);
        logLine(`◈ <b style="color:${entColor(ent.kind)}">${ent.label}</b> sur le glyphe « ${esc(g.name)} » : ` +
          (g.heal ? `<span class="v-heal">+${healK(k, v)} PV</span>` : `<span class="v-dmg">-${hurt(k, applyRes(k, g.el, v))}</span> ${ELEMENTS[g.el].n}`) + hpTxt(k));
      }
      g.turns--;
      if (g.turns <= 0) logLine(`◈ Le glyphe « ${esc(g.name)} » disparaît.`);
    }
    S.glyphs = S.glyphs.filter(g => g.turns > 0);
    // poisons (valeurs déjà réduites par les résistances au moment du lancer)
    for (const ent of ents) {
      const r = S.rt[ent.c.k]; if (!r || !r.poisons.length) continue;
      for (const p of r.poisons) {
        logLine(`☠ <b style="color:${entColor(ent.kind)}">${ent.label}</b> subit le poison « ${esc(p.name)} » : <span class="v-poison">-${hurt(ent.c.k, roll(p.lo, p.hi))}</span>${hpTxt(ent.c.k)}`);
        p.turns--;
      }
      r.poisons = r.poisons.filter(p => p.turns > 0);
    }
    resolveDeaths();
    newTurnReset();
    renderCombat(); refresh();
  }

  const hpColor = f => f > .5 ? '#4fbf3a' : f > .25 ? '#e0b02a' : '#d8392a';
  const hpBarHTML = r => `<span class="hpbar"><i style="width:${Math.round(100 * r.hp / r.hpMax)}%;background:${hpColor(r.hp / r.hpMax)}"></i></span>`;
  function renderHud() {
    const k = activeKey(), r = rtOf(k), ent = entities().find(e => e.c.k === k), m = rtMax(k);
    if (!r || !ent) { $('hud').innerHTML = ''; return; }
    $('hud').innerHTML = `🎮 <b style="color:${entColor(ent.kind)}">${ent.label}</b>
      <span class="hpv">❤ <b>${r.hp}</b>/${r.hpMax}</span> ${hpBarHTML(r)}
      ${S.rules ? `<span class="pa">⭐ <b>${r.pa}</b>/${m.pa} PA</span><span class="pm">👟 <b>${r.pm}</b>/${m.pm} PM</span>`
        : '<span class="hint">PA / PM illimités (règles désactivées)</span>'}
      ${r.poisons.length ? `<span class="v-poison">☠ ${r.poisons.length} poison(s)</span>` : ''}`;
  }
  // Tableau des personnages : PV, PV max et résistances éditables
  function renderRtTable() {
    const wrap = $('rtTable');
    if (wrap.contains(document.activeElement)) return; // pas de reconstruction pendant la saisie
    const ents = entities();
    if (!ents.length) { wrap.innerHTML = '<span class="hint">Aucun personnage sur la carte.</span>'; return; }
    const act = activeKey();
    wrap.innerHTML = `<table class="rt"><thead><tr><th>Personnage</th><th>PV</th><th>max</th>${RES_ELS.map(el =>
      `<th title="Résistance ${ELEMENTS[el].n} (%)"><span class="el" style="background:${ELEMENTS[el].c}"></span>%</th>`).join('')}<th>PA / PM</th></tr></thead><tbody>${
      ents.map(ent => {
        const k = ent.c.k, r = rtOf(k), fixed = hasBudget(k), m = rtMax(k);
        return `<tr data-rtk="${k}">
          <td class="who" style="color:${entColor(ent.kind)}">${k === act ? '🎮 ' : ''}${ent.label}${r.hp <= 0 ? ' <span class="ko">K.O.</span>' : ''}${r.poisons.length ? ' <span class="v-poison" title="Poisons actifs">☠</span>' : ''}</td>
          <td>${hpBarHTML(r)} <input type="number" data-rf="hp" min="0" max="${r.hpMax}" value="${r.hp}"></td>
          <td>${fixed ? `<span title="${k === S.caster ? 'Réglé dans les caractéristiques du lanceur' : 'Défini par le niveau de l\'invocation'}">${r.hpMax}</span>` : `<input type="number" data-rf="hpMax" min="1" max="99999" value="${r.hpMax}">`}</td>
          ${RES_ELS.map(el => `<td><input class="res" type="number" data-rf="res" data-el="${el}" min="-100" max="100" value="${r.res[el]}"></td>`).join('')}
          <td>${fixed ? `${r.pa}/${m.pa} · ${r.pm}/${m.pm}` : '—'}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
  document.getElementById('rtTable').addEventListener('input', ev => {
    const el = ev.target, tr = el.closest('[data-rtk]'); if (!tr || !el.dataset.rf) return;
    const r = rtOf(tr.dataset.rtk); if (!r) return;
    const v = parseInt(el.value, 10); if (Number.isNaN(v)) return;
    if (el.dataset.rf === 'hp') r.hp = Math.max(0, Math.min(r.hpMax, v));
    else if (el.dataset.rf === 'hpMax') { r.hpMax = Math.max(1, v); r.hp = Math.min(r.hp, r.hpMax); }
    else r.res[el.dataset.el] = Math.max(-100, Math.min(100, v));
    renderHud(); save(); requestRender();
  });
  document.getElementById('rtTable').addEventListener('change', () => { resolveDeaths(); renderCombat(); refresh(); });

  function renderCombat() {
    $('turnNo').textContent = S.turn;
    renderHud();
    renderRtTable();
    const chips = S.glyphs.map(g => `<span class="glyph-chip" style="border-color:${glyphColor(g)}">${g.icon ? ic(g.icon) : `<i style="background:${glyphColor(g)}"></i>`}${esc(g.name)} · ${g.heal ? '+' : '-'}${fmt(g.lo, g.hi)} · ${g.turns} tour${g.turns > 1 ? 's' : ''}</span>`)
      .concat(S.traps.map(t => `<span class="glyph-chip" style="border-color:${trapColor(t)}">${t.icon ? ic(t.icon) : "🪤"} ${esc(t.name)} · ${t.heal ? '+' : '-'}${fmt(t.lo, t.hi)} · ${t.cells.length} case${t.cells.length > 1 ? 's' : ''}</span>`));
    $('glyphList').innerHTML = chips.join('') || '<span class="hint">Aucun glyphe ni piège au sol.</span>';
    renderInvOnMap();
    $('combatLog').innerHTML = S.log.map(l => `<div>${l}</div>`).join('') || '<span class="hint">Journal vide.</span>';
    $('combatLog').scrollTop = $('combatLog').scrollHeight;
    requestRender();
  }

  // Invocations en jeu : prise de contrôle et accès à leurs sorts
  function renderInvOnMap() {
    const ents = entities(), act = activeKey();
    const rows = Object.entries(S.inv).map(([k, iv]) => {
      const d = summonById(iv.sid), st = summonStats(iv);
      const label = d && d.kind === 'obstacle' ? `${ic(d.icon)} ${esc(d.name)}` : (ents.find(e => e.c.k === k) || {}).label || 'Invocation';
      const kind = d ? INV_KINDS[d.kind].n : '?';
      const isActive = act === k;
      const spells = d && d.kind !== 'obstacle' ? d.spells.map(id => S.spells.findIndex(s => s.id === id)).filter(i => i >= 0) : [];
      return `<div class="inv-row${isActive ? ' active' : ''}">
        <span class="nm">${label}</span>
        <span class="pa-pm">${kind} · niv ${iv.lvl}${(() => { const r = d && d.kind !== "obstacle" ? rtOf(k) : null; return r ? ` · ❤ ${r.hp}/${r.hpMax} · ⭐ ${S.rules ? r.pa + "/" : ""}${st.pa} PA · 👟 ${S.rules ? r.pm + "/" : ""}${st.pm} PM` : ` · ${st.pv} PV`; })()}</span>
        ${d && d.kind !== 'obstacle' ? `<button data-play="${k}" class="${isActive ? 'on' : ''}">${isActive ? '🎮 Contrôlée' : '🎮 Jouer'}</button>` : ''}
        ${spells.length ? `<div class="sp">${spells.map(i => { const sp = S.spells[i], why = castBlock(sp, sp.levels[sp.lvl], k, null);
          return `<button data-invspell="${i}" data-invk="${k}" class="${isActive && S.cur === i ? 'on' : ''}" title="${why || sp.levels[sp.lvl].pa + ' PA'}"${why ? ' style="opacity:.6"' : ''}>${ic(sp.icon)} ${esc(sp.name)}${why ? ' ⛔' : ''}</button>`; }).join('')}</div>`
          : d && d.kind !== 'obstacle' ? '<div class="sp hint">Aucun sort lié (onglet 🐾 Invocations).</div>' : ''}
      </div>`;
    });
    $('invOnMap').innerHTML = rows.length
      ? `<div class="row"><b style="margin-right:auto">🐾 Invocations en jeu : ${rows.length}/${S.stats.invoc}</b>${act !== S.caster ? '<button data-play="">↩ Rendre la main au lanceur</button>' : ''}</div>` + rows.join('')
      : '';
  }
  document.getElementById('invOnMap').addEventListener('click', ev => {
    const p = ev.target.closest('[data-play]');
    if (p) { S.active = p.dataset.play || null; refresh(); renderCombat(); return; }
    const b = ev.target.closest('[data-invspell]');
    if (b) { S.active = b.dataset.invk; selectSpell(+b.dataset.invspell); renderCombat(); }
  });

