# 10 — Les audits (skills Claude)

Le repo embarque des **panels d'auditeurs experts** : des *skills* Claude qui analysent
le projet et rendent un diagnostic. Il y a **deux suites complémentaires** :

- **`/audit`** — audit de **toute l'entreprise** (produit, marché, business, tech,
  conformité…), note de santé **sur 20**.
- **`/code-audit`** — audit **ingénierie de tout le code** (structure, bugs, versions,
  sécurité), rapport de constats priorisés.

> Un *skill* = une commande `/quelque-chose` qu'on lance dans Claude Code. Le code des
> skills vit dans [`.claude/skills/`](../.claude/skills/), versionné avec le repo (donc
> dispo pour toi **et** pour le futur associé).

---

## L'idée

On veut pouvoir demander, à tout moment : **« où en est la boîte, qu'est-ce qui est
fort, qu'est-ce qui cloche, quelle note ? »** — et obtenir une réponse façon
**due diligence d'investisseur**, pas juste un avis sur le code.

Deux principes non négociables :

1. **Audit de l'entreprise** (produit, marché, business, croissance, tech, conformité,
   exécution) — pas seulement de la dette technique.
2. **Uniquement ce qui est évaluable depuis le repo** : `Ova___Master_Plan_v4.md`,
   `BACKLOG.md`, l'onboarding, les `rules/`, le code, la config, l'historique git, la
   mémoire projet. **Aucune donnée externe inventée.** Ce qui *manque* dans le repo
   (ex. pas de TAM, pas de chiffres de traction) devient **un constat à part entière**.

Le fil rouge de chaque audit : **l'écart entre l'ambition** (ce que promet le Master
Plan) **et la réalité** (ce qui est vraiment codé).

---

## Les 7 experts + le chef d'orchestre

| Commande | Dimension auditée | Exemples de ce qu'il regarde |
|---|---|---|
| `/audit-produit` | Produit, Vision & Expérience | les 4 piliers (Myo, Fantôme, Prédictif, ADN) promis vs livrés, PMF |
| `/audit-marche` | Marché & Positionnement | cohérence de l'analyse concurrentielle, défendabilité du moat |
| `/audit-business` | Business model & Monétisation | tarifs Free/Pro/Coach, réalisme de l'ARR, monétisation branchée ou non |
| `/audit-growth` | Croissance, Acquisition & Rétention | boucles virales codées ?, push, KPIs rétention vs moyens réels |
| `/audit-tech` | Technologie, Architecture & Scalabilité | dette (BACKLOG), coûts Supabase à l'échelle, 60 FPS, reprenabilité |
| `/audit-conformite` | Conformité, Sécurité & RGPD | données santé (art. 9), suppression compte (rejet Apple), secrets, RLS |
| `/audit-execution` | Exécution, Process & Organisation | vélocité git, CI/CD, fiabilité release (EAS/OTA/Sentry), bus factor |
| **`/audit`** | **Tout (orchestrateur)** | **lance les 7 en parallèle → note de santé globale /20** |

Chaque expert sort : une **sous-note /20**, les **forces**, les **faiblesses & angles
morts** (avec preuve `fichier`/`§`), et une **reco** par point.

---

## Comment ça marche

- **`/audit`** lance les 7 sous-audits **en parallèle** (un sous-agent par dimension),
  récupère les 7 sous-notes, calcule la **note globale pondérée** et rend un rapport
  structuré comme le `BACKLOG.md` (tableau de notes + forces + risques + plan priorisé).
- **Garde-fou** : un **bloquant critique** (app non lançable légalement, revenu
  impossible aujourd'hui, build prod cassé, risque de corruption de données) **plafonne
  la note globale** — une boîte non lançable ne décroche pas la moyenne, même avec un
  super produit.
- Tu peux aussi lancer **un seul** expert (ex. `/audit-conformite`) pour un focus.

> 🔁 **Important** : un skill fraîchement ajouté apparaît comme commande (`/audit…`,
> `/code-…`) seulement **après un reload de la fenêtre / relance de Claude Code** (la
> liste des skills est lue au démarrage).

---

## Ce que l'audit ne fait PAS

- ❌ **Aucune modification** : les audits sont en **lecture seule**. Ils n'écrivent ni
  code, ni ticket dans `BACKLOG.md` (sauf si tu le demandes explicitement ensuite).
- ❌ **Aucune donnée externe** : pas de recherche web, pas de chiffre de marché inventé.
  Ce qui n'est pas dans le repo est signalé comme **angle mort**, pas comblé au doigt mouillé.
- ❌ **Pas l'audit ligne par ligne du code** : `/audit-tech` reste au niveau
  **risque d'entreprise** (scaling, coût, vitesse). Pour le détail du code, c'est la
  **2e suite** ci-dessous (`/code-audit`).

---

## La 2e suite : `/code-audit` (le code en détail)

Là où `/audit` regarde la boîte, **`/code-audit` regarde le code, ligne par ligne, sur
tout `mobile_app/`**. Même principe (experts + orchestrateur), mais altitude ingénierie.

| Commande | Ce qu'il cherche |
|---|---|
| `/code-structure` | god-objects, duplication, couplage, TS strict, dead code, anti-patterns |
| `/code-bugs` | vrais bugs (logique, races, async, null, edge cases) **vérifiés** avant d'être listés |
| `/code-versions` | dépendances obsolètes/dépréciées, vulnérabilités (`npm audit`), alignement Expo/RN |
| `/code-security` | secrets, confiance client/RLS, Storage exposé, données en clair, auth |
| **`/code-audit`** | **lance les 4 → rapport unique priorisé** (🔴 Critique / 🟠 Majeur / 🟡 Mineur, `fichier:ligne`, fix) |

Trois niveaux à ne pas confondre :

| Outil | Portée |
|---|---|
| `/audit` | l'**entreprise** (business + tech comme actif) |
| `/code-audit` | **tout le code** (bugs, versions, structure, sécurité) |
| `/code-review`, `/security-review` (intégrés) | seulement le **diff en cours** (au quotidien) |

> Comme les audits entreprise : **lecture seule**, et ils **réutilisent les `ORA-xxx`** du
> `BACKLOG.md` sans re-signaler ce qui est déjà ✅. `/code-audit` peut ensuite **écrire les
> constats comme tickets** dans le BACKLOG — mais seulement si tu le demandes.

---

## Quand t'en servir

**Côté entreprise (`/audit`)**
- Avant une **levée / discussion associé** : `/audit` pour une photo honnête de la boîte.
- Avant un **jalon** (fin de phase, pré-lancement) : vérifier que les bloquants sont traités.
- En **focus** : `/audit-conformite` avant de soumettre aux stores, `/audit-tech` avant
  d'ouvrir le feed à plus d'utilisateurs.

**Côté code (`/code-audit`)**
- Avant une **release** : `/code-bugs` (+ `/code-security`) pour ne rien expédier de cassé.
- Après une **grosse feature ou un refactor** : `/code-audit` pour mesurer la dette ajoutée.
- En **routine dépendances** : `/code-versions` (en plus de Dependabot) pour les paquets à risque.
- Pour le **travail du jour** sur une branche, reste sur les intégrés `/code-review` et
  `/security-review` (ils ne regardent que ton diff — plus rapides).

> 💡 Tous les audits **réutilisent les IDs `ORA-xxx`** du `BACKLOG.md` et ne re-signalent
> pas ce qui est déjà ✅ fait — ils restent cohérents avec ta dette existante.

---

⬅️ Retour à l'[index](./README.md).
