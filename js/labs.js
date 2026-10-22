// Marqueurs de bilan sanguin pré-remplis.
// Les plages sont INDICATIVES (adulte, valeurs usuelles des labos français) :
// elles ne remplacent pas les normes imprimées sur ton compte-rendu ni l'avis d'un médecin.
export const LAB_MARKERS = [
  { key: 'testo', name: 'Testostérone totale', unit: 'ng/mL', range: [3, 10] },
  { key: 'testo_libre', name: 'Testostérone libre', unit: 'pg/mL', range: [50, 210] },
  { key: 'dfg', name: 'DFG (CKD-EPI)', unit: 'mL/min/1,73m²', range: [90, null] },
  { key: 'creat', name: 'Créatinine', unit: 'mg/L', range: [7, 12] },
  { key: 'glyc', name: 'Glycémie à jeun', unit: 'g/L', range: [0.7, 1.1] },
  { key: 'hba1c', name: 'HbA1c', unit: '%', range: [null, 5.7] },
  { key: 'chol', name: 'Cholestérol total', unit: 'g/L', range: [null, 2.0] },
  { key: 'ldl', name: 'LDL', unit: 'g/L', range: [null, 1.6] },
  { key: 'hdl', name: 'HDL', unit: 'g/L', range: [0.4, null] },
  { key: 'tg', name: 'Triglycérides', unit: 'g/L', range: [null, 1.5] },
  { key: 'tsh', name: 'TSH', unit: 'mUI/L', range: [0.4, 4] },
  { key: 'vitd', name: 'Vitamine D', unit: 'ng/mL', range: [30, 100] },
  { key: 'ferritine', name: 'Ferritine', unit: 'µg/L', range: [30, 300] },
];

export const markerByName = (name) => LAB_MARKERS.find((m) => m.name === name);

export function rangeStatus(value, range) {
  if (!range) return null;
  const [lo, hi] = range;
  if (lo != null && value < lo) return 'low';
  if (hi != null && value > hi) return 'high';
  return 'ok';
}

export function rangeText(range) {
  if (!range) return '';
  const [lo, hi] = range;
  const f = (v) => String(v).replace('.', ',');
  if (lo != null && hi != null) return `${f(lo)} – ${f(hi)}`;
  if (lo != null) return `> ${f(lo)}`;
  return `< ${f(hi)}`;
}
