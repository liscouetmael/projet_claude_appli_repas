// ---------- Stockage (uniquement sur le téléphone) ----------
const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } };
const ecrire = (cle, val) => localStorage.setItem(cle, JSON.stringify(val));

let profil = lire("profil", null);
let journal = lire("journal", {});          // { "2026-09-29": [{ nom, g, repas, n: {nutriments} }] }
let placard = lire("placard", []);          // [nom Ciqual]
let ustensiles = lire("ustensiles", ["Plaque de cuisson", "Casserole", "Poêle", "Four", "Micro-ondes"]);
let CIQUAL = { keys: [], foods: [] };

const $ = s => document.querySelector(s);
const aujourdhui = () => new Date().toLocaleDateString("sv"); // AAAA-MM-JJ, heure locale
let dateCourante = aujourdhui();

const arrondi = (v, u) => u === "kcal" || v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(0) : v.toFixed(1);
const echapper = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- Navigation ----------
const TITRES = { jour: "Aujourd'hui", ajout: "Ajouter", repas: "Idées repas", placard: "Placard", profil: "Profil" };
function afficherVue(v) {
  document.querySelectorAll(".vue").forEach(s => s.hidden = s.id !== v);
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("actif", b.dataset.vue === v));
  $("#titre").textContent = TITRES[v];
  if (v === "jour") rendreJour();
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => afficherVue(b.dataset.vue));
$("#refresh").onclick = () => location.reload();

// ---------- Recherche Ciqual ----------
const normaliser = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function chercher(texte) {
  const mots = normaliser(texte).split(/\s+/).filter(Boolean);
  if (!mots.length) return [];
  return CIQUAL.foods
    .filter(f => { const n = normaliser(f[0]); return mots.every(m => n.includes(m)); })
    .sort((a, b) => a[0].length - b[0].length)
    .slice(0, 30);
}
// Nom exact d'abord, puis sans tenir compte des majuscules ni des accents.
const alimentParNom = nom => CIQUAL.foods.find(f => f[0] === nom)
  || CIQUAL.foods.find(f => normaliser(f[0]) === normaliser(nom.trim()));

// ---------- Vue Jour ----------
function barre(nom, val, cible, unite, sens) {
  const [bas, haut] = Array.isArray(cible) ? cible : [cible, cible];
  const pct = Math.min(100, (val / haut) * 100);
  const trop = sens === "max" ? val > haut : !sens && val > haut * 1.1;
  const ok = sens === "min" ? val >= bas : !trop && val >= bas * 0.9;
  const cibleTxt = Array.isArray(cible) ? `${arrondi(bas)}–${arrondi(haut)}` : (sens === "max" ? "max " : "") + arrondi(cible, unite);
  return `<div class="barre ${trop ? "trop" : ok ? "ok" : ""}">
    <div class="barre-txt"><span>${nom}</span><span>${arrondi(val, unite)} / ${cibleTxt} ${unite}</span></div>
    <div class="barre-fond"><div style="width:${pct}%"></div></div></div>`;
}

