// npm install three @types/three
// expo-gl ships with Expo SDK — no extra install needed

import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, ActivityIndicator,
  TouchableOpacity, PanResponder, Animated,
} from 'react-native'
import { GLView } from 'expo-gl'
import * as THREE from 'three'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import Svg, { Path, Circle } from 'react-native-svg'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OrbSig {
  z_volume: number; z_intensite: number; z_structure: number
  z_recovery: number; z_performance: number; z_regularite: number
  score: number; z_extended: Record<string, number>; workout_title: string
}

interface FamilyNode {
  id: string; label: string; color: string
  theta: number; phi: number; famZ: number
  vars: Array<{ key: string; label: string; z: number }>
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window')
const SIZE = Math.min(SW - 32, 400)
const CX = SIZE / 2

const VAR_LABELS: Record<string, string> = {
  volume_kg: 'Volume', densite: 'Densité', charge_relative: 'Charge rel.',
  max_1rm_kg: '1RM max', nb_series: 'Séries', nb_exercices: 'Exercices',
  recuperation: 'Récup.', temps_repos_moy_sec: 'Repos moy.',
  nb_pr: 'PRs', mean_evolution_volume: 'Évolution',
  streak: 'Streak', frequence_hebdo: 'Fréquence',
  nb_muscles: 'Muscles', hhi_muscles: 'Répartition', share_dominant: 'Dominant',
  duree_sec: 'Durée', ratio_actif: 'Ratio actif',
}

const GROUPS: Array<{ id: string; label: string; color: string; zKeys: string[] }> = [
  { id: 'volume',       label: 'Volume',    color: '#D85A30', zKeys: ['volume_kg'] },
  { id: 'intensite',    label: 'Intensité', color: '#FAC775', zKeys: ['densite', 'charge_relative', 'max_1rm_kg'] },
  { id: 'structure',    label: 'Structure', color: '#9B59B6', zKeys: ['nb_series', 'nb_exercices'] },
  { id: 'recuperation', label: 'Récup.',    color: '#50C878', zKeys: ['recuperation', 'temps_repos_moy_sec'] },
  { id: 'performance',  label: 'Perf.',     color: '#4A9EFF', zKeys: ['nb_pr', 'mean_evolution_volume'] },
  { id: 'regularite',   label: 'Constance', color: '#FF9800', zKeys: ['streak', 'frequence_hebdo'] },
  { id: 'muscles',      label: 'Muscles',   color: '#00BCD4', zKeys: ['nb_muscles', 'hhi_muscles', 'share_dominant'] },
  { id: 'temps',        label: 'Durée',     color: '#E91E63', zKeys: ['duree_sec', 'ratio_actif'] },
]

const NODE_PHI = GROUPS.map((_, i) => i % 2 === 0 ? Math.PI * 0.38 : Math.PI * 0.62)

// ─── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo = -3, hi = 3): number {
  return Math.max(lo, Math.min(hi, isFinite(v) ? v : 0))
}

function buildFamilyNodes(sig: OrbSig): FamilyNode[] {
  const coreZ: Record<string, number> = {
    volume_kg: sig.z_volume, densite: sig.z_intensite,
    nb_series: sig.z_structure, recuperation: sig.z_recovery,
    nb_pr: sig.z_performance, streak: sig.z_regularite,
  }
  const allZ = { ...coreZ, ...sig.z_extended }
  return GROUPS.map((g, i) => {
    const zVals = g.zKeys.map(k => clamp(allZ[k] ?? 0))
    const famZ  = zVals.reduce((a, b) => a + b, 0) / zVals.length
    return {
      id: g.id, label: g.label, color: g.color,
      theta: (i / GROUPS.length) * 2 * Math.PI,
      phi: NODE_PHI[i], famZ,
      vars: g.zKeys.map((k, vi) => ({ key: k, label: VAR_LABELS[k] ?? k, z: zVals[vi] })),
    }
  })
}

