// ORA-068 — logger centralisé conditionné par __DEV__.
// Dev : sortie console (visibilité). Prod : console silencieux + point d'ancrage UNIQUE
// pour brancher Sentry/PostHog (ORA-011) sans re-toucher chaque site d'appel.
/* eslint-disable no-console */

function emit(level: 'error' | 'warn' | 'log', args: unknown[]): void {
  if (__DEV__) {
    console[level](...args)
    return
  }
  // prod : TODO ORA-011 — remonter `args` vers Sentry/PostHog ici. No-op pour l'instant.
}

export const log = {
  error: (...args: unknown[]): void => emit('error', args),
  warn: (...args: unknown[]): void => emit('warn', args),
  info: (...args: unknown[]): void => emit('log', args),
}
