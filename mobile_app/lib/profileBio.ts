// ─── lib/profileBio.ts — bio courte du profil (ORA-085) ───────────────────────
// Petite présentation libre affichée dans la tête de profil (espace à droite de
// l'avatar). Plafonnée à BIO_MAX caractères + espaces normalisés pour rester propre
// visuellement (l'aperçu profil n'affiche que 2 lignes).
//
// Lecture/écriture isolée + best-effort : la colonne users.bio n'existe qu'après la
// migration ora085_profile_bio.sql → un échec (colonne absente) renvoie null / false
// sans casser le profil (même pattern que getProfileNameFields / getFeaturedPhoto).

import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export const BIO_MAX = 70

// Normalise une bio saisie : espaces/sauts de ligne compressés en un seul espace, trim,
// puis coupe à BIO_MAX. Protège la mise en page compacte (pas de pavé multi-lignes).
export function sanitizeBio(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, BIO_MAX)
}

// Lecture isolée (HORS du select profil critique → pas de 400 pré-migration).
// Renvoie null si vide OU colonne absente.
export async function getProfileBio(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('users').select('bio').eq('id', userId).single()
    if (error || !data) return null
    const bio = (data as { bio: string | null }).bio
    return bio && bio.trim() ? bio : null
  } catch (e) {
    log.error('[profileBio] getProfileBio', e)
    return null
  }
}

// Écrit la bio (vide → NULL). Renvoie true si persisté (false pré-migration : colonne absente).
export async function saveProfileBio(userId: string, bio: string): Promise<boolean> {
  try {
    const clean = sanitizeBio(bio)
    const { error } = await supabase
      .from('users')
      .update({ bio: clean || null })
      .eq('id', userId)
    if (error) {
      log.error('[profileBio] saveProfileBio', error)
      return false
    }
    return true
  } catch (e) {
    log.error('[profileBio] saveProfileBio', e)
    return false
  }
}
