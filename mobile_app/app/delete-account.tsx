import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, AlertTriangle } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, font } from '@/constants/theme'
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/storage'
import { log } from '@/lib/logger'

// ─── Suppression de compte (ORA-001) ───────────────────────────────────────────
// Apple Guideline 5.1.1(v) + RGPD art. 17. Friction intentionnelle (règle UX #6) :
// l'utilisateur tape « SUPPRIMER » pour confirmer. Le flux purge d'abord les blobs
// Storage (best-effort, tant qu'on est authentifié) puis appelle la RPC
// delete_account() qui efface toutes les données DB + le compte d'auth.

const CONFIRM_WORD = 'SUPPRIMER'
const STORAGE_BUCKETS = ['avatars', 'workout-photos'] as const

// Purge best-effort des fichiers Storage du dossier `${uid}/` avant la RPC.
async function purgeStorage(uid: string): Promise<void> {
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const { data } = await supabase.storage.from(bucket).list(uid)
      if (!data || data.length === 0) continue
      const paths = data.map((f) => `${uid}/${f.name}`)
      await supabase.storage.from(bucket).remove(paths)
    } catch (e) {
      log.error('[delete-account] purgeStorage', bucket, e)
    }
  }
}

const DELETED_ITEMS = [
  'Toutes tes séances, exercices et séries',
  'Tes records et signatures Myo',
  'Tes mesures de poids de corps',
  'Tes photos de séance et de profil',
  'Ton profil et ton compte',
]

export default function DeleteAccountScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const s = buildStyles(colors)

  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !loading

  async function handleDelete(): Promise<void> {
    if (!canDelete) return
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not authenticated')

      // 1. Purge des blobs Storage (best-effort, encore authentifié)
      await purgeStorage(user.id)

      // 2. Suppression DB + compte d'auth (transactionnel, RPC SECURITY DEFINER)
      const { error: rpcError } = await supabase.rpc('delete_account')
      if (rpcError) throw rpcError

      // 3. Nettoyage local + déconnexion
      try {
        storage.delete('workout_session_draft')
      } catch {
        // best-effort
      }
      await supabase.auth.signOut()

      router.replace('/auth/login')
    } catch (e) {
      log.error('[delete-account] handleDelete', e)
      setError('La suppression a échoué. Réessaie ou contacte le support.')
      setLoading(false)
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          disabled={loading}
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Supprimer mon compte</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + spacing.s10 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.warningBadge}>
          <AlertTriangle size={20} color={colors.error} strokeWidth={2} />
          <Text style={s.warningTitle}>Action irréversible</Text>
        </View>

        <Text style={s.lead}>
          La suppression de ton compte efface définitivement tes données. Cette action ne peut pas
          être annulée.
        </Text>

        <View style={s.list}>
          {DELETED_ITEMS.map((item) => (
            <View key={item} style={s.listRow}>
              <View style={s.bullet} />
              <Text style={s.listText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={s.hint}>
          Pour confirmer, écris <Text style={s.hintWord}>{CONFIRM_WORD}</Text> ci-dessous.
        </Text>

        <TextInput
          style={s.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="Champ de confirmation de suppression"
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          style={[s.deleteBtn, !canDelete && s.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={!canDelete}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDelete }}
          accessibilityLabel="Supprimer définitivement mon compte"
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <Text style={s.deleteBtnLabel}>Supprimer définitivement</Text>
          )}
        </Pressable>

        <Pressable
          style={s.cancelBtn}
          onPress={() => router.back()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Annuler"
        >
          <Text style={s.cancelLabel}>Annuler</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.s4,
      paddingTop: spacing.s2,
      paddingBottom: spacing.s4,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      ...typography.subtitle,
      fontFamily: font.bold,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerRight: {
      width: 44,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.s5,
      paddingTop: spacing.s2,
    },
    warningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s2,
      marginBottom: spacing.s4,
    },
    warningTitle: {
      ...typography.subtitle,
      fontFamily: font.bold,
      color: colors.error,
    },
    lead: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.s5,
    },
    list: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      padding: spacing.s4,
      gap: spacing.s3,
      marginBottom: spacing.s6,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s3,
    },
    bullet: {
      width: 5,
      height: 5,
      borderRadius: radius.full,
      backgroundColor: colors.error,
    },
    listText: {
      ...typography.body,
      color: colors.textPrimary,
      flex: 1,
    },
    hint: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.s3,
    },
    hintWord: {
      color: colors.textPrimary,
      fontFamily: font.bold,
    },
    input: {
      height: 52,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.s4,
      ...typography.body,
      color: colors.textPrimary,
      letterSpacing: 2,
    },
    error: {
      ...typography.caption,
      color: colors.error,
      marginTop: spacing.s3,
    },
    deleteBtn: {
      height: 52,
      backgroundColor: colors.error,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.s6,
    },
    deleteBtnDisabled: {
      opacity: 0.4,
    },
    deleteBtnLabel: {
      ...typography.body,
      fontFamily: font.bold,
      color: colors.textPrimary,
    },
    cancelBtn: {
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.s2,
    },
    cancelLabel: {
      ...typography.body,
      color: colors.textSecondary,
    },
  })
}
