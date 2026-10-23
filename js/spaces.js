// Super app : plusieurs espaces indépendants (code et données séparés).
// Chaque espace a sa propre clé de stockage local : une modif de l'un ne touche pas les autres.

export const SPACES = [
  { key: 'today', icon: '🏠', name: 'Ma journée', desc: 'Tout l\'essentiel en un écran' },
  { key: 'muscu', icon: '💪', name: 'Muscu', desc: 'Déficit, repas, salle, poids' },
  { key: 'todo', icon: '✅', name: 'Todo', desc: 'Perso, Clinique, Atom' },
  { key: 'goodnews', icon: '🎉', name: 'Good news', desc: 'Tout ce qui t\'attend de cool' },
  { key: 'goals', icon: '🎯', name: 'Objectifs de vie', desc: 'Suis-je dans les temps ?' },
  { key: 'esthetique', icon: '✨', name: 'Roadmap esthétique', desc: 'Traitements prévus et score /100' },
  { key: 'clinique', icon: '🏥', name: 'Clinique Singulier', desc: 'Modèle financier · bientôt' },
];

const SPACE_KEY = 'hub.space';
const CLINIC_KEY = 'clinique.data.v1';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const getSpace = () => {
  const k = read(SPACE_KEY, 'today');
  return SPACES.some((s) => s.key === k) ? k : 'today';
};
export const setSpace = (k) => write(SPACE_KEY, k);
export const spaceOf = (k) => SPACES.find((s) => s.key === k);

// Bouton en haut de chaque écran pour changer d'espace
export function spaceSwitch(current) {
  const s = spaceOf(current);
  return `<button class="space-switch" data-action="space-menu">${s.icon} ${esc(s.name)} <span>▾</span></button>`;
}

// À changer à chaque mise à jour (comme VERSION dans sw.js) : affiché en bas du menu
export const APP_VERSION = 'v16';

export function spaceMenu(current) {
  return `
    <div class="sheet-backdrop" data-action="space-close"></div>
    <div class="sheet" role="dialog" aria-label="Changer d'espace">
      <h2>Mes espaces</h2>
      ${SPACES.map((s) => `
        <button class="space-item ${s.key === current ? 'active' : ''}" data-action="space" data-space="${s.key}">
          <span class="space-icon">${s.icon}</span>
          <span><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></span>
        </button>`).join('')}
      <div class="app-version">
        <span class="hint">Version ${APP_VERSION}</span>
        <button class="chip" data-action="force-update">↻ Forcer la mise à jour</button>
      </div>
    </div>`;
}

// ---------- Espace Clinique Singulier (à construire) ----------
export const clinic = {
  get: () => read(CLINIC_KEY, { link: '' }),
  setLink(link) {
    let l = (link || '').trim();
    if (l && !/^https?:\/\//i.test(l)) l = 'https://' + l; // n'accepte que des liens web
    write(CLINIC_KEY, { ...clinic.get(), link: l });
  },
};

function clinique() {
  const { link } = clinic.get();
  return `
    <header class="page-head"><h1>Clinique Singulier</h1><p>Modèle financier</p></header>
    <section class="card">
      <h2>🏥 Espace prêt, module à construire</h2>
      <p class="hint">Hypothèses, compte de résultat prévisionnel, trésorerie, scénarios… On le construit ensemble quand tu veux.</p>
      <p class="hint">🔒 Confidentialité : le code de l'app est public sur GitHub. Tes chiffres seront saisis
      dans l'app et resteront sur ton téléphone, jamais dans le code.</p>
    </section>
    <section class="card">
      <h2>Raccourci vers un fichier existant</h2>
      <p class="hint">Si ton modèle existe déjà (Google Sheets, Excel en ligne…), colle son lien ici pour l'ouvrir en un tap.
      Le lien reste sur ce téléphone.</p>
      <form data-form="clinicLink" class="burn-form">
        <input name="link" type="text" inputmode="url" autocapitalize="off" placeholder="https://…" value="${esc(link)}" autocomplete="off">
        <button class="primary">OK</button>
      </form>
      ${link ? `<a class="button-like block-link" href="${esc(link)}" target="_blank" rel="noopener">Ouvrir mon modèle ↗</a>` : ''}
    </section>`;
}

// Clés de stockage des espaces autres que Muscu (pour la sauvegarde complète)
export const SPACE_KEYS = ['todo.data.v1', 'goodnews.data.v1', 'goals.data.v1', 'esthetique.data.v1', CLINIC_KEY];

export const spaceViews = { clinique };
