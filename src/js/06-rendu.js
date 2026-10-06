  // ---------- Rendu ----------
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  function diamond(c, x, y, w = W, h = H) {
    c.beginPath();
    c.moveTo(x, y - h/2); c.lineTo(x + w/2, y); c.lineTo(x, y + h/2); c.lineTo(x - w/2, y);
    c.closePath();
  }
  function poly(pts) { ctx.beginPath(); ctx.moveTo(...pts[0]); for (let p = 1; p < pts.length; p++) ctx.lineTo(...pts[p]); ctx.closePath(); }

  // Sol pré-rendu : herbe texturée façon cartes Retro
  const ground = document.createElement('canvas');
  // (Re)construit la grille, redimensionne les canvas et repeint le sol pour une taille de carte
  function setMapSize(mw, mh) {
    buildCells(mw, mh);
    cv.width = LW * dpr; cv.height = LH * dpr;
    ground.width = LW * dpr; ground.height = LH * dpr;
    paintGround();
  }
  function paintGround() {
    const g = ground.getContext('2d'), r2 = mulberry32(7);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, LH);
    bg.addColorStop(0, '#2d3a18'); bg.addColorStop(1, '#1d2610');
    g.fillStyle = bg; g.fillRect(0, 0, LW, LH);
    for (const c of cells) {
      const l = 34 + c.shade * 7 + ((c.i + c.j) % 2 ? 1.5 : 0);
      const h = 80 + (c.shade - .5) * 10;
      diamond(g, c.x, c.y, W + 1, H + 1);
      g.fillStyle = `hsl(${h},34%,${l}%)`; g.fill();
      g.save(); diamond(g, c.x, c.y, W, H); g.clip();
      for (let t = 0; t < 14; t++) {
        const px = c.x + (r2() - .5) * W, py = c.y + (r2() - .5) * H;
        g.fillStyle = r2() < .5 ? 'rgba(20,40,5,.22)' : 'rgba(210,230,120,.13)';
        g.beginPath(); g.ellipse(px, py, 1 + r2() * 3, .6 + r2() * 1.4, 0, 0, Math.PI * 2); g.fill();
      }
      if (r2() < .12) { // touffes de fleurs / cailloux
        g.fillStyle = r2() < .5 ? 'rgba(240,230,150,.55)' : 'rgba(180,170,150,.5)';
        for (let t = 0; t < 3; t++) { g.beginPath(); g.arc(c.x + (r2()-.5)*W*.5, c.y + (r2()-.5)*H*.5, 1.3, 0, 7); g.fill(); }
      }
      g.restore();
    }
    const v = g.createRadialGradient(LW/2, LH/2, LH*.3, LW/2, LH/2, LW*.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = v; g.fillRect(0, 0, LW, LH);
  }

  function fillCell(c, fill, stroke) {
    diamond(ctx, c.x, c.y, W - 3, H - 1.5);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function drawHole(c) {
    const { x, y } = c;
    diamond(ctx, x, y, W - 2, H - 1);
    const gr = ctx.createRadialGradient(x, y + 3, 2, x, y, W / 2);
    gr.addColorStop(0, '#000'); gr.addColorStop(1, '#231a10');
    ctx.fillStyle = gr; ctx.fill();
    ctx.fillStyle = '#5a3f22';
    poly([[x - W/2 + 1, y], [x, y - H/2 + .5], [x, y - H/2 + 5], [x - W/2 + 9, y]]); ctx.fill();
    ctx.fillStyle = '#3f2c17';
    poly([[x, y - H/2 + .5], [x + W/2 - 1, y], [x + W/2 - 9, y], [x, y - H/2 + 5]]); ctx.fill();
    diamond(ctx, x, y, W - 2, H - 1);
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Entité invoquée : sprite selon le type + icône de l'entité
  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const summonLevel = e => e.sLvl === 'spell' || !e.sLvl ? Sp().lvl + 1 : +e.sLvl;
  // Dessine une icône (emoji ou pixel art) posée sur `bottom`, centrée en x, de taille s
  function drawIcon(icon, x, bottom, s) {
    const p = isPx(icon) && pxById(icon.slice(3));
    if (p) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pxRender(p).canvas, Math.round(x - s / 2), Math.round(bottom - s), s, s);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `${s}px ${EMOJI_FONT}`; ctx.fillText(isPx(icon) ? '❔' : icon, x, bottom);
    }
  }
  // Icône à plat, centrée sur une case (glyphes, pièges)
  const drawCellIcon = (icon, x, y, s) => drawIcon(icon, x, y + s * .42, s);
  function drawSummon(c, iv, alpha = 1) {
    const d = summonById(iv.sid), kind = d ? d.kind : 'creature', icon = d ? d.icon : '❔';
    const { x, y } = c;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (kind === 'obstacle') {
      // bloc cristallin (plus bas qu'un rocher) + icône sur le dessus
      const h = 22, hw = W / 2 - 4, hh = H / 2 - 2;
      poly([[x - hw, y], [x, y + hh], [x, y + hh - h], [x - hw, y - h]]); ctx.fillStyle = '#6a5f7e'; ctx.fill();
      poly([[x, y + hh], [x + hw, y], [x + hw, y - h], [x, y + hh - h]]); ctx.fillStyle = '#4d4460'; ctx.fill();
      poly([[x, y - hh - h], [x + hw, y - h], [x, y + hh - h], [x - hw, y - h]]); ctx.fillStyle = '#9c90b4'; ctx.fill();
      ctx.strokeStyle = 'rgba(20,14,30,.6)'; ctx.lineWidth = 1;
      poly([[x - hw, y - h], [x, y - hh - h], [x + hw, y - h], [x + hw, y], [x, y + hh], [x - hw, y]]); ctx.stroke();
      drawIcon(icon, x, y - h + 7, 20);
    } else {
      // anneau d'équipe (bleu = allié) + ombre
      ctx.beginPath(); ctx.ellipse(x, y, W * .3, H * .3, 0, 0, 7);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#3d7bff'; ctx.stroke();
      if (kind === 'object') {
        // petit socle en bois
        const h = 9, hw = 11, hh = 5.5;
        poly([[x - hw, y - 2], [x, y + hh - 2], [x, y + hh - 2 - h], [x - hw, y - 2 - h]]); ctx.fillStyle = '#7a5530'; ctx.fill();
        poly([[x, y + hh - 2], [x + hw, y - 2], [x + hw, y - 2 - h], [x, y + hh - 2 - h]]); ctx.fillStyle = '#5c3f22'; ctx.fill();
        poly([[x, y - hh - 2 - h], [x + hw, y - 2 - h], [x, y + hh - 2 - h], [x - hw, y - 2 - h]]); ctx.fillStyle = '#a07443'; ctx.fill();
        drawIcon(icon, x, y - 12, 26);
      } else {
        drawIcon(icon, x, y + 2, 32);
      }
    }
    // niveau de l'invocation
    ctx.font = 'bold 9px Verdana, sans-serif'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText('niv ' + iv.lvl, x + 16, y - 4);
    ctx.fillStyle = '#ffe9a8'; ctx.fillText('niv ' + iv.lvl, x + 16, y - 4);
    ctx.restore();
  }

  function drawRock(c) {
    const { x, y } = c, h = 30, hw = W / 2 - 3, hh = H / 2 - 1.5;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 2, hw, hh, 0, 0, 7); ctx.fill();
    poly([[x - hw, y], [x, y + hh], [x, y + hh - h], [x - hw, y - h]]);
    ctx.fillStyle = '#6f6657'; ctx.fill();
    poly([[x, y + hh], [x + hw, y], [x + hw, y - h], [x, y + hh - h]]);
    ctx.fillStyle = '#524a3f'; ctx.fill();
    poly([[x, y - hh - h], [x + hw, y - h], [x, y + hh - h], [x - hw, y - h]]);
    const gr = ctx.createLinearGradient(x, y - hh - h, x, y + hh - h);
    gr.addColorStop(0, '#b0a690'); gr.addColorStop(1, '#8a8171');
    ctx.fillStyle = gr; ctx.fill();
    ctx.fillStyle = 'rgba(95,125,45,.8)';
    ctx.beginPath(); ctx.ellipse(x - 6, y - h - 2, 8, 3.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 8, y - h + 3, 5, 2.4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(40,34,26,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - hw + 8, y - h + 10); ctx.lineTo(x - hw + 13, y - h + 18); ctx.lineTo(x - hw + 10, y - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + hw - 9, y - h + 8); ctx.lineTo(x + hw - 14, y - 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,16,10,.55)';
    ctx.beginPath();
    ctx.moveTo(x - hw, y - h); ctx.lineTo(x, y - hh - h); ctx.lineTo(x + hw, y - h); ctx.lineTo(x + hw, y); ctx.lineTo(x, y + hh); ctx.lineTo(x - hw, y); ctx.closePath();
    ctx.moveTo(x, y + hh); ctx.lineTo(x, y + hh - h); ctx.lineTo(x - hw, y - h);
    ctx.moveTo(x, y + hh - h); ctx.lineTo(x + hw, y - h);
    ctx.stroke();
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  // Assombrit (f < 0) ou éclaircit (f > 0) une couleur #rrggbb
  const shadeHex = (hex, f) => '#' + [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16), t = f < 0 ? 0 : 255;
    return Math.round(v + (t - v) * Math.abs(f)).toString(16).padStart(2, '0');
  }).join('');

  function drawChar(c, kind) {
    const { x, y } = c;
    const pal = {
      caster: { ring: '#ffd24a', cloth: '#3f6fb3', cloth2: '#2b4f86', hair: '#6b3b16' },
      ally:   { ring: '#3d7bff', cloth: '#4f8a3a', cloth2: '#36652a', hair: '#e2c068' },
      enemy:  { ring: '#ff3b2f', cloth: '#8e2f2a', cloth2: '#64201c', hair: '#2a2a2a' }
    }[kind];
    // en prévisualisation, le lanceur porte la couleur de la classe testée
    if (kind === 'caster' && S.view === 'preview' && curClass()) {
      const col = curClass().color;
      pal.cloth = col; pal.cloth2 = shadeHex(col, -.35);
    }
    ctx.beginPath(); ctx.ellipse(x, y, W * .3, H * .3, 0, 0, 7);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = pal.ring; ctx.stroke();
    ctx.fillStyle = '#3a2a1a';
    rr(x - 7, y - 15, 5, 14, 2); ctx.fill(); rr(x + 2, y - 15, 5, 14, 2); ctx.fill();
    const gr = ctx.createLinearGradient(x - 11, 0, x + 11, 0);
    gr.addColorStop(0, pal.cloth); gr.addColorStop(1, pal.cloth2);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x - 9, y - 33); ctx.lineTo(x + 9, y - 33); ctx.lineTo(x + 12, y - 12); ctx.lineTo(x - 12, y - 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#6b4a22'; ctx.fillRect(x - 10.5, y - 21, 21, 3);
    ctx.fillStyle = pal.cloth2;
    rr(x - 14, y - 31, 5, 13, 2); ctx.fill(); rr(x + 9, y - 31, 5, 13, 2); ctx.fill();
    ctx.fillStyle = '#f0c496';
    ctx.beginPath(); ctx.arc(x - 11.5, y - 17, 2.6, 0, 7); ctx.arc(x + 11.5, y - 17, 2.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 41, 9.5, 0, 7);
    ctx.fillStyle = '#f3c99b'; ctx.fill(); ctx.strokeStyle = 'rgba(80,45,20,.7)'; ctx.stroke();
    ctx.fillStyle = pal.hair;
    ctx.beginPath(); ctx.arc(x, y - 43, 10, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(x + 6, y - 45); ctx.lineTo(x - 7, y - 44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b120a';
    ctx.fillRect(x - 4.5, y - 41, 2, 3); ctx.fillRect(x + 2.5, y - 41, 2, 3);
  }

  // Glyphe : cases teintées de la couleur de l'élément, avec une rune au centre de chaque case
  function drawGlyph(g) {
    const col = glyphColor(g);
    for (const k of g.cells) {
      const c = byKey.get(k); if (!c) continue;
      diamond(ctx, c.x, c.y, W - 4, H - 2);
      ctx.fillStyle = hexA(col, .45); ctx.fill();
      ctx.strokeStyle = hexA(col, 1); ctx.lineWidth = 2; ctx.stroke();
      if (g.icon) { ctx.save(); ctx.globalAlpha = .9; drawCellIcon(g.icon, c.x, c.y, 18); ctx.restore(); continue; }
      // rune : double losange + croix
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
      diamond(ctx, c.x, c.y, W * .5, H * .5); ctx.stroke();
      diamond(ctx, c.x, c.y, W * .28, H * .28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x - W * .25, c.y); ctx.lineTo(c.x + W * .25, c.y);
      ctx.moveTo(c.x, c.y - H * .25); ctx.lineTo(c.x, c.y + H * .25); ctx.stroke();
    }
    // tours restants sur la case centrale (décalés si une icône occupe le centre)
    const cc = byKey.get(g.center);
    if (cc) {
      const tx = g.icon ? cc.x + 14 : cc.x, ty = g.icon ? cc.y + 5 : cc.y + 1;
      ctx.font = 'bold 12px Verdana, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(g.turns, tx, ty);
      ctx.fillStyle = '#fff'; ctx.fillText(g.turns, tx, ty);
    }
  }

  // Piège : zone au contour pointillé + mécanisme sur la case centrale
  function drawTrapZone(cellsK, col, dashed = true) {
    for (const k of cellsK) {
      const c = byKey.get(k); if (!c || !walkable(k)) continue;
      diamond(ctx, c.x, c.y, W - 6, H - 3);
      ctx.fillStyle = hexA(col, .2); ctx.fill();
      if (dashed) ctx.setLineDash([5, 3]);
      ctx.strokeStyle = hexA(col, .95); ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  function drawTrapIcon(c, col, alpha = 1, icon = '') {
    const { x, y } = c;
    ctx.save(); ctx.globalAlpha = alpha;
    if (icon) {
      // icône perso posée sur un disque de la couleur du piège
      ctx.beginPath(); ctx.ellipse(x, y, 15, 7.5, 0, 0, 7);
      ctx.fillStyle = hexA(col, .55); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1a0f05'; ctx.stroke();
      drawCellIcon(icon, x, y - 2, 22);
      ctx.restore(); return;
    }
    // mâchoires : couronne dentelée aplatie
    ctx.beginPath();
    const teeth = 10, R = 13, r = 8;
    for (let n = 0; n <= teeth * 2; n++) {
      const a = n / (teeth * 2) * Math.PI * 2, rad = n % 2 ? r : R;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad * .5;
      n ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = hexA(col, .9); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#1a0f05'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, 5, 2.6, 0, 0, 7);
    ctx.fillStyle = '#e8e2d0'; ctx.fill(); ctx.strokeStyle = '#1a0f05'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  const trapZoneLabel = e => {
    const a = e.tAoe || 'none';
    if (a === 'none') return 'case unique';
    if (a.startsWith('z:')) { const z = zoneById(a.slice(2)); return z ? esc(z.name) : 'zone supprimée'; }
    return `${TRAP_SHAPES[a].toLowerCase()} de ${e.tSize}`;
  };
  const trapZone = (center, from, e) => zoneCells(center, from, e.tAoe || 'none', Math.max(0, e.tSize || 0));

  // Outil Déplacer : personnage sélectionné + trajet prévu (s'arrête au premier piège)
  function drawMovePreview() {
    if (moveSel && !occupied(moveSel)) moveSel = null;
    if (!moveSel) return null;
    const s = byKey.get(moveSel);
    ctx.setLineDash([4, 3]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, W * .36, H * .36, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    if (!hover || hover.k === moveSel) return null;
    const path = findPath(moveSel, hover.k);
    if (!path) return null;
    const stop = path.findIndex(k => S.traps.some(t => t.cells.includes(k)));
    const shown = stop >= 0 ? path.slice(0, stop + 1) : path;
    const pm = moverPM(moveSel); // PM max d'une invocation (Infinity pour les autres)
    shown.forEach((k, n) => {
      const c = byKey.get(k);
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, 2.6, 0, 0, 7);
      ctx.fillStyle = n >= pm ? 'rgba(150,150,150,.8)' : n === stop ? '#ff3b2f' : 'rgba(120,255,120,.95)'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    });
    if (stop >= 0 && stop < pm) {
      const c = byKey.get(path[stop]);
      diamond(ctx, c.x, c.y, W - 4, H - 2); ctx.strokeStyle = '#ff3b2f'; ctx.lineWidth = 3; ctx.stroke();
    }
    return { steps: shown.length, trap: stop >= 0 && stop < pm, pm };
  }

  // Chaîne de rebonds : arcs lumineux numérotés entre chaque cible
  function drawChain(chain) {
    const ey = 24;
    for (const s of chain) {
      if (!s.n) continue;
      const a = { x: s.from.x, y: s.from.y - ey }, b = { x: s.cell.x, y: s.cell.y - ey };
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.max(18, Math.hypot(b.x - a.x, b.y - a.y) * .3);
      for (const [w, col] of [[6, 'rgba(255,220,80,.25)'], [2.5, 'rgba(255,240,150,.95)']]) {
        ctx.lineWidth = w; ctx.strokeStyle = col;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
      }
      // pointe de flèche
      const ang = Math.atan2(b.y - my, b.x - mx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
      ctx.fillStyle = '#ffe98a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      // numéro du rebond
      ctx.beginPath(); ctx.arc(mx, my + 6, 9, 0, 7);
      ctx.fillStyle = '#5a3a0a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffe98a'; ctx.stroke();
      ctx.font = 'bold 11px Verdana, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff3c4'; ctx.fillText(s.n, mx, my + 6.5);
    }
  }

  // Barre de vie au-dessus d'un personnage, avec les PV restants
  function drawHpBar(x, y, r) {
    const w = 38, h = 6, f = Math.max(0, r.hp / r.hpMax);
    ctx.fillStyle = 'rgba(20,12,4,.85)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = hpColor(f); ctx.fillRect(x - w / 2, y, Math.round(w * f), h);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - w / 2, y, Math.round(w * f), 2);
    ctx.font = 'bold 9px Verdana, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
    const t = r.hp <= 0 ? 'K.O.' : String(r.hp);
    ctx.strokeText(t, x, y - 1); ctx.fillStyle = r.hp <= 0 ? '#ff6b5a' : '#fff'; ctx.fillText(t, x, y - 1);
  }

  // Chiffres flottants au-dessus des personnages (rouge = dommages, vert = soins)
  function drawNumbers(impact) {
    ctx.font = 'bold 13px Verdana, Tahoma, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const { ent, lines } of impact) {
      let y = ent.c.y - (S.showHp ? 74 : 62);
      for (let n = lines.length - 1; n >= 0; n--) {
        const l = lines[n];
        let txt, col;
        if (l.kind === 'dmg') { txt = '-' + fmt(l.lo, l.hi); col = '#ff4b3a'; }
        else if (l.kind === 'heal') { txt = '+' + fmt(l.lo, l.hi); col = '#62ff58'; }
        else if (l.kind === 'glyph') { txt = `◈ ${l.heal ? '+' : '-'}${fmt(l.lo, l.hi)} ×${l.dur}t`; col = l.heal ? '#62ff58' : '#ffb347'; }
        else { txt = `☠ -${fmt(l.lo, l.hi)} ×${l.dur}`; col = '#c6f04c'; }
        if (l.b) txt = `↪${l.b} ` + txt;
        const w = ctx.measureText(txt).width;
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#000'; ctx.strokeText(txt, ent.c.x, y);
        ctx.fillStyle = col; ctx.fillText(txt, ent.c.x, y);
        if (l.el) {
          ctx.beginPath(); ctx.arc(ent.c.x - w / 2 - 8, y, 4, 0, 7);
          ctx.fillStyle = ELEMENTS[l.el].c; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
        }
        y -= 16;
      }
    }
  }

  let hover = null;
  let queued = false;
  const requestRender = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };

  function render() {
    queued = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LW, LH);
    ctx.drawImage(ground, 0, 0, LW, LH);

    const caster = byKey.get(activeKey());
    const editing = P().mode === 'custom' && S.tool === 'edit';
    const mapEdit = S.view === 'maps'; // interface Cartes : pas de sort, uniquement la disposition

    for (const c of cells) if (S.objs[c.k] === 'hole') drawHole(c);

    if (S.grid) {
      ctx.lineWidth = 1;
      for (const c of cells) {
        if (S.objs[c.k] === 'hole') continue;
        diamond(ctx, c.x, c.y, W - 1, H - .5);
        ctx.strokeStyle = 'rgba(255,255,230,.13)'; ctx.stroke();
      }
    }

    // portée
    let count = 0;
    const status = new Map();
    for (const c of cells) {
      const st = mapEdit ? 'out' : evaluate(c, caster);
      status.set(c.k, st);
      if (st === 'ok') count++;
    }
    for (const c of cells) {
      const st = status.get(c.k);
      if (editing) {
        if (st !== 'out') fillCell(c, 'rgba(47,95,214,.55)', 'rgba(150,190,255,.7)');
        continue;
      }
      if (st === 'ok' || st === 'empty') fillCell(c, 'rgba(38,86,214,.58)', 'rgba(140,185,255,.6)');
      else if (st === 'nolos') fillCell(c, 'rgba(190,200,225,.38)', 'rgba(230,235,250,.45)');
    }
    // glyphes posés au sol (au-dessus de la portée pour rester lisibles)
    for (const g of S.glyphs) drawGlyph(g);
    // pièges posés : zone (pointillés) + mécanisme au centre
    for (const t of S.traps) { drawTrapZone(t.cells, trapColor(t)); drawTrapIcon(byKey.get(t.center), trapColor(t), 1, t.icon); }

    if (editing) {
      diamond(ctx, caster.x, caster.y, W - 3, H - 1.5);
      ctx.setLineDash([4, 3]); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    }

    // zone d'effet + survol
    let info = null, impact = null, chain = null;
    if (hover) {
      const st = status.get(hover.k);
      const d = Math.abs(hover.i - caster.i) + Math.abs(hover.j - caster.j);
      info = { st, d };
      if (!editing && st === 'ok' && S.tool !== 'move') {
        chain = bounceChain(hover, caster);
        // zone du lancer (orange) puis zones des rebonds (ambre, plus claires)
        for (const step of chain) {
          const zone = aoeCells(step.cell, step.from);
          for (const c of zone) step.n
            ? fillCell(c, 'rgba(255,170,40,.42)', 'rgba(255,225,140,.7)')
            : fillCell(c, 'rgba(226,78,36,.62)', 'rgba(255,190,140,.75)');
          // aperçu des glyphes que le sort poserait
          for (const e of P().effects) if (e.type === 'glyph') {
            const col = fxGlyphColor(e);
            ctx.setLineDash([5, 3]); ctx.lineWidth = 2; ctx.strokeStyle = col;
            for (const c of zone) { if (!walkable(c.k)) continue; diamond(ctx, c.x, c.y, W * .55, H * .55); ctx.stroke(); if (e.gIcon) { ctx.save(); ctx.globalAlpha = .6; drawCellIcon(e.gIcon, c.x, c.y, 16); ctx.restore(); } }
            ctx.setLineDash([]);
          }
        }
        // aperçu des pièges que le sort poserait sur la case ciblée
        for (const e of P().effects) if (e.type === 'trap') {
          const col = fxGlyphColor(e);
          drawTrapZone(trapZone(hover, caster, e).map(c => c.k), col);
          drawTrapIcon(hover, col, .7, e.gIcon || "");
        }
        impact = computeImpact(hover, caster);
      }
      diamond(ctx, hover.x, hover.y, W - 3, H - 1.5);
      ctx.lineWidth = 2;
      ctx.strokeStyle = editing ? '#fff' : (st === 'ok' ? '#fff6c8' : 'rgba(255,90,70,.95)');
      ctx.stroke();
    }

    // objets triés par profondeur
    const objs = cells.filter(c => c.k === S.caster || (S.objs[c.k] && S.objs[c.k] !== 'hole'))
      .sort((a, b) => (a.i + a.j) - (b.i + b.j) || a.x - b.x);
    // invocation contrôlée : anneau doré en pointillés sous ses pieds
    if (activeKey() !== S.caster) {
      const a = byKey.get(activeKey());
      ctx.setLineDash([5, 3]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd24a';
      ctx.beginPath(); ctx.ellipse(a.x, a.y, W * .38, H * .38, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const c of objs) {
      if (c.k === S.caster) drawChar(c, 'caster');
      else if (S.inv[c.k]) drawSummon(c, S.inv[c.k]);
      else if (S.objs[c.k] === 'rock') drawRock(c);
      else drawChar(c, S.objs[c.k]);
    }
    // barres de vie (pas en édition de carte)
    if (S.showHp && !mapEdit) for (const c of objs) if (occupied(c.k)) {
      const r = rtOf(c.k), kind = S.inv[c.k] ? summonKind(S.inv[c.k]) : 'char';
      drawHpBar(c.x, c.y - (kind === 'creature' ? 42 : kind === 'object' ? 46 : 60), r);
    }
    // aperçu fantôme des entités qu'invoquerait le sort sur la case survolée
    if (hover && info && info.st === 'ok' && !editing && S.tool !== 'move')
      for (const e of P().effects) if (e.type === 'summon' && summonById(e.sid)) drawSummon(hover, { sid: e.sid, lvl: summonLevel(e) }, .55);

    // rayon de ligne de vue
    if (hover && S.showRay && !editing && !mapEdit && hover.k !== S.caster) {
      const res = lineOfSight(caster, hover);
      const ey = 22;
      ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeStyle = res.ok ? 'rgba(120,255,120,.9)' : 'rgba(255,80,60,.95)';
      ctx.beginPath(); ctx.moveTo(caster.x, caster.y - ey); ctx.lineTo(hover.x, hover.y - ey); ctx.stroke();
      ctx.setLineDash([]);
      if (!res.ok) {
        const b = byKey.get(res.block);
        ctx.strokeStyle = '#ff3b2f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(b.x - 7, b.y - ey - 7); ctx.lineTo(b.x + 7, b.y - ey + 7);
        ctx.moveTo(b.x + 7, b.y - ey - 7); ctx.lineTo(b.x - 7, b.y - ey + 7); ctx.stroke();
      }
    }

    const move = S.tool === 'move' ? drawMovePreview() : null;
    if (chain && chain.length > 1) drawChain(chain);
    if (impact && S.showNumbers) drawNumbers(impact);

    // barre d'état
    const OBJ_NAMES = { rock: '🪨 Obstacle', hole: '🕳️ Trou', ally: '🔵 Allié', enemy: '🔴 Ennemi' };
    if (mapEdit) {
      const n = Object.values(S.objs).reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
      document.getElementById('count').innerHTML = `🪨 ${n.rock || 0} · 🕳️ ${n.hole || 0} · 🔵 ${n.ally || 0} · 🔴 ${n.enemy || 0}`;
    } else document.getElementById('count').innerHTML = editing
      ? `Motif : <b>${pattern.size}</b> case(s)`
      : `Cases ciblables : <b>${count}</b>`;
    const hi = document.getElementById('hoverInfo');
    if (!info) hi.textContent = 'Survole une case…';
    else if (mapEdit) hi.innerHTML = `Case [${hover.i}, ${hover.j}] · ${hover.k === S.caster ? '🧙 Départ du lanceur' : OBJ_NAMES[S.objs[hover.k]] || 'libre'}`;
    else {
      const labels = {
        ok: '<b class="ok">✔ Ciblable</b>',
        out: '<b class="ko">✖ Hors portée</b>',
        nolos: '<b class="ko">✖ Pas de ligne de vue</b>',
        blocked: '<b class="ko">✖ Case non ciblable</b>',
        busy: '<b class="ko">✖ Case occupée</b>',
        empty: '<b class="ko">✖ Il faut cibler un personnage</b>',
        trapped: '<b class="ko">✖ Il y a déjà un piège ici</b>'
      };
      const di = hover.i - caster.i, dj = hover.j - caster.j;
      const rel = `(${di >= 0 ? '+' : ''}${di}, ${dj >= 0 ? '+' : ''}${dj})`;
      const gl = S.glyphs.filter(g => g.cells.includes(hover.k))
        .map(g => ` · <b style="color:${glyphColor(g)}">◈ ${esc(g.name)}</b> (${g.turns} tour${g.turns > 1 ? 's' : ''})`).join('');
      const tr = S.traps.filter(t => t.cells.includes(hover.k))
        .map(t => ` · <b style="color:${trapColor(t)}">🪤 ${esc(t.name)}</b>${t.center === hover.k ? ' (centre)' : ''}`).join('');
      const mv = S.tool !== 'move' ? ''
        : !moveSel ? ' · 🚶 clique un personnage à déplacer'
        : !move ? (hover.k === moveSel ? ' · 🚶 personnage sélectionné' : ' · <b class="ko">🚶 case inaccessible</b>')
        : ` · 🚶 <b${move.steps > move.pm ? ' class="ko"' : ''}>${move.steps} PM</b>${isFinite(move.pm) ? ` / ${move.pm} max` : ''}${move.trap ? ' · <b class="ko">💥 piège sur le chemin</b>' : ''}`;
      hi.innerHTML = S.tool === 'move'
        ? `Case ${rel}${mv}${gl}${tr}`
        : `Case ${rel} · distance <b>${info.d}</b> · ${editing ? (pattern.has(di + ',' + dj) ? 'dans le motif' : 'hors motif')
          : info.st === 'ok' && castCheck(hover) ? `<b class="ko">✖ ${castCheck(hover)}</b>` : labels[info.st]}${gl}${tr}`;
    }
    renderPreview(info, impact, editing, chain);
  }

  const pct = m => Math.round(m * 100) + ' %';
  function chainNote(chain) {
    const p = P();
    if (!p.bounce || !chain) return '';
    const steps = chain.slice(1);
    const list = steps.map(s => `<b>${s.n}</b> ${s.ent.label} <small>(×${pct(s.mult)})</small>`).join(' → ');
    return `<div class="hint">↪ Rebonds : ${steps.length}/${p.bounces}${steps.length ? ' · ' + list : ' · aucune cible à portée de bond'}</div>`;
  }

  function renderPreview(info, impact, editing, chain) {
    const el = document.getElementById('preview');
    if (editing) { el.innerHTML = '<span class="hint">Mode édition de la portée : les effets ne sont pas prévisualisés.</span>'; return; }
    if (info && info.st === 'empty') { el.innerHTML = '<span class="hint">↪ Ce sort à rebond doit d\'abord viser un personnage. Coche « Peut partir d\'une case vide » dans l\'encadré Rebond pour autoriser une case libre.</span>'; return; }
    const traps = P().effects.filter(e => e.type === 'trap');
    const summons = P().effects.filter(e => e.type === 'summon');
    if (traps.length && info && (info.st === 'busy' || info.st === 'trapped')) {
      el.innerHTML = '<span class="hint">🪤 Un piège doit être posé sur une case libre : sans obstacle, trou, personnage ni autre piège. Un glyphe sur la case ne gêne pas.</span>'; return;
    }
    if (summons.length && info && info.st === 'busy') {
      el.innerHTML = '<span class="hint">🐾 Une invocation doit apparaître sur une case libre.</span>'; return;
    }
    if (!info || info.st !== 'ok') { el.innerHTML = '<span class="hint">Survole une case ciblable (en bleu) pour voir ce que le sort inflige à chaque personnage dans la zone.</span>'; return; }
    const glyphs = P().effects.filter(e => e.type === 'glyph');
    const glyphNote = (glyphs.length
      ? `<div class="hint">◈ Ce sort pose ${glyphs.length > 1 ? glyphs.length + ' glyphes' : 'un glyphe'} sur la zone (${glyphs.map(e => `${e.dur} tour${e.dur > 1 ? 's' : ''}`).join(', ')}). Utilise l'outil <b>Lancer</b> pour le poser, puis <b>Tour suivant</b>.</div>`
      : '') + (traps.length
      ? `<div class="hint">🪤 Ce sort pose ${traps.length > 1 ? traps.length + ' pièges' : 'un piège'} sur la case ciblée (zone : ${traps.map(trapZoneLabel).join(', ')}). Pose-le avec <b>🎯 Lancer</b>, puis fais marcher un personnage dans sa zone avec <b>🚶 Déplacer</b> pour le déclencher.</div>`
      : '') + (summons.length
      ? `<div class="hint">${summons.map(summonFxText).join('<br>')}<br>Invocations en jeu : <b>${Object.keys(S.inv).length}/${S.stats.invoc}</b>. Utilise <b>🎯 Lancer</b> pour l'invoquer.</div>`
      : '');
    const bNote = chainNote(chain);
    const why = hover ? castCheck(hover) : '';
    const rules = why ? `<div class="hint ko" style="color:var(--ko)">⛔ Lancer impossible : <b>${why}</b></div>` : '';
    if (!impact.length) { el.innerHTML = rules + '<span class="hint">Aucun personnage touché dans la zone.</span>' + glyphNote + bNote; return; }
    el.innerHTML = rules + glyphNote + bNote + impact.map(({ ent, lines }) => {
      const parts = lines.map(l => {
        const dot = (l.b ? `<small>↪${l.b}</small> ` : '') + (l.el ? `<span class="el" style="background:${ELEMENTS[l.el].c}"></span> ` : '');
        if (l.kind === 'dmg') return `${dot}<span class="v-dmg">-${fmt(l.lo, l.hi)}</span> ${ELEMENTS[l.el].n}${l.steal ? ' (vol)' : ''}`;
        if (l.kind === 'heal') return `<span class="v-heal">+${fmt(l.lo, l.hi)} PV</span>${l.steal ? ' (vol de vie)' : ''}`;
        if (l.kind === 'glyph') return l.heal
          ? `◈ <span class="v-heal">+${fmt(l.lo, l.hi)} PV</span> / tour s'il reste sur le glyphe (${l.dur} tours)`
          : `◈ ${dot}<span class="v-dmg">-${fmt(l.lo, l.hi)}</span> ${ELEMENTS[l.el].n} / tour s'il reste sur le glyphe (${l.dur} tours)`;
        return `${dot}<span class="v-poison">-${fmt(l.lo, l.hi)}</span> ${ELEMENTS[l.el].n} / tour pendant ${l.dur} tours`;
      });
      const dm = lines.filter(l => l.kind === 'dmg');
      if (dm.length > 1) parts.push(`total <span class="v-dmg">-${fmt(dm.reduce((s, l) => s + l.lo, 0), dm.reduce((s, l) => s + l.hi, 0))}</span>`);
      // PV prévus après le lancer (dommages et soins immédiats seulement)
      const r = rtOf(ent.c.k);
      if (r) {
        const now = lines.filter(l => l.kind === 'dmg' || l.kind === 'heal');
        const dLo = now.filter(l => l.kind === 'dmg').reduce((s, l) => s + l.lo, 0), dHi = now.filter(l => l.kind === 'dmg').reduce((s, l) => s + l.hi, 0);
        const hLo = now.filter(l => l.kind === 'heal').reduce((s, l) => s + l.lo, 0), hHi = now.filter(l => l.kind === 'heal').reduce((s, l) => s + l.hi, 0);
        const clamp = v => Math.max(0, Math.min(r.hpMax, v));
        const a = clamp(r.hp - dHi + hLo), b = clamp(r.hp - dLo + hHi);
        const dead = a <= 0 ? (b <= 0 ? ' 💀 vaincu' : ' 💀 possible') : '';
        if (now.length) parts.push(`❤ ${r.hp} → <b>${fmt(a, b)}</b>/${r.hpMax}${dead ? `<b class="v-dmg">${dead}</b>` : ''}`);
      }
      const color = { caster: '#9a7400', ally: '#2553b8', enemy: '#a3291f' }[ent.kind];
      return `<div class="ent"><b style="color:${color}">${ent.label}</b><span>${parts.join(' · ')}</span></div>`;
    }).join('');
  }

