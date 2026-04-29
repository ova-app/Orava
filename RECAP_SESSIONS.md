# Orava — Récapitulatif des sessions Claude Code

> Projet : application mobile React Native (Expo Router) + Supabase
> Dernière mise à jour : Session 10 + corrections bugs

---

## Structure du projet

```
orava/
├── mobile_app/
│   ├── app/
│   │   ├── _layout.tsx               ← Racine : auth guard + splash animé
│   │   ├── index.tsx                 ← Redirect → /auth/login
│   │   ├── analytics.tsx             ← Stats avancées (NEW S10)
│   │   ├── settings.tsx              ← Paramètres complets (NEW S10)
│   │   ├── edit-profile.tsx          ← Modifier profil (NEW S10)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           ← Tab bar + FAB avec confirmation
│   │   │   ├── feed.tsx              ← Feed social (likes, commentaires)
│   │   │   ├── history.tsx           ← Historique séances
│   │   │   ├── library.tsx           ← Bibliothèque exercices (SectionList)
│   │   │   ├── profile.tsx           ← Profil + stats du mois + PRs
│   │   │   └── start.tsx             ← Placeholder tab FAB
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── exercise/
│   │   │   └── [id].tsx              ← Fiche exercice (muscles, activation)
│   │   ├── history/
│   │   │   └── [id].tsx              ← Détail d'une séance passée
│   │   └── workout/
│   │       ├── session.tsx           ← Séance en cours + ScrollPicker
│   │       ├── timer.tsx             ← Timer de repos
│   │       └── summary.tsx           ← Résumé + sauvegarde Supabase
│   ├── context/
│   │   ├── ThemeContext.tsx          ← Dark/light theme (AsyncStorage)
│   │   └── WorkoutContext.tsx        ← État global séance + PR detection
│   └── constants/
│       └── theme.ts                  ← Palette couleurs dark + light
└── supabase/
    ├── session07_rls.sql
    ├── session09.sql
    └── session10_permissions.sql     ← À APPLIQUER (voir section SQL)
```

---

## Session 10 — Ce qui a été implémenté

