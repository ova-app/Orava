import React, { useCallback, useEffect, useRef } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl'
import * as THREE from 'three'

// ─── Props ─────────────────────────────────────────────────────────────────
interface Props {
  sessionValues?: number[]
  averageValues?: number[]
  size?: number
}

// ─── Config géométrique ────────────────────────────────────────────────────
const TWO_PI    = Math.PI * 2
const N_SECTORS = 8
const SECTOR_ANG = TWO_PI / N_SECTORS
const N_RINGS   = 42   // plus de lignes de niveau → terrain plus dense
const N_SEGS    = 140  // segments par cercle
const N_SPOKES  = 26   // rayons radiaux
const MAX_R     = 1.8
const H_TOP     = 0.9
const H_BOT     = 0.45

// Echelle du bruit : contrôle la densité des pics (plus élevé = pics plus denses)
const NOISE_SCALE = 4.4

const SECTOR_COLORS: readonly number[] = [
  0xf97316, // Volume     — orange
  0xef4444, // Intensité  — rouge
  0x8b5cf6, // Structure  — violet
  0x06b6d4, // Récup      — cyan
  0xfac775, // Perf       — or
  0x22c55e, // Régularité — vert
  0xec4899, // Muscles    — rose
  0x3b82f6, // Temps      — bleu
]

const MOCK_SESSION: number[] = [0.85, 0.70, 0.60, 0.45, 0.90, 0.55, 0.75, 0.40]
const MOCK_AVERAGE: number[] = [0.65, 0.55, 0.50, 0.60, 0.70, 0.45, 0.65, 0.50]

// ─── Perlin Noise 2D (implémentation pure TS — zéro dépendance externe) ───
const PERM = new Uint8Array(512)

// Table de permutation initialisée une fois avec seed fixe → terrain déterministe
;(function initPerlin() {
  const p: number[] = Array.from({ length: 256 }, (_, i) => i)
  let s = 73856093  // seed arbitraire — bonne couverture angulaire
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    const j = ((s >>> 0) % (i + 1))
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp
  }
  for (let i = 0; i < 256; i++) { PERM[i] = p[i]; PERM[i + 256] = p[i] }
})()

const G2: readonly [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0,  1], [ 0, -1],
]

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a: number, b: number, t: number): number { return a + t * (b - a) }

function dot2(hash: number, x: number, y: number): number {
  const g = G2[hash & 7]
  return g[0] * x + g[1] * y
}

function perlin2(x: number, y: number): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u  = fade(xf)
  const v  = fade(yf)
  const aa = PERM[PERM[X]     + Y]
  const ab = PERM[PERM[X]     + Y + 1]
  const ba = PERM[PERM[X + 1] + Y]
  const bb = PERM[PERM[X + 1] + Y + 1]
  return lerp(
    lerp(dot2(aa, xf,     yf    ), dot2(ba, xf - 1, yf    ), u),
    lerp(dot2(ab, xf,     yf - 1), dot2(bb, xf - 1, yf - 1), u),
    v,
  )
}

/**
 * Ridged fBm — terrain chaotique avec pics pointus.
 * Chaque octave utilise (1 - |perlin|)^2 → créneaux nets asymétriques.
 * Le "weight cascade" propage les hautes crêtes vers les couches fines.
 * Renvoie [0, 1] approximativement.
 */
function ridgedFbm(x: number, y: number, octaves: number): number {
  let val    = 0
  let amp    = 0.75
  let freq   = 1.0
  let weight = 1.0
  let maxAmp = 0

  for (let i = 0; i < octaves; i++) {
    const n  = 1 - Math.abs(perlin2(x * freq, y * freq))
    const nn = n * n * weight          // ridge sharpenning
    val    += nn * amp
    maxAmp += amp
    weight  = Math.min(n * 1.25, 1.0) // couches fines amplifiées sous les pics principaux
    amp    *= 0.48
    freq   *= 2.12                     // lacunarity légèrement > 2 → irrégularité
  }
  return val / maxAmp
}

// ─── Helpers angulaires ────────────────────────────────────────────────────
const ss = (t: number): number => t * t * (3 - 2 * t)

