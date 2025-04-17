# besoin.py


# Methode de calcul : Mifflin-St Jeor
def calcul_bmr(utilisateur):
    if utilisateur.sexe.lower() == "homme":
        return 10 * utilisateur.poids + 6.25 * utilisateur.taille - 5 * utilisateur.age + 5
    elif utilisateur.sexe.lower() == "femme":
        return 10 * utilisateur.poids + 6.25 * utilisateur.taille - 5 * utilisateur.age - 161
    else:
        raise ValueError("Sexe invalide (doit être 'homme' ou 'femme')")


def calcul_tdee(utilisateur):
    bmr = calcul_bmr(utilisateur)
    return bmr * utilisateur.activite


def ajuster_objectif(tdee, objectif):
    if objectif == "perte":
        return tdee * 0.9  # déficit de 10%
    elif objectif == "prise":
        return tdee * 1.1  # surplus de 10%
    elif objectif == "maintien":
        return tdee
    else:
        raise ValueError("Objectif invalide (doit être 'perte', 'maintien' ou 'prise')")


def calcul_macros(calories_obj, poids, ratio_prot=0.2, ratio_gluc=0.5, ratio_lip=0.3):

    # 1) calcul des protéines en g
    prot_g = (calories_obj * ratio_prot) / 4
    max_prot = 2 * poids  # 2g de protéine par kg de poids

    if prot_g > max_prot:
        # on plafonne la protéine
        prot_g = max_prot
        # calories restantes à répartir
        cal_restantes = calories_obj - (prot_g * 4)
        # on conserve les proportions relatives glucides/lipides
        total_ratio = ratio_gluc + ratio_lip
        # calories pour chaque macronutriment
        cal_gluc = cal_restantes * (ratio_gluc / total_ratio)
        cal_lip  = cal_restantes * (ratio_lip  / total_ratio)
        # conversion en grammes
        glucides = cal_gluc / 4
        lipides  = cal_lip  / 9
    else:
        # cas standard
        glucides = (calories_obj * ratio_gluc) / 4
        lipides  = (calories_obj * ratio_lip)  / 9

    return prot_g, glucides, lipides

