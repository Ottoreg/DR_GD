  // ---------- Démarrage ----------
  document.body.dataset.view = S.view;
  document.querySelectorAll('#views [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
  if (S.view === 'maps') enterMapEdit(); else setMapSize(curMap().w, curMap().h);
  if (S.view === 'preview') ensureClassSpell();

  refreshIconSelects();
  renderSpellList();
  renderEffects();
  renderCombat();
  refresh();
