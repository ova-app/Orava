import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { spacing, typography, font } from '@/constants/theme'

// ─── Politique de confidentialité (ORA-003) ────────────────────────────────────
// Données de santé (art. 9 RGPD) : l'app traite des données d'entraînement (volumes,
// charges, poids de corps) = catégorie spéciale. Base légale = consentement explicite
// recueilli à l'inscription. Écran accessible depuis register.tsx + settings.tsx.
// ⚠️ Gabarit produit — à faire valider juridiquement avant publication store.

interface Section {
  title: string
  body: string
}

const LAST_UPDATE = '23 juin 2026'

const SECTIONS: Section[] = [
  {
    title: '1. Responsable du traitement',
    body: "Ova (« nous ») exploite l'application Ova. Pour toute question relative à tes données, contacte-nous à privacy@ova.app.",
  },
  {
    title: '2. Données collectées',
    body: "Compte : email, nom d'utilisateur, nom (facultatif), date de naissance (facultatif), photo de profil. Entraînement : séances, exercices, séries (poids, répétitions, repos), records, signatures Myo. Mesures corporelles : poids de corps. Usage : géolocalisation de la salle (facultatif), photos de séance (facultatif).",
  },
  {
    title: '3. Données de santé (article 9 RGPD)',
    body: "Tes volumes d'entraînement, charges et mesures corporelles constituent des données relatives à la santé, une catégorie particulière de données. Nous ne les traitons que sur la base de ton consentement explicite, recueilli à l'inscription. Tu peux retirer ce consentement à tout moment en supprimant ton compte.",
  },
  {
    title: '4. Finalités',
    body: 'Tes données servent à : enregistrer et afficher tes séances, calculer tes records et ta signature Myo, alimenter le fil social (uniquement pour les séances que tu rends publiques), et estimer tes prédictions de progression (calcul sur ton appareil).',
  },
  {
    title: '5. Statistiques d’usage (analytics)',
    body: "Nous utilisons PostHog (hébergement UE) pour comprendre l'usage de l'app et l'améliorer. Cette collecte est DÉSACTIVÉE par défaut : elle n'a lieu que si tu l'actives dans Réglages › Confidentialité. Aucune donnée d'entraînement n'est envoyée à des fins publicitaires.",
  },
  {
    title: '6. Partage',
    body: "Tes séances sont privées par défaut. Une séance n'apparaît dans le fil que si tu la rends publique. Nous ne vendons jamais tes données. Sous-traitants techniques : Supabase (hébergement UE) et PostHog (analytics UE, sur opt-in).",
  },
  {
    title: '7. Conservation',
    body: 'Tes données sont conservées tant que ton compte est actif. À la suppression du compte, elles sont effacées de façon irréversible (séances, mesures, signatures, photos, compte).',
  },
  {
    title: '8. Tes droits',
    body: "Tu disposes des droits d'accès, de rectification, d'effacement, de portabilité et d'opposition. Depuis l'app : exporte tes données (Réglages › Confidentialité › Exporter mes données) et supprime ton compte (Réglages › Compte › Supprimer mon compte). Pour les autres droits, écris à privacy@ova.app.",
  },
  {
    title: '9. Sécurité',
    body: 'Tes données transitent chiffrées (HTTPS) et sont protégées par des règles d’accès au niveau de chaque ligne (RLS). Ta session est stockée dans le coffre sécurisé du téléphone.',
  },
]

export default function PrivacyScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const s = buildStyles(colors)

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Confidentialité</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + spacing.s10 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>
          Cette politique explique quelles données Ova traite, pourquoi, et comment exercer tes
          droits. Ova traite des données de santé : lis attentivement la section 3.
        </Text>
        <Text style={s.updated}>Dernière mise à jour : {LAST_UPDATE}</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionBody}>{section.body}</Text>
          </View>
        ))}
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
    intro: {
      ...typography.body,
      color: colors.textSecondary,
    },
    updated: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.s2,
      marginBottom: spacing.s6,
    },
    section: {
      marginBottom: spacing.s6,
    },
    sectionTitle: {
      ...typography.subtitle,
      fontFamily: font.bold,
      color: colors.textPrimary,
      marginBottom: spacing.s2,
    },
    sectionBody: {
      ...typography.body,
      color: colors.textSecondary,
    },
  })
}
