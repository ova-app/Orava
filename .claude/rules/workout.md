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

Signature multi-dimensionnelle en z-score (41 dims, 8 familles). Visualisation Three.js + expo-gl.

### Architecture
- **GLView** (expo-gl) → Three.js WebGLRenderer avec canvas proxy (voir rules/stack.md)
- **Géométrie** : `IcosahedronGeometry(1.0, 6)` déformée par champ metaball des 8 familles
- **Matériau** : `MeshPhongMaterial` matte white ceramic `#f0ece7`, shininess 12
- **Lumières** : AmbientLight(0xffffff, 0.28) + key (0xfff6ee, 2.4) + fill (0xdde6ff, 0.52) + rim (0xffffff, 1.0) + ground (0xffe8d8, 0.16)
- **Overlay React Native** : labels familles positionnés via `THREE.Vector3.project(camera)` + panel détail

### buildBlobGeometry — formule vertex
```
for each vertex (nx,ny,nz normalized):
  field = Σ families: t×0.55 / (d2 + 0.045)   où t=(famZ+3)/6, d2=dist² vers attractor
  scale = 1.0 + min(0.48, field×0.068)
  vertex = (nx,ny,nz) × scale
```
Attractor position famille : `(sin(phi)cos(theta), -cos(phi), sin(phi)sin(theta))` — phi depuis NODE_PHI[], theta secteur famille.

### 8 familles — GROUPS
volume · intensite · structure · recuperation · performance · regularite · muscles · temps
Chaque famille : couleur hex, clé(s) z-score depuis `myo_signatures`.

### Auto-rotation
RAF 30fps (`now - last >= 33ms`), `ryRef += 0.003`. Stop si `isInteract.current = true` (PanResponder grant → release/terminate).

### Score (header)
Arc SVG 240°, score numérique + "MYO". Couleur : ≥66→`#FAC775` / ≥33→`#D85A30` / <33→`#8E8E93`.

### Detail panel
`Animated.View` slide-in au tap famille. Barres z-score par variable. Dismiss sur tap hors panel.

### Pipeline données
`myo_signatures` → fetch par `workout_id` (ou dernier) → `FamilyNode[]` avec `famZ` → `nodesRef.current` → `buildBlobGeometry`

## Auth storage
expo-secure-store — adaptateur custom chunks 1800 bytes (JWT > 2048b).
