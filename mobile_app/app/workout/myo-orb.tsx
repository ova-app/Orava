import { useEffect, useRef, useState, useMemo } from 'react'
import {
  View, Text, PanResponder, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, Animated,
} from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrbSig {
  z_volume: number; z_intensite: number; z_structure: number
  z_recovery: number; z_performance: number; z_regularite: number
  score: number; z_extended: Record<string, number>; workout_title: string
}
interface Particle3D { pos: V3; r: number; color: string; opacity: number; glow: boolean; dormant?: boolean }
interface Stem3D { from: V3; to: V3; color: string; width: number; opacity: number; dashed?: boolean }
interface LabelAnchor { pos: V3; label: string; color: string; z: number; dormant: boolean }
interface SceneData { stems: Stem3D[]; particles: Particle3D[]; labelAnchors: LabelAnchor[] }
type V3 = [number, number, number]

interface ProjStem { x1:number; y1:number; x2:number; y2:number; color:string; width:number; opacity:number; dashed?:boolean }
interface ProjParticle { cx:number; cy:number; r:number; color:string; opacity:number; glow:boolean; dormant?:boolean }
interface ProjectedScene {
  stemsBack: ProjStem[]; stemsFront: ProjStem[]
  particlesBack: ProjParticle[]; particlesFront: ProjParticle[]
  rings: string[]
  labels: Array<{ label:string; color:string; x:number; y:number; visible:boolean; z:number; dormant:boolean }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window')
const SIZE = Math.min(SW - 32, 400)
const CX = SIZE / 2, CY = SIZE / 2
const R   = SIZE * 0.36
const FOV = SIZE * 1.8

const PAN_SPEED     = 0.005
const ZOOM_MIN      = 0.4
const ZOOM_MAX      = 3.0
const AUTO_ROT_SPD  = 0.006  // rad per frame at 30fps ≈ full rotation in ~20s

const GROUPS: Array<{ id:string; label:string; color:string; zKeys:string[] }> = [
  { id:'volume',       label:'Volume',    color:'#D85A30', zKeys:['volume_kg']                                 },
  { id:'intensite',    label:'Intensité', color:'#FAC775', zKeys:['densite','charge_relative','max_1rm_kg']    },
  { id:'structure',    label:'Structure', color:'#9B59B6', zKeys:['nb_series','nb_exercices']                  },
  { id:'recuperation', label:'Récup.',    color:'#50C878', zKeys:['recuperation','temps_repos_moy_sec']        },
  { id:'performance',  label:'Perf.',     color:'#4A9EFF', zKeys:['nb_pr','mean_evolution_volume']             },
  { id:'regularite',   label:'Constance', color:'#FF9800', zKeys:['streak','frequence_hebdo']                  },
  { id:'muscles',      label:'Muscles',   color:'#00BCD4', zKeys:['nb_muscles','hhi_muscles','share_dominant'] },
  { id:'temps',        label:'Durée',     color:'#E91E63', zKeys:['duree_sec','ratio_actif']                   },
]

// ─── Score arc SVG ────────────────────────────────────────────────────────────

const ARC_SZ    = 72
const ARC_CX    = ARC_SZ / 2
const ARC_CY    = ARC_SZ / 2
const ARC_R     = 27
// 240° arc leaving 120° gap at bottom — starts bottom-left, goes clockwise through top to bottom-right
const ARC_START = 150 * Math.PI / 180
const ARC_SWEEP = 240 * Math.PI / 180

function arcPath(cx: number, cy: number, r: number, start: number, sweep: number): string {
  const sx = cx + r * Math.cos(start)
  const sy = cy + r * Math.sin(start)
  const ex = cx + r * Math.cos(start + sweep)
  const ey = cy + r * Math.sin(start + sweep)
  const large = sweep > Math.PI ? 1 : 0
  return `M${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 ${large},1 ${ex.toFixed(2)},${ey.toFixed(2)}`
}

function ScoreArc({ score }: { score: number }) {
  const pct   = Math.max(0, Math.min(100, score)) / 100
  const color = pct >= 0.66 ? '#FAC775' : pct >= 0.33 ? '#D85A30' : '#8E8E93'
  const trackD = arcPath(ARC_CX, ARC_CY, ARC_R, ARC_START, ARC_SWEEP)
  const fillD  = pct > 0.01 ? arcPath(ARC_CX, ARC_CY, ARC_R, ARC_START, ARC_SWEEP * pct) : null
  return (
    <View style={{ width: ARC_SZ, height: ARC_SZ }}>
      <Svg width={ARC_SZ} height={ARC_SZ}>
        <Path d={trackD} stroke="#ffffff14" strokeWidth={4.5} fill="none" strokeLinecap="round" />
        {fillD && <Path d={fillD} stroke={color} strokeWidth={4.5} fill="none" strokeLinecap="round" />}
        {/* center accent dot */}
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

// ─── 3D Math ──────────────────────────────────────────────────────────────────

function rotX(p: V3, a: number): V3 {
  return [p[0], p[1]*Math.cos(a)-p[2]*Math.sin(a), p[1]*Math.sin(a)+p[2]*Math.cos(a)]
}
function rotY(p: V3, a: number): V3 {
  return [p[0]*Math.cos(a)+p[2]*Math.sin(a), p[1], -p[0]*Math.sin(a)+p[2]*Math.cos(a)]
}
function rot(p: V3, rx: number, ry: number): V3 { return rotX(rotY(p, ry), rx) }
function proj(p: V3, zoom = 1.0) {
  const dz = p[2] + FOV, s = (FOV / dz) * zoom
  return { x: CX + p[0]*s, y: CY + p[1]*s, depth: p[2] }
}
function sph(theta: number, phi: number, r = R): V3 {
  return [r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta)]
}
function norm(v: V3): V3 {
  const l = Math.sqrt(v[0]**2+v[1]**2+v[2]**2) || 1
  return [v[0]/l, v[1]/l, v[2]/l]
}
function add(a: V3, b: V3): V3 { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]] }
function mul(v: V3, s: number): V3 { return [v[0]*s, v[1]*s, v[2]*s] }
function perp(d: V3): V3 {
  const ref: V3 = Math.abs(d[0]) < 0.9 ? [1,0,0] : [0,1,0]
  return norm([d[1]*ref[2]-d[2]*ref[1], d[2]*ref[0]-d[0]*ref[2], d[0]*ref[1]-d[1]*ref[0]])
}
function cross3(a: V3, b: V3): V3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
}

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1|s)
    t = (t + Math.imul(t ^ (t >>> 7), 61|t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Build 3D scene ───────────────────────────────────────────────────────────
//
// L0 — Origin
// L1 — Family root node at 45% of famR — phi & famR both z-score driven
// L2 — Variable island on sphere at famR, same phi as family
// L3 — Halo of N satellites in the tangent plane, spoke length ∝ z-score

function buildSceneData(sig: OrbSig): SceneData {
  const coreZ: Record<string,number> = {
    volume_kg: sig.z_volume, densite: sig.z_intensite, nb_series: sig.z_structure,
    recuperation: sig.z_recovery, nb_pr: sig.z_performance, streak: sig.z_regularite,
  }
  const allZ = { ...coreZ, ...sig.z_extended }
  const clamp = (v: number) => Math.max(-3, Math.min(3, isFinite(v) ? v : 0))

  const stems: Stem3D[]              = []
  const particles: Particle3D[]      = []
  const labelAnchors: LabelAnchor[]  = []
  const ORIGIN: V3 = [0, 0, 0]

  GROUPS.forEach((g, gi) => {
    const zVals = g.zKeys.map(k => clamp(allZ[k] ?? 0))
    const famZ  = zVals.reduce((a, b) => a + b, 0) / zVals.length

    // A — floor at R×0.25: aucune famille ne s'écrase au centre
    const famR = R * Math.max(0.25, Math.min(1.0, (famZ + 3) / 4))

    // B — dormant: famille sous le baseline (famZ < -1)
    const isDormant = famZ < -1

    // Elevation from z-score: z=+3 → top pole (small phi), z=-3 → bottom pole (large phi)
    const phi_fam   = Math.PI * (0.08 + 0.84 * (1 - (famZ + 3) / 6))
    const theta_fam = (gi / GROUPS.length) * 2 * Math.PI

    const famRoot = sph(theta_fam, phi_fam, famR * 0.45)

    // L0→L1: backbone — dashed + atténué si dormant
    stems.push({ from: ORIGIN, to: famRoot, color: g.color, width: isDormant ? 0.55 : 0.85, opacity: isDormant ? 0.18 : 0.40, dashed: isDormant })
    particles.push({ pos: famRoot, r: 1.5, color: g.color, opacity: isDormant ? 0.28 : 0.70, glow: false })

    labelAnchors.push({ pos: sph(theta_fam, phi_fam, R * 1.55), label: g.label, color: g.color, z: famZ, dormant: isDormant })

    const sectorW = (Math.PI * 2 / GROUPS.length) * 0.36

    zVals.forEach((z, vi) => {
      const rand = makeRng(gi * 997 + vi * 137 + 42)
      const t    = (z + 3) / 6

      const theta_var = zVals.length === 1
        ? theta_fam
        : theta_fam + ((vi / (zVals.length - 1)) - 0.5) * 2 * sectorW

      const anchor = sph(theta_var, phi_fam, famR)

      // L1→L2: branch — dashed si dormant
      stems.push({ from: famRoot, to: anchor, color: g.color, width: isDormant ? 0.55 : 0.90, opacity: isDormant ? 0.18 : 0.58, dashed: isDormant })

      // island floor à 2.8px si dormant, pas de bloom
      const islandR  = isDormant ? Math.max(2.8, (2.2 + 3.8 * t) * 0.65) : 2.2 + 3.8 * t
      const spokeLen = R * (0.06 + 0.22 * t)

      particles.push({ pos: anchor, r: islandR, color: g.color, opacity: isDormant ? 0.32 : 0.92, glow: !isDormant, dormant: isDormant })

      // 3 satellites triangulaires si dormant, sinon halo complet
      const N_sat  = isDormant ? 3 : 4 + Math.floor(t * 18)
      const outDir = norm(anchor)
      const p1     = perp(outDir)
      const p2     = norm(cross3(outDir, p1))

      for (let i = 0; i < N_sat; i++) {
        const angle  = (i / N_sat) * 2 * Math.PI + (isDormant ? 0 : rand() * (Math.PI / N_sat) * 0.6)
        const tang   = norm(add(mul(p1, Math.cos(angle)), mul(p2, Math.sin(angle))))
        const satPos = add(anchor, mul(tang, spokeLen))

        stems.push({ from: anchor, to: satPos, color: g.color, width: 0.32, opacity: isDormant ? 0.18 : 0.52, dashed: isDormant })
        particles.push({
          pos:     satPos,
          r:       isDormant ? 0.9 + t * 0.5 : (0.9 + t * 0.9) + rand() * 0.35,
          color:   g.color,
          opacity: isDormant ? 0.25 : 0.72 + rand() * 0.26,
          glow:    false,
          dormant: isDormant,
        })
      }
    })
  })

  return { stems, particles, labelAnchors }
}

// ─── Sphere rings ─────────────────────────────────────────────────────────────

function buildRings(rx: number, ry: number, zoom: number): string[] {
  const RING_PHIS = [Math.PI * 0.25, Math.PI * 0.50, Math.PI * 0.75]
  const STEPS = 60
  return RING_PHIS.map(phi => {
    const pts: string[] = []
    for (let i = 0; i <= STEPS; i++) {
      const theta = (i / STEPS) * 2 * Math.PI
      const p     = proj(rot(sph(theta, phi), rx, ry), zoom)
      pts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    }
    return pts.join('')
  })
}

// ─── Project to 2D ───────────────────────────────────────────────────────────

function projectScene(data: SceneData, rx: number, ry: number, zoom: number): ProjectedScene {
  const stemsBack:      ProjStem[]     = []
  const stemsFront:     ProjStem[]     = []
  const particlesBack:  ProjParticle[] = []
  const particlesFront: ProjParticle[] = []

  data.stems
    .map(s => {
      const a = proj(rot(s.from, rx, ry), zoom), b = proj(rot(s.to, rx, ry), zoom)
      return { x1:a.x, y1:a.y, x2:b.x, y2:b.y, color:s.color, width:s.width, opacity:s.opacity, dashed:s.dashed, depth:(a.depth+b.depth)/2 }
    })
    .sort((a, b) => a.depth - b.depth)
    .forEach(s => (s.depth < 0 ? stemsBack : stemsFront).push(s))

  data.particles
    .map(p => {
      const pp = proj(rot(p.pos, rx, ry), zoom)
      return { cx:pp.x, cy:pp.y, r:p.r, color:p.color, opacity:p.opacity, glow:p.glow, dormant:p.dormant, depth:pp.depth }
    })
    .sort((a, b) => a.depth - b.depth)
    .forEach(p => (p.depth < 0 ? particlesBack : particlesFront).push(p))

  const rings = buildRings(rx, ry, zoom)

  const labels = data.labelAnchors.map(la => {
    const p = proj(rot(la.pos, rx, ry), zoom)
    return { label:la.label, color:la.color, x:p.x, y:p.y, visible: p.depth > -R * 0.5, z: la.z, dormant: la.dormant }
  })

  return { stemsBack, stemsFront, particlesBack, particlesFront, rings, labels }
}

// ─── Bloom helper — 3-layer radial glow per island ────────────────────────────

function bloomCircles(p: ProjParticle, key: string) {
  return [
    <Circle key={`${key}o`} cx={p.cx} cy={p.cy} r={p.r * 6.0} fill={p.color} opacity={p.opacity * 0.04} />,
    <Circle key={`${key}m`} cx={p.cx} cy={p.cy} r={p.r * 3.2} fill={p.color} opacity={p.opacity * 0.10} />,
    <Circle key={`${key}i`} cx={p.cx} cy={p.cy} r={p.r * 1.9} fill={p.color} opacity={p.opacity * 0.22} />,
  ]
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const EMPTY: ProjectedScene = {
  stemsBack: [], stemsFront: [], particlesBack: [], particlesFront: [], rings: [], labels: [],
}

export default function MyoOrbScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()

  const [sig, setSig]         = useState<OrbSig | null>(null)
  const [loading, setLoading] = useState(true)
  const [scene, setScene]     = useState<ProjectedScene>(EMPTY)
  const fadeAnim              = useRef(new Animated.Value(0)).current

  const rxRef            = useRef(-0.3)
  const ryRef            = useRef(0.4)
  const zoomRef          = useRef(1.0)
  const dataRef          = useRef<SceneData | null>(null)
  const rafRef           = useRef(0)
  const isInteracting    = useRef(false)
  const lastXRef         = useRef(0)
  const lastYRef         = useRef(0)
  const lastPinchDistRef = useRef(0)
  const lastAutoTick     = useRef(0)

  function scheduleReproject() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (dataRef.current) {
        setScene(projectScene(dataRef.current, rxRef.current, ryRef.current, zoomRef.current))
      }
    })
  }

  // family z-scores for legend bars — computed once per sig
  const familyZMap = useMemo<Record<string, number>>(() => {
    if (!sig) return {}
    const coreZ: Record<string, number> = {
      volume_kg: sig.z_volume, densite: sig.z_intensite, nb_series: sig.z_structure,
      recuperation: sig.z_recovery, nb_pr: sig.z_performance, streak: sig.z_regularite,
    }
    const allZ = { ...coreZ, ...sig.z_extended }
    const clamp = (v: number) => Math.max(-3, Math.min(3, isFinite(v) ? v : 0))
    const out: Record<string, number> = {}
    GROUPS.forEach(g => {
      const vals = g.zKeys.map(k => clamp(allZ[k] ?? 0))
      out[g.id] = vals.reduce((a, b) => a + b, 0) / vals.length
    })
    return out
  }, [sig])

  // Auto-rotation at ~30fps — skips when user is interacting
  useEffect(() => {
    let raf: number
    const tick = (now: number) => {
      if (!isInteracting.current && dataRef.current && now - lastAutoTick.current >= 33) {
        lastAutoTick.current = now
        ryRef.current += AUTO_ROT_SPD
        setScene(projectScene(dataRef.current, rxRef.current, ryRef.current, zoomRef.current))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt, gs) => {
      isInteracting.current = true
      const touches = evt.nativeEvent.touches
      if (touches.length >= 2) {
        const dx = touches[1].pageX - touches[0].pageX
        const dy = touches[1].pageY - touches[0].pageY
        lastPinchDistRef.current = Math.sqrt(dx*dx + dy*dy)
      } else {
        lastXRef.current = gs.moveX
        lastYRef.current = gs.moveY
        lastPinchDistRef.current = 0
      }
    },
    onPanResponderMove: (evt, gs) => {
      const touches = evt.nativeEvent.touches
      if (touches.length >= 2) {
        const dx   = touches[1].pageX - touches[0].pageX
        const dy   = touches[1].pageY - touches[0].pageY
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (lastPinchDistRef.current > 0) {
          zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current * (dist / lastPinchDistRef.current)))
        }
        lastPinchDistRef.current = dist
        scheduleReproject()
      } else {
        const dx = gs.moveX - lastXRef.current
        const dy = gs.moveY - lastYRef.current
        lastXRef.current = gs.moveX
        lastYRef.current = gs.moveY
        ryRef.current -= dx * PAN_SPEED
        rxRef.current  = Math.max(-1.4, Math.min(1.4, rxRef.current - dy * PAN_SPEED))
        scheduleReproject()
      }
    },
    onPanResponderRelease:    () => { isInteracting.current = false },
    onPanResponderTerminate:  () => { isInteracting.current = false },
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
    setSig(loaded)
    const data = buildSceneData(loaded)
    dataRef.current = data
    setScene(projectScene(data, rxRef.current, ryRef.current, zoomRef.current))
    setLoading(false)
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start()
  }

  if (loading) {
    return (
      <View style={[st.center, { backgroundColor: '#0a0a0c' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }
  if (!sig) {
    return (
      <View style={[st.center, { backgroundColor: '#0a0a0c' }]}>
        <Text style={{ color: colors.textSecondary }}>Signature introuvable</Text>
      </View>
    )
  }

  return (
    <View style={[st.container, { backgroundColor: '#0a0a0c' }]}>

      {/* Header — always visible */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Text style={[st.back, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <View style={st.headerMid}>
          <Text style={st.title}>{sig.workout_title}</Text>
          <Text style={st.hint}>glisser · pincer zoom</Text>
        </View>
        <ScoreArc score={sig.score} />
      </View>

      {/* Orb + legend — fade in on load */}
      <Animated.View style={{ opacity: fadeAnim }}>

        <View style={st.canvas} {...pan.panHandlers}>
          <Svg width={SIZE} height={SIZE}>

            {/* Sphere silhouette */}
            <Circle cx={CX} cy={CY} r={R} stroke="#ffffff" strokeWidth={0.7} opacity={0.12} fill="none" />

            {/* Latitude rings */}
            {scene.rings.map((d, i) => (
              <Path key={`r${i}`} d={d} stroke="#ffffff" strokeWidth={0.5} opacity={0.08} fill="none" />
            ))}

            {/* Stems — back hemisphere */}
            {scene.stemsBack.map((s, i) => (
              <Path
                key={`sb${i}`}
                d={`M${s.x1.toFixed(1)},${s.y1.toFixed(1)}L${s.x2.toFixed(1)},${s.y2.toFixed(1)}`}
                stroke={s.color} strokeWidth={s.width} opacity={s.opacity} fill="none" strokeLinecap="round"
                strokeDasharray={s.dashed ? '3,2' : undefined}
              />
            ))}

            {/* Bloom — back */}
            {scene.particlesBack.filter(p => p.glow).flatMap((p, i) => bloomCircles(p, `gb${i}`))}

            {/* Particles — back */}
            {scene.particlesBack.map((p, i) => (
              <Circle key={`pb${i}`} cx={p.cx} cy={p.cy} r={p.r} fill={p.color} opacity={p.opacity} />
            ))}

            {/* Stems — front hemisphere */}
            {scene.stemsFront.map((s, i) => (
              <Path
                key={`sf${i}`}
                d={`M${s.x1.toFixed(1)},${s.y1.toFixed(1)}L${s.x2.toFixed(1)},${s.y2.toFixed(1)}`}
                stroke={s.color} strokeWidth={s.width} opacity={s.opacity} fill="none" strokeLinecap="round"
                strokeDasharray={s.dashed ? '3,2' : undefined}
              />
            ))}

            {/* Bloom — front */}
            {scene.particlesFront.filter(p => p.glow).flatMap((p, i) => bloomCircles(p, `gf${i}`))}

            {/* Particles — front */}
            {scene.particlesFront.map((p, i) => (
              <Circle key={`pf${i}`} cx={p.cx} cy={p.cy} r={p.r} fill={p.color} opacity={p.opacity} />
            ))}

            {/* Origin node — layered glow */}
            <Circle cx={CX} cy={CY} r={18}  fill="#ffffff" opacity={0.025} />
            <Circle cx={CX} cy={CY} r={10}  fill="#ffffff" opacity={0.055} />
            <Circle cx={CX} cy={CY} r={5.5} fill="#ffffff" opacity={0.12}  />
            <Circle cx={CX} cy={CY} r={3}   fill="#ffffff" opacity={0.50}  />
            <Circle cx={CX} cy={CY} r={1.4} fill="#ffffff" opacity={0.95}  />
          </Svg>

          {/* Floating label chips — D: z-score affiché, B: atténué si dormant */}
          {scene.labels.map((l, i) => l.visible && (
            <View
              key={i}
              pointerEvents="none"
              style={[
                st.labelChip,
                {
                  left: l.x - 28, top: l.y - 13,
                  borderColor: l.color + (l.dormant ? '28' : '44'),
                  opacity: l.dormant ? 0.55 : 1,
                },
              ]}
            >
              <Text style={[st.labelText, { color: l.color }]}>{l.label}</Text>
              <Text style={[st.labelZ, { color: l.color }]}>
                {l.z >= 0 ? `+${l.z.toFixed(1)}` : l.z.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        {/* Legend — label + z-score bar */}
        <View style={st.legend}>
          {GROUPS.map(g => {
            const z    = familyZMap[g.id] ?? 0
            const barW = 4 + Math.max(0, Math.min(1, (z + 3) / 6)) * 22
            return (
              <View key={g.id} style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: g.color }]} />
                <Text style={st.legendText}>{g.label}</Text>
                <View style={[st.legendBar, { width: barW, backgroundColor: g.color }]} />
              </View>
            )
          })}
        </View>

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
  back:       { fontSize: 32, fontWeight: '300', lineHeight: 34 },
  headerMid:  { flex: 1, gap: 2 },
  title:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint:       { color: '#ffffff44', fontSize: 11 },
  arcCenter:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  arcNum:     { fontSize: 17, fontWeight: '800', lineHeight: 20 },
  arcLabel:   { color: '#ffffff44', fontSize: 7, letterSpacing: 2 },
  canvas:     { alignSelf: 'center', width: SIZE, height: SIZE, position: 'relative' },
  labelChip: {
    position: 'absolute',
    backgroundColor: '#0a0a0cdd',
    borderRadius: 8,
    borderWidth: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  labelText:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  labelZ:      { fontSize: 8, fontWeight: '600', letterSpacing: 0.3, opacity: 0.72 },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 24, paddingTop: 12, justifyContent: 'center',
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 7, height: 7, borderRadius: 3.5 },
  legendText:  { color: '#ffffff66', fontSize: 11 },
  legendBar:   { height: 3, borderRadius: 1.5, opacity: 0.75 },
})
