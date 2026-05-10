# rules/database.md

## 13 tables

```
users             : id, email, username, full_name, avatar_url, weight_unit(kg|lbs), plan(free|premium),
                    locale, date_naissance(DATE NULL), created_at
follows           : follower_id → users.id, following_id → users.id, created_at
gyms              : id, name, address, lat, lng, is_home, created_by → users.id, created_at
muscles           : id, name, group, body_side
exercises         : id, name_fr, slug, equipment_type, muscle_group, mechanics, force_type,
                    laterality, source, external_id, is_verified, created_by, created_at
exercise_muscles  : exercise_id, muscle_id → muscles.id, muscle(text), fascicle(text),
                    role(primary|secondary|stabilizer), activation_pct(0-100), source, confidence
workouts          : id, user_id, gym_id, title, started_at, ended_at, duration_sec, total_volume_kg,
                    poids_corps_kg(FLOAT NULL — snapshot au save),
                    is_public(DEFAULT false), note, lat, lng, avg_rest_seconds, photo_url, location_city,
                    pr_seance(text NULL — 'gold'|'silver'|'bronze')
workout_exercises : id, workout_id, exercise_id, order_index, note,
                    pr_exercice(text NULL — 'gold'|'silver'|'bronze')
workout_sets      : id, workout_exercise_id, set_type(warmup|working|dropset|failure), set_number,
                    reps, weight_kg, rest_seconds, rpe, is_pr,
                    pr_charge(text NULL — 'gold'|'silver'|'bronze'),
                    pr_serie(text NULL — 'gold'|'silver'|'bronze'),
                    parent_set_id, is_continuation, logged_at
body_metrics      : id, user_id → users.id, weight_kg(FLOAT), measured_at(TIMESTAMPTZ)
                    — série temporelle de poids, insert à chaque mise à jour profil
workout_metrics   : workout_id(PK) → workouts.id, data(JSONB), computed_at(TIMESTAMPTZ)
                    — toutes les métriques analytiques, calculées et stockées au save de chaque séance
likes             : user_id, workout_id, created_at
comments          : id, workout_id, user_id, content, created_at
```

## RPCs Postgres

```
get_prev_exercise_volumes(p_user_id, p_exercise_ids UUID[], p_before TIMESTAMPTZ)
  → TABLE(exercise_id UUID, volume_kg FLOAT, estimated_1rm_kg FLOAT)
  Retourne le volume + 1RM estimé de la séance précédente pour chaque exercice.

get_muscle_volume_rolling(p_user_id, p_since TIMESTAMPTZ)
  → TABLE(muscle_id UUID, volume_kg FLOAT)
  Volume pondéré par activation_pct pour tous les muscles depuis p_since.

get_muscle_frequency_7j(p_user_id, p_since TIMESTAMPTZ)
  → TABLE(muscle_id UUID, nb_seances BIGINT)
  Nombre de séances distinctes travaillant chaque muscle depuis p_since.
```

## workout_metrics.data — champs stockés (type WorkoutMetricsData dans summary.tsx)

Volume, poids max, séries, temps (repos/actif/densité), slot horaire, 1RM Epley,
PRs, muscles (via exercise_muscles + activation_pct), poids_corps snapshot, âge,
temps_depuis_derniere_seance, evolution vs séance précédente, rolling 7/30/90j,
streak semaines, fréquence musculaire 7j, score_recuperation_estime (0-100).

## Rappels critiques
- Trigger `on_auth_user_created` crée `public.users` automatiquement
- Signaler toute migration SQL avant de coder
- `exercise_muscles.activation_pct` = échelle 0-100 (pas 0-1)
- `workout_metrics` insert best-effort dans summary.tsx — jamais bloque le save