function sectorBlend(theta: number): { s0: number; s1: number; t: number } {
  const a  = ((theta % TWO_PI) + TWO_PI) % TWO_PI
  const sf = a / SECTOR_ANG
  const s0 = Math.floor(sf) % N_SECTORS
  return { s0, s1: (s0 + 1) % N_SECTORS, t: ss(sf - Math.floor(sf)) }
}

/**
 * Hauteur Y en (r, theta) — amplitude pilotée par les données de secteur,
 * forme déterminée par le bruit ridged fBm.
 *
 * L'amplitude max du bruit dans chaque secteur est proportionnelle à vals[s] :
 * si le secteur volume vaut 0.9, ses pics montent jusqu'à 90% de H_TOP.
 */
function getH(r: number, theta: number, vals: number[], maxH: number): number {
  const { s0, s1, t } = sectorBlend(theta)
  const v  = vals[s0] * (1 - t) + vals[s1] * t  // amplitude sectorielle [0,1]

  const rn   = r / MAX_R
  // Enveloppe radiale : zéro au centre et au bord extérieur
  const edge = Math.min(rn / 0.10, 1.0) * Math.min((1 - rn) / 0.08, 1.0)

  // Coordonnées cartésiennes → évite la symétrie concentrique du repère polaire
  const nx = r * Math.cos(theta) * NOISE_SCALE
  const nz = r * Math.sin(theta) * NOISE_SCALE

  const noise = ridgedFbm(nx, nz, 4)  // [0, ~1]

  return v * maxH * edge * noise
}

function getC(theta: number): [number, number, number] {
  const { s0, s1, t } = sectorBlend(theta)
  const h0 = SECTOR_COLORS[s0]
  const h1 = SECTOR_COLORS[s1]
  return [
    (((h0 >> 16) & 0xff) * (1 - t) + ((h1 >> 16) & 0xff) * t) / 255,
    (((h0 >>  8) & 0xff) * (1 - t) + ((h1 >>  8) & 0xff) * t) / 255,
    (( h0        & 0xff) * (1 - t) + ( h1        & 0xff) * t) / 255,
  ]
}

