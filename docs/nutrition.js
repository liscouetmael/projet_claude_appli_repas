// Besoins nutritionnels d'un adulte selon l'Anses.
// Vitamines et minéraux : avis Anses 2018-SA-0238 (2021), tableaux 2 et 3 (RNP ou AS).
// Macronutriments : Anses 2016 (protéines 0,83 g/kg, lipides 35-40 %, glucides 40-55 %, fibres 30 g, sucres < 100 g, AGS ≤ 12 %).
// Sel : repère PNNS / OMS < 5 g/j.

// Libellés, unités et sens de lecture : "min" = à atteindre, "max" = à ne pas dépasser.
const NUTRIMENTS = {
  kcal:   { nom: "Énergie",       unite: "kcal" },
  prot:   { nom: "Protéines",     unite: "g",  sens: "min" },
  gluc:   { nom: "Glucides",      unite: "g" },
  lip:    { nom: "Lipides",       unite: "g" },
  fibres: { nom: "Fibres",        unite: "g",  sens: "min" },
  sucres: { nom: "Sucres",        unite: "g",  sens: "max" },
  ags:    { nom: "AG saturés",    unite: "g",  sens: "max" },
  sel:    { nom: "Sel",           unite: "g",  sens: "max" },
  vitA:   { nom: "Vitamine A",    unite: "µg", sens: "min" },
  b1:     { nom: "Vitamine B1",   unite: "mg", sens: "min" },
  b2:     { nom: "Vitamine B2",   unite: "mg", sens: "min" },
  b3:     { nom: "Vitamine B3",   unite: "mg", sens: "min" },
  b5:     { nom: "Vitamine B5",   unite: "mg", sens: "min" },
  b6:     { nom: "Vitamine B6",   unite: "mg", sens: "min" },
  b9:     { nom: "Vitamine B9",   unite: "µg", sens: "min" },
  b12:    { nom: "Vitamine B12",  unite: "µg", sens: "min" },
  vitC:   { nom: "Vitamine C",    unite: "mg", sens: "min" },
  vitD:   { nom: "Vitamine D",    unite: "µg", sens: "min" },
  vitE:   { nom: "Vitamine E",    unite: "mg", sens: "min" },
  vitK:   { nom: "Vitamine K",    unite: "µg", sens: "min" },
  ca:     { nom: "Calcium",       unite: "mg", sens: "min" },
  cu:     { nom: "Cuivre",        unite: "mg", sens: "min" },
  fe:     { nom: "Fer",           unite: "mg", sens: "min" },
  iode:   { nom: "Iode",          unite: "µg", sens: "min" },
  mg:     { nom: "Magnésium",     unite: "mg", sens: "min" },
  p:      { nom: "Phosphore",     unite: "mg", sens: "min" },
  k:      { nom: "Potassium",     unite: "mg", sens: "min" },
  se:     { nom: "Sélénium",      unite: "µg", sens: "min" },
  zn:     { nom: "Zinc",          unite: "mg", sens: "min" },
};
const MACROS = ["prot", "gluc", "lip", "fibres", "sucres", "ags", "sel"];
const MICROS = ["vitA", "b1", "b2", "b3", "b5", "b6", "b9", "b12", "vitC", "vitD", "vitE", "vitK",
                "ca", "cu", "fe", "iode", "mg", "p", "k", "se", "zn"];

// Valeurs par groupe : [homme, femme, enceinte, allaitante]
const MICRO_REF = {
  vitA: [750, 650, 700, 1300], b2: [1.6, 1.6, 1.9, 2.0], b5: [6, 5, 5, 7], b6: [1.7, 1.6, 1.8, 1.7],
  b9: [330, 330, 600, 500], b12: [4, 4, 4.5, 5], vitC: [110, 110, 120, 170], vitD: [15, 15, 15, 15],
  vitE: [10, 9, 9, 9], vitK: [79, 79, 79, 79], cu: [1.9, 1.5, 1.7, 1.7], iode: [150, 150, 200, 200],
  mg: [380, 300, 300, 300], p: [550, 550, 550, 550], k: [3500, 3500, 3500, 4000], se: [70, 70, 70, 85],
  zn: [11.7, 9.3, 9.3, 9.3], // RNP pour un apport modéré en phytates (600 mg/j)
};

function besoins(p) {
  const homme = p.sexe === "H";
  const sit = homme ? "" : p.situation;
  // Dépense de repos, Black et al. 1996 (MJ/j) — équation utilisée par l'Anses.
  const mj = (homme ? 1.083 : 0.963) * p.poids ** 0.48 * (p.taille / 100) ** 0.5 * p.age ** -0.13;
  let kcal = mj * 239 * p.nap;
  if (p.objectif === "perte") kcal *= 0.85;
  if (p.objectif === "prise") kcal *= 1.1;
  if (sit === "enceinte") kcal += 300; // moyenne sur la grossesse (≈ +70 à +450 kcal selon le trimestre)
  if (sit === "allaitante") kcal += 500;
  const i = homme ? 0 : sit === "enceinte" ? 2 : sit === "allaitante" ? 3 : 1;
  const b = {
    kcal,
    prot: 0.83 * p.poids,
    gluc: [kcal * 0.40 / 4, kcal * 0.55 / 4],
    lip: [kcal * 0.35 / 9, kcal * 0.40 / 9],
    fibres: 30, sucres: 100, ags: kcal * 0.12 / 9, sel: 5,
    b1: 0.1 * kcal / 239,  // 0,1 mg/MJ
    b3: 1.6 * kcal / 239,  // 1,6 mg EN/MJ
    ca: p.age < 25 ? 1000 : 950,
    fe: homme || sit === "menopause" || sit === "" ? 11 : 16,
  };
  for (const [k, v] of Object.entries(MICRO_REF)) b[k] = v[i];
  return b;
}

// Nutriments d'une quantité (g) d'un aliment Ciqual. Valeur manquante = 0.
function nutrimentsDe(aliment, grammes) {
  const r = {};
  CIQUAL.keys.forEach((k, j) => { r[k] = (aliment[j + 2] || 0) * grammes / 100; });
  return r;
}

function additionner(liste) {
  const t = Object.fromEntries(Object.keys(NUTRIMENTS).map(k => [k, 0]));
  for (const n of liste) for (const k in t) t[k] += n[k] || 0;
  return t;
}