// ─── Blob geometry — metaball field displaced icosphere ────────────────────────
//     Fallback when MarchingCubes import is unavailable

function buildBlobGeometry(nodes: FamilyNode[]): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, 6)
  const pos = geo.attributes.position.array as Float32Array

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2]
    const len = Math.sqrt(x * x + y * y + z * z) || 1
    const nx = x / len, ny = y / len, nz = z / len

    let field = 0
    for (const n of nodes) {
      const ax = Math.sin(n.phi) * Math.cos(n.theta)
      const ay = -Math.cos(n.phi)
      const az = Math.sin(n.phi) * Math.sin(n.theta)
      const d2 = (nx - ax) ** 2 + (ny - ay) ** 2 + (nz - az) ** 2
      const t  = Math.max(0, (n.famZ + 3) / 6)
      field += t * 0.55 / (d2 + 0.045)
    }

    const scale = 1.0 + Math.min(0.48, field * 0.068)
    pos[i] = nx * scale; pos[i + 1] = ny * scale; pos[i + 2] = nz * scale
  }

  geo.attributes.position.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}


// ─── Studio lighting — Matte White Ceramic ────────────────────────────────────

function addStudioLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.28))

  // Key — warm, top-front-right
  const key = new THREE.DirectionalLight(0xfff6ee, 2.4)
  key.position.set(3.5, 5, 4)
  scene.add(key)

  // Fill — cool, left
  const fill = new THREE.DirectionalLight(0xdde6ff, 0.52)
  fill.position.set(-5, 1, 2)
  scene.add(fill)

  // Rim — top-back (separates ceramic from background)
  const rim = new THREE.DirectionalLight(0xffffff, 1.0)
  rim.position.set(-1, 6, -6)
  scene.add(rim)

  // Ground bounce — warm subtle
  const ground = new THREE.DirectionalLight(0xffe8d8, 0.16)
  ground.position.set(0, -4, 1)
  scene.add(ground)
}

// ─── Score arc ────────────────────────────────────────────────────────────────

const ARC_SZ = 72, ARC_CX = 36, ARC_CY = 36, ARC_R = 27
const A0 = 150 * Math.PI / 180, ASWEEP = 240 * Math.PI / 180

function arcPath(cx: number, cy: number, r: number, a0: number, sweep: number): string {
  const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0)
  const ex = cx + r * Math.cos(a0 + sweep), ey = cy + r * Math.sin(a0 + sweep)
  return `M${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${ex.toFixed(2)},${ey.toFixed(2)}`
}

