  // ---------- Géométrie de la carte (losanges isométriques ; 15 × 17 par défaut comme en jeu) ----------
  // MW = cases par ligne, MH = nombre de lignes doubles. La taille change selon la carte choisie.
  const W = 64, H = 32, OFFY = 50;
  let MW = 15, MH = 17, LW = 0, LH = 0;

  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  const cells = [], byKey = new Map();
  function buildCells(mw, mh) {
    MW = mw; MH = mh;
    LW = MW * W; LH = MH * H + H / 2 + OFFY;
    cells.length = 0; byKey.clear();
    const rnd = mulberry32(1337);
    for (let r = 0; r < MH * 2; r++) {
      const odd = r % 2, n = odd ? MW - 1 : MW;
      for (let c = 0; c < n; c++) {
        const i = odd ? (2*c + r + 3) / 2 : (2*c + r + 2) / 2;
        const j = odd ? (r - 2*c - 1) / 2 : (r - 2*c) / 2;
        const cell = { i, j, k: i + ',' + j, x: (i - j) * W / 2, y: (i + j) * H / 2 + OFFY, shade: rnd() };
        cells.push(cell); byKey.set(cell.k, cell);
      }
    }
  }
  buildCells(15, 17);
  // Case la plus proche du centre de la carte (position de départ par défaut)
  const centerCell = () => cells.reduce((b, c) => Math.hypot(c.x - LW / 2, c.y - LH / 2) < Math.hypot(b.x - LW / 2, b.y - LH / 2) ? c : b, cells[0]);
  const key = (i, j) => i + ',' + j;
  const cellAt = (i, j) => byKey.get(key(i, j));

