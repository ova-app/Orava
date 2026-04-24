# ORAVA — Session 06 — Zone d'entraînement
*Document de session interne — Avril 2026*

---

> *"La zone d'entraînement est le cœur du produit. Tout le reste en dépend."*

---

## 1. Livrable de session

| Composant | Fichier | Statut |
|---|---|---|
| État global de séance | `context/WorkoutContext.tsx` | ✅ Livré |
| Stack navigator workout | `app/workout/_layout.tsx` | ✅ Livré |
| Écran de log principal | `app/workout/session.tsx` | ✅ Livré |
| Modal timer repos | `app/workout/timer.tsx` | ✅ Livré |
| Écran résumé + save | `app/workout/summary.tsx` | ✅ Livré |
| FAB orange centré | `app/(tabs)/_layout.tsx` | ✅ Livré |
| Placeholder FAB | `app/(tabs)/start.tsx` | ✅ Livré |
| Wrapping WorkoutProvider | `app/_layout.tsx` | ✅ Mis à jour |

**Résumé : 7 fichiers créés, 1 mis à jour. L'intégralité de la boucle Log → Résumé → Save est fonctionnelle.**

---

## 2. Ce qui a été construit

### 2.1 Architecture — WorkoutContext

Le contexte global gère l'état complet d'une séance en mémoire pendant toute sa durée de vie. Il est monté au niveau racine (`app/_layout.tsx`) pour être accessible depuis les tabs (FAB) et les écrans workout (session, summary).

**État géré :**

| Champ | Type | Description |
|---|---|---|
| `status` | `idle \| active \| done` | Cycle de vie de la séance |
| `startedAt` | `Date \| null` | Horodatage de début |
| `exercises` | `WorkoutExercise[]` | Liste des exercices avec leurs séries |
| `currentIndex` | `number` | Exercice affiché dans session.tsx |
| `elapsedSeconds` | `number` | Chrono — incrémenté par `setInterval` |

**Actions exposées :**

| Action | Comportement |
|---|---|
| `startWorkout()` | Réinitialise l'état, passe status → active, lance le chrono |
| `finishWorkout()` | Passe status → done (sans reset — les données restent pour summary) |
| `resetWorkout()` | Réinitialise tout après save ou abandon |
| `addExercise()` | Fetch le PR historique Supabase, crée l'exercice avec un draft set vide |
| `updateDraftSet()` | Modifie le dernier set non validé (poids ou reps) |
| `validateSet()` | Valide le draft, détecte le PR, crée automatiquement un nouveau draft |
| `removeSet()` | Supprime une série validée et renumérote |

> *Décision d'architecture : le WorkoutContext est le seul source of truth pendant la séance. Aucune donnée n'est persistée en base avant la validation finale dans summary.tsx — ce qui permet d'abandonner proprement à tout moment.*

---

### 2.2 Détection automatique des PRs

**Algorithme :**

```
PR = poids_série > max(PR_historique_Supabase, max_poids_séance_courante)
```

Le PR historique est fetchée depuis Supabase au moment de l'ajout de l'exercice (`addExercise`), via une jointure `workout_sets → workout_exercises → workouts` filtrée par `user_id`. L'appel est non-bloquant (try/catch silencieux) — si le fetch échoue, les PRs sont détectés intra-séance uniquement.

**Correction React 18 — bug de timing :**

Le calcul du PR est effectué **avant** l'appel à `setExercises` (lecture synchrone depuis l'état courant), puis la valeur `isPr` calculée est passée en paramètre au callback fonctionnel du setState. Cette approche évite le cas où le callback fonctionnel est appelé deux fois en StrictMode et où la variable `wasPr` définie à l'intérieur du callback n'est pas retournée à temps.

**Signalisation UI :**
- Badge ambre `PR` sur les lignes de séries validées — fond `#FAC77520`, texte `#FAC775`
- Flash banner "🏆 Nouveau PR !" pendant 2 secondes sur session.tsx

---

### 2.3 Écran de log — session.tsx

**Flux principal :**

```
FAB pressé
  → router.push('/workout/session')
    → useEffect détecte status === 'idle' → startWorkout()
      → Écran vide → "+ Ajouter un exercice"
        → Modal picker → recherche live Supabase (debounce 350ms)
          → Exercice sélectionné → currentIndex pointe sur lui
            → Steppers poids (±2.5 kg) + reps (±1)
              → "Valider la série" → PR détecté si applicable
                → Nouvelle série draft créée automatiquement (même poids/reps)
                  → Bouton "Fin" → summary.tsx
```

**Composants internes :**

| Composant | Rôle |
|---|---|
| Header | Chrono (HH:MM / MM:SS) + bouton ⏱ timer + bouton "Fin" |
| ExerciseNav | Navigation ← Exercice [N/Total] → |
| SetRow | Ligne série validée : numéro, poids × reps, badge PR, bouton × |
| DraftContainer | Steppers poids + reps, bouton "Valider la série" |
| Footer | Bouton "+ Ajouter un exercice" |
| ExercisePicker | Modal plein écran avec TextInput et FlatList Supabase |

**Décisions UX retenues :**
- Validation par bouton explicite uniquement (pas de swipe)
- Incrément poids : ±2.5 kg (standard barre olympique)
- Le draft suivant hérite du poids et des reps du draft validé (gain de temps en séance)
- Alert de confirmation si "Fin" pressé avec 0 série validée → option abandon

---

### 2.4 Timer repos — timer.tsx

Route modale Expo Router (`presentation: 'modal'`) — approche plus idiomatique qu'un composant `<Modal>` React Native, et qui garde le timer complètement autonome du contexte de séance.

| Feature | Détail |
|---|---|
| Presets | 1:00 / 1:30 / 2:00 / 3:00 — sélection réinitialise et arrête le décompte |
| Ajustements | ±15 secondes — modifient le temps restant et le preset actif si pas en cours |
| Démarrage | Tap sur l'affichage chrono → bascule start/pause |
| Fin | Vibration `[0, 300, 150, 300, 150, 500]` via `Vibration` (React Native natif) + fermeture auto après 1.2s |
| Barre de progression | Pleine largeur, orange `#D85A30`, se vide avec le temps |

> *`expo-haptics` non installé — utilisation de `Vibration` de React Native (built-in, pas de dépendance supplémentaire). Cohérent avec la politique de dépendances minimales du projet.*

---

### 2.5 Résumé + save — summary.tsx

**Génération du nom de séance :**

```typescript
1 groupe musculaire  → "Séance Pectoraux"
2 groupes            → "Pectoraux · Dos"
3+ groupes           → "Full Body"
Aucun groupe         → "Séance"
```

Le nom est pré-rempli dans un `TextInput` modifiable avant save.

**Save Supabase — séquence en 3 étapes :**

```
INSERT workouts → id
  └── Pour chaque exercice :
        INSERT workout_exercises (workout_id, exercise_id, order_index) → id
          └── INSERT workout_sets[] (workout_exercise_id, set_number, weight_kg, reps, is_pr, logged_at)
```

Seuls les exercices avec au moins une série validée sont persistés. Les drafts non validés sont ignorés.

**Stats affichées :**
- Durée (depuis `elapsedSeconds` du context)
- Nombre de séries validées
- Volume total (Σ poids × reps)
- Nombre de PRs (carte ambre si > 0)

**Sélection salle :** fetch `gyms` table, chips horizontaux — optionnel, `gym_id` nullable.

---

### 2.6 FAB — Navigation principale

Approche retenue : tab "start" avec `tabBarButton` custom qui intercepte le press et appelle `router.push('/workout/session')`. Le fichier `app/(tabs)/start.tsx` est un `<Redirect>` vers `/workout/session` — il n'est jamais atteint via navigation normale puisque le `tabBarButton` override le comportement natif du tab.

**Dot actif :** pastille ambre `#FAC775` sur le FAB quand `workout.status === 'active'` — indique visuellement qu'une séance est en cours si l'utilisateur navigue sur les autres tabs.

```
Tab bar : Feed | Historique | [FAB +] | Bibliothèque | Profil
```

---

## 3. Résultat validé

**Flux testé de bout en bout :**

1. ✅ Tap FAB → session.tsx s'ouvre, chrono démarre
2. ✅ Modal picker → recherche live exercices Supabase
3. ✅ Navigation entre exercices avec compteur N/Total
4. ✅ Steppers poids ±2.5 kg et reps ±1
5. ✅ Validation série → set apparaît dans la liste
6. ✅ Détection PR → flash banner + badge sur la ligne
7. ✅ Bouton timer → modal repos avec presets et vibration
8. ✅ "+ Ajouter un exercice" → picker réutilisable
9. ✅ Bouton "Fin" → summary.tsx avec stats calculées
10. ✅ Nom auto-généré depuis muscle groups, modifiable
11. ✅ Save → insertion en base, reset context, retour feed
12. ✅ Dot actif sur FAB si séance en cours

**Stack des fichiers à ce stade du projet :**

```
mobile_app/
├── app/
│   ├── _layout.tsx              ← WorkoutProvider + workout screen
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← FAB centré ✅ S06
│   │   ├── feed.tsx             ← placeholder
│   │   ├── history.tsx          ← placeholder
│   │   ├── library.tsx          ← ✅ S05
│   │   ├── profile.tsx          ← placeholder
│   │   └── start.tsx            ← FAB placeholder ✅ S06
│   ├── auth/                    ← ✅ S04
│   ├── exercise/[id].tsx        ← ✅ S05
│   └── workout/
│       ├── _layout.tsx          ← ✅ S06
│       ├── session.tsx          ← ✅ S06
│       ├── timer.tsx            ← ✅ S06
│       └── summary.tsx          ← ✅ S06
├── context/
│   └── WorkoutContext.tsx       ← ✅ S06
└── lib/
    └── supabase.ts              ← ✅ S03
```

---

## 4. Points d'attention et dette technique

| Point | Détail | Priorité |
|---|---|---|
| `duration_seconds` vs `duration_sec` | Le Product Brief nomme la colonne `duration_sec` — vérifier le nom réel en base Supabase et aligner si nécessaire | Haute |
| PR fetch Supabase | La jointure `workout_sets → workout_exercises → workouts` avec filtre imbriqué peut ne pas fonctionner selon la configuration RLS — fallback silencieux en place (PR intra-séance uniquement) | Moyenne |
| `is_public` non géré | La colonne `is_public` de `workouts` n'est pas encore renseignée au save — toutes les séances sont traitées comme privées jusqu'à implémentation du toggle | Moyenne |
| `total_volume_kg` | Le Product Brief prévoit cette colonne dénormalisée sur `workouts` — actuellement calculée à la volée côté client | Basse |
| Timer — reprise après fond | Si l'OS suspend l'app pendant le timer repos, le décompte n'est pas recalculé au retour — nécessite `AppState` + timestamp de démarrage pour la v suivante | Basse |

---

## 5. Prochaines étapes

| # | Session | Objectif | Statut |
|---|---|---|---|
| 01 | Vision & Product Brief | Définir la vision, le MVP, la stack, la BDD | ✅ Terminé |
| 02 | UX & Wireframes | Dessiner les écrans clés du MVP, navigation | ✅ Terminé |
| 03 | Setup technique | Init Expo + Supabase, premier commit, structure projet | ✅ Terminé |
| 04 | Build : Auth | Inscription, connexion, profil utilisateur | ✅ Terminé |
| 05 | Build : Bibliothèque exos | Import Wger + mapping musculaire, fiche exercice | ✅ Terminé |
| 06 | Build : Zone d'entraînement | Context, session, timer, résumé, FAB | ✅ Terminé |
| 07 | Build : Historique + Feed social | Liste séances, détail, feed avec likes | 🔄 En cours |
| 08 | Lancement TestFlight | Build EAS, profil Apple, beta test | À venir |

**Session 07 — travaux déjà engagés dans cette session :**
- `app/(tabs)/history.tsx` — liste des séances avec stats, pull-to-refresh, `useFocusEffect`
- `app/history/[id].tsx` — détail complet (exercices, séries, badges PR)
- `app/(tabs)/feed.tsx` — timeline sociale (follows + propres séances), like optimiste, avatars initiales

**Restant pour finaliser le MVP v1 :**
- Écran profil (`profile.tsx`) — stats personnelles, déconnexion
- Polissage feed — commentaires, profil public
- Préparation TestFlight — configuration EAS Build, provisioning Apple

---

*Orava — Document de session interne — Avril 2026*
*Rôles : Fondateur (décisions produit) · Claude Sonnet 4.6 (CTO virtuel — architecture, code, documentation)*
