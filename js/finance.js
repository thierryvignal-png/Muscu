// Suivi financier (en bas de « Objectifs de vie ») : flux mensuels (+ annuel ×12) et portefeuille (valorisations).
import { esc, uid, read, write, num, fr } from './util.js';

export const KEY = 'finance.data.v1';
const DEFAULT = () => ({
  flows: ['Singulier', 'Airbnb', 'Atom', 'Accenture'].map((name) => ({ id: uid(), name, monthly: null })),
  assets: ['Atom', 'Singulier', 'MDB'].map((name) => ({ id: uid(), name, value: null })),
});
const load = () => {
  const d = read(KEY, null);
  if (d) return d;
  const fresh = DEFAULT();
  write(KEY, fresh);
  return fresh;
};
const save = (d) => write(KEY, d);

const euros = (v) => (v == null ? '–' : `${fr(v, v % 1 ? 2 : 0)} €`);
const SIGN = '<button type="button" class="sign-btn" data-action="goal-sign" aria-label="Changer le signe">±</button>';

export function view() {
  const { flows, assets } = load();
  const totalM = flows.reduce((s, f) => s + (f.monthly || 0), 0);
  const totalV = assets.reduce((s, a) => s + (a.value || 0), 0);
  return `
    <h2 class="section-title">💰 Suivi financier</h2>

    <section class="card fin">
      <h2>💶 Flux mensuels</h2>
      <form data-form="finFlows">
        <div class="fin-head"><span>Flux</span><span>€ / mois</span><span>€ / an</span><span></span></div>
        ${flows.map((f) => `
          <div class="fin-row">
            <input name="name_${f.id}" value="${esc(f.name)}" autocomplete="off">
            <span class="signed-input"><input name="m_${f.id}" data-fin-monthly inputmode="decimal" value="${f.monthly ?? ''}" placeholder="0" autocomplete="off">${SIGN}</span>
            <span class="fin-year" data-fin-year>${euros(f.monthly == null ? null : f.monthly * 12)}</span>
            <button type="button" class="icon-btn" data-action="fin-del" data-list="flows" data-id="${f.id}" aria-label="Supprimer">✕</button>
          </div>`).join('')}
        <div class="fin-total"><span>Total</span><b data-fin-total-m>${euros(totalM)}</b><b data-fin-total-y>${euros(totalM * 12)}</b><span></span></div>
        <button class="primary block">Enregistrer</button>
      </form>
      <form data-form="finAdd" class="deal-add">
        <input type="hidden" name="list" value="flows">
        <input name="name" required placeholder="Nouveau flux (ex : Loyer, Dividendes…)" autocomplete="off">
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
    </section>

    <section class="card fin">
      <h2>💼 Portefeuille</h2>
      <form data-form="finAssets">
        <div class="fin-head two"><span>Actif</span><span>Valorisation €</span><span></span></div>
        ${assets.map((a) => `
          <div class="fin-row two">
            <input name="name_${a.id}" value="${esc(a.name)}" autocomplete="off">
            <span class="signed-input"><input name="v_${a.id}" inputmode="decimal" value="${a.value ?? ''}" placeholder="0" autocomplete="off">${SIGN}</span>
            <button type="button" class="icon-btn" data-action="fin-del" data-list="assets" data-id="${a.id}" aria-label="Supprimer">✕</button>
          </div>`).join('')}
        <div class="fin-total two"><span>Total</span><b>${euros(totalV)}</b><span></span></div>
        <button class="primary block">Enregistrer</button>
      </form>
      <form data-form="finAdd" class="deal-add">
        <input type="hidden" name="list" value="assets">
        <input name="name" required placeholder="Nouvel actif (ex : Immobilier, PEA…)" autocomplete="off">
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
    </section>
  `;
}

// Mise à jour en direct de l'annuel (×12) et des totaux pendant la saisie
if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-fin-monthly]')) return;
    const form = e.target.closest('form');
    const year = e.target.closest('.fin-row').querySelector('[data-fin-year]');
    const v = num(e.target.value);
    year.textContent = euros(v == null ? null : v * 12);
    const total = [...form.querySelectorAll('[data-fin-monthly]')].reduce((s, i) => s + (num(i.value) || 0), 0);
    form.querySelector('[data-fin-total-m]').textContent = euros(total);
    form.querySelector('[data-fin-total-y]').textContent = euros(total * 12);
  });
}

export const forms = {
  finFlows(f) {
    const d = load();
    d.flows.forEach((x) => {
      x.name = (f[`name_${x.id}`] || '').trim() || x.name;
      x.monthly = num(f[`m_${x.id}`]);
    });
    save(d);
    return 'Flux enregistrés';
  },
  finAssets(f) {
    const d = load();
    d.assets.forEach((x) => {
      x.name = (f[`name_${x.id}`] || '').trim() || x.name;
      x.value = num(f[`v_${x.id}`]);
    });
    save(d);
    return 'Portefeuille enregistré';
  },
  finAdd(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    if (f.list === 'flows') d.flows.push({ id: uid(), name, monthly: null });
    else d.assets.push({ id: uid(), name, value: null });
    save(d);
    return 'Ajouté';
  },
};

export const actions = {
  'fin-del'(el) {
    if (!confirm('Supprimer cette ligne ?')) return false;
    const d = load();
    d[el.dataset.list] = d[el.dataset.list].filter((x) => x.id !== el.dataset.id);
    save(d);
  },
};
