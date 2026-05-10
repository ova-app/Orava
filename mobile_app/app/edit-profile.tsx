import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'

export default function EditProfileScreen() {
  const { colors } = useTheme()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [dataNaissance, setDateNaissance] = useState('')
  const [poids, setPoids] = useState('')
  const [originalPoids, setOriginalPoids] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [profileRes, bodyRes] = await Promise.all([
      supabase.from('users').select('username, full_name, date_naissance').eq('id', user.id).single(),
      supabase.from('body_metrics').select('weight_kg').eq('user_id', user.id)
        .order('measured_at', { ascending: false }).limit(1),
    ])
    if (profileRes.data) {
      setUsername((profileRes.data as any).username ?? '')
      setFullName((profileRes.data as any).full_name ?? '')
      setDateNaissance((profileRes.data as any).date_naissance ?? '')
    }
    const p = String((bodyRes.data as any)?.[0]?.weight_kg ?? '')
    setPoids(p)
    setOriginalPoids(p)
    setLoading(false)
  }

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert('Champ requis', 'Le nom d\'utilisateur ne peut pas être vide.')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const updates: Record<string, any> = {
        username: username.trim(),
        full_name: fullName.trim() || null,
      }
      if (dataNaissance.trim()) updates.date_naissance = dataNaissance.trim()
      const { error } = await supabase.from('users').update(updates).eq('id', user.id)
      if (error) { Alert.alert('Erreur', error.message); return }
      const poidsNum = parseFloat(poids)
      if (!isNaN(poidsNum) && poids !== originalPoids) {
        await supabase.from('body_metrics').insert({ user_id: user.id, weight_kg: poidsNum })
        setOriginalPoids(poids)
      }
      router.back()
    } finally {
      setSaving(false)
    }
  }

  const c = colors

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: c.separator }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.textPrimary }]}>Modifier le profil</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Nom complet</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.card, borderColor: c.separator, color: c.textPrimary }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Prénom Nom"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Nom d'utilisateur</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.card, borderColor: c.separator, color: c.textPrimary }]}
            value={username}
            onChangeText={setUsername}
            placeholder="@username"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Date de naissance</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.card, borderColor: c.separator, color: c.textPrimary }]}
            value={dataNaissance}
            onChangeText={setDateNaissance}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={c.textSecondary}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Poids (kg)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.card, borderColor: c.separator, color: c.textPrimary }]}
            value={poids}
            onChangeText={setPoids}
            placeholder="75"
            placeholderTextColor={c.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: c.accent, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Enregistrer</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, fontWeight: '300', lineHeight: 30 },
  title: { fontSize: 18, fontWeight: '700' },
  form: { padding: 20, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16,
  },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})