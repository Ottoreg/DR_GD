# Atelier de sorts — façon Dofus Retro

Application web (100 % navigateur, sans serveur) pour créer et tester des sorts, des classes, des invocations, des zones d'effet, des cartes isométriques et des icônes en pixel art. Les données sont enregistrées dans le `localStorage` du navigateur. On peut les exporter et les importer en fichiers JSON.

## Organisation

```
src/
  index.html      structure de la page (HTML seul)
  styles.css      tout le style
  js/             le code, découpé par thème, dans l'ordre d'exécution
    01-geometrie.js                    grille isométrique
    02-sorts-invocations.js            modèle des sorts, effets, invocations
    03-zones-etat-icones.js            zones perso, état sauvegardé, icônes pixel
    04-cartes-classes-regles.js        cartes, classes, règles
    05-combat.js                       personnages, calcul des effets, rebonds
    06-rendu.js                        dessin du canvas et aperçus
    07-fiche-sort-effets.js            fiche de sort, page des sorts, éditeur d'effets
    08-interaction-lancer-deplacement.js  souris, lancers, glyphes, pièges, déplacements
    09-editeurs.js                     liaison des champs, niveaux, zones, invocations
    10-navigation-import-export.js     interfaces, terrain, export / import
    11-classes-previsualisation.js     interface Classes et prévisualisation
    12-atelier-pixel.js                atelier d'icônes
    13-demarrage.js                    initialisation
build.mjs         construit dist/ (concatène + minifie)
vercel.json       configuration du déploiement
```

Les fichiers de `src/js/` partagent les mêmes variables : `build.mjs` les met bout à bout, dans l'ordre de leur numéro, à l'intérieur d'une seule fonction. Pour ajouter un fichier, il suffit de lui donner un numéro à la bonne place.

## Commandes

```bash
npm install        # une seule fois
npm run dev        # version lisible sur http://localhost:3000
npm run build      # version en ligne dans dist/ (JS et CSS minifiés)
```

## Mise en ligne (Vercel)

Le dépôt est prêt pour Vercel : sur vercel.com, **Add New… → Project**, importer le dépôt GitHub `DR_GD`, laisser les réglages détectés depuis `vercel.json`, puis **Deploy**. Chaque push sur `main` met ensuite le site à jour automatiquement.

En ligne, seuls `index.html` et deux fichiers minifiés sont servis. Les sources lisibles restent dans le dépôt. Le code d'un site web reste téléchargeable par le navigateur : la minification le rend difficile à lire, sans le cacher totalement.