function ScoreArc({ score }: { score: number }) {
  const pct   = Math.max(0, Math.min(100, score)) / 100
  const color = pct >= 0.66 ? '#FAC775' : pct >= 0.33 ? '#D85A30' : '#8E8E93'
  return (
    <View style={{ width: ARC_SZ, height: ARC_SZ }}>
      <Svg width={ARC_SZ} height={ARC_SZ}>
        <Path d={arcPath(ARC_CX, ARC_CY, ARC_R, A0, ASWEEP)}
          stroke="#ffffff14" strokeWidth={4.5} fill="none" strokeLinecap="round" />
        {pct > 0.01 && (
          <Path d={arcPath(ARC_CX, ARC_CY, ARC_R, A0, ASWEEP * pct)}
            stroke={color} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        )}
        <Circle cx={ARC_CX} cy={ARC_CY} r={10} fill={color} opacity={0.07} />
        <Circle cx={ARC_CX} cy={ARC_CY} r={3}  fill={color} opacity={0.22} />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={st.arcCenter}>
          <Text style={[st.arcNum, { color: '#fff' }]}>{Math.round(score)}</Text>
          <Text style={st.arcLabel}>MYO</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyoOrbScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()

  const [sig, setSig]           = useState<OrbSig | null>(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [, setFrame]            = useState(0)

  const fadeAnim    = useRef(new Animated.Value(0)).current
  const detailAnim  = useRef(new Animated.Value(0)).current
  const nodesRef    = useRef<FamilyNode[]>([])
  const meshRef     = useRef<THREE.Object3D | null>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const disposeRef  = useRef<(() => void) | null>(null)
  const ryRef       = useRef(0)
  const isInteract  = useRef(false)
  const lastXRef    = useRef(0)
  const selectedRef = useRef<string | null>(null)
  const projRef     = useRef<Array<{ id: string; sx: number; sy: number }>>([])
  const tapOrigin   = useRef({ x: 0, y: 0 })

  useEffect(() => () => { disposeRef.current?.() }, [])

  function selectFamily(fid: string | null) {
    selectedRef.current = fid
    setSelected(fid)
    Animated.spring(detailAnim, {
      toValue: fid ? 1 : 0, useNativeDriver: true, tension: 80, friction: 12,
    }).start()
  }

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e, gs) => {
      isInteract.current = true
      lastXRef.current   = gs.moveX
      tapOrigin.current  = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
    },
    onPanResponderMove: (_, gs) => {
      const dx = gs.moveX - lastXRef.current
      lastXRef.current = gs.moveX
      ryRef.current   -= dx * 0.005
      if (meshRef.current) meshRef.current.rotation.y = ryRef.current
      setFrame(f => f + 1)
    },
    onPanResponderRelease: (_, gs) => {
      isInteract.current = false
      if (Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
        const { x, y } = tapOrigin.current
        let best: string | null = null, minD = Infinity
        for (const p of projRef.current) {
          const d = Math.hypot(p.sx - x, p.sy - y)
          if (d < 38 && d < minD) { minD = d; best = p.id }
        }
        selectFamily(best && best !== selectedRef.current ? best : null)
      }
    },
    onPanResponderTerminate: () => { isInteract.current = false },
  })).current

  useEffect(() => { if (id) loadSig(id) }, [id])

  async function loadSig(wid: string) {
    const [sigRes, wRes] = await Promise.all([
      supabase.from('myo_signatures')
        .select('z_volume,z_intensite,z_structure,z_recovery,z_performance,z_regularite,score,z_extended')
        .eq('workout_id', wid).maybeSingle(),
      supabase.from('workouts').select('title').eq('id', wid).maybeSingle(),
    ])
    if (!sigRes.data) { setLoading(false); return }
    const s = sigRes.data as any
    const loaded: OrbSig = {
      z_volume: s.z_volume ?? 0, z_intensite: s.z_intensite ?? 0,
      z_structure: s.z_structure ?? 0, z_recovery: s.z_recovery ?? 0,
      z_performance: s.z_performance ?? 0, z_regularite: s.z_regularite ?? 0,
      score: s.score ?? 50, z_extended: s.z_extended ?? {},
      workout_title: (wRes.data as any)?.title ?? 'Séance',
    }
    nodesRef.current = buildFamilyNodes(loaded)
    setSig(loaded)
    setLoading(false)
    Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }).start()
  }

  function onContextCreate(gl: any) {
    const nodes = nodesRef.current
    if (!nodes.length) { console.warn('[MYO] no nodes'); return }

    const W = gl.drawingBufferWidth
    const H = gl.drawingBufferHeight

    // Canvas proxy — do NOT include getContext, Three.js uses context: gl directly
    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: W, height: H, style: {},
        clientWidth: W, clientHeight: H,
        addEventListener: () => {}, removeEventListener: () => {},
      } as any,
      context: gl as any,
      antialias: false,           // antialias can crash on some expo-gl versions
      alpha: false,
    })
    renderer.setSize(W, H, false)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x0a0a0c, 1)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100)
    camera.position.set(0, 0, 5.5)
    cameraRef.current = camera

    addStudioLights(scene)

    // MeshPhongMaterial — WebGL1 compatible (MeshPhysicalMaterial needs WebGL2)
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color('#f0ece7'),
      shininess: 12,
      specular: new THREE.Color('#2a2a2a'),
    })

    const geo  = buildBlobGeometry(nodes)
    const mesh = new THREE.Mesh(geo, material)
    mesh.scale.setScalar(1.45)
    scene.add(mesh)
    meshRef.current = mesh

    let rafId: number
    let last = 0
    let tick_n = 0

    function tick(now: number) {
      rafId = requestAnimationFrame(tick)
      if (!isInteract.current && now - last >= 33) {
        last = now
        ryRef.current += 0.003
        mesh.rotation.y = ryRef.current
      }
      renderer.render(scene, camera)
      gl.endFrameEXP()
      tick_n++
      if (tick_n % 3 === 0) setFrame(f => f + 1)  // labels update at ~10fps
    }

    rafId = requestAnimationFrame(tick)
    console.log('[MYO] scene ready W=', W, 'H=', H)

    disposeRef.current = () => {
      cancelAnimationFrame(rafId)
      geo.dispose()
      material.dispose()
      renderer.dispose()
    }
  }

  // Project family attractor positions to screen (for label overlay)
  const labelData = (() => {
    const cam = cameraRef.current
    if (!cam || !nodesRef.current.length) return []
    const tmp = new THREE.Vector3()
    const meshScale = meshRef.current?.scale.x ?? 1.45
    return nodesRef.current.map(n => {
      tmp.set(
        Math.sin(n.phi) * Math.cos(n.theta),
        -Math.cos(n.phi),
        Math.sin(n.phi) * Math.sin(n.theta),
      ).multiplyScalar(meshScale)
      tmp.applyEuler(new THREE.Euler(0, ryRef.current, 0))
      tmp.project(cam)
      return {
        ...n,
        sx: (tmp.x + 1) / 2 * SIZE,
        sy: -(tmp.y - 1) / 2 * SIZE,
        behind: tmp.z > 1.0,
      }
    })
  })()

  projRef.current = labelData.map(l => ({ id: l.id, sx: l.sx, sy: l.sy }))

  const selectedNode = selected ? nodesRef.current.find(n => n.id === selected) ?? null : null

  if (loading) return (
    <View style={[st.center, { backgroundColor: '#0a0a0c' }]}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  )
  if (!sig) return (
    <View style={[st.center, { backgroundColor: '#0a0a0c' }]}>
      <Text style={{ color: colors.textSecondary }}>Signature introuvable</Text>
    </View>
  )

  return (
    <View style={[st.container, { backgroundColor: '#0a0a0c' }]}>

      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[st.back, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <View style={st.headerMid}>
          <Text style={st.title}>{sig.workout_title}</Text>
          <Text style={st.hint}>{selected ? 'appuyer pour fermer' : 'glisser · appuyer'}</Text>
        </View>
        <ScoreArc score={sig.score} />
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>

        {/* 3D canvas */}
        <View style={st.canvas} {...pan.panHandlers}>
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

          {/* Floating family labels — positioned over 3D scene */}
          {labelData.map(l => !l.behind && (
            <View
              key={`lbl${l.id}`}
              pointerEvents="none"
              style={[st.labelChip, {
                ...(l.sx >= CX
                  ? { left: Math.round(l.sx + 16) }
                  : { right: Math.round(SIZE - l.sx + 16) }),
                top: Math.round(l.sy - 12),
                borderColor: l.color + (l.famZ < -1 ? '28' : '44'),
                opacity: l.famZ < -1 ? 0.44 : 1,
              }]}
            >
              <Text style={[st.labelText, { color: l.color }]}>{l.label}</Text>
              <Text style={[st.labelZ, { color: l.color }]}>
                {l.famZ >= 0 ? `+${l.famZ.toFixed(1)}` : l.famZ.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        {/* Variable detail panel — slides in on family tap */}
        {selectedNode && (
          <Animated.View style={[st.detail, {
            opacity: detailAnim,
            transform: [{ translateY: detailAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }]}>
            <View style={[st.detailHead, { borderLeftColor: selectedNode.color }]}>
              <Text style={[st.detailTitle, { color: selectedNode.color }]}>{selectedNode.label}</Text>
              <Text style={[st.detailFamZ, { color: selectedNode.color }]}>
                {selectedNode.famZ >= 0 ? `+${selectedNode.famZ.toFixed(2)}` : selectedNode.famZ.toFixed(2)} σ
              </Text>
            </View>
            {selectedNode.vars.map(v => {
              const t   = Math.max(0, Math.min(1, (v.z + 3) / 6))
              const pos = v.z >= 0
              return (
                <View key={v.key} style={st.varRow}>
                  <Text style={st.varLbl}>{v.label}</Text>
                  <View style={st.varTrack}>
                    <View style={[st.varFill, {
                      width: Math.round(t * 100),
                      backgroundColor: pos ? selectedNode.color : '#8E8E93',
                    }]} />
                  </View>
                  <Text style={[st.varVal, { color: pos ? selectedNode.color : '#8E8E93' }]}>
                    {v.z >= 0 ? `+${v.z.toFixed(1)}` : v.z.toFixed(1)}
                  </Text>
                </View>
              )
            })}
          </Animated.View>
        )}

        {/* Legend — tappable shortcut */}
        {!selected && (
          <View style={st.legend}>
            {GROUPS.map(g => {
              const z    = nodesRef.current.find(n => n.id === g.id)?.famZ ?? 0
              const barW = 4 + Math.max(0, Math.min(1, (z + 3) / 6)) * 22
              return (
                <TouchableOpacity key={g.id} style={st.legendItem} onPress={() => selectFamily(g.id)}>
                  <View style={[st.legendDot, { backgroundColor: g.color }]} />
                  <Text style={st.legendTxt}>{g.label}</Text>
                  <View style={[st.legendBar, { width: barW, backgroundColor: g.color }]} />
                </TouchableOpacity>
              )
            })}
          </View>
        )}

      </Animated.View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container:  { flex: 1 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 58, paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  back:      { fontSize: 32, fontWeight: '300', lineHeight: 34 },
  headerMid: { flex: 1, gap: 2 },
  title:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint:      { color: '#ffffff44', fontSize: 11 },
  arcCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  arcNum:    { fontSize: 17, fontWeight: '800', lineHeight: 20 },
  arcLabel:  { color: '#ffffff44', fontSize: 7, letterSpacing: 2 },
  canvas:    { alignSelf: 'center', width: SIZE, height: SIZE, position: 'relative' },
  labelChip: {
    position: 'absolute',
    backgroundColor: '#0a0a0ccc',
    borderRadius: 6, borderWidth: 0.5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  labelText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  labelZ:    { fontSize: 8, fontWeight: '600', opacity: 0.72 },
  detail: {
    marginHorizontal: 20, marginTop: 4,
    backgroundColor: '#111115',
    borderRadius: 14, borderWidth: 0.5, borderColor: '#ffffff12',
    padding: 16,
  },
  detailHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 14,
  },
  detailTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  detailFamZ:  { fontSize: 13, fontWeight: '700' },
  varRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  varLbl:   { color: '#ffffff66', fontSize: 11, width: 90, textAlign: 'right' },
  varTrack: { flex: 1, height: 3, backgroundColor: '#ffffff10', borderRadius: 2, overflow: 'hidden' },
  varFill:  { height: 3, borderRadius: 2 },
  varVal:   { fontSize: 11, fontWeight: '700', width: 38, textAlign: 'right' },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 24, paddingTop: 8, justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt:  { color: '#ffffff66', fontSize: 11 },
  legendBar:  { height: 3, borderRadius: 1.5, opacity: 0.75 },
})
