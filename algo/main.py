# main.py

from user import Utilisateur
from besoin import calcul_bmr, calcul_tdee, ajuster_objectif, calcul_macros


# Exemple utilisateur
u = Utilisateur(sexe="homme", age=23, poids=71, taille=182, activite=1.725, objectif="maintien")


# Calcul des besoins
bmr = calcul_bmr(u)
tdee = calcul_tdee(u)
calories_obj = ajuster_objectif(tdee, u.objectif)
proteines, glucides, lipides = calcul_macros(calories_obj, u.poids)

print(f"TDEE ajusté ({u.objectif}) : {calories_obj:.0f} kcal")
print(f"Répartition journalière :")
print(f" - Protéines : {proteines:.0f} g")
print(f" - Glucides  : {glucides:.0f} g")
print(f" - Lipides   : {lipides:.0f} g")
