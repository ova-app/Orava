# Setup GitHub Orava - labels, milestones, issues CR 15/06/2026
# cd C:\Users\SofianeBESSILA\orava && .\scripts\github-setup.ps1

$REPO = "sofianebessila/Orava"
$GH   = "C:\Program Files\GitHub CLI\gh.exe"

function mklabel($name, $color, $desc) {
  & $GH label create $name --color $color --description $desc -R $REPO 2>$null
  if ($LASTEXITCODE -ne 0) {
    & $GH label edit $name --color $color --description $desc -R $REPO 2>$null
  }
}

function mkissue($title, $labels, $body) {
  & $GH issue create -R $REPO --title $title --label $labels --body $body
}

Write-Host "==> Labels"
mklabel "bug"         "d73a4a" "Anomalie reproductible"
mklabel "enhancement" "a2eeef" "Feature en cours"
mklabel "feature"     "0e8a16" "Nouvelle feature a concevoir"
mklabel "design"      "d4c5f9" "Visuel / branding"
mklabel "discussion"  "fef2c0" "A arbitrer avant implementation"
foreach ($d in @("feed","dev-env","session","profile","home","chatbot","ops","analytics","ux","social","calendar","sharing","records","branding","ai","monetization","v2","motivation")) {
  mklabel $d "ededed" "domaine: $d"
}

Write-Host "==> Milestones"
& $GH api -X POST "repos/$REPO/milestones" -f title="MVP stabilisation"    -f description="Bugs + features en cours avant tests utilisateurs" 2>$null
& $GH api -X POST "repos/$REPO/milestones" -f title="v1 features sociales" -f description="Claim, planning, galerie, story, recherche semantique" 2>$null
& $GH api -X POST "repos/$REPO/milestones" -f title="v2 monetisation"      -f description="Marketplace programmes, IA physique" 2>$null

Write-Host "==> Issues - Bugs"

mkissue "[BUG] Indicateurs du dashboard ne scrollent pas" "bug,feed" "Les cartes d'indicateurs (volume, seances, tendance, PR, duree) en haut du feed restent fixes au scroll. Attendu : elles defilent avec le contenu. Reproduit en demo sur emulateur Android."

mkissue "[BUG] Freeze emulateur lors du partage ecran Teams" "bug,dev-env" "L'emulateur Android Studio se fige quand un partage d'ecran Teams tourne en parallele (saturation CPU/RAM). Contournement : brancher un vrai device Android en USB."

mkissue "[BUG] Animation de fin de seance saccadee" "bug,session" "La transition vers le recap de seance (apres TERMINER) est saccadee avec artefacts visuels. A revoir pour une transition fluide."

mkissue "[BUG] Scroll ecran log de seance ne marche pas a la molette" "bug,session" "En session active, le defilement de la liste des series a la molette (emulateur) ne fonctionne pas."

mkissue "[BUG] App ne se relance pas apres arret partage ecran" "bug,dev-env" "Apres stop/relance du partage Teams, l'affichage de l'emulateur reste fige. Necessite un redemarrage complet."

mkissue "[BUG] Profil : section 8 dernieres seances peu lisible" "bug,profile,design" "La liste des 8 dernieres seances manque de traitement visuel. A redessiner ou remplacer par un composant calendrier."

Write-Host "==> Issues - Features en cours"

mkissue "[FEATURE] Message de bienvenue personnalise sur l'accueil" "enhancement,home" "Message anime avec le prenom a l'arrivee (ex : Bonjour Sofiane). Composant prevu mais pas encore fonctionnel."

mkissue "[FEATURE] Mode fantome - clarifier la logique de reference" "enhancement,session" "Definir et implementer la valeur de reference du ghost (max historique vs volume moyen vs derniere seance). Voir lib/ghost.ts."

mkissue "[FEATURE] Graphique 2D resume de seance - finaliser le rendu" "enhancement,session,analytics" "Finaliser rendu visuel + logique de calcul de la courbe de perf vs moyenne. Le 3D a ete abandonne pour performance."

