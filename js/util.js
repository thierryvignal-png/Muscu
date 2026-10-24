// Petits outils partagés par les espaces (dates, nombres, stockage local).

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad2 = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const today = () => isoOf(new Date());
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoOf(new Date(y, m - 1, d + n));
};
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export const fmtDate = (iso, withWeekday = true) => {
  const d = new Date(iso + 'T12:00:00');
  const opts = { day: 'numeric', month: 'short' };
  if (withWeekday) opts.weekday = 'short';
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
};

// Accepte "82,5" comme "82.5"
export const num = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
};
export const fr = (n, dec = 0) =>
  n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { alert("Impossible d'enregistrer : " + e.message); }
}

// Carte « montant + date de mise à jour » (trésorerie, capex restant…), partagée par Clinique et Atom.
// cash : {amount, date} ; formName : nom du formulaire qui l'enregistre.
export function cashCard(cash, formName, opts = {}) {
  const { title = '💰 Trésorerie', placeholder = 'Solde actuel (€)', colored = true, sign = true } = opts;
  const a = cash?.amount;
  const cls = !colored || a == null ? '' : a >= 0 ? 'good' : 'warn';
  return `
    <section class="card cash">
      <div class="cash-head"><span>${title}</span><b class="${cls}">${a == null ? '–' : `${fr(a)} €`}</b></div>
      <form data-form="${formName}" class="burn-form">
        <span class="signed-input"><input name="cash" inputmode="decimal" placeholder="${placeholder}" value="${a ?? ''}" autocomplete="off">${sign ? '<button type="button" class="sign-btn" data-action="goal-sign" aria-label="Changer le signe">±</button>' : ''}</span>
        <button class="primary">OK</button>
      </form>
      ${cash?.date ? `<p class="hint">Mise à jour le ${fmtDate(cash.date, false)}</p>` : ''}
    </section>`;
}
