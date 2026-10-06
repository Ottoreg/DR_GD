  // ---------- Combat : fiche de chaque personnage ----------
  // S.rt[case] = { id, hp, hpMax, res{élément: %}, pa, pm, casts{sortId: {n, last, targets{id: n}}}, poisons[] }
  // La fiche suit le personnage quand il se déplace (moveRt).
  const RES_ELS = ['neutre', 'terre', 'feu', 'eau', 'air'];
  const DUMMY = { pv: 100, pa: 6, pm: 3 }; // alliés / ennemis posés à la main
  if (!S.rt || typeof S.rt !== 'object') S.rt = {};
  // PV / PA / PM max : ceux du lanceur (caractéristiques), d'une invocation (son niveau) ou par défaut
  function rtMax(k) {
    if (k === S.caster) return { hp: Math.max(1, S.stats.pv || 1), pa: S.stats.pa || 0, pm: S.stats.pm || 0 };
    if (S.inv[k]) { const st = summonStats(S.inv[k]); return { hp: Math.max(1, st.pv || 1), pa: st.pa, pm: st.pm }; }
    return { hp: DUMMY.pv, pa: DUMMY.pa, pm: DUMMY.pm };
  }
  const hasBudget = k => k === S.caster || !!S.inv[k]; // lanceur et invocations comptent leurs PA / PM
  function rtOf(k) {
    if (!occupied(k)) return null;
    const m = rtMax(k);
    let r = S.rt[k];
    if (!r) r = S.rt[k] = { id: uid('rt'), hp: m.hp, hpMax: m.hp, res: Object.fromEntries(RES_ELS.map(e => [e, 0])), pa: m.pa, pm: m.pm, casts: {}, poisons: [] };
    if (hasBudget(k)) {
      // le maximum suit la source (caractéristiques / niveau d'invocation)
      if (r.hpMax !== m.hp) { r.hp = Math.max(0, Math.min(m.hp, r.hp + (m.hp - r.hpMax))); r.hpMax = m.hp; }
      r.pa = Math.min(r.pa, m.pa); r.pm = Math.min(r.pm, m.pm);
    }
    return r;
  }
  const moveRt = (from, to) => { if (from !== to && S.rt[from]) { S.rt[to] = S.rt[from]; delete S.rt[from]; } };
  const resOf = (k, el) => Math.max(-100, Math.min(100, ((S.rt[k] || {}).res || {})[el] || 0));
  const applyRes = (k, el, v) => Math.max(0, Math.floor(v * (100 - resOf(k, el)) / 100));
  const roll = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  function hurt(k, v) { const r = rtOf(k); if (r) r.hp = Math.max(0, r.hp - v); return v; }
  function healK(k, v) { const r = rtOf(k); if (!r) return 0; const h = Math.min(v, r.hpMax - r.hp); r.hp += h; return h; }
  const hpTxt = k => { const r = rtOf(k); return r ? ` <small>(❤ ${r.hp}/${r.hpMax})</small>` : ''; };

  // Règles de lancer pour un sort (niveau lvl) lancé par le personnage en case k sur `target` (facultatif).
  // Renvoie '' si c'est permis, sinon la raison.
  function castBlock(sp, lvl, k, target) {
    if (!S.rules) return '';
    const r = rtOf(k); if (!r) return '';
    if (r.hp <= 0) return 'Le lanceur est K.O.';
    if (r.pa < lvl.pa) return `Pas assez de PA (${r.pa}/${lvl.pa})`;
    const c = r.casts[sp.id];
    if (c) {
      if (lvl.cooldown && c.last != null && S.turn - c.last < lvl.cooldown) return `Relance : encore ${lvl.cooldown - (S.turn - c.last)} tour(s)`;
      if (lvl.perTurn && c.n >= lvl.perTurn) return `Déjà lancé ${c.n} fois ce tour (max ${lvl.perTurn})`;
      if (lvl.perTarget && target && S.rt[target.k] && (c.targets[S.rt[target.k].id] || 0) >= lvl.perTarget) return `Déjà lancé ${lvl.perTarget} fois sur cette cible ce tour`;
    }
    return '';
  }
  const castCheck = target => castBlock(Sp(), P(), activeKey(), target);
  // Enregistre un lancer réussi : PA dépensés, compteurs par tour / par cible, tour du dernier lancer
  function recordCast(sp, lvl, k, target) {
    const r = rtOf(k); if (!r) return;
    if (S.rules) r.pa = Math.max(0, r.pa - lvl.pa);
    const c = r.casts[sp.id] || (r.casts[sp.id] = { n: 0, last: null, targets: {} });
    c.n++; c.last = S.turn;
    const t = target && occupied(target.k) ? rtOf(target.k) : null;
    if (t) c.targets[t.id] = (c.targets[t.id] || 0) + 1;
  }
  // Début d'un nouveau tour : PA / PM rendus, compteurs par tour remis à zéro
  function newTurnReset() {
    for (const [k, r] of Object.entries(S.rt)) {
      if (!occupied(k)) { delete S.rt[k]; continue; }
      const m = rtMax(k); r.pa = m.pa; r.pm = m.pm;
      for (const c of Object.values(r.casts)) { c.n = 0; c.targets = {}; }
    }
  }

  // Parcours de grille (supercover) entre les centres, en coordonnées (i,j).
  // Un passage exact par un coin ne teste pas les deux cases adjacentes (comme les diagonales en jeu).
  function lineOfSight(a, b) {
    const dx = b.i - a.i, dy = b.j - a.j, nx = Math.abs(dx), ny = Math.abs(dy);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let x = a.i, y = a.j, ix = 0, iy = 0;
    while (ix < nx || iy < ny) {
      const cmp = (1 + 2*ix) * ny - (1 + 2*iy) * nx;
      if (cmp === 0) { x += sx; y += sy; ix++; iy++; }
      else if (cmp < 0) { x += sx; ix++; }
      else { y += sy; iy++; }
      if (x === b.i && y === b.j) break;
      const k = key(x, y);
      if (byKey.has(k) && blocksLos(k)) return { ok: false, block: k };
    }
    return { ok: true, block: null };
  }

  const maxPO = (p = P()) => Math.max(p.min, p.max + (p.mod ? p.bonus : 0));

  function inStandardShape(di, dj, p = P()) {
    const d = Math.abs(di) + Math.abs(dj);
    if (d < p.min || d > maxPO(p)) return false;
    if (p.line || p.diag) {
      const okLine = p.line && (di === 0 || dj === 0);
      const okDiag = p.diag && Math.abs(di) === Math.abs(dj);
      if (!okLine && !okDiag) return false;
    }
    return true;
  }
  const inShape = (di, dj) => P().mode === 'custom' ? pattern.has(di + ',' + dj) : inStandardShape(di, dj);

  // Statut d'une case : 'ok' | 'nolos' | 'blocked' | 'busy' | 'out' | 'empty' | 'trapped'
  function evaluate(cell, caster) {
    const p = P(), di = cell.i - caster.i, dj = cell.j - caster.j;
    if (!inShape(di, dj)) return 'out';
    if (!walkable(cell.k)) return 'blocked';
    if (p.free && occupied(cell.k)) return 'busy';
    if (p.los && !lineOfSight(caster, cell).ok) return 'nolos';
    // sort à rebond : la première cible doit être un personnage, sauf option contraire
    if (p.bounce && !p.bounceFromEmpty && !occupied(cell.k)) return 'empty';
    // sort qui pose un piège : la case centrale doit être libre (personnage, autre piège)
    if (p.effects.some(e => e.type === 'trap')) {
      if (occupied(cell.k)) return 'busy';
      if (S.traps.some(t => t.center === cell.k)) return 'trapped';
    }
    // sort d'invocation : la case doit être libre de tout personnage
    if (p.effects.some(e => e.type === 'summon') && occupied(cell.k)) return 'busy';
    return 'ok';
  }

  // Zone d'effet du sort (réglages du niveau courant)
  const aoeCells = (target, caster) => zoneCells(target, caster, P().aoe, P().aoeSize);

  // Cases d'une zone de forme `aoe` et de taille `n` centrée sur `target`, orientée depuis `caster`
  function zoneCells(target, caster, aoe, n) {
    const out = [];
    const push = (i, j) => { const c = cellAt(i, j); if (c) out.push(c); };
    if (aoe === 'none') push(target.i, target.j);
    else if (aoe === 'circle') {
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++)
        if (Math.abs(a) + Math.abs(b) <= n) push(target.i + a, target.j + b);
    } else if (aoe === 'cross') {
      push(target.i, target.j);
      for (let s = 1; s <= n; s++) { push(target.i+s, target.j); push(target.i-s, target.j); push(target.i, target.j+s); push(target.i, target.j-s); }
    } else if (aoe === 'line') {
      const [u, v] = castDir(target, caster);
      for (let s = 0; s <= n; s++) push(target.i + u*s, target.j + v*s);
    } else if (aoe.startsWith('z:')) {
      const z = zoneById(aoe.slice(2));
      if (!z) { push(target.i, target.j); return out; }
      // (u,v) = axe « vers l'avant », (-v,u) = axe « sur le côté »
      const [u, v] = z.oriented ? castDir(target, caster) : EDITOR_DIR;
      for (const k of z.cells) {
        const [f, s] = k.split(',').map(Number);
        push(target.i + f*u - s*v, target.j + f*v + s*u);
      }
    }
    return out;
  }

  // Direction du lancer : l'axe dominant entre le lanceur et la cible (4 directions possibles)
  const EDITOR_DIR = [0, -1]; // sens affiché dans l'éditeur de zones (vers le haut-droite)
  function castDir(target, caster) {
    const di = target.i - caster.i, dj = target.j - caster.j;
    if (!di && !dj) return EDITOR_DIR;
    return Math.abs(di) >= Math.abs(dj) ? [Math.sign(di), 0] : [0, Math.sign(dj)];
  }

  // ---------- Calcul des effets ----------
  function scaled(e, v) {
    const st = S.stats;
    if (isHealFx(e)) return Math.max(0, Math.floor(v * (100 + st.intel) / 100) + st.soins);
    const carac = st[ELEMENTS[e.el].stat];
    if (e.type === 'poison') return Math.max(0, Math.floor(v * (100 + carac) / 100));
    return Math.max(0, Math.floor(v * (100 + carac + st.pctDmg) / 100) + st.dmg);
  }
  const range = e => {
    const a = Math.min(e.min, e.max), b = Math.max(e.min, e.max);
    return [scaled(e, a), scaled(e, b)];
  };
  const fmt = (lo, hi) => lo === hi ? String(lo) : `${lo} à ${hi}`;

  // Personnages sur la carte. Les invocations (créatures, objets) sont des alliés portant leur nom.
  function entities() {
    const list = []; let nE = 0, nA = 0;
    const perSummon = {}, totalSummon = {};
    for (const iv of Object.values(S.inv)) totalSummon[iv.sid] = (totalSummon[iv.sid] || 0) + 1;
    for (const c of cells) {
      if (c.k === S.caster) list.push({ c, kind: 'caster', label: 'Lanceur' });
      else if (S.objs[c.k] === 'enemy') list.push({ c, kind: 'enemy', label: 'Ennemi ' + (++nE) });
      else if (S.objs[c.k] === 'ally') {
        const iv = S.inv[c.k];
        if (iv) {
          const d = summonById(iv.sid), n = perSummon[iv.sid] = (perSummon[iv.sid] || 0) + 1;
          list.push({ c, kind: 'ally', summon: iv, label: `${d ? ic(d.icon) + ' ' + esc(d.name) : 'Invocation'}${totalSummon[iv.sid] > 1 ? ' ' + n : ''}` });
        } else list.push({ c, kind: 'ally', label: 'Allié ' + (++nA) });
      }
    }
    return list;
  }

  // ---------- Rebond ----------
  // Angle « horaire » vu à l'écran, en partant de haut-droite (0°) : bas-droite 90°, bas-gauche 180°, haut-gauche 270°.
  // Sur la grille : haut-droite = j-1, bas-droite = i+1, bas-gauche = j+1, haut-gauche = i-1.
  function clockAngle(from, to) {
    const u = -(to.j - from.j), v = to.i - from.i;
    const a = Math.atan2(v, u) * 180 / Math.PI;
    return (a + 360) % 360;
  }
  // Chaîne de lancers : la case ciblée, puis chaque rebond { cell, from, mult, n, ent }
  function bounceChain(target, caster) {
    const p = P(), chain = [{ cell: target, from: caster, mult: 1, n: 0 }];
    if (!p.bounce) return chain;
    // le lanceur compte comme un allié : il peut recevoir un rebond si le sort vise les alliés (ou tous)
    const wanted = e => p.bounceTarget === 'all' || (p.bounceTarget === 'enemies') === (e.kind === 'enemy');
    const pool = entities().filter(wanted);
    const used = new Set([target.k]);
    let cur = target;
    for (let n = 1; n <= p.bounces; n++) {
      let best = null, bd = Infinity, ba = Infinity;
      for (const e of pool) {
        if (used.has(e.c.k)) continue;
        const d = Math.abs(e.c.i - cur.i) + Math.abs(e.c.j - cur.j);
        if (d > p.bounceRange) continue;
        if (p.bounceLos && !lineOfSight(cur, e.c).ok) continue;
        const a = clockAngle(cur, e.c);
        if (d < bd || (d === bd && a < ba)) { best = e; bd = d; ba = a; }
      }
      if (!best) break;
      used.add(best.c.k);
      chain.push({ cell: best.c, from: cur, mult: Math.pow(1 - p.bounceDecay / 100, n), n, ent: best });
      cur = best.c;
    }
    return chain;
  }

  // Pour une case ciblée : liste des personnages touchés (rebonds compris) et de ce qu'ils subissent.
  function computeImpact(target, caster) {
    const ents = entities(), res = new Map();
    const get = ent => { if (!res.has(ent.c.k)) res.set(ent.c.k, { ent, lines: [] }); return res.get(ent.c.k); };
    let stLo = 0, stHi = 0;
    for (const step of bounceChain(target, caster)) {
      const zone = new Set(aoeCells(step.cell, step.from).map(c => c.k));
      const b = step.n;
      for (const e of P().effects) {
        if (e.type === 'trap' || e.type === 'summon') continue; // piège : au déclenchement ; invocation : pas de valeur
        const [lo0, hi0] = range(e), lo = Math.floor(lo0 * step.mult), hi = Math.floor(hi0 * step.mult);
        for (const ent of ents) {
          if (!zone.has(ent.c.k)) continue;
          const friendly = ent.kind !== 'enemy';
          if (e.target === 'enemies' && friendly) continue;
          if (e.target === 'allies' && !friendly) continue;
          const r = get(ent);
          // valeurs après résistances de la cible (les soins n'en tiennent pas compte)
          const k = ent.c.k, rl = applyRes(k, e.el, lo), rh = applyRes(k, e.el, hi);
          if (e.type === 'dmg') r.lines.push({ kind: 'dmg', lo: rl, hi: rh, el: e.el, b });
          else if (e.type === 'poison') r.lines.push({ kind: 'poison', lo: rl, hi: rh, el: e.el, dur: e.dur, b });
          else if (e.type === 'heal') r.lines.push({ kind: 'heal', lo, hi, b });
          else if (e.type === 'glyph') r.lines.push(e.gType === 'heal'
            ? { kind: 'glyph', lo, hi, el: e.el, dur: e.dur, heal: true, b }
            : { kind: 'glyph', lo: rl, hi: rh, el: e.el, dur: e.dur, heal: false, b });
          else { r.lines.push({ kind: 'dmg', lo: rl, hi: rh, el: e.el, steal: true, b }); stLo += Math.floor(rl / 2); stHi += Math.floor(rh / 2); }
        }
      }
    }
    if (stHi > 0) {
      const me = ents.find(e => e.c.k === activeKey());
      get(me).lines.push({ kind: 'heal', lo: stLo, hi: stHi, steal: true });
    }
    return [...res.values()].filter(r => r.lines.length);
  }