mkissue "[FEATURE] Chatbot IA - implementation de base via API Claude" "enhancement,chatbot" "Chatbot accessible depuis l'interface principale via API Claude. V1 : resume d'entrainement sur periode + skills predefinis (analyse seance, report bug, question libre)."

mkissue "[FEATURE] Chatbot - report de bug utilisateur vers la base" "enhancement,chatbot,ops" "Signaler un bug en langage naturel via le chatbot. Categorisation auto + insert dans une table Supabase dediee pour suivi backoffice."

mkissue "[FEATURE] Carte musculaire mensuelle sur le profil" "enhancement,profile,analytics" "Schema corporel avec surbrillance des groupes les plus travailles sur le mois + top 3 muscles + graphique colore."

mkissue "[FEATURE] Historique complet des seances sur le profil" "enhancement,profile" "Section historique scrollable sous le profil, listant toutes les seances passees cliquables vers le detail."

mkissue "[FEATURE] Armurerie - affichage des PR par exercice" "enhancement,profile,records" "Afficher tous les PR par exercice : 3 types (volume seance, 1RM estime, charge max) + medailles or/argent/bronze. Partiellement implemente."

Write-Host "==> Issues - Nouvelles features"

mkissue "[FEATURE] Recherche semantique exercices en langage naturel" "feature,session,ux" "La recherche ne reconnait que les noms techniques. Permettre une description (ex : je tire une corde vers le bas pour les triceps). Ref : recherche Spotify par paroles."

mkissue "[FEATURE] Planification hebdomadaire et suivi de regularite" "feature,profile,calendar" "Planifier les seances en debut de semaine (cases a cocher). Score de regularite prevu vs realise en fin de semaine. Point vert/rouge par jour, vue calendrier mensuelle."

mkissue "[FEATURE] Systeme de Claim - mettre en avant un PR ou une seance" "feature,social,profile" "Claimer publiquement un PR/seance : bandeau sur profil public + notif push aux followers. 1 claim actif gratuit, plusieurs en premium, expiration ~7 jours."

mkissue "[FEATURE] Galerie photos personnelle avec publication selective" "feature,profile,social" "Associer des photos aux seances dans une galerie privee. Toggle mettre en public par photo. Les publiques visibles par les followers."

mkissue "[FEATURE] Partage seance en format story reseaux sociaux" "feature,social,sharing" "Generer une carte recap 9:16 (PR, score, branding Orava) partageable sur Instagram/WhatsApp depuis l'ecran de fin de seance."

mkissue "[FEATURE] Prediction de PR et objectifs chiffres" "feature,analytics,motivation" "Predire le prochain PR par exercice. + objectif perso avec pourcentage de progression mis a jour apres chaque seance. Voir lib/predictor.ts."

mkissue "[FEATURE] Graphique radar - version simplifiee debutants" "feature,analytics,ux" "Version simplifiee 2-3 dimensions (volume, intensite, recup) + score global lisible. Version complete via voir le detail ou premium."

mkissue "[FEATURE] Analyse IA du physique via photo" "feature,ai,profile,discussion" "Photo -> analyse IA : taux masse grasse estime, description physique, score natty/dope ludique. Opt-in strict. Statut : a explorer avant toute implementation."

mkissue "[FEATURE] Marketplace de programmes d'entrainement" "feature,monetization,v2" "Creer/vendre/acheter des programmes dans l'app. Profil coach, interface de creation. Post-lancement, communaute etablie requise."

mkissue "[DESIGN] Refonte du logo Orava" "design,branding" "Logo percu negativement (association anatomique involontaire). Retravailler : courbes montantes + referent sportif lisible. Piste : disque de musculation + barre centrale."

Write-Host ""
Write-Host "==> Termine. Liste des issues :"
& $GH issue list -R $REPO --limit 30
