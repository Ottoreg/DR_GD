  // ---------- Sorts ----------
  const ELEMENTS = {
    neutre: { n: 'Neutre', c: '#a3a3a3', stat: 'force' },
    terre:  { n: 'Terre',  c: '#b27a3a', stat: 'force' },
    feu:    { n: 'Feu',    c: '#e8552b', stat: 'intel' },
    eau:    { n: 'Eau',    c: '#3f93e6', stat: 'chance' },
    air:    { n: 'Air',    c: '#57b548', stat: 'agi' }
  };
  const FX_TYPES = { dmg: 'Dommages', poison: 'Poison', heal: 'Soins', steal: 'Vol de vie', glyph: 'Glyphe', trap: 'Piège', summon: 'Invocation' };
  const uid = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- Entités invocables ----------
  const INV_KINDS = {
    object:   { n: 'Objet',    hint: 'Objet fixe (0 PM conseillé) : il occupe sa case, bloque la ligne de vue, peut être ciblé et lancer ses sorts.' },
    creature: { n: 'Créature', hint: 'Créature alliée : elle se déplace avec ses PM, bloque la ligne de vue, peut être ciblée et lancer ses sorts.' },
    obstacle: { n: 'Obstacle', hint: 'Obstacle : il bloque le passage et la ligne de vue comme un rocher. Il n\'est pas un personnage et ne lance pas de sorts.' }
  };
  const newSummon = (o = {}) => ({
    id: o.id || uid('inv'), name: o.name || 'Nouvelle entité', icon: o.icon || '🐾',
    kind: INV_KINDS[o.kind] ? o.kind : 'creature',
    levels: Array.from({ length: 6 }, (_, i) => Object.assign({ pa: 4, pm: 3, pv: 30 + 10 * i }, (o.levels || [])[i] || {})),
    spells: Array.isArray(o.spells) ? o.spells.slice() : []
  });
  const TRAP_SHAPES = { none: 'Case unique', circle: 'Cercle', cross: 'Croix', line: 'Ligne' };
  const GLYPH_KINDS = { dmg: 'de dommages', heal: 'de soin' };
  const FX_TARGETS = { all: 'Tout le monde', enemies: 'Ennemis', allies: 'Alliés' };
  const FX_DEFAULT_TARGET = { dmg: 'all', poison: 'all', heal: 'allies', steal: 'all', glyph: 'all', trap: 'all', summon: 'all' };
  const isHealFx = e => e.type === 'heal' || ((e.type === 'glyph' || e.type === 'trap') && e.gType === 'heal');
  const hexA = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  // Couleur d'un glyphe : perso si choisie, sinon rouge (dommages) ou vert (soin)
  const GLYPH_DMG_COLOR = '#e0402a', GLYPH_HEAL_COLOR = '#4fd05a';
  const glyphColor = g => g.color || (g.heal ? GLYPH_HEAL_COLOR : GLYPH_DMG_COLOR);
  // Pièges : violet (dommages) ou vert (soin) par défaut
  const TRAP_DMG_COLOR = '#9b4ad8';
  const autoColor = e => e.gType === 'heal' ? GLYPH_HEAL_COLOR : (e.type === 'trap' ? TRAP_DMG_COLOR : GLYPH_DMG_COLOR);
  const fxGlyphColor = e => (e.gColorMode === 'custom' && e.gColor) ? e.gColor : autoColor(e);
  const trapColor = t => t.color || (t.heal ? GLYPH_HEAL_COLOR : TRAP_DMG_COLOR);

  // Un sort = nom + description communs, et 6 niveaux ayant chacun PA, portée, zone, effets…
  const NB_LEVELS = 6;
  const newLevel = (o = {}) => {
    const l = Object.assign({
      pa: 3, cooldown: 0, perTurn: 0, perTarget: 0, cc: 50, ec: 100,
      mode: 'standard', min: 1, max: 3, mod: false, bonus: 0, line: false, diag: false,
      los: true, free: false, pattern: [], aoe: 'none', aoeSize: 1,
      bounce: false, bounces: 2, bounceRange: 3, bounceDecay: 0, bounceTarget: 'enemies', bounceLos: false, bounceFromEmpty: false,
      effects: [{ type: 'dmg', el: 'neutre', min: 5, max: 10, dur: 3, target: 'all' }]
    }, structuredClone(o));
    delete l.name; delete l.desc; delete l.icon; delete l.levels; delete l.lvl; delete l.id; delete l.syncLevels;
    return l;
  };
  // Accepte aussi l'ancien format (sort sans niveaux) : ses réglages deviennent les 6 niveaux.
  // Chaque sort a un identifiant stable (utilisé par les entités invocables pour lister leurs sorts).
  const newSpell = (o = {}) => {
    const src = Array.isArray(o.levels) && o.levels.length ? o.levels : [o];
    const levels = Array.from({ length: NB_LEVELS }, (_, i) => newLevel(src[Math.min(i, src.length - 1)]));
    const lvl = o.lvl >= 0 && o.lvl < NB_LEVELS ? o.lvl : 0;
    return { id: o.id || uid('sp'), name: o.name || 'Nouveau sort', desc: o.desc || '', icon: o.icon || '✨', syncLevels: o.syncLevels !== false, lvl, levels };
  };

  // Progression linéaire des valeurs d'effets entre le niveau 1 et le niveau 6.
  function interpolate(spell) {
    const a = spell.levels[0], b = spell.levels[NB_LEVELS - 1];
    if (a.effects.length !== b.effects.length || a.effects.some((e, i) => e.type !== b.effects[i].type)) return false;
    for (let l = 1; l < NB_LEVELS - 1; l++) {
      const t = l / (NB_LEVELS - 1), lv = spell.levels[l];
      lv.effects = a.effects.map((e, i) => {
        const f = b.effects[i], mix = (x, y) => Math.round(x + (y - x) * t);
        return Object.assign({}, e, { min: mix(e.min, f.min), max: mix(e.max, f.max), dur: mix(e.dur, f.dur) });
      });
    }
    return true;
  }

  // Sort d'exemple : niveau 1 = base, niveau 6 = base avec valeurs × mult et quelques réglages, entre-deux interpolés.
  function sample(icon, name, desc, base, mult, top = {}) {
    const s = newSpell(Object.assign({ name, desc, icon }, base));
    const l6 = s.levels[NB_LEVELS - 1];
    l6.effects.forEach(e => { e.min = Math.round(e.min * mult); e.max = Math.round(e.max * mult); });
    Object.assign(l6, top);
    interpolate(s);
    for (let l = 1; l < NB_LEVELS - 1; l++) for (const k of Object.keys(top)) {
      const x = base[k] ?? newLevel()[k], y = top[k];
      s.levels[l][k] = typeof x === 'number' ? Math.round(x + (y - x) * l / (NB_LEVELS - 1)) : (l >= 3 ? y : x);
    }
    return s;
  }

  const DEFAULT_SPELLS = () => [
    sample('🔥', 'Flamme ardente', 'Projette une boule de feu sur la cible.',
      { pa: 4, min: 1, max: 5, mod: true, perTurn: 2, cc: 50, effects: [{ type: 'dmg', el: 'feu', min: 8, max: 12, dur: 3, target: 'all' }] },
      1.8, { max: 8, cc: 35 }),
    sample('☠️', 'Nuée toxique', 'Empoisonne les créatures dans la zone pendant quelques tours.',
      { pa: 3, min: 1, max: 5, aoe: 'circle', aoeSize: 1, cooldown: 3,
        effects: [{ type: 'dmg', el: 'terre', min: 2, max: 4, dur: 3, target: 'all' }, { type: 'poison', el: 'terre', min: 3, max: 5, dur: 3, target: 'enemies' }] },
      1.8, { cooldown: 2 }),
    sample('💚', 'Mot apaisant', 'Soigne les alliés autour de la cible.',
      { id: 'sp_apaisant', pa: 3, min: 0, max: 3, aoe: 'circle', aoeSize: 1, effects: [{ type: 'heal', el: 'neutre', min: 7, max: 10, dur: 3, target: 'allies' }] },
      2, { max: 5 }),
    sample('🩸', 'Morsure sanguine', 'Vole la vie de la cible : le lanceur récupère la moitié des dommages infligés.',
      { pa: 4, min: 1, max: 2, line: true, perTarget: 1, effects: [{ type: 'steal', el: 'eau', min: 6, max: 9, dur: 3, target: 'all' }] },
      1.7, { max: 4, pa: 3 }),
    sample('🌪️', 'Souffle du dragon', 'Un souffle en cône qui touche la case ciblée puis s\'élargit sur les 3 cases suivantes.',
      { pa: 5, min: 1, max: 1, cooldown: 2, aoe: 'z:cone3', effects: [{ type: 'dmg', el: 'air', min: 9, max: 13, dur: 3, target: 'all' }] },
      1.7, {}),
    sample('🔮', 'Glyphe enflammé', 'Pose au sol un glyphe de feu. Les personnages qui commencent leur tour dessus subissent des dommages.',
      { pa: 3, min: 1, max: 5, aoe: 'circle', aoeSize: 1, cooldown: 3,
        effects: [{ type: 'glyph', gType: 'dmg', el: 'feu', min: 6, max: 9, dur: 2, target: 'all' }] },
      1.8, { cooldown: 2 }),
    sample('🌿', 'Glyphe régénérant', 'Pose au sol un glyphe qui soigne les alliés au début de leur tour.',
      { pa: 4, min: 0, max: 4, aoe: 'circle', aoeSize: 1, cooldown: 4,
        effects: [{ type: 'glyph', gType: 'heal', el: 'neutre', min: 5, max: 8, dur: 3, target: 'allies' }] },
      1.8, {}),
    sample('⚡', 'Arc électrique', 'Un éclair qui frappe la cible puis rebondit sur les ennemis proches, en perdant de la puissance à chaque bond.',
      { pa: 4, min: 1, max: 6, perTurn: 2, bounce: true, bounces: 2, bounceRange: 3, bounceDecay: 25, bounceTarget: 'enemies',
        effects: [{ type: 'dmg', el: 'air', min: 8, max: 11, dur: 3, target: 'enemies' }] },
      1.7, { bounces: 4, bounceDecay: 15 }),
    sample('🪤', 'Piège à mâchoires', 'Pose un piège sur une case libre. Le premier personnage qui marche dessus le déclenche.',
      { pa: 3, min: 1, max: 4, los: false, cooldown: 0,
        effects: [{ type: 'trap', gType: 'dmg', el: 'feu', min: 10, max: 14, dur: 3, target: 'all', tAoe: 'none', tSize: 1 }] },
      1.7, { max: 6 }),
    sample('💣', 'Piège explosif', 'Piège en croix : il se déclenche dès qu\'un personnage entre dans sa zone et touche tout ce qui s\'y trouve.',
      { pa: 4, min: 1, max: 4, los: false, cooldown: 1,
        effects: [{ type: 'trap', gType: 'dmg', el: 'terre', min: 7, max: 10, dur: 3, target: 'all', tAoe: 'cross', tSize: 1 }] },
      1.7, {}),
    // Invocations d'exemple (entités définies dans DEFAULT_SUMMONS)
    sample('🐗', 'Appel du sanglier', 'Invoque un sanglier allié sur une case libre adjacente.',
      { pa: 3, min: 1, max: 1, cooldown: 3, effects: [{ type: 'summon', sid: 'inv_sanglier', sLvl: 'spell', el: 'neutre', min: 0, max: 0, dur: 1, target: 'all' }] },
      1, { max: 2, cooldown: 2 }),
    sample('🗿', 'Totem guérisseur', 'Invoque un totem immobile qui peut soigner ses alliés.',
      { pa: 4, min: 1, max: 3, cooldown: 4, effects: [{ type: 'summon', sid: 'inv_totem', sLvl: 'spell', el: 'neutre', min: 0, max: 0, dur: 1, target: 'all' }] },
      1, {}),
    sample('🧱', 'Mur de pierre', 'Fait surgir un bloc de pierre qui bloque le passage et la ligne de vue.',
      { pa: 2, min: 1, max: 4, los: false, cooldown: 2, effects: [{ type: 'summon', sid: 'inv_mur', sLvl: 'spell', el: 'neutre', min: 0, max: 0, dur: 1, target: 'all' }] },
      1, { max: 6 }),
    sample('🦷', 'Coup de défenses', 'Attaque au corps à corps du sanglier.',
      { id: 'sp_defenses', pa: 3, min: 1, max: 1, effects: [{ type: 'dmg', el: 'terre', min: 5, max: 8, dur: 3, target: 'enemies' }] },
      1.8, {})
  ];

  const DEFAULT_SUMMONS = () => [
    newSummon({ id: 'inv_sanglier', name: 'Sanglier', icon: '🐗', kind: 'creature', spells: ['sp_defenses'],
      levels: [0, 1, 2, 3, 4, 5].map(i => ({ pa: 4 + (i >= 3 ? 1 : 0), pm: 3 + (i >= 4 ? 1 : 0), pv: 40 + 15 * i })) }),
    newSummon({ id: 'inv_totem', name: 'Totem', icon: '🗿', kind: 'object', spells: ['sp_apaisant'],
      levels: [0, 1, 2, 3, 4, 5].map(i => ({ pa: 3 + (i >= 3 ? 1 : 0), pm: 0, pv: 30 + 10 * i })) }),
    newSummon({ id: 'inv_mur', name: 'Bloc de pierre', icon: '🧱', kind: 'obstacle', spells: [],
      levels: [0, 1, 2, 3, 4, 5].map(i => ({ pa: 0, pm: 0, pv: 50 + 20 * i })) })
  ];

