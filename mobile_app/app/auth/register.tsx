import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography } from '@/constants/theme'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  email: string
  nomUtilisateur: string
  motDePasse: string
}

interface ErreurFormulaire {
  email?: string
  nomUtilisateur?: string
  motDePasse?: string
  global?: string
}

// ─── Logo SVG inline ─────────────────────────────────────────────────────────

function LogoOrava(): React.JSX.Element {
  return (
    <Svg width={64} height={64} viewBox="0 0 200 200">
      <Circle
        cx={100}
        cy={100}
        r={85}
        stroke="#FFDD00"
        strokeWidth={30}
        fill="none"
      />
      <Path
        d="M 100,44 L 145,153.6 A 70 70 0 0 1 55,153.6 Z"
        fill="#FFDD00"
      />
    </Svg>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RegisterScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    email: '',
    nomUtilisateur: '',
    motDePasse: '',
  })
  const [erreurs, setErreurs] = useState<ErreurFormulaire>({})
  const [chargement, setChargement] = useState<boolean>(false)
  const [motDePasseVisible, setMotDePasseVisible] = useState<boolean>(false)

  function validerFormulaire(): boolean {
    const nouvellesErreurs: ErreurFormulaire = {}
    if (!form.email.trim()) {
      nouvellesErreurs.email = 'Email requis'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nouvellesErreurs.email = 'Email invalide'
    }
    if (!form.nomUtilisateur.trim()) {
      nouvellesErreurs.nomUtilisateur = 'Nom d\'utilisateur requis'
    } else if (form.nomUtilisateur.trim().length < 3) {
      nouvellesErreurs.nomUtilisateur = '3 caractères minimum'
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.nomUtilisateur.trim())) {
      nouvellesErreurs.nomUtilisateur = 'Lettres, chiffres et _ uniquement'
    }
    if (!form.motDePasse) {
      nouvellesErreurs.motDePasse = 'Mot de passe requis'
    } else if (form.motDePasse.length < 8) {
      nouvellesErreurs.motDePasse = '8 caractères minimum'
    }
    setErreurs(nouvellesErreurs)
    return Object.keys(nouvellesErreurs).length === 0
  }

  async function creerCompte(): Promise<void> {
    if (!validerFormulaire()) return
    setChargement(true)
    setErreurs({})

    const { error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.motDePasse,
      options: {
        data: {
          username: form.nomUtilisateur.trim().toLowerCase(),
        },
      },
    })

    setChargement(false)

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        setErreurs({ email: 'Cet email est déjà utilisé.' })
      } else {
        setErreurs({ global: 'Erreur lors de la création du compte.' })
      }
      return
    }

    router.replace('/onboarding')
  }

  const styles = buildStyles(colors)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LogoOrava />
          <Text style={styles.wordmark}>ORAVA</Text>
          <Text style={styles.tagline}>Chaque séance devient une œuvre.</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>

          {/* Email */}
          <View style={styles.champGroupe}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={[styles.input, erreurs.email ? styles.inputErreur : null]}
              value={form.email}
              onChangeText={(v) => setForm(f => ({ ...f, email: v }))}
              placeholder="ton@email.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              accessibilityLabel="Champ email"
            />
            {erreurs.email ? (
              <Text style={styles.texteErreur}>{erreurs.email}</Text>
            ) : null}
          </View>

          {/* Nom utilisateur */}
          <View style={styles.champGroupe}>
            <Text style={styles.label}>NOM D'UTILISATEUR</Text>
            <TextInput
              style={[styles.input, erreurs.nomUtilisateur ? styles.inputErreur : null]}
              value={form.nomUtilisateur}
              onChangeText={(v) => setForm(f => ({ ...f, nomUtilisateur: v }))}
              placeholder="tonpseudo"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              accessibilityLabel="Champ nom d'utilisateur"
            />
            {erreurs.nomUtilisateur ? (
              <Text style={styles.texteErreur}>{erreurs.nomUtilisateur}</Text>
            ) : null}
          </View>

          {/* Mot de passe */}
          <View style={styles.champGroupe}>
            <Text style={styles.label}>MOT DE PASSE</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputAvecBouton,
                  erreurs.motDePasse ? styles.inputErreur : null,
                ]}
                value={form.motDePasse}
                onChangeText={(v) => setForm(f => ({ ...f, motDePasse: v }))}
                placeholder="8 caractères minimum"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!motDePasseVisible}
                textContentType="newPassword"
                accessibilityLabel="Champ mot de passe"
              />
              <Pressable
                style={styles.boutonVisibilite}
                onPress={() => setMotDePasseVisible(v => !v)}
                accessibilityLabel={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                hitSlop={8}
              >
                <Text style={styles.texteVisibilite}>
                  {motDePasseVisible ? 'Masquer' : 'Voir'}
                </Text>
              </Pressable>
            </View>
            {erreurs.motDePasse ? (
              <Text style={styles.texteErreur}>{erreurs.motDePasse}</Text>
            ) : null}
          </View>

          {/* Erreur globale */}
          {erreurs.global ? (
            <View style={styles.banniereErreur}>
              <Text style={styles.banniereErreurTexte}>{erreurs.global}</Text>
            </View>
          ) : null}

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaAppuye,
              chargement && styles.ctaDesactive,
            ]}
            onPress={creerCompte}
            disabled={chargement}
            accessibilityRole="button"
            accessibilityLabel="Créer mon compte"
          >
            {chargement ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.ctaTexte}>CRÉER MON COMPTE</Text>
            )}
          </Pressable>

          {/* Lien connexion */}
          <Pressable
            style={styles.lienConnexion}
            onPress={() => router.push('/auth/login')}
            accessibilityRole="link"
            accessibilityLabel="Se connecter"
          >
            <Text style={styles.lienTexte}>
              Déjà un compte ?{' '}
              <Text style={styles.lienAccent}>Se connecter</Text>
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.s6,
      paddingVertical: spacing.s12,
    },
    hero: {
      alignItems: 'center',
      marginBottom: spacing.s8,
    },
    wordmark: {
      ...typography.title,
      color: colors.textPrimary,
      letterSpacing: 6,
      marginTop: spacing.s2,
    },
    tagline: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.s2,
    },
    form: {
      gap: spacing.s5,
    },
    champGroupe: {
      gap: spacing.s1,
    },
    label: {
      ...typography.caption,
      color: colors.textTertiary,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    input: {
      height: 52,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.s4,
      ...typography.body,
      color: colors.textPrimary,
    },
    inputWrapper: {
      position: 'relative',
    },
    inputAvecBouton: {
      paddingRight: 72,
    },
    boutonVisibilite: {
      position: 'absolute',
      right: spacing.s4,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    texteVisibilite: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    inputErreur: {
      borderWidth: 1,
      borderColor: colors.error,
    },
    texteErreur: {
      ...typography.caption,
      color: colors.error,
      marginTop: spacing.s1,
    },
    banniereErreur: {
      backgroundColor: `${colors.error}18`,
      borderRadius: radius.md,
      padding: spacing.s3,
    },
    banniereErreurTexte: {
      ...typography.caption,
      color: colors.error,
      textAlign: 'center',
    },
    cta: {
      height: 64,
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.s2,
    },
    ctaAppuye: {
      opacity: 0.85,
    },
    ctaDesactive: {
      opacity: 0.6,
    },
    ctaTexte: {
      ...typography.body,
      fontFamily: 'Barlow_700Bold',
      color: colors.background,
      letterSpacing: 1,
    },
    lienConnexion: {
      alignItems: 'center',
      paddingVertical: spacing.s3,
    },
    lienTexte: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    lienAccent: {
      color: colors.textPrimary,
      fontFamily: 'Barlow_500Medium',
    },
  })
}
