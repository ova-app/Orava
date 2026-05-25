import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft, Calendar, AlertCircle } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, font } from '@/constants/theme'
import { inputRecipe, InputState } from '@/constants/recipes'
import RulerPicker from '@/components/RulerPicker'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileForm {
  username: string
  fullName: string
  dateNaissance: string
  poidsKg: string
  tailleCm: string
  ageLeBrut: string
  masseGrassePct: string
}

interface ProfileErrors {
  username?: string
  fullName?: string
  dateNaissance?: string
  poidsKg?: string
  tailleCm?: string
  ageLeBrut?: string
  masseGrassePct?: string
  global?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]} / ${parts[1]} / ${parts[0]}`
}

function parseDateInput(input: string): string {
  // Accepte dd/mm/yyyy ou dd / mm / yyyy → yyyy-mm-dd
  const cleaned = input.replace(/\s/g, '').replace(/\//g, '/')
  const parts = cleaned.split('/')
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return input
}

function getInitiales(fullName: string, username: string): string {
  if (fullName.trim()) {
    const words = fullName.trim().split(/\s+/)
    if (words.length >= 2) {
      return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
    }
    return words[0][0].toUpperCase()
  }
  if (username.trim()) {
    return username.trim().charAt(0).toUpperCase()
  }
  return '?'
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function EditProfileScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  const [form, setForm] = useState<ProfileForm>({
    username: '',
    fullName: '',
    dateNaissance: '',
    poidsKg: '',
    tailleCm: '',
    ageLeBrut: '',
    masseGrassePct: '',
  })
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [usernameFocused, setUsernameFocused] = useState<boolean>(false)
  const [fullNameFocused, setFullNameFocused] = useState<boolean>(false)
  const [poidsKgFocused, setPoidsKgFocused] = useState<boolean>(false)
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false)
  const dateInputRef = useRef<TextInput>(null)
  const [rulerMode, setRulerMode] = useState<string | null>(null)

  // ─── Load profil existant ──────────────────────────────────────────────────

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/auth/login')
          return
        }
        setUserId(user.id)

        const { data, error } = await supabase
          .from('users')
          .select('username, full_name, avatar_url, date_naissance')
          .eq('id', user.id)
          .single()

        if (error) throw error

        // Récupérer dernier poids
        const { data: metricsData } = await supabase
          .from('body_metrics')
          .select('weight_kg')
          .eq('user_id', user.id)
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        setAvatarUrl(data.avatar_url ?? null)
        const dataAny = data as any
        setForm({
          username: data.username ?? '',
          fullName: data.full_name ?? '',
          dateNaissance: data.date_naissance
            ? formatDateForDisplay(data.date_naissance)
            : '',
          poidsKg: metricsData?.weight_kg ? String(metricsData.weight_kg) : '',
          tailleCm: dataAny?.taille_cm ? String(dataAny.taille_cm) : '',
          ageLeBrut: dataAny?.age ? String(dataAny.age) : '',
          masseGrassePct: dataAny?.masse_grasse_pct ? String(dataAny.masse_grasse_pct) : '',
        })
      } catch {
        setErrors({ global: 'Impossible de charger le profil.' })
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [router])

  // ─── Validation ───────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: ProfileErrors = {}

    if (!form.username.trim()) {
      newErrors.username = "Nom d'utilisateur requis"
    } else if (form.username.length < 3) {
      newErrors.username = 'Minimum 3 caractères'
    }

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Nom complet requis'
    }

    if (form.poidsKg) {
      const poids = parseFloat(form.poidsKg)
      if (isNaN(poids) || poids < 20 || poids > 500) {
        newErrors.poidsKg = 'Poids invalide (20–500 kg)'
      }
    }

    if (form.tailleCm) {
      const taille = parseFloat(form.tailleCm)
      if (isNaN(taille) || taille < 100 || taille > 220) {
        newErrors.tailleCm = 'Taille invalide (100–220 cm)'
      }
    }

    if (form.ageLeBrut) {
      const age = parseFloat(form.ageLeBrut)
      if (isNaN(age) || age < 10 || age > 100) {
        newErrors.ageLeBrut = 'Âge invalide (10–100 ans)'
      }
    }

    if (form.masseGrassePct) {
      const mg = parseFloat(form.masseGrassePct)
      if (isNaN(mg) || mg < 5 || mg > 50) {
        newErrors.masseGrassePct = 'Masse grasse invalide (5–50%)'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function saveProfile(): Promise<void> {
    if (!validate() || !userId) return
    setSaving(true)
    setErrors({})

    try {
      const isoDate = form.dateNaissance
        ? parseDateInput(form.dateNaissance)
        : null

      const tailleCmNum = form.tailleCm ? parseInt(form.tailleCm, 10) : null
      const ageNum = form.ageLeBrut ? parseInt(form.ageLeBrut, 10) : null
      const masseGrassaPctNum = form.masseGrassePct ? parseFloat(form.masseGrassePct) : null

      const { error: userError } = await supabase
        .from('users')
        .update({
          username: form.username.trim(),
          full_name: form.fullName.trim(),
          date_naissance: isoDate,
          taille_cm: tailleCmNum,
          age: ageNum,
          masse_grasse_pct: masseGrassaPctNum,
        })
        .eq('id', userId)

      if (userError) throw userError

      if (form.poidsKg) {
        const poidsNum = parseFloat(form.poidsKg)
        if (!isNaN(poidsNum)) {
          const { error: metricsError } = await supabase
            .from('body_metrics')
            .insert({
              user_id: userId,
              weight_kg: poidsNum,
              measured_at: new Date().toISOString(),
            })
          if (metricsError) throw metricsError
        }
      }

      router.back()
    } catch {
      setErrors({ global: 'Erreur lors de la sauvegarde.' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Avatar picker ────────────────────────────────────────────────────────

  async function pickAvatar(): Promise<void> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setAvatarUrl(result.assets[0].uri)
    }
  }

  async function seDeconnecter(): Promise<void> {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  const s = buildStyles(colors)
  const initiales = getInitiales(form.fullName, form.username)

  if (loading) {
    return (
      <View style={[s.root, s.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Mon profil</Text>
        <Pressable
          style={s.saveBtn}
          onPress={() => void saveProfile()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Sauvegarder"
        >
          {saving ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text style={s.saveBtnLabel}>Sauvegarder</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Avatar ── */}
        <View style={s.avatarSection}>
          <Pressable
            style={s.avatarWrap}
            onPress={() => void pickAvatar()}
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{initiales}</Text>
              </View>
            )}
          </Pressable>
          <Text style={s.avatarChangeLabel}>Changer la photo</Text>
        </View>

        {/* ── Erreur globale ── */}
        {errors.global ? (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>{errors.global}</Text>
          </View>
        ) : null}

        {/* ── Champs ── */}
        <View style={s.form}>

          {/* Nom d'utilisateur */}
          {(() => {
            const state: InputState =
              errors.username ? 'error' :
              usernameFocused ? 'active' :
              form.username.length > 0 ? 'filled' : 'default'
            const r = inputRecipe(state, colors)
            return (
              <View style={s.fieldGroup}>
                <Text style={r.label}>NOM D&apos;UTILISATEUR</Text>
                <View style={r.container}>
                  <TextInput
                    style={r.input}
                    value={form.username}
                    onChangeText={(v) => setForm(f => ({ ...f, username: v }))}
                    onFocus={() => setUsernameFocused(true)}
                    onBlur={() => setUsernameFocused(false)}
                    placeholder="@tonpseudo"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                    accessibilityLabel="Nom d'utilisateur"
                  />
                  {errors.username ? (
                    <View style={r.icon}>
                      <AlertCircle size={16} color={colors.error} strokeWidth={2} />
                    </View>
                  ) : null}
                </View>
                {errors.username ? (
                  <Text style={r.helper}>{errors.username}</Text>
                ) : null}
              </View>
            )
          })()}

          {/* Nom complet */}
          {(() => {
            const state: InputState =
              errors.fullName ? 'error' :
              fullNameFocused ? 'active' :
              form.fullName.length > 0 ? 'filled' : 'default'
            const r = inputRecipe(state, colors)
            return (
              <View style={s.fieldGroup}>
                <Text style={r.label}>NOM COMPLET</Text>
                <View style={r.container}>
                  <TextInput
                    style={r.input}
                    value={form.fullName}
                    onChangeText={(v) => setForm(f => ({ ...f, fullName: v }))}
                    onFocus={() => setFullNameFocused(true)}
                    onBlur={() => setFullNameFocused(false)}
                    placeholder="Prénom Nom"
                    placeholderTextColor={colors.textTertiary}
                    textContentType="name"
                    accessibilityLabel="Nom complet"
                  />
                  {errors.fullName ? (
                    <View style={r.icon}>
                      <AlertCircle size={16} color={colors.error} strokeWidth={2} />
                    </View>
                  ) : null}
                </View>
                {errors.fullName ? (
                  <Text style={r.helper}>{errors.fullName}</Text>
                ) : null}
              </View>
            )
          })()}

          {/* Date de naissance */}
          {(() => {
            const state: InputState =
              errors.dateNaissance ? 'error' :
              datePickerOpen ? 'active' :
              form.dateNaissance.length > 0 ? 'filled' : 'default'
            const r = inputRecipe(state, colors)
            return (
              <View style={s.fieldGroup}>
                <Text style={r.label}>DATE DE NAISSANCE</Text>
                {datePickerOpen ? (
                  <View style={r.container}>
                    <TextInput
                      ref={dateInputRef}
                      style={r.input}
                      value={form.dateNaissance}
                      onChangeText={(v) => setForm(f => ({ ...f, dateNaissance: v }))}
                      onBlur={() => {
                        setDatePickerOpen(false)
                      }}
                      placeholder="jj / mm / aaaa"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={14}
                      autoFocus
                      accessibilityLabel="Date de naissance"
                    />
                    <View style={r.icon}>
                      {errors.dateNaissance ? (
                        <AlertCircle size={16} color={colors.error} strokeWidth={2} />
                      ) : (
                        <Calendar size={16} color={colors.accent} strokeWidth={1.5} />
                      )}
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={[r.container, s.dateDisplayRow]}
                    onPress={() => setDatePickerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Date de naissance, appuyez pour modifier"
                  >
                    <Text style={[r.input, form.dateNaissance ? s.dateValueText : s.datePlaceholderText]}>
                      {form.dateNaissance || 'jj / mm / aaaa'}
                    </Text>
                    <View style={r.icon}>
                      {errors.dateNaissance ? (
                        <AlertCircle size={16} color={colors.error} strokeWidth={2} />
                      ) : (
                        <Calendar size={16} color={colors.textTertiary} strokeWidth={1.5} />
                      )}
                    </View>
                  </Pressable>
                )}
                {errors.dateNaissance ? (
                  <Text style={r.helper}>{errors.dateNaissance}</Text>
                ) : null}
              </View>
            )
          })()}

          {/* Poids */}
          <View style={s.fieldGroup}>
            <Text style={[inputRecipe('default', colors).label]}>POIDS</Text>
            {rulerMode === 'poids' ? (
              <View style={s.rulerContainer}>
                <RulerPicker
                  value={form.poidsKg ? parseFloat(form.poidsKg) : 70}
                  min={20}
                  max={200}
                  step={0.5}
                  unit="kg"
                  onChange={(v) => setForm(f => ({ ...f, poidsKg: String(v) }))}
                  colors={colors}
                />
                <Pressable
                  onPress={() => setRulerMode(null)}
                  style={s.rulerDoneBtn}
                >
                  <Text style={s.rulerDoneBtnText}>Valider</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[inputRecipe(errors.poidsKg ? 'error' : form.poidsKg ? 'filled' : 'default', colors).container, s.rulerPressable]}
                onPress={() => setRulerMode('poids')}
              >
                <Text style={[inputRecipe(form.poidsKg ? 'filled' : 'default', colors).input, form.poidsKg ? { color: colors.textPrimary } : { color: colors.textTertiary }]}>
                  {form.poidsKg || '70'} kg
                </Text>
              </Pressable>
            )}
            {errors.poidsKg ? (
              <Text style={inputRecipe('error', colors).helper}>{errors.poidsKg}</Text>
            ) : null}
          </View>

          {/* Taille */}
          <View style={s.fieldGroup}>
            <Text style={[inputRecipe('default', colors).label]}>TAILLE</Text>
            {rulerMode === 'taille' ? (
              <View style={s.rulerContainer}>
                <RulerPicker
                  value={form.tailleCm ? parseFloat(form.tailleCm) : 170}
                  min={100}
                  max={220}
                  step={1}
                  unit="cm"
                  onChange={(v) => setForm(f => ({ ...f, tailleCm: String(v) }))}
                  colors={colors}
                />
                <Pressable
                  onPress={() => setRulerMode(null)}
                  style={s.rulerDoneBtn}
                >
                  <Text style={s.rulerDoneBtnText}>Valider</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[inputRecipe(errors.tailleCm ? 'error' : form.tailleCm ? 'filled' : 'default', colors).container, s.rulerPressable]}
                onPress={() => setRulerMode('taille')}
              >
                <Text style={[inputRecipe(form.tailleCm ? 'filled' : 'default', colors).input, form.tailleCm ? { color: colors.textPrimary } : { color: colors.textTertiary }]}>
                  {form.tailleCm || '170'} cm
                </Text>
              </Pressable>
            )}
            {errors.tailleCm ? (
              <Text style={inputRecipe('error', colors).helper}>{errors.tailleCm}</Text>
            ) : null}
          </View>

          {/* Âge */}
          <View style={s.fieldGroup}>
            <Text style={[inputRecipe('default', colors).label]}>ÂGE</Text>
            {rulerMode === 'age' ? (
              <View style={s.rulerContainer}>
                <RulerPicker
                  value={form.ageLeBrut ? parseFloat(form.ageLeBrut) : 25}
                  min={10}
                  max={100}
                  step={1}
                  unit="ans"
                  onChange={(v) => setForm(f => ({ ...f, ageLeBrut: String(v) }))}
                  colors={colors}
                />
                <Pressable
                  onPress={() => setRulerMode(null)}
                  style={s.rulerDoneBtn}
                >
                  <Text style={s.rulerDoneBtnText}>Valider</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[inputRecipe(errors.ageLeBrut ? 'error' : form.ageLeBrut ? 'filled' : 'default', colors).container, s.rulerPressable]}
                onPress={() => setRulerMode('age')}
              >
                <Text style={[inputRecipe(form.ageLeBrut ? 'filled' : 'default', colors).input, form.ageLeBrut ? { color: colors.textPrimary } : { color: colors.textTertiary }]}>
                  {form.ageLeBrut || '25'} ans
                </Text>
              </Pressable>
            )}
            {errors.ageLeBrut ? (
              <Text style={inputRecipe('error', colors).helper}>{errors.ageLeBrut}</Text>
            ) : null}
          </View>

          {/* Masse grasse */}
          <View style={s.fieldGroup}>
            <Text style={[inputRecipe('default', colors).label]}>MASSE GRASSE</Text>
            {rulerMode === 'mg' ? (
              <View style={s.rulerContainer}>
                <RulerPicker
                  value={form.masseGrassePct ? parseFloat(form.masseGrassePct) : 20}
                  min={5}
                  max={50}
                  step={0.5}
                  unit="%"
                  onChange={(v) => setForm(f => ({ ...f, masseGrassePct: String(v) }))}
                  colors={colors}
                />
                <Pressable
                  onPress={() => setRulerMode(null)}
                  style={s.rulerDoneBtn}
                >
                  <Text style={s.rulerDoneBtnText}>Valider</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[inputRecipe(errors.masseGrassePct ? 'error' : form.masseGrassePct ? 'filled' : 'default', colors).container, s.rulerPressable]}
                onPress={() => setRulerMode('mg')}
              >
                <Text style={[inputRecipe(form.masseGrassePct ? 'filled' : 'default', colors).input, form.masseGrassePct ? { color: colors.textPrimary } : { color: colors.textTertiary }]}>
                  {form.masseGrassePct || '20'} %
                </Text>
              </Pressable>
            )}
            {errors.masseGrassePct ? (
              <Text style={inputRecipe('error', colors).helper}>{errors.masseGrassePct}</Text>
            ) : null}
          </View>

        </View>

        {/* ── Déconnexion ── */}
        <Pressable
          style={({ pressed }) => [s.deconnexionBtn, pressed && { opacity: 0.6 }]}
          onPress={() => void seDeconnecter()}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
        >
          <Text style={s.deconnexionText}>Déconnexion</Text>
        </Pressable>

        <View style={s.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.s4,
      paddingTop: spacing.s12,
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
    saveBtn: {
      height: 44,
      justifyContent: 'center',
      alignItems: 'flex-end',
      minWidth: 44,
    },
    saveBtnLabel: {
      ...typography.body,
      fontFamily: font.bold,
      color: colors.accent,
    },

    // ── Scroll ──
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.s4,
    },

    // ── Avatar ──
    avatarSection: {
      alignItems: 'center',
      paddingTop: spacing.s6,
      paddingBottom: spacing.s4,
    },
    avatarWrap: {
      marginBottom: spacing.s2,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      ...typography.title,
      color: colors.accent,
    },
    avatarChangeLabel: {
      ...typography.caption,
      color: colors.accent,
      marginTop: spacing.s2,
    },

    // ── Error ──
    errorBanner: {
      backgroundColor: `${colors.error}18`,
      borderRadius: radius.md,
      padding: spacing.s3,
      marginBottom: spacing.s4,
    },
    errorBannerText: {
      ...typography.caption,
      color: colors.error,
      textAlign: 'center',
    },

    // ── Form ──
    form: {
      gap: spacing.s4,
    },
    fieldGroup: {
      gap: spacing.s2,
    },
    inputUnit: {
      ...typography.body,
      fontFamily: font.bold,
      color: colors.textSecondary,
    },
    fieldNote: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.s3,
    },
    fieldNoteAccent: {
      color: colors.accent,
    },

    // ── RulerPicker ──
    rulerPressable: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rulerContainer: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      padding: spacing.s5,
      gap: spacing.s4,
    },
    rulerDoneBtn: {
      backgroundColor: colors.accent,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rulerDoneBtnText: {
      ...typography.body,
      fontFamily: font.bold,
      color: colors.background,
    },

    // ── Date display ──
    dateDisplayRow: {
      // Pressable reprend le style container de inputRecipe — juste curseur implicite
    },
    dateValueText: {
      ...typography.body,
      color: colors.textPrimary,
      flex: 1,
      paddingVertical: spacing.s3,
    },
    datePlaceholderText: {
      ...typography.body,
      color: colors.textTertiary,
      flex: 1,
      paddingVertical: spacing.s3,
    },

    // ── Déconnexion ──
    deconnexionBtn: {
      alignItems: 'center',
      paddingVertical: spacing.s5,
      marginTop: spacing.s8,
      minHeight: 52,
      justifyContent: 'center',
    },
    deconnexionText: {
      ...typography.body,
      color: colors.textTertiary,
    },

    bottomPad: {
      height: spacing.s12,
    },
  })
}
