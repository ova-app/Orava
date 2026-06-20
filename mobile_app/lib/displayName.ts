// ─── lib/displayName.ts — nom décomposé + préférence d'affichage du profil ─────
// Le « nom complet » se saisit en deux champs (prénom + nom). On stocke first_name /
// last_name côté users, et on continue de maintenir full_name (concaténation) pour les
// lectures existantes (feed, profil). name_display = ce qui s'affiche en tête de profil.
//
// Lecture/écriture des nouvelles colonnes en requête ISOLÉE + best-effort : elles
// n'existent qu'après la migration `profile_name_fields.sql` → un échec (colonne absente)
// renvoie null / false sans casser le profil — même pattern que getManualFeaturedPr.

import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export type NameDisplay = 'full_name' | 'username'

export interface ProfileNameFields {
  first_name: string | null
  last_name: string | null
  name_display: NameDisplay
}

// ─── Logique pure (testée) ─────────────────────────────────────────────────────

// Décompose un nom complet : 1er mot = prénom, le reste = nom.
export function splitFullName(fullName: string | null): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

// Recompose full_name à partir de prénom + nom (champs vides ignorés).
export function joinFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

// Résout le libellé affiché en tête de profil selon la préférence (avec repli).
export function resolveDisplayName(
  pref: NameDisplay,
  fullName: string | null,
  username: string | null
): string {
  const full = (fullName ?? '').trim()
  const user = (username ?? '').trim()
  if (pref === 'username') return user || full || 'Athlète'
  return full || user || 'Athlète'
}

// ─── Lecture / écriture isolées (no-op pré-migration) ──────────────────────────

export async function getProfileNameFields(userId: string): Promise<ProfileNameFields | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('first_name, last_name, name_display')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    const d = data as {
      first_name: string | null
      last_name: string | null
      name_display: string | null
    }
    return {
      first_name: d.first_name,
      last_name: d.last_name,
      name_display: d.name_display === 'username' ? 'username' : 'full_name',
    }
  } catch (e) {
    log.error('[displayName] getProfileNameFields', e)
    return null
  }
}

// Écrit first_name / last_name / name_display. Renvoie true si persisté (false pré-migration).
export async function saveProfileNameFields(
  userId: string,
  fields: { firstName: string; lastName: string; nameDisplay: NameDisplay }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        first_name: fields.firstName.trim() || null,
        last_name: fields.lastName.trim() || null,
        name_display: fields.nameDisplay,
      })
      .eq('id', userId)
    if (error) {
      log.error('[displayName] saveProfileNameFields', error)
      return false
    }
    return true
  } catch (e) {
    log.error('[displayName] saveProfileNameFields', e)
    return false
  }
}
