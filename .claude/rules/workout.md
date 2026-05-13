# rules/workout.md

## Système PR — 4 types × podium 3 niveaux

| Type | Échelle | Définition | Stockage |
|---|---|---|---|
| pr_charge | Set | Poids le plus lourd toutes séances | workout_sets |
| pr_serie | Set | Max(poids × reps) sur 1 set | workout_sets |
| pr_exercice | Exercice/séance | Volume total exercice vs historique | workout_exercises |
| pr_seance | Séance | Volume total séance vs historique | workouts |

Podium : `gold` = nouveau record absolu · `silver` = 2e · `bronze` = 3e · `null` = pas de PR.

`is_pr` (boolean) = `pr_charge IS NOT NULL OR pr_serie IS NOT NULL`

## WorkoutContext
- `status` : idle | active | done
- `startedAt`, `exercises`, `currentIndex`, `elapsedSeconds`
- PR : `pr_charge`/`pr_serie` = `PrLevel` (text null|gold|silver|bronze)
- 3 top-3 chargés par `addExercise` : `pr_top3_charge`, `pr_top3_serie`, `pr_top3_exercice`
- `computePodium(value, top3)` exporté — utilisé dans `summary.tsx`
- `rest_seconds` : delta ms depuis dernier set validé (global workout)

## Calcul au save (summary.tsx)
- `pr_exercice` : `computePodium(Σ poids×reps des sets, ex.pr_top3_exercice)` → `workout_exercises`
- `pr_seance` : `computePodium(volume total séance, seanceTop3)` — top-3 chargé depuis `workouts.total_volume_kg` → `workouts`

## Chargement dans addExercise
- `pr_top3_charge` : top-3 poids distincts
- `pr_top3_serie` : top-3 valeurs (poids × reps) distinctes
- `pr_top3_exercice` : top-3 volumes d'exercice par séance (groupés par workout_id en JS)

## Armurerie (prs.tsx)
Podium pr_charge (poids) par exercice. 1 card par exercice.

## Myo 3D (myo-orb.tsx)

Signature multi-dimensionnelle en z-score (41 dims, 8 familles). Visualisation SVG 3D interactive.

### Arborescence — 4 niveaux depuis l'origine
| Niveau | Élément | Déterminé par |
|---|---|---|
| L0 | Origine (nœud central, 5 cercles concentriques) | fixe |
| L1 | Nœud racine famille à 45% de famR | famZ moyen → phi + famR |
| L2 | Îlot variable sur sphère à famR (bloom si actif) | theta_var dans secteur famille |
| L3 | Halo de N satellites dans le plan tangent | z-score variable |

### Formules impératives
- **Hauteur** = z-score moyen famille → `phi = π × (0.08 + 0.84 × (1 − (famZ+3)/6))`. z=+3 → pôle haut, z=-3 → pôle bas.
- **Rayon** = `famR = R × clamp((famZ+3)/4, 0.25, 1.0)` — floor à 0.25 (jamais 0.08), z=+1 → surface R.
- **Tous les éléments d'une famille partagent le même phi** — pas de dispersion verticale entre variables.
- **Satellites actifs** : `N = 4 + floor(t×18)` où `t = (z+3)/6`, avec jitter RNG.
- **Spoke length** : `R × (0.06 + 0.22×t)` — proportionnel au z-score.
- R = `SIZE × 0.36` — ne pas réduire.
- RNG seeded (mulberry32) — visuel déterministe.

### Mode dormant (famZ < −1)
Quand la famille est sous le baseline :
- Stems L0→L1 et L1→L2 : `strokeDasharray="3,2"`, opacity 0.18, width réduit
- L2 island : `glow: false` (pas de bloom), opacity 0.32, taille plancher 2.8px
- L3 : 3 satellites triangulaires (pas de jitter), opacity 0.25
- Label chip : opacity 0.55, borderColor atténué

### Score (header)
`ScoreArc` — arc SVG 240° (gap bas), score numérique + "MYO" au centre. Couleur : ≥66→`#FAC775` / ≥33→`#D85A30` / <33→`#8E8E93`.

### Label chips
Flottants sur le canvas, position absolue. Contenu : nom famille + z-score (`+1.4` / `-0.8`). Backdrop `#0a0a0cdd` + border colorée. `pointerEvents="none"`.

### Auto-rotation
RAF loop à 30fps (`now - last >= 33ms`), `ryRef += 0.006`. Pause si `isInteracting.current = true` (set sur `onPanResponderGrant`, clear sur release/terminate).

### Bloom (îlots actifs uniquement)
3 cercles concentriques par island : `r×6 opacité×0.04` / `r×3.2 opacité×0.10` / `r×1.9 opacité×0.22`.

### Legend
Mini-barre colorée par famille, largeur `4 + t×22` px (t = z normalisé 0→1).

### Autres règles
- Sphère : 1 cercle silhouette + 3 anneaux latitude projetés. PAS de grille dense.
- Pan : delta `moveX/moveY` + RAF scheduling. PAS `gs.vx`.
- Fade-in 700ms (`Animated.Value 0→1`) sur l'orb + legend au chargement.
- Depth sorting : back/front hemisphere séparés, stems puis bloom puis particles.

## Auth storage
expo-secure-store — adaptateur custom chunks 1800 bytes (JWT > 2048b).
