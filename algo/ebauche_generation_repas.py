
import psycopg2
import random

def generer_journee_repas(conn, besoin_calories, besoin_prot, besoin_gluc, besoin_lip):
    # Répartition des apports
    portions = {
        "repas1": 0.35,
        "repas2": 0.35,
        "collation1": 0.15,
        "collation2": 0.15
    }

    cibles = {
        moment: {
            "kcal": besoin_calories * portions[moment],
            "prot": besoin_prot * portions[moment],
            "gluc": besoin_gluc * portions[moment],
            "lip": besoin_lip * portions[moment]
        } for moment in portions
    }

    repas_journee = {}

    for moment, cible in cibles.items():
        if "repas" in moment:
            repas_journee[moment] = selectionner_aliments_repas(conn, cible)
        else:
            repas_journee[moment] = selectionner_aliments_collation(conn, cible)

    return repas_journee


def selectionner_aliments_repas(conn, cible):
    with conn.cursor() as cur:
        # Sélection d'un aliment protéique
        cur.execute("""
            SELECT id, nom_ref, energie_kcal, proteines_g, glucides_g, lipides_g
            FROM aliment_macro
            JOIN aliment_repas USING(id)
            WHERE id_type_2 = 1 -- source de protéines
              AND id_fct_1 IN (1, 3)
            ORDER BY RANDOM()
            LIMIT 1
        """)
        prot = cur.fetchone()

        # Sélection d'un féculent
        cur.execute("""
            SELECT id, nom_ref, energie_kcal, proteines_g, glucides_g, lipides_g
            FROM aliment_macro
            JOIN aliment_repas USING(id)
            WHERE id_type_2 = 2 -- féculent
              AND id_fct_1 IN (1, 3)
            ORDER BY RANDOM()
            LIMIT 1
        """)
        feculent = cur.fetchone()

        # Sélection d'un légume
        cur.execute("""
            SELECT id, nom_ref, energie_kcal, proteines_g, glucides_g, lipides_g
            FROM aliment_macro
            JOIN aliment_repas USING(id)
            WHERE id_type_2 = 3 -- légume
              AND id_fct_1 IN (1, 3)
            ORDER BY RANDOM()
            LIMIT 1
        """)
        legume = cur.fetchone()

        return [prot, feculent, legume]


def selectionner_aliments_collation(conn, cible):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, nom_ref, energie_kcal, proteines_g, glucides_g, lipides_g
            FROM aliment_macro
            JOIN aliment_repas USING(id)
            WHERE id_fct_1 IN (2, 3)
            ORDER BY RANDOM()
            LIMIT 1
        """)
        collation = cur.fetchone()
        return [collation]