function rendreJour() {
  $("#date").value = dateCourante;
  const entrees = journal[dateCourante] || [];
  const total = additionner(entrees.map(e => e.n));
  if (!profil) {
    $("#energie").innerHTML = `<p>Commence par remplir ton <a href="#" onclick="afficherVue('profil')">profil</a> pour calculer tes besoins.</p>`;
    $("#macros").innerHTML = $("#micros").innerHTML = "";
  } else {
    const b = besoins(profil);
    const reste = b.kcal - total.kcal;
    $("#energie").innerHTML = `<div class="gros">${Math.round(total.kcal)} <small>/ ${Math.round(b.kcal)} kcal</small></div>
      <p class="petit">${reste >= 0 ? `Il reste ${Math.round(reste)} kcal` : `${Math.round(-reste)} kcal au-dessus de l'objectif`}</p>
      <div class="barre ${reste < -b.kcal * 0.1 ? "trop" : "ok"}"><div class="barre-fond"><div style="width:${Math.min(100, total.kcal / b.kcal * 100)}%"></div></div></div>`;
    $("#macros").innerHTML = MACROS.map(k => barre(NUTRIMENTS[k].nom, total[k], b[k], NUTRIMENTS[k].unite, NUTRIMENTS[k].sens)).join("");
    $("#micros").innerHTML = MICROS.map(k => barre(NUTRIMENTS[k].nom, total[k], b[k], NUTRIMENTS[k].unite, "min")).join("");
  }
  $("#journal").innerHTML = entrees.length ? entrees.map((e, i) =>
    `<li><div><strong>${echapper(e.nom)}</strong><br><span class="petit">${e.repas} · ${Math.round(e.g)} g · ${Math.round(e.n.kcal)} kcal</span></div>
     <button class="suppr" data-i="${i}" aria-label="Supprimer">✕</button></li>`).join("")
    : `<li class="petit">Rien de noté pour ce jour.</li>`;
  $("#journal").querySelectorAll(".suppr").forEach(b => b.onclick = () => {
    journal[dateCourante].splice(+b.dataset.i, 1);
    ecrire("journal", journal); rendreJour();
  });
}
function decalerJour(n) {
  const d = new Date(dateCourante + "T12:00"); d.setDate(d.getDate() + n);
  dateCourante = d.toLocaleDateString("sv"); rendreJour();
}
$("#jour-prec").onclick = () => decalerJour(-1);
$("#jour-suiv").onclick = () => decalerJour(1);
$("#date").onchange = e => { dateCourante = e.target.value || aujourdhui(); rendreJour(); };

function ajouterAuJournal(entree) {
  (journal[dateCourante] ||= []).push(entree);
  ecrire("journal", journal);
}

// ---------- Vue Ajouter ----------
let alimentChoisi = null;
$("#recherche").oninput = e => {
  const liste = chercher(e.target.value);
  $("#resultats").innerHTML = liste.map((f, i) =>
    `<li data-i="${i}"><div>${echapper(f[0])}<br><span class="petit">${Math.round(f[2])} kcal / 100 g</span></div></li>`).join("");
  $("#resultats").querySelectorAll("li").forEach(li => li.onclick = () => {
    alimentChoisi = liste[li.dataset.i];
    $("#ajout-nom").textContent = alimentChoisi[0];
    $("#form-ajout").hidden = false;
    $("#resultats").innerHTML = "";
    apercu();
    $("#ajout-g").focus();
  });
};
function apercu() {
  if (!alimentChoisi) return;
  const n = nutrimentsDe(alimentChoisi, +$("#ajout-g").value || 0);
  $("#ajout-apercu").textContent = `${Math.round(n.kcal)} kcal · ${n.prot.toFixed(1)} g protéines · ${n.gluc.toFixed(1)} g glucides · ${n.lip.toFixed(1)} g lipides`;
}
$("#ajout-g").oninput = apercu;
$("#form-ajout").onsubmit = e => {
  e.preventDefault();
  const g = +$("#ajout-g").value;
  if (!alimentChoisi || !g) return;
  ajouterAuJournal({ nom: alimentChoisi[0], g, repas: $("#ajout-repas").value, n: nutrimentsDe(alimentChoisi, g) });
  $("#form-ajout").hidden = true; $("#recherche").value = ""; alimentChoisi = null;
  afficherVue("jour");
};
// Repas proposé selon l'heure
const h = new Date().getHours();
$("#ajout-repas").value = $("#sugg-repas").value = h < 10 ? "Petit-déjeuner" : h < 15 ? "Déjeuner" : h < 18 ? "Collation" : "Dîner";

// ---------- Vue Placard ----------
const USTENSILES_COURANTS = ["Plaque de cuisson", "Casserole", "Poêle", "Four", "Micro-ondes", "Mixeur",
  "Cuiseur à riz", "Friteuse à air", "Autocuiseur", "Wok", "Grille-pain", "Robot cuiseur"];

function rendrePlacard() {
  $("#placard-liste").innerHTML = placard.length ? placard.map((nom, i) =>
    `<li><span>${echapper(nom)}</span><button class="suppr" data-i="${i}" aria-label="Retirer">✕</button></li>`).join("")
    : `<li class="petit">Placard vide : ajoute ce que tu as chez toi.</li>`;
  $("#placard-liste").querySelectorAll(".suppr").forEach(b => b.onclick = () => {
    placard.splice(+b.dataset.i, 1); ecrire("placard", placard); rendrePlacard();
  });
  const tous = [...new Set([...USTENSILES_COURANTS, ...ustensiles])];
  $("#ustensiles").innerHTML = tous.map(u =>
    `<button class="puce ${ustensiles.includes(u) ? "actif" : ""}">${echapper(u)}</button>`).join("");
  $("#ustensiles").querySelectorAll(".puce").forEach(b => b.onclick = () => {
    const u = b.textContent;
    ustensiles = ustensiles.includes(u) ? ustensiles.filter(x => x !== u) : [...ustensiles, u];
    ecrire("ustensiles", ustensiles); rendrePlacard();
  });
}
$("#placard-recherche").oninput = e => {
  const liste = chercher(e.target.value).filter(f => !placard.includes(f[0]));
  $("#placard-resultats").innerHTML = liste.map((f, i) => `<li data-i="${i}">${echapper(f[0])}</li>`).join("");
  $("#placard-resultats").querySelectorAll("li").forEach(li => li.onclick = () => {
    placard.push(liste[li.dataset.i][0]); ecrire("placard", placard);
    $("#placard-recherche").value = ""; $("#placard-resultats").innerHTML = ""; rendrePlacard();
  });
};
$("#form-ustensile").onsubmit = e => {
  e.preventDefault();
  const u = $("#ustensile-autre").value.trim();
  if (u && !ustensiles.includes(u)) { ustensiles.push(u); ecrire("ustensiles", ustensiles); }
  $("#ustensile-autre").value = ""; rendrePlacard();
};

// ---------- Vue Profil ----------
const form = $("#form-profil");
function rendreProfil() {
  if (profil) for (const [k, v] of Object.entries(profil)) if (form.elements[k]) form.elements[k].value = v;
  form.querySelector("[data-femme]").hidden = form.elements.sexe.value !== "F";
  if (profil) {
    const b = besoins(profil);
    $("#profil-besoins").textContent = `Besoins estimés : ${Math.round(b.kcal)} kcal/j · protéines ≥ ${Math.round(b.prot)} g · fer ${b.fe} mg · calcium ${b.ca} mg.`;
  }
  $("#cle-api").value = localStorage.getItem("cleApi") || "";
}
form.elements.sexe.onchange = () => form.querySelector("[data-femme]").hidden = form.elements.sexe.value !== "F";
form.onsubmit = e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  profil = { ...d, age: +d.age, poids: +d.poids, taille: +d.taille, nap: +d.nap, situation: d.sexe === "F" ? d.situation || "" : "" };
  ecrire("profil", profil); rendreProfil();
};
$("#cle-enregistrer").onclick = () => { localStorage.setItem("cleApi", $("#cle-api").value.trim()); alert("Clé enregistrée."); };
$("#export").onclick = async () => {
  const txt = JSON.stringify({ profil, journal, placard, ustensiles });
  try { await navigator.clipboard.writeText(txt); alert("Sauvegarde copiée : colle-la dans une note."); }
  catch { $("#import-texte").value = txt; alert("Copie impossible : la sauvegarde est affichée dans le champ ci-dessous."); }
};
$("#import").onclick = () => {
  try {
    const d = JSON.parse($("#import-texte").value);
    for (const k of ["profil", "journal", "placard", "ustensiles"]) if (d[k] !== undefined) ecrire(k, d[k]);
    location.reload();
  } catch { alert("Sauvegarde invalide."); }
};

// ---------- Vue Repas : suggestions par Claude ----------
const MODELE = "claude-opus-5-5";
// Format de réponse imposé (structured outputs) : du JSON conforme à ce schéma.
const SCHEMA_REPAS = {
  type: "object",
  additionalProperties: false,
  required: ["repas"],
  properties: {
    repas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nom", "type", "pourquoi", "temps_minutes", "ustensiles", "ingredients", "etapes"],
        properties: {
          nom: { type: "string" },
          type: { type: "string", enum: ["nutrition", "plaisir"] },
          pourquoi: { type: "string", description: "Une phrase : ce que ce repas apporte par rapport aux manques du jour." },
          temps_minutes: { type: "integer" },
          ustensiles: { type: "array", items: { type: "string" } },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["aliment", "grammes"],
              properties: {
                aliment: { type: "string", description: "Nom EXACT d'un aliment de la liste du placard." },
                grammes: { type: "number" },
              },
            },
          },
          etapes: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

function manquesDuJour() {
  const b = besoins(profil);
  const t = additionner((journal[dateCourante] || []).map(e => e.n));
  const lignes = [`Énergie restante : ${Math.round(b.kcal - t.kcal)} kcal`];
  for (const k of [...MACROS, ...MICROS]) {
    const { nom, unite, sens } = NUTRIMENTS[k];
    const cible = Array.isArray(b[k]) ? b[k][0] : b[k];
    if (sens === "max") lignes.push(`${nom} : ${arrondi(t[k], unite)} ${unite} consommés (max ${arrondi(b[k], unite)})`);
    else if (t[k] < cible) lignes.push(`${nom} : manque ${arrondi(cible - t[k], unite)} ${unite}`);
  }
  return lignes.join("\n");
}

// Vérifie les prérequis ; renvoie un message d'erreur ou "".
function prerequisSuggestions() {
  if (!profil) return "Remplis d'abord ton profil.";
  if (placard.length < 2) return "Ajoute au moins quelques aliments à ton placard.";
  return "";
}

function construirePrompt(repas) {
  return `Tu es diététicien et cuisinier. Propose 5 idées pour le ${repas.toLowerCase()} :
- 2 repas de type "nutrition" : ils comblent au mieux les manques nutritionnels ci-dessous ;
- 3 repas de type "plaisir" : gourmands mais qui restent équilibrés et sains.
Contraintes strictes :
- n'utilise QUE des aliments de la liste du placard, en recopiant leur nom exactement (eau, sel, poivre et épices sèches sont toujours disponibles et ne sont pas à lister) ;
- n'utilise QUE les ustensiles listés ;
- quantités en grammes pour UNE personne, adaptées à un ${repas.toLowerCase()} et à l'énergie restante ;
- étapes courtes et claires.
Profil : ${profil.sexe === "H" ? "homme" : "femme"}, ${profil.age} ans, ${profil.poids} kg, objectif ${profil.objectif}.
Régime / allergies / refus : ${profil.regime || "aucun"}.
Envie : ${$("#sugg-envie").value || "aucune en particulier"}.

Bilan nutritionnel du jour :
${manquesDuJour()}

Placard :
${placard.join("\n")}

Ustensiles : ${ustensiles.join(", ")}`;
}

// Option gratuite : copier la demande pour la coller dans l'appli Claude (ou une autre IA).
$("#sugg-copier").onclick = async () => {
  const etat = $("#sugg-etat");
  const erreur = prerequisSuggestions();
  if (erreur) return etat.textContent = erreur;
  const texte = construirePrompt($("#sugg-repas").value) + `

Pour chaque repas, donne : le nom, le type (nutrition ou plaisir), une phrase sur ce qu'il apporte, le temps de préparation,
les ingrédients en grammes et les étapes (pas besoin de calculer les calories).

Termine OBLIGATOIREMENT ta réponse par ce bloc, sans mise en forme, avec les noms d'aliments recopiés exactement depuis le placard :
### ASSIETTE
REPAS: <nom du repas> | <nutrition ou plaisir>
<nom exact de l'aliment> ; <grammes>
<nom exact de l'aliment> ; <grammes>
REPAS: <nom du repas suivant> | <nutrition ou plaisir>
...
### FIN`;
  try {
    await navigator.clipboard.writeText(texte);
    etat.textContent = "Demande copiée : colle-la dans l'appli Claude.";
    $("#sugg-texte").hidden = true;
  } catch {
    $("#sugg-texte").value = texte;
    $("#sugg-texte").hidden = false;
    $("#sugg-texte").select();
    etat.textContent = "Copie automatique impossible : sélectionne le texte ci-dessous et copie-le.";
  }
};

// Lit le bloc "### ASSIETTE" de la réponse collée : lignes "REPAS: nom | type" puis "aliment ; grammes".
function lireReponse(texte) {
  const repas = [];
  for (const brut of texte.split("\n")) {
    const ligne = brut.replace(/^[\s>*`•-]+|[`*]+$/g, "").trim();
    const m = ligne.match(/^REPAS\s*:\s*(.+?)\s*(?:\|\s*(\w+))?$/i);
    if (m) repas.push({ nom: m[1], type: normaliser(m[2] || "").startsWith("nutri") ? "nutrition" : "plaisir", ingredients: [] });
    else if (repas.length && ligne.includes(";")) {
      const [aliment, g] = ligne.split(";");
      const grammes = parseFloat(g.replace(",", "."));
      if (aliment.trim() && grammes > 0) repas.at(-1).ingredients.push({ aliment: aliment.trim(), grammes });
    }
  }
  return repas.filter(r => r.ingredients.length);
}
$("#reponse-calculer").onclick = () => {
  const liste = lireReponse($("#reponse-texte").value);
  if (!liste.length) return $("#sugg-etat").textContent = "Bloc « ### ASSIETTE » introuvable dans le texte collé : copie bien toute la réponse de Claude.";
  $("#sugg-etat").textContent = "";
  rendreSuggestions(liste, $("#sugg-repas").value);
};

$("#sugg-go").onclick = async () => {
  const cle = localStorage.getItem("cleApi");
  const etat = $("#sugg-etat");
  const erreur = prerequisSuggestions() || (cle ? "" : "Pas de clé API : utilise « Copier la demande », ou ajoute une clé dans Profil.");
  if (erreur) return etat.textContent = erreur;
  etat.textContent = "Réflexion en cours… (jusqu'à une minute)";
  $("#sugg-go").disabled = true;
  const repas = $("#sugg-repas").value;
  const prompt = construirePrompt(repas);

  try {
    const rep = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "anthropic-beta": "server-side-fallback-2026-07-01", // bascule auto sur un autre modèle en cas de refus
      },
      body: JSON.stringify({
        model: MODELE, max_tokens: 16000, fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_REPAS } },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await rep.json();
    if (!rep.ok) throw new Error(data.error?.message || rep.status);
    if (data.stop_reason === "refusal") throw new Error("demande refusée par le modèle, reformule ton envie.");
    if (data.stop_reason === "max_tokens") throw new Error("réponse trop longue, réessaie.");
    const texte = data.content.filter(c => c.type === "text").map(c => c.text).join("");
    rendreSuggestions(JSON.parse(texte).repas, repas);
    etat.textContent = "";
  } catch (err) {
    etat.textContent = "Erreur : " + err.message;
  } finally {
    $("#sugg-go").disabled = false;
  }
};

