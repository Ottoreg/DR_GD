  // ---------- Carte par défaut ----------
  function defaultMap() {
    const o = {};
    ['13,2','13,3','14,-3','19,-2','20,-2','18,5','18,6','11,-1','21,3','15,6'].forEach(k => byKey.has(k) && (o[k] = 'rock'));
    ['12,4','12,5','20,0'].forEach(k => byKey.has(k) && (o[k] = 'hole'));
    ['18,2','19,1'].forEach(k => byKey.has(k) && (o[k] = 'enemy'));
    ['14,0'].forEach(k => byKey.has(k) && (o[k] = 'ally'));
    return o;
  }
  if (!S.objs) S.objs = defaultMap();

  // ---------- Cartes enregistrées ----------
  // Une carte = taille + disposition de départ (position du lanceur, obstacles, trous, alliés, ennemis).
  // La partie en cours (S.objs, S.caster…) est une copie modifiable de la carte choisie.
  const MAP_OBJS = ['rock', 'hole', 'ally', 'enemy'];
  const clampInt = (v, a, b, d) => { v = parseInt(v, 10); return Number.isNaN(v) ? d : Math.max(a, Math.min(b, v)); };
  const newMap = (o = {}) => ({
    id: o.id || uid('map'), name: o.name || 'Nouvelle carte',
    w: clampInt(o.w, 5, 30, 15), h: clampInt(o.h, 5, 30, 17),
    caster: o.caster || '',
    objs: Object.fromEntries(Object.entries(o.objs || {}).filter(([, v]) => MAP_OBJS.includes(v)))
  });
  if (!Array.isArray(S.maps) || !S.maps.length) {
    // première ouverture : la carte actuelle devient la carte par défaut (sans les invocations)
    const objs = {};
    for (const [k, v] of Object.entries(S.objs)) if (MAP_OBJS.includes(v) && !(S.inv || {})[k]) objs[k] = v;
    S.maps = [newMap({ id: 'map_plaine', name: 'Plaine', w: 15, h: 17, caster: S.caster, objs })];
  }
  S.maps = S.maps.map(newMap);
  if (!(S.mapCur >= 0 && S.mapCur < S.maps.length)) S.mapCur = 0;
  const curMap = () => S.maps[S.mapCur];
  buildCells(curMap().w, curMap().h);
  for (const k of Object.keys(S.objs)) if (!byKey.has(k)) delete S.objs[k];
  if (!byKey.has(S.caster)) S.caster = byKey.has(curMap().caster) ? curMap().caster : centerCell().k;

  // ---------- Classes ----------
  // Une classe = nom, icône, couleur, et une liste de sorts appris à un niveau de personnage donné.
  const newClass = (o = {}) => ({
    id: o.id || uid('cl'), name: o.name || 'Nouvelle classe', icon: o.icon || '⚔️',
    color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#b86d22', desc: o.desc || '',
    spells: (Array.isArray(o.spells) ? o.spells : []).filter(x => x && x.sid)
      .map(x => ({ sid: String(x.sid), lvl: clampInt(x.lvl, 1, 200, 1) }))
  });
  function DEFAULT_CLASSES() {
    const id = n => (S.spells.find(s => s.name === n) || {}).id;
    const mk = (o, list) => newClass(Object.assign(o, { spells: list.map(([n, lvl]) => ({ sid: id(n), lvl })).filter(x => x.sid) }));
    return [
      mk({ name: 'Mage élémentaire', icon: '🔥', color: '#e0572a', desc: 'Maîtrise le feu et la foudre, frappe à distance et contrôle le terrain avec ses glyphes.' },
        [['Flamme ardente', 1], ['Arc électrique', 3], ['Souffle du dragon', 6], ['Nuée toxique', 9], ['Glyphe enflammé', 13]]),
      mk({ name: 'Invocateur', icon: '🐗', color: '#4f9a3a', desc: 'Appelle des créatures, des totems et des murs pour protéger ses alliés.' },
        [['Appel du sanglier', 1], ['Mot apaisant', 3], ['Totem guérisseur', 6], ['Mur de pierre', 9], ['Glyphe régénérant', 13]]),
      mk({ name: 'Piégeur', icon: '🪤', color: '#8e44c4', desc: 'Prépare le terrain avec des pièges et affaiblit ses cibles.' },
        [['Piège à mâchoires', 1], ['Morsure sanguine', 3], ['Piège explosif', 6]])
    ];
  }
  if (!Array.isArray(S.classes)) S.classes = DEFAULT_CLASSES();
  S.classes = S.classes.map(newClass);
  if (!(S.classCur >= 0 && S.classCur < S.classes.length)) S.classCur = 0;
  S.charLvl = clampInt(S.charLvl, 1, 200, 200);
  if (!['classes', 'spells', 'preview', 'maps'].includes(S.view)) S.view = 'preview';
  const curClass = () => S.classes[S.classCur];

  // ---------- Règles ----------
  // 'sobst' = obstacle invoqué : se comporte comme un rocher
  const blocksLos = k => { const o = S.objs[k]; return o === 'rock' || o === 'sobst' || o === 'ally' || o === 'enemy'; };
  const walkable  = k => { const o = S.objs[k]; return o !== 'rock' && o !== 'hole' && o !== 'sobst'; };
  const occupied  = k => k === S.caster || S.objs[k] === 'ally' || S.objs[k] === 'enemy';

