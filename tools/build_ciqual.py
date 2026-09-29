"""Convertit la table Ciqual (xlsx ANSES) en docs/data/ciqual.json compact.
Usage : uvx --with openpyxl python tools/build_ciqual.py chemin/ciqual.xlsx
Source : Anses. 2025. Table de composition nutritionnelle des aliments Ciqual (Licence Etalab 2.0)."""
import json, sys, openpyxl

# clé -> index de colonne dans la table Ciqual 2025 (valeurs pour 100 g)
COLS = {
    "kcal": 10, "prot": 14, "gluc": 16, "lip": 17, "sucres": 18, "fibres": 26, "ags": 31, "sel": 49,
    "ca": 50, "cu": 52, "fe": 53, "iode": 54, "mg": 55, "p": 57, "k": 58, "se": 59, "na": 60, "zn": 61,
    "vitA": 62, "vitD": 65, "vitE": 69, "vitK": 70, "vitC": 72, "b1": 73, "b2": 74, "b3": 75, "b5": 76,
    "b6": 77, "b9": 78, "b12": 82, "ala": 44,
}
EPA, DHA = 46, 47  # g/100 g, additionnés en "epadha" (mg/100 g)

def num(v):
    if v is None: return None
    s = str(v).strip().replace(",", ".")
    if s in ("", "-"): return None
    if s == "traces": return 0
    if s.startswith("<"): return round(float(s[1:].strip()) / 2, 4)
    return float(s)

rows = openpyxl.load_workbook(sys.argv[1], read_only=True).active.iter_rows(values_only=True)
next(rows)
foods = []
for r in rows:
    vals = [num(r[i]) for i in COLS.values()]
    if vals[0] is None: continue  # pas d'énergie : inutilisable
    b9 = list(COLS).index("b9")
    if vals[b9] is None: vals[b9] = num(r[79])  # B9 : folates totaux si DFE absent
    epa, dha = num(r[EPA]), num(r[DHA])
    vals.append(None if epa is None and dha is None else round(((epa or 0) + (dha or 0)) * 1000, 1))
    foods.append([r[7].strip(), (r[3] or "").strip()] + vals)
json.dump({"keys": list(COLS) + ["epadha"], "foods": foods}, open("docs/data/ciqual.json", "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print(len(foods), "aliments")
