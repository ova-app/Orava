// Supabase Edge Function — resolve-claims (ORA-077, alternative extensible au cron SQL)
//
// Résolution SERVEUR des claims expirés : passe en 'failed' tout claim 'active' dont la
// deadline est dépassée, même si l'utilisateur n'a pas rouvert l'app (cohérence du track
// record + des events feed). La résolution 'succeeded' reste côté client au save (immédiateté).
//
// Pourquoi une Edge Function plutôt que le seul cron SQL (ora077_resolve_claims_cron.sql) :
// c'est le point d'accroche de la NOTIFICATION de résolution (ORA-078) — on pourra, après
// le passage en 'failed'/'succeeded', pousser un expo-notification (« ton claim a expiré »,
// « X a tenu son claim »). Tant qu'ORA-078 n'est pas fait, le cron SQL suffit.
//
// Déploiement :
//   supabase functions deploy resolve-claims --no-verify-jwt
// Planification (cron) — Dashboard → Edge Functions → resolve-claims → Schedules : "0 * * * *",
//   ou via pg_net (cf. doc Supabase « Scheduling Edge Functions »).
//
// Sécurité : SERVICE_ROLE est injecté AUTOMATIQUEMENT dans l'env d'exécution de la fonction
// par Supabase — il n'est JAMAIS écrit dans le repo (respecte la règle service_role, ORA-002).
//
// ⚠️ Prérequis : migration `claims_and_featured_pr.sql` (ORA-075) appliquée.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const nowIso = new Date().toISOString()

  // resolved_value = progress_current (valeur atteinte) → near-miss côté client (ORA-081).
  // supabase-js ne sait pas affecter une colonne à une autre dans un UPDATE → on lit puis
  // on écrit par lot (volume faible : ≤ 1 claim actif/user). Garde-fou status='active'
  // anti double-résolution (course possible avec le client au même instant).
  const { data: overdue, error: selErr } = await supabase
    .from('claims')
    .select('id, progress_current')
    .eq('status', 'active')
    .not('deadline', 'is', null)
    .lt('deadline', nowIso)

  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = (overdue ?? []) as Array<{ id: string; progress_current: number }>
  let resolved = 0
  for (const c of rows) {
    const { error: updErr } = await supabase
      .from('claims')
      .update({ status: 'failed', resolved_value: c.progress_current, resolved_at: nowIso })
      .eq('id', c.id)
      .eq('status', 'active')
    if (!updErr) resolved++
    // ORA-078 (futur) : ici, push « ton claim a expiré » à c.user_id.
  }

  return new Response(JSON.stringify({ scanned: rows.length, resolved }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
