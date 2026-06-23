// ─── lib/dataExport.ts — export RGPD (portabilité, art. 20) ────────────────────
// Rassemble toutes les données de l'utilisateur courant en un JSON unique et le
// partage via le Share natif (zéro dépendance). Best-effort : une table absente ou
// une requête en échec n'empêche pas l'export du reste.
//
// Upgrade futur recommandé : expo-file-system + expo-sharing → écrire un .json sur
// disque et le partager comme fichier (meilleure UX pour les gros exports).

import { Share } from 'react-native'
import { supabase } from '@/lib/supabase'
import { log } from '@/lib/logger'

export interface ExportResult {
  ok: boolean
  dismissed?: boolean
}

export async function exportUserData(): Promise<ExportResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const uid = user.id

  // Chaque bloc est isolé : un échec (table absente, RLS) renvoie une valeur vide
  // sans interrompre l'export du reste.
  let account: unknown = null
  try {
    const { data } = await supabase.from('users').select('*').eq('id', uid).single()
    account = data ?? null
  } catch (e) {
    log.error('[dataExport] account', e)
  }

  let workouts: unknown[] = []
  try {
    const { data } = await supabase
      .from('workouts')
      .select('*, workout_exercises(*, workout_sets(*))')
      .eq('user_id', uid)
      .order('started_at', { ascending: false })
    workouts = data ?? []
  } catch (e) {
    log.error('[dataExport] workouts', e)
  }

  let bodyMetrics: unknown[] = []
  try {
    const { data } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', uid)
      .order('measured_at', { ascending: false })
    bodyMetrics = data ?? []
  } catch (e) {
    log.error('[dataExport] body_metrics', e)
  }

  let myoSignatures: unknown[] = []
  try {
    const { data } = await supabase
      .from('myo_signatures')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    myoSignatures = data ?? []
  } catch (e) {
    log.error('[dataExport] myo_signatures', e)
  }

  let claims: unknown[] = []
  try {
    const { data } = await supabase
      .from('claims')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    claims = data ?? []
  } catch (e) {
    log.error('[dataExport] claims', e)
  }

  const payload = {
    export_metadata: {
      generated_at: new Date().toISOString(),
      app: 'Ova',
      format: 'json',
      note: 'Export RGPD (portabilité, art. 20) — toutes les données associées à ton compte.',
    },
    account,
    workouts,
    body_metrics: bodyMetrics,
    myo_signatures: myoSignatures,
    claims,
  }

  const json = JSON.stringify(payload, null, 2)

  try {
    const res = await Share.share({ message: json }, { subject: 'Mes données Ova' })
    return {
      ok: res.action !== Share.dismissedAction,
      dismissed: res.action === Share.dismissedAction,
    }
  } catch (e) {
    log.error('[dataExport] share', e)
    return { ok: false }
  }
}
