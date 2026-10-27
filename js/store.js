// Stockage local (sur le téléphone). Aucune donnée ne quitte l'appareil.
const KEY = 'muscu.data.v1';

const DEFAULT = {
  version: 1,
  settings: {
    calorieGoal: 2200,
    deficitGoal: 500,
    proteinGoal: 160,
    weightGoal: 74,
    targetDate: '2026-12-31',
    heightCm: null,
  },
  meals: [],    // {id, date, name, kcal, protein}
  burn: [],     // {id, date, kcal}  dépense totale du jour (une entrée par jour)
  alcohol: [],  // {id, date, value}  true = alcool, false = sans (saisie manuelle)
  steps: [],    // {id, date, steps}  (une entrée par jour)
  rides: [],    // {id, date, minutes, km, kcal, notes}
  workouts: [], // {id, date, name, exercises: [{name, sets: [{reps, weight}]}], notes}
  body: [],     // {id, date, weight}  pesées (anciennes entrées : bodyfat, waist)
  visbody: [],  // {id, date, bodyfat, fatMass, smm, weight}  relevés Visbody
  labs: [],     // (ancienne section Labo, conservée pour ne pas perdre de données)
};

let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return merge(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT);
  }
}

function merge(obj) {
  const base = structuredClone(DEFAULT);
  for (const k of Object.keys(base)) {
    if (k === 'settings') base.settings = { ...base.settings, ...(obj.settings || {}) };
    else if (Array.isArray(base[k])) base[k] = Array.isArray(obj[k]) ? obj[k] : [];
  }
  return base;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    alert("Impossible d'enregistrer : " + e.message);
  }
  listeners.forEach((fn) => fn());
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const store = {
  get: () => data,
  settings: () => data.settings,
  onChange: (fn) => listeners.add(fn),

  add(collection, item) {
    data[collection].push({ id: uid(), ...item });
    save();
  },
  update(collection, id, patch) {
    const it = data[collection].find((x) => x.id === id);
    if (it) Object.assign(it, patch);
    save();
  },
  remove(collection, id) {
    data[collection] = data[collection].filter((x) => x.id !== id);
    save();
  },
  // Une seule valeur de pas par jour : on remplace si elle existe déjà.
  setSteps(date, steps) {
    const it = data.steps.find((x) => x.date === date);
    if (it) it.steps = steps;
    else data.steps.push({ id: uid(), date, steps });
    save();
  },
  // Dépense totale du jour (null = effacer)
  setBurn(date, kcal) {
    data.burn = data.burn.filter((x) => x.date !== date);
    if (kcal != null) data.burn.push({ id: uid(), date, kcal });
    save();
  },
  setAlcohol(date, value) {
    data.alcohol = data.alcohol.filter((x) => x.date !== date);
    if (value != null) data.alcohol.push({ id: uid(), date, value });
    save();
  },
  setSettings(patch) {
    Object.assign(data.settings, patch);
    save();
  },

  exportJSON: () => JSON.stringify(data, null, 2),
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || !parsed) throw new Error('Fichier invalide');
    data = merge(parsed);
    save();
  },
  reset() {
    data = structuredClone(DEFAULT);
    save();
  },
};
