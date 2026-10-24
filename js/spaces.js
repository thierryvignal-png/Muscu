// Super app : plusieurs espaces indépendants (code et données séparés).
// Chaque espace a sa propre clé de stockage local : une modif de l'un ne touche pas les autres.

export const SPACES = [
  { key: 'today', icon: '🏠', name: 'Ma journée', desc: 'Tout l\'essentiel en un écran' },
  { key: 'muscu', icon: '💪', name: 'Muscu', desc: 'Déficit, repas, salle, poids' },
  { key: 'todo', icon: '✅', name: 'Todo', desc: 'Perso, Clinique, Atom' },
  { key: 'atom', icon: '⚛️', name: 'Atom', desc: 'Deals et grands projets' },
  { key: 'goodnews', icon: '🎉', name: 'Good news', desc: 'Tout ce qui t\'attend de cool' },
  { key: 'goals', icon: '🎯', name: 'Objectifs de vie', desc: 'Objectifs, flux et portefeuille' },
  { key: 'esthetique', icon: '✨', name: 'Roadmap esthétique', desc: 'Traitements prévus et score /100' },
  { key: 'clinique', icon: '🏥', name: 'Clinique Singulier', desc: 'Revenus, coûts par BU, résultat' },
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
export const APP_VERSION = 'v36';

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

// Clés de stockage des espaces autres que Muscu (pour la sauvegarde complète)
export const SPACE_KEYS = ['todo.data.v1', 'atom.data.v1', 'goodnews.data.v1', 'goals.data.v1', 'finance.data.v1', 'esthetique.data.v1', CLINIC_KEY];

export const spaceViews = {};
