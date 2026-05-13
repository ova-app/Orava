# rules/stack.md

## Stack complète
- React Native + Expo (TypeScript strict) + Expo Router (`app/`)
- Supabase : PostgreSQL + Auth + RLS (projet ORAVA, région Frankfurt)
- Auth storage : expo-secure-store — adaptateur custom chunks 1800 bytes
- Icônes : Lucide React Native
- Git : `main` stable · `dev` travail · `feat/xxx` par feature
- **3D Myo** : `three` + `@types/three` + `expo-gl` (installés via `--legacy-peer-deps`)

## Config Supabase
- `lib/supabase.ts` : client (SecureStore fragmenté 1800b, autoRefreshToken)
- Trigger `on_auth_user_created` → crée `public.users`

## expo-gl + Three.js — règles critiques
- `onContextCreate` doit être **synchrone** — expo-gl ignore toute Promise retournée (async → black screen)
- Canvas proxy : NE PAS inclure `getContext` — passer uniquement `{ width, height, style:{}, clientWidth, clientHeight, addEventListener:()=>{}, removeEventListener:()=>{} }`
- Matériaux : **MeshPhongMaterial** uniquement — `MeshPhysicalMaterial` requiert WebGL2, non dispo dans expo-gl (GLES2/WebGL1) → black screen
- Appeler `gl.endFrameEXP()` après chaque `renderer.render(scene, camera)`
- `renderer.setSize(W, H, false)` + `setPixelRatio(1)` — ne pas laisser Three.js resize le canvas
- Dynamic imports (`three/examples/jsm/`) : **incompatibles** avec Metro bundler — ne pas utiliser


