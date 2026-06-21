// ─── lib/feedSignal.ts — invalidation légère du cache de fraîcheur du feed ────────
// Le feed ne refetch que si ses données sont périmées (>20 s, ORA-067) pour ne pas
// marteler Supabase aux allers-retours entre tabs. Mais certaines actions faites
// AILLEURS (résoudre / abandonner un claim depuis le profil) doivent s'y refléter
// immédiatement. Ce drapeau module-scope, lu au focus du feed, force un refetch.

let dirty = false

// Marque le feed comme « à rafraîchir au prochain focus » (appelé après une mutation claim).
export function markFeedDirty(): void {
  dirty = true
}

// Lit et réarme le drapeau (true = un refetch forcé est dû). Consommation unique.
export function consumeFeedDirty(): boolean {
  const was = dirty
  dirty = false
  return was
}