// ─── Construction BufferGeometry topographique ─────────────────────────────
function makeTopoGeo(
  vals: number[],
  maxH: number,
  sign: 1 | -1,
  colored: boolean,
): THREE.BufferGeometry {
  const ringS  = N_RINGS * N_SEGS
  const spokeS = N_SPOKES * N_RINGS
  const total  = ringS + spokeS

  const pos = new Float32Array(total * 6)
  const col = colored ? new Float32Array(total * 6) : null

  const setV = (
    si: number,
    vi: 0 | 1,
    x: number,
    y: number,
    z: number,
    c?: [number, number, number],
  ): void => {
    const b = si * 6 + vi * 3
    pos[b] = x; pos[b + 1] = y; pos[b + 2] = z
    if (col && c) { col[b] = c[0]; col[b + 1] = c[1]; col[b + 2] = c[2] }
  }

  // Cercles concentriques (lignes de niveau déformées par le bruit)
  for (let ri = 0; ri < N_RINGS; ri++) {
    const r = ((ri + 1) / N_RINGS) * MAX_R
    for (let si = 0; si < N_SEGS; si++) {
      const a1  = (si / N_SEGS) * TWO_PI
      const a2  = ((si + 1) / N_SEGS) * TWO_PI
      const idx = ri * N_SEGS + si
      setV(idx, 0, r * Math.cos(a1), sign * getH(r, a1, vals, maxH), r * Math.sin(a1), colored ? getC(a1) : undefined)
      setV(idx, 1, r * Math.cos(a2), sign * getH(r, a2, vals, maxH), r * Math.sin(a2), colored ? getC(a2) : undefined)
    }
  }

  // Rayons radiaux
  for (let sp = 0; sp < N_SPOKES; sp++) {
    const a = (sp / N_SPOKES) * TWO_PI
    const c = colored ? getC(a) : undefined
    for (let ri = 0; ri < N_RINGS; ri++) {
      const r1  = (ri / N_RINGS) * MAX_R
      const r2  = ((ri + 1) / N_RINGS) * MAX_R
      const idx = ringS + sp * N_RINGS + ri
      setV(idx, 0, r1 * Math.cos(a), sign * getH(r1, a, vals, maxH), r1 * Math.sin(a), c)
      setV(idx, 1, r2 * Math.cos(a), sign * getH(r2, a, vals, maxH), r2 * Math.sin(a), c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

/**
 * Socle circulaire — 3 anneaux concentriques (inner / main / outer) + ticks radiaux.
 * Rendu Y=0 : séparation visuelle nette entre terrain séance (dessus) et historique (dessous).
 */
function makeSocleGeo(): THREE.BufferGeometry {
  const R_MAIN  = MAX_R
  const R_INNER = MAX_R * 0.92
  const R_OUTER = MAX_R * 1.07
  const N_TICKS = N_SPOKES * 2  // ticks plus denses que les rayons du terrain

  const totalSeg = 3 * N_SEGS + N_TICKS
  const pts = new Float32Array(totalSeg * 6)
  let idx = 0

  const addRing = (r: number) => {
    for (let i = 0; i < N_SEGS; i++) {
      const a1 = (i / N_SEGS) * TWO_PI
      const a2 = ((i + 1) / N_SEGS) * TWO_PI
      const b  = idx * 6
      pts[b]     = r * Math.cos(a1); pts[b + 1] = 0; pts[b + 2] = r * Math.sin(a1)
      pts[b + 3] = r * Math.cos(a2); pts[b + 4] = 0; pts[b + 5] = r * Math.sin(a2)
      idx++
    }
  }

  addRing(R_INNER)
  addRing(R_MAIN)
  addRing(R_OUTER)

  // Ticks radiaux entre anneau intérieur et extérieur → grille de graduation
  for (let t = 0; t < N_TICKS; t++) {
    const a = (t / N_TICKS) * TWO_PI
    const b = idx * 6
    pts[b]     = R_INNER * Math.cos(a); pts[b + 1] = 0; pts[b + 2] = R_INNER * Math.sin(a)
    pts[b + 3] = R_OUTER * Math.cos(a); pts[b + 4] = 0; pts[b + 5] = R_OUTER * Math.sin(a)
    idx++
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
  return geo
}

// ─── Composant ─────────────────────────────────────────────────────────────
export default function MyoOrb({
  sessionValues = MOCK_SESSION,
  averageValues = MOCK_AVERAGE,
  size,
}: Props) {
  const { width } = Dimensions.get('window')
  const S = size ?? width - 32

  const rafRef = useRef<number | null>(null)
  const svRef  = useRef(sessionValues)
  const avRef  = useRef(averageValues)

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    const W = gl.drawingBufferWidth
    const H = gl.drawingBufferHeight

    const canvas = {
      width: W, height: H, style: {},
      clientWidth: W, clientHeight: H,
      addEventListener: () => {}, removeEventListener: () => {},
    } as unknown as HTMLCanvasElement

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl as WebGL2RenderingContext,
      antialias: false,
    })
    renderer.setSize(W, H, false)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x080808, 1)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100)
    camera.position.set(0, 3.2, 4.8)
    camera.lookAt(0, 0, 0)

    // Relief séance (dessus) — couleurs par secteur, terrain chaotique ridged fBm
    scene.add(new THREE.LineSegments(
      makeTopoGeo(svRef.current, H_TOP, 1, true),
      new THREE.LineBasicMaterial({ vertexColors: true }),
    ))

    // Relief moyen (dessous) — amplitude réduite, couleur unique, même bruit → cohérence visuelle
    scene.add(new THREE.LineSegments(
      makeTopoGeo(avRef.current, H_BOT, -1, false),
      new THREE.LineBasicMaterial({ color: 0x4e7d9e }),
    ))

    // Socle circulaire — 3 anneaux + ticks radiaux, clairement visible
    scene.add(new THREE.LineSegments(
      makeSocleGeo(),
      new THREE.LineBasicMaterial({ color: 0x606060 }),
    ))

    let last = 0
    const tick = (now: number): void => {
      rafRef.current = requestAnimationFrame(tick)
      if (now - last < 33) return
      last = now
      scene.rotation.y += 0.003
      renderer.render(scene, camera)
      gl.endFrameEXP()
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  return (
    <View style={[styles.wrap, { width: S, height: S }]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#080808',
  },
})