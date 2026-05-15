# Myo 3D — Prompts Midjourney

## Objectif
Trouver la forme définitive du Myo : blob organique déformé par les données d'entraînement.
Chaque séance génère une forme unique → empreinte athlétique personnelle.

Lancer 30–50 variations. Garder 3 candidats dans `candidates/`.

---

## Direction retenue — Mesh particules sombre ✅

Forme organique fluide + surface maillée translucide + points lumineux + fond dark.
Références visuelles : les 2 images candidates (fluid mesh, dark, particles, ambient data viz).

### Prompts améliorés (lancer ces en priorité)

**Forme + matériau**
```
dark translucent organic mesh sculpture, flowing parametric deformation, 
glowing particle nodes on surface, fluid simulation topology, athletic data fingerprint,
deep charcoal background, soft blue-white particle glow, asymmetric blob form,
3D render, no text --ar 1:1 --v 6.1 --style raw --chaos 10
```

```
bioluminescent mesh organism, fluid organic morphing form, parametric surface deformation,
subtle particle system, fitness biometric data visualization, dark void background,
ambient soft glow, flowing topology, premium athletic tech, hyperrealistic render
--ar 1:1 --v 6.1 --style raw
```

```
dark fluid organic sculpture, translucent mesh surface with glowing vertices,
asymmetric deformation driven by 8 force vectors, athletic performance fingerprint,
deep black background, micro particle halo, flowing smooth topology,
no flat areas, 3D studio render --ar 1:1 --v 6.1 --chaos 15
```

**Avec éléments data en périphérie (comme image de droite)**
```
dark organic mesh blob, flowing parametric form, glowing particle nodes,
surrounded by minimal data visualization elements, small amber charts and arcs,
fitness biometrics, dark background, center focus on sculpture,
peripheral UI elements subtle, premium dark app aesthetic --ar 1:1 --v 6.1 --style raw
```

```
fluid dark sculptural form, particle mesh surface, athletic data visualization,
surrounded by abstract fitness metrics floating in space, orange accent charts,
circular progress arcs, deep dark background, premium fitness app, 
3D render with UI context --ar 1:1 --v 6.1
```

**Format mobile Stories (PR gold)**
```
glowing dark mesh organic blob, flowing parametric deformation, golden particle nodes,
athletic performance peak visualization, deep black background, amber gold particle glow,
fitness achievement moment, premium, vertical composition --ar 9:16 --v 6.1 --style raw
```

### Ce qui marche — garder dans tous les prompts
- `dark translucent mesh` / `particle nodes` / `flowing parametric`
- `asymmetric` (jamais symétrique — chaque séance = forme unique)
- `deep black background` / `charcoal background`
- `no text` / `no watermark`

### Ce qui ne marche pas — éviter
- `ceramic` / `white` / `marble` — mauvaise direction
- `wireframe` seul — trop technique, pas organique
- `jellyfish` / `medusa` — trop chaotique, forme pas lisible
- `sphere` — trop régulier, perd l'idée d'empreinte unique

---

---

## Direction A — Céramique blanche (direction principale)

Matériau cible Three.js : `MeshPhongMaterial`, `#f0ece7`, shininess 12.

```
organic ceramic sculptural sphere, asymmetric parametric deformation, matte white glaze #f0ece7,
smooth surface tension, sports biometric data form, studio lighting warm key light,
deep black background, minimal shadow, 8K render, product photography --ar 1:1 --v 6.1 --style raw
```

```
white ceramic blob sculpture, irregular organic morphing, athletic performance fingerprint,
soft studio rim light, premium fitness tech aesthetic, glossy depth matte finish,
isolated on pure black, hyperrealistic render --ar 1:1 --v 6.1 --q 2
```

```
parametric white ceramic orb, data-driven surface deformation, asymmetric protrusions,
8 directional forces sculpting the form, smooth gradient shadow, minimal luxury,
dark charcoal background, Jony Ive product design language --ar 1:1 --v 6.1 --style raw
```

```
ceramic athletic data sculpture, morphing icosahedron base, soft matte white surface,
workout signature visualization, subtle warm studio lighting, premium wearable tech aesthetic,
black void background, no text --ar 1:1 --v 6.1
```

---

## Direction B — Obsidienne + or (variante sombre)

Pour tester si le noir/or est plus premium que le blanc céramique.

```
black obsidian organic sphere, gold molten veins, parametric deformation,
athletic performance data visualization, dramatic studio lighting, deep specular highlights,
dark premium fitness, product render --ar 1:1 --v 6.1 --style raw
```

```
dark ceramic blob, volcanic texture, gold accent highlights, asymmetric parametric form,
sports biometric signature, luxury wearable aesthetic, moody dramatic lighting,
pure black background --ar 1:1 --v 6.1
```

```
obsidian parametric sculpture, molten gold surface cracks, organic morphing sphere,
fitness data art, studio key light, premium dark UI complement --ar 1:1 --v 6.1 --style raw
```

---

## Direction C — Translucide / verre dépoli

```
frosted glass organic sphere, translucent parametric deformation, inner glow soft white,
athletic data visualization, premium frosted acrylic, minimal studio lighting,
dark background, no reflections, product render --ar 1:1 --v 6.1 --style raw
```

```
semi-transparent ceramic blob, subsurface scattering, parametric asymmetric form,
fitness biometric fingerprint, milky white opalescent surface, soft studio light,
charcoal background, Apple Vision Pro aesthetic --ar 1:1 --v 6.1
```

```
translucent white glass sculpture, organic morphing icosahedron, subsurface light diffusion,
athletic performance art, minimal luxury, dark void, premium fitness tech,
hyperrealistic 3D render --ar 1:1 --v 6.1 --style raw
```

---

## Direction D — Marbre blanc

```
white marble organic sculptural sphere, parametric deformation, fine grey veins,
athletic data visualization form, dramatic studio lighting, dark background,
premium luxury fitness aesthetic, product photography --ar 1:1 --v 6.1
```

```
carrara marble blob, irregular parametric protrusions, sports performance fingerprint,
soft key light, deep shadow contrast, dark background, minimal luxury,
Balenciaga meets fitness tech --ar 1:1 --v 6.1 --style raw
```

---

## Direction E — Bioluminescent (variante colorée / score élevé)

Pour les moments de PR gold (score > 66) — animation de couleur.

```
bioluminescent organic sphere, soft warm amber glow #FAC775, dark water background,
parametric deformation, athletic data visualization, subsurface light emission,
premium fitness, no hard edges, dreamy --ar 1:1 --v 6.1 --style raw
```

```
glowing amber data blob, organic morphing form, deep dark void background,
warm bioluminescent material, athletic achievement visualization, 
premium fitness app aesthetic, soft halo light --ar 1:1 --v 6.1
```

---

## Variations de format à tester

Ajouter ces suffixes aux prompts qui marchent bien :

- `--ar 9:16` — format Stories mobile
- `--ar 3:4` — format card summary
- `--chaos 15` — plus de variation organique
- `--weird 50` — déformations plus agressives
- `--no text, no watermark, no grid` — toujours mettre ça

---

## Paramètres Three.js à documenter après choix

| Paramètre | Valeur actuelle v1 | Cible v2 |
|---|---|---|
| Couleur matériau | `#f0ece7` | À ajuster selon candidat |
| Shininess | 12 | À ajuster |
| AmbientLight intensity | 0.28 | À ajuster |
| Key light intensity | 2.4 | À ajuster |
| Déformation max | 0.48 | À ajuster |
| Fréquence metaball | 0.045 | À ajuster |

---

## Images candidates

Stocker les 3 directions retenues dans `design/myo/candidates/` :
- `candidate-1.jpg` — direction retenue principale
- `candidate-2.jpg` — alternative
- `candidate-3.jpg` — variante score élevé (PR gold)

---

## Notes
<!-- Remplir après les tests Midjourney -->
<!-- Ce qui plait, ce qui ne plait pas, direction choisie -->