### 1. Système de thèmes (dark / light)
- **`constants/theme.ts`** — palette complète avec tokens : `background`, `card`, `textPrimary`, `textSecondary`, `separator`, `accent` (#D85A30), `prAmber/prGold/prPurple`
- **`context/ThemeContext.tsx`** — `useTheme()` hook, persistance via AsyncStorage (`'theme'`)
- **`app/_layout.tsx`** — `ThemeProvider` wrapping + splash animé (fade + spring sur le logo "Orava")
- Tous les écrans utilisent `colors.*` au lieu de couleurs codées en dur

### 2. Tab bar & FAB
- **`app/(tabs)/_layout.tsx`** — icônes Lucide : `Users` (Fil), `CalendarDays` (Historique), `CirclePlus` (FAB), `Dumbbell` (Biblio.), `CircleUser` (Profil)
- FAB : si séance active → navigue directement ; sinon → modal de confirmation "Lancer une séance ?" avec bouton "Commencer" (orange) et "Annuler"
- Point orange sur le FAB quand une séance est en cours

### 3. Bibliothèque d'exercices
- **`app/(tabs)/library.tsx`** — refonte complète
- Nouveau schéma BDD : `name_fr`, `equipment_type`, `is_compound`, `muscle_group`
- `SectionList` avec sticky headers groupés par muscle
- Ordre des sections : pectoraux → dos → épaules → biceps → triceps → quadriceps → ischio-jambiers → fessiers → mollets → abdominaux → avant-bras
- Filtres chips : équipement + type (polyarticulaire / isolation)
- Badge orange "Poly" sur les exercices polyarticulaires
- Composés en premier dans chaque section

### 4. Fiche exercice
- **`app/exercise/[id].tsx`** — refonte nouveau schéma
- Affiche `name_fr`, `equipment_type`, `muscle_group`
- Muscles : `muscle · fascicule` + barre d'activation avec % pour les muscles primaires
- Bouton "Ajouter à la séance" visible uniquement si séance active
- Appelle `workout.addExercise(id, name_fr, muscle_group, equipment_type)`

### 5. Contexte séance + détection PR
- **`context/WorkoutContext.tsx`** — réécriture complète
- `WorkoutSet` inclut : `pr_charge`, `pr_serie`, `pr_1rm` (3 types de PR)
- `addExercise` récupère l'historique Supabase pour calculer les baselines PR
- `validateSet` retourne `{ isPrCharge, isPrSerie, isPr1rm }` avec formule Epley 1RM : `weight × (1 + reps/30)`

### 6. Écran de séance
- **`app/workout/session.tsx`** — réécriture complète
- `ScrollPicker` custom (ScrollView avec `snapToInterval=48`) par équipement :
  - haltères : 2–60 kg par 2
  - poulie : 2,5–100 kg par 2,5
  - machine : 2,5–200 kg par 2,5
  - smith : 2,5–150 kg par 2,5
  - kettlebell : 4–48 kg par 4
  - barre : combinaisons de plaques (20 kg barre + plaques 0/1,25/2,5/5/10/20)
- `RepsStepper` : boutons +/–
- Flash PR après validation : ⚡ (charge/#FFD700), 🔥 (série/orange), 🏆 (1RM)
- Auto-navigation vers timer après validation

### 7. Timer de repos
- **`app/workout/timer.tsx`** — réécriture complète
- Lit `AsyncStorage 'default_rest'` au montage, auto-démarre si valeur définie
- Presets : 45s, 60s, 90s, 120s — sélection auto-démarre le décompte
- Résistance arrière-plan via `AppState` (recalcul elapsed au retour)
- Grand cercle visuel + texte "Terminé !" + vibration pattern en fin

### 8. Résumé de séance
- **`app/workout/summary.tsx`** — réécriture complète
- Block "Records battus aujourd'hui" avec icônes Zap/Flame/Trophy
- Sauvegarde Supabase : `pr_charge`, `pr_serie`, `pr_1rm` sur chaque set
- Génération automatique du titre selon les groupes musculaires travaillés

### 9. Paramètres
- **`app/settings.tsx`** — nouvel écran complet
- Section Préférences : unité de poids (kg/lbs), thème (sombre/clair), vibration
- Section Entraînement : timer repos par défaut (Off/60s/90s/120s/180s), visibilité séances
- Section Compte : modifier profil, changer mot de passe (resetPasswordForEmail), déconnexion
- Section Données : supprimer compte

### 10. Profil
- **`app/(tabs)/profile.tsx`** — mise à jour
- Header avec icônes `TrendingUp` (→ analytics) et `Settings` (→ settings)
- Stats du mois : séances, durée totale, séries, volume
- Records personnels : tableau triable par poids

### 11. Analytics
- **`app/analytics.tsx`** — nouvel écran complet
- Chips période : 1M / 3M / 6M / 1A / Tout
- **Résumé** : séances, durée moy., volume total, séries
- **Volume par semaine** : bar chart horizontal scrollable (12 dernières semaines)
- **Vue musculaire** : barres d'intensité grises→orange + top 5
- **Régularité** : streak actif + record + calendrier 4 semaines (4×7 grille)
- **Progression des charges** : start → end max weight avec Δ% ↑vert / ↓rouge
- **Top exercices** : top 5 par nombre de séries + volume
- **Déséquilibres** : Push/Pull et Haut/Bas (BalanceBar)
- **Records battus** : count par type Zap/Flame/Trophy sur la période

---

## Corrections bugs (post-session 10)

| Bug | Fichier(s) modifié(s) | Fix |
|-----|-----------------------|-----|
| Page de lancement manquante | `app/_layout.tsx` | Splash animé : logo fade+spring, tagline "Forge ta progression", fade-out auto après init auth |
| Thème clair cassé (Fil, Historique) | `feed.tsx`, `history.tsx`, `history/[id].tsx` | Migration vers `useTheme()` + `colors.*` sur tous les composants |
| "Séance introuvable" au clic | `app/history/[id].tsx` | Requête utilisait `exercises(name, equipment)` (ancien schéma) → corrigé en `name_fr, equipment_type` |
| Icônes PR type Strava | `feed.tsx`, `history.tsx`, `history/[id].tsx` | Requêtes fetchent `pr_charge, pr_serie, pr_1rm` ; cartes affichent ⚡🔥🏆 selon le type |
| Analytics à étoffer | `app/analytics.tsx` | +Résumé période, +Bar chart volume hebdo, +Top exercices, +Records par type |
| permission denied for table exercises | Supabase SQL | `DISABLE ROW LEVEL SECURITY` + `GRANT SELECT` sur `exercises` et `exercise_muscles` |

---

## SQL — Toutes les migrations à appliquer

### session07_rls.sql — RLS policies initiales
```sql
CREATE POLICY "workouts_select"
  ON workouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "workouts_insert"
  ON workouts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "workouts_update"
  ON workouts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "workouts_delete"
  ON workouts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "workout_exercises_select"
  ON workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "workout_exercises_insert"
  ON workout_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_exercises_delete"
  ON workout_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_sets_select"
  ON workout_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "workout_sets_insert"
  ON workout_sets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_sets_delete"
  ON workout_sets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "likes_select"
  ON likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "likes_insert"
  ON likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete"
  ON likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workouts_feed
  ON workouts(started_at DESC) WHERE is_public = true;
```

---

### session09.sql — GRANT + table comments
```sql
GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON workouts           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_exercises  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_sets       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON likes              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users              TO authenticated;
GRANT SELECT                          ON exercises         TO authenticated;
GRANT SELECT                          ON gyms              TO authenticated;

ALTER TABLE workouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes                 ENABLE ROW LEVEL SECURITY;

-- (Re-création policies workouts, workout_exercises, workout_sets, likes — voir fichier)

CREATE TABLE IF NOT EXISTS comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  uuid        NOT NULL REFERENCES workouts(id)  ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON comments TO authenticated;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_comments_workout ON comments(workout_id, created_at);

CREATE POLICY "comments_select"
  ON comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "comments_insert"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "comments_delete"
  ON comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

---

### session10_permissions.sql — ⚠️ À APPLIQUER MAINTENANT
```sql
-- Fix "permission denied for table exercises"
GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT ON exercises        TO authenticated, anon;
GRANT SELECT ON exercise_muscles TO authenticated, anon;

ALTER TABLE exercises        DISABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_muscles DISABLE ROW LEVEL SECURITY;

-- Re-grant tables workout (perdu lors migration schéma)
GRANT SELECT, INSERT, UPDATE, DELETE ON workouts          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_sets      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON likes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON comments          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users             TO authenticated;
GRANT SELECT                          ON gyms             TO authenticated;

-- Nouvelles colonnes PR par type
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS pr_charge boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pr_serie  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pr_1rm    boolean DEFAULT false;
```

---

## Dépendances npm installées

```bash
npm install --legacy-peer-deps lucide-react-native react-native-svg @react-native-async-storage/async-storage
```

> `--legacy-peer-deps` nécessaire à cause du conflit react@19.1.0 vs react-dom@19.2.5

---

## Schéma BDD — tables principales

| Table | Colonnes clés |
|-------|--------------|
| `exercises` | `id`, `name_fr`, `equipment_type`, `is_compound`, `muscle_group` |
| `exercise_muscles` | `exercise_id`, `muscle`, `fascicle`, `role`, `activation_pct` |
| `workouts` | `id`, `user_id`, `title`, `started_at`, `ended_at`, `duration_sec`, `gym_id`, `is_public` |
| `workout_exercises` | `id`, `workout_id`, `exercise_id`, `order_index` |
| `workout_sets` | `id`, `workout_exercise_id`, `set_number`, `weight_kg`, `reps`, `is_pr`, `pr_charge`, `pr_serie`, `pr_1rm`, `logged_at` |
| `users` | `id`, `username`, `full_name` |
| `gyms` | `id`, `name` |
| `likes` | `workout_id`, `user_id` |
| `comments` | `id`, `workout_id`, `user_id`, `content`, `created_at` |
| `follows` | `follower_id`, `following_id` |

---

## Vérifications après migration SQL

```sql
-- 1. Exercices accessibles
SELECT COUNT(*) FROM exercises;
-- → doit retourner > 0

-- 2. Colonnes PR présentes
SELECT column_name FROM information_schema.columns
WHERE table_name = 'workout_sets'
  AND column_name IN ('pr_charge', 'pr_serie', 'pr_1rm');
-- → doit retourner 3 lignes

-- 3. RLS désactivé sur exercises
SELECT relname, relrowsecurity
FROM pg_class WHERE relname IN ('exercises', 'exercise_muscles');
-- → relrowsecurity doit être 'f' (false)
```