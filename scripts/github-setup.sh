#!/usr/bin/env bash
# Setup GitHub Orava — labels, milestones, et les 24 issues du CR du 15/06/2026.
#
# Prérequis (une seule fois) :
#   1. Installer gh        : winget install GitHub.cli   (puis rouvrir le terminal)
#   2. S'authentifier      : gh auth login
#   3. Se placer dans le repo : cd /c/Users/SofianeBESSILA/orava
#
# Lancer :  bash scripts/github-setup.sh
# Idempotent : relancer ne duplique pas les labels (les issues, si).

set -uo pipefail
REPO="ova-app/Orava"

echo "==> Labels"
mklabel() { gh label create "$1" --color "$2" --description "$3" -R "$REPO" 2>/dev/null \
  || gh label edit "$1" --color "$2" --description "$3" -R "$REPO" 2>/dev/null || true; }

# Types
mklabel bug          d73a4a "Anomalie reproductible"
mklabel enhancement  a2eeef "Fonctionnalité en cours"
mklabel feature      0e8a16 "Nouvelle fonctionnalité à concevoir"
mklabel design       d4c5f9 "Visuel / branding"
mklabel discussion   fef2c0 "À arbitrer avant implémentation"
# Domaines
for d in feed dev-env session profile home chatbot ops analytics ux social calendar sharing records branding ai monetization v2 motivation; do
  mklabel "$d" ededed "domaine: $d"
done

echo "==> Milestones"
mkmilestone() { gh api -X POST "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 || true; }
mkmilestone "MVP — stabilisation"   "Bugs + features en cours avant tests utilisateurs"
mkmilestone "v1 — features sociales" "Claim, planning, galerie, story, recherche sémantique"
mkmilestone "v2 — monétisation"      "Marketplace programmes, IA physique"

echo "==> Issues"
mkissue() { gh issue create -R "$REPO" --title "$1" --label "$2" --body "$3"; }

# ---------- 🐛 BUGS ----------
mkissue "[BUG] Les indicateurs du dashboard ne scrollent pas avec la page" "bug,feed" \
"Les cartes d'indicateurs (volume, séances, tendance, PR, durée) en haut du feed restent fixes au scroll. Attendu : elles défilent avec le contenu pour libérer l'espace. Reproduit en démo sur émulateur Android."

mkissue "[BUG] Freeze de l'émulateur lors du partage d'écran Teams" "bug,dev-env" \
"L'émulateur Android Studio se fige quand un partage d'écran Teams tourne en parallèle (saturation CPU/RAM). Contournement : brancher un vrai device Android en USB."

mkissue "[BUG] Animation de fin de séance saccadée / incorrecte" "bug,session" \
"La transition vers le récap de séance (après TERMINER) est saccadée avec artefacts visuels. À revoir pour une transition fluide."

mkissue "[BUG] Le scroll de l'écran de log de séance ne marche pas à la molette" "bug,session" \
"En session active, le défilement de la liste des séries à la molette (émulateur) ne fait rien. À corriger."

mkissue "[BUG] L'app ne se relance pas après arrêt du partage d'écran" "bug,dev-env" \
"Après stop/relance du partage Teams, l'affichage de l'émulateur reste figé. Nécessite un redémarrage complet de l'émulateur."

mkissue "[BUG] Profil : section '8 dernières séances' peu lisible et sans valeur" "bug,profile,design" \
"La liste des 8 dernières séances manque de traitement visuel. À redessiner ou remplacer par un composant calendrier."

# ---------- 🔧 FEATURES EN COURS ----------
mkissue "[FEATURE] Message de bienvenue personnalisé sur l'accueil" "enhancement,home" \
"Message animé avec le prénom à l'arrivée (ex : 'Bonjour Sofiane'). Composant prévu mais pas encore fonctionnel."

mkissue "[FEATURE] Mode fantôme — clarifier la logique de référence" "enhancement,session" \
"Définir et implémenter proprement la valeur de référence du ghost (max historique vs volume moyen vs dernière séance). Voir lib/ghost.ts et .claude/rules/workout.md."

mkissue "[FEATURE] Graphique 2D de résumé de séance — finaliser le rendu" "enhancement,session,analytics" \
"Finaliser rendu visuel + logique de calcul de la courbe de perf vs moyenne. Le 3D a été abandonné (perf)."

mkissue "[FEATURE] Chatbot IA — implémentation de base (API Claude)" "enhancement,chatbot" \
"Chatbot accessible depuis l'interface principale, relié à l'API Claude. V1 : résumé d'entraînement sur période + skills prédéfinis (analyse séance, report bug, question libre)."

mkissue "[FEATURE] Chatbot — report de bug utilisateur vers la base" "enhancement,chatbot,ops" \
"Signaler un bug en langage naturel via le chatbot ; catégorisation auto + insert dans une table Supabase dédiée pour suivi backoffice."

mkissue "[FEATURE] Carte musculaire mensuelle sur le profil" "enhancement,profile,analytics" \
"Schéma corporel avec surbrillance des groupes les plus travaillés sur le mois + top 3 muscles + graphique coloré. DA pensée, implémentation jugée complexe."

mkissue "[FEATURE] Historique complet des séances sur le profil" "enhancement,profile" \
"Section 'historique' scrollable sous le profil, listant toutes les séances passées, cliquables vers le détail."

mkissue "[FEATURE] Armurerie — affichage des PR par exercice" "enhancement,profile,records" \
"Afficher tous les PR par exercice : 3 types (volume séance, 1RM estimé, charge max) + médailles or/argent/bronze (top 3). Partiellement implémenté, à mettre en valeur."

# ---------- ✨ NOUVELLES FEATURES ----------
mkissue "[FEATURE] Recherche sémantique d'exercices en langage naturel" "feature,session,ux" \
"La recherche ne reconnaît que les noms techniques (ex : 'abduction hanche machine'), inaccessible aux débutants. Permettre une recherche par description ('je tire une corde vers le bas pour les triceps'). S'appuyer sur le chatbot ou un embedding vectoriel. Réf : recherche Spotify par paroles."

mkissue "[FEATURE] Planification hebdomadaire et suivi de régularité" "feature,profile,calendar" \
"Planifier les séances en début de semaine (cases à cocher). En fin de semaine : score de régularité prévu vs réalisé. Point vert/rouge par jour, pré-remplissage optionnel du type, vue calendrier mensuelle sur le profil."

mkissue "[FEATURE] Système de 'Claim' — mettre en avant un PR ou une séance" "feature,social,profile" \
"Claimer publiquement un PR/séance : bandeau sur le profil public + notif push aux followers. 1 claim actif en gratuit, plusieurs en premium, expiration ~7 jours."

mkissue "[FEATURE] Galerie de photos personnelle avec publication sélective" "feature,profile,social" \
"Associer des photos aux séances dans une galerie privée. Toggle 'mettre en public' par photo. Les publiques sont visibles par les followers sur le profil."

mkissue "[FEATURE] Partage de séance en format 'story' réseaux sociaux" "feature,social,sharing" \
"Générer une carte récap 9:16 (PR, score de séance, branding Orava) partageable sur Instagram/WhatsApp depuis l'écran de fin de séance. Levier marketing."

mkissue "[FEATURE] Prédiction de PR et objectifs chiffrés" "feature,analytics,motivation" \
"Prédire le prochain PR atteignable par exercice (ex : '80 kg au DC dans 2 semaines'). + objectif perso (cible + échéance) avec % de progression mis à jour après chaque séance. Voir lib/predictor.ts."

mkissue "[FEATURE] Graphique radar de séance — version simplifiée débutants" "feature,analytics,ux" \
"Le radar 40 indicateurs intimide les débutants. Version simplifiée 2-3 dimensions (volume, intensité, récup) + score global lisible. Version complète via 'voir le détail' ou premium."

mkissue "[FEATURE] Analyse IA du physique via photo" "feature,ai,profile,discussion" \
"Soumettre une photo pour analyse IA : taux de masse grasse estimé, description, score 'natty/dopé' ludique. Vigilance : sensibilité (image corporelle), fiabilité (éclairage/congestion), opt-in strict. Statut : à explorer avant toute implémentation."

mkissue "[FEATURE] Marketplace de programmes d'entraînement" "feature,monetization,v2" \
"Créer/vendre/acheter des programmes dans l'app. Profil coach avec interface de création. Programmes achetés intégrés au flux de log. Prérequis : communauté établie. Post-lancement."

mkissue "[DESIGN] Refonte du logo Orava" "design,branding" \
"Logo perçu négativement (association anatomique involontaire). Conserver l'idée des courbes montantes mais rendre le référent sportif immédiatement lisible. Piste : disque de musculation (vue de face) + barre centrale. DA épurée, déclinable (Orava muscu, Orava nutrition)."

echo ""
echo "==> Terminé. Vérifier : gh issue list -R $REPO"
