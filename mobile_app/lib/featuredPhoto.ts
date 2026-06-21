// ─── lib/featuredPhoto.ts — photo épinglée de la vitrine ──────────────────────
// L'utilisateur peut épingler UNE photo de sa vitrine (curation = identité). Elle
// remonte en tête de vitrine. Tant qu'il n'a rien épinglé (users.featured_photo NULL),
// c'est la photo la plus récente qui fait foi (fallback côté client, pas ici).
//
// La vitrine mêle deux sources (séance + ajout manuel) → un seul pointeur user-level
// couvre les deux. Snapshot dénormalisé, matché par `id` (PhotoItem.id) au render.
//
// Lecture/écriture isolée + best-effort : la colonne featured_photo n'existe qu'après
// la migration ora084_featured_photo.sql → un échec (colonne absente) est silencieux
// (no-op pré-migration, même pattern que getManualFeaturedPr).

import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export interface FeaturedPhoto {
  id: string // = PhotoItem.id (workout id si séance, profile_photo id si ajout manuel)
  photo_url: string
  source: 'workout' | 'profile'
  workout_id: string | null // lien séance (source 'workout' uniquement)
}

// Lecture du pointeur épinglé (users.featured_photo). Isolée → reste HORS du select profil
// critique (sinon 400 pré-migration). Renvoie null si rien d'épinglé OU colonne absente.
export async function getFeaturedPhoto(userId: string): Promise<FeaturedPhoto | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('featured_photo')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return (data as { featured_photo: FeaturedPhoto | null }).featured_photo ?? null
  } catch (e) {
    log.error('[featuredPhoto] getFeaturedPhoto', e)
    return null
  }
}

// Épingle une photo (remplace le pin précédent — un seul actif). Renvoie true si l'écriture
// a réussi (false pré-migration : colonne absente → l'UI n'affiche pas de confirmation).
export async function pinFeaturedPhoto(photo: FeaturedPhoto): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('users').update({ featured_photo: photo }).eq('id', user.id)
  if (error) {
    log.error('[featuredPhoto] pinFeaturedPhoto', error)
    return false
  }
  return true
}

// Dé-épingle → retour à la photo la plus récente (fallback client). Met featured_photo à NULL.
export async function clearFeaturedPhoto(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('users').update({ featured_photo: null }).eq('id', user.id)
  if (error) {
    log.error('[featuredPhoto] clearFeaturedPhoto', error)
    return false
  }
  return true
}