// La valeur nutritionnelle est calculée par l'appli à partir de Ciqual, pas estimée par l'IA.
function rendreSuggestions(liste, repas) {
  const b = besoins(profil);
  $("#suggestions").innerHTML = "";
  for (const r of liste) {
    const tous = r.ingredients.map(i => ({ ...i, f: alimentParNom(i.aliment) }));
    const ingr = tous.filter(i => i.f && i.grammes > 0);
    const ignores = tous.filter(i => !i.f).map(i => i.aliment);
    const n = additionner(ingr.map(i => nutrimentsDe(i.f, i.grammes)));
    const forts = MICROS.map(k => [k, n[k] / b[k]]).sort((a, c) => c[1] - a[1]).slice(0, 4)
      .map(([k, p]) => `${NUTRIMENTS[k].nom} ${Math.round(p * 100)} %`).join(" · ");
    const carte = document.createElement("div");
    carte.className = "carte recette";
    carte.innerHTML = `
      <span class="badge ${r.type}">${r.type === "nutrition" ? "Nutrition" : "Plaisir healthy"}</span>
      <h3>${echapper(r.nom)}</h3>
      ${r.pourquoi ? `<p class="petit">${echapper(r.pourquoi)} · ${r.temps_minutes} min · ${echapper(r.ustensiles.join(", "))}</p>` : ""}
      <p><strong>${Math.round(n.kcal)} kcal</strong> · P ${n.prot.toFixed(0)} g · G ${n.gluc.toFixed(0)} g · L ${n.lip.toFixed(0)} g · Fibres ${n.fibres.toFixed(0)} g</p>
      <p class="petit">Couvre : ${forts} de tes besoins du jour</p>
      <details><summary>Ingrédients et recette</summary>
        <ul>${ingr.map(i => `<li>${Math.round(i.grammes)} g ${echapper(i.aliment)}</li>`).join("")}</ul>
        ${ignores.length ? `<p class="petit">Hors placard, non compté : ${echapper(ignores.join(", "))}</p>` : ""}
        ${r.etapes ? `<ol>${r.etapes.map(e => `<li>${echapper(e)}</li>`).join("")}</ol>` : ""}
      </details>
      <button>J'ai mangé ça</button>`;
    carte.querySelector("button").onclick = () => {
      for (const i of ingr) ajouterAuJournal({ nom: `${i.aliment} (${r.nom})`, g: i.grammes, repas, n: nutrimentsDe(i.f, i.grammes) });
      afficherVue("jour");
    };
    $("#suggestions").append(carte);
  }
}

// ---------- Démarrage ----------
(async function chargerCiqual(essais = 4) {
  try { CIQUAL = await (await fetch("data/ciqual.json")).json(); }
  catch {
    if (essais > 1) return setTimeout(() => chargerCiqual(essais - 1), 1000);
    alert("La base d'aliments n'a pas pu être chargée : appuie sur ⟳.");
  }
})();
rendreProfil(); rendrePlacard();
afficherVue(profil ? "jour" : "profil");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
