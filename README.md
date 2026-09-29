# Assiette

Application web (installable sur iPhone) pour suivre ses calories et nutriments, comparés aux références de l'Anses, et obtenir des idées de repas à partir de son placard et de ses ustensiles.

- `docs/` : l'application (HTML/CSS/JS sans dépendance), publiée par GitHub Pages.
- `docs/data/ciqual.json` : composition des aliments, générée par `tools/build_ciqual.py` depuis la table Ciqual 2025.

## Installer sur l'iPhone

1. Ouvrir l'adresse GitHub Pages du dépôt dans **Safari**.
2. Bouton Partager → **Sur l'écran d'accueil**.

Les données (profil, journal, placard, clé API) restent uniquement sur le téléphone. Pensez à exporter une sauvegarde depuis Profil.

## Mettre à jour la table Ciqual

```bash
uvx --with openpyxl python tools/build_ciqual.py "Table Ciqual 2025_FR_2025_11_03.xlsx"
```

## Sources

- Anses (2021), avis 2018-SA-0238 : références nutritionnelles en vitamines et minéraux.
- Anses (2016) : références pour les macronutriments ; dépense énergétique de repos selon Black et al. (1996).
- Anses (2025), table de composition nutritionnelle des aliments Ciqual — Licence Etalab 2.0.

Outil indicatif : il ne remplace pas l'avis d'un médecin ou d'un diététicien.
