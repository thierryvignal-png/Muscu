// État de l'app : un seul objet, persisté dans localStorage, exportable en JSON.
(function () {
  const KEY = "chantier90.state.v1";
  const CFG = window.CHANTIER_CONFIG;

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function todayISO(d) { d = d || State.now(); return d.toISOString().slice(0, 10); }

  function blank() {
    return {
      version: 1,
      profile: null, // rempli à l'onboarding
      ui: { role: "apprenante", simDate: "" },
      weeks: {},     // n -> { accordA, accordD, amounts, deadlines, milestones[2], tranches[2] }
      inventory: [],
      ideas: [],
      days: {},      // 'YYYY-MM-DD' -> { ideaDone, cardDone, opened }
      cards: {},     // id -> { done, result, date }
      fluxB: [],
      costs: { tools: [{ name: "ChatGPT Plus", monthly: 23 }], cotisationRate: CFG.cotisationRate },
      journal: [],
      hints: {},
      challenges: {},
      coach: [],     // historique récent
    };
  }

  const State = {
    data: null,
    load() {
      try { const raw = localStorage.getItem(KEY); this.data = raw ? JSON.parse(raw) : blank(); }
      catch (e) { this.data = blank(); }
      if (!this.data.ui) this.data.ui = { role: "apprenante", simDate: "" };
      return this.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* stockage indisponible */ } },
    reset() { this.data = blank(); this.save(); },
    export() { return JSON.stringify(this.data, null, 2); },
    import(json) { const d = JSON.parse(json); if (!d || !d.version) throw new Error("fichier invalide"); this.data = d; this.save(); },
    uid, todayISO,

    // Date courante, avec date de démonstration possible (réglages).
    now() {
      const sim = this.data && this.data.ui && this.data.ui.simDate;
      if (sim) { const d = new Date(sim + "T10:00:00"); if (!isNaN(d)) return d; }
      return new Date();
    },

    // ---- Calendrier ----
    startDate() { return new Date(((this.data.profile && this.data.profile.startDate) || CFG.defaultStartDate) + "T00:00:00"); },
    s1Monday() { const d = this.startDate(); const day = d.getDay(); const add = day === 1 ? 0 : (8 - day) % 7; const m = new Date(d); m.setDate(d.getDate() + add); return m; },
    dayNumber() { const ms = this.now().setHours(0, 0, 0, 0) - this.startDate().setHours(0, 0, 0, 0); return Math.floor(ms / 86400000); },
    weekMonday(n) { const m = new Date(this.s1Monday()); m.setDate(m.getDate() + (n - 1) * 7); return m; },
    currentWeekNumber() {
      const ms = this.now().setHours(0, 0, 0, 0) - this.s1Monday().setHours(0, 0, 0, 0);
      const n = Math.floor(ms / (7 * 86400000)) + 1;
      return Math.max(0, Math.min(13, n)); // 0 = avant S1, 13 = bilan
    },
    defaultDeadlines(n) {
      const off = (window.WEEK_DEADLINE_OFFSETS || {})[n] || [2, 4];
      return off.map(o => { const d = this.weekMonday(n); d.setDate(d.getDate() + o); d.setHours(18, 0, 0, 0); return d.toISOString(); });
    },
    fmtDate(iso, withTime) {
      const d = new Date(iso); if (isNaN(d)) return "";
      const s = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
      return withTime ? s + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : s;
    },

    // ---- Semaines et jalons ----
    week(n) {
      if (!this.data.weeks[n]) {
        this.data.weeks[n] = {
          accordA: false, accordD: false,
          amounts: CFG.defaultAmounts.slice(),
          deadlines: this.defaultDeadlines(n),
          milestones: [0, 1].map(() => ({ state: "ouvert", criteria: {}, qcm: [], test: null, remisAt: null, acceptedAt: null, correction: null, report: null, flag: null })),
          tranches: [0, 1].map(() => ({ state: "non_due", history: [] })),
          chrono: {},
        };
        this.save();
      }
      return this.data.weeks[n];
    },
    weekDef(n) { return (window.WEEKS || []).find(w => w.n === n); },
    terrain() { const id = this.data.profile && this.data.profile.terrain; return (window.TERRAINS || []).find(t => t.id === id) || window.TERRAINS[0]; },
    tpl(text) {
      const v = this.terrain().vocab; return String(text || "").replace(/\{\{(\w+)\}\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
    },
    isLocked(n, m) {
      // Un jalon est verrouillé tant que le précédent n'est pas accepté.
      if (n === 1 && m === 0) return false;
      if (m === 1) return this.week(n).milestones[0].state !== "accepte";
      const prev = this.data.weeks[n - 1]; return !prev || prev.milestones[1].state !== "accepte";
    },
    criteriaDone(n, m) {
      const def = this.weekDef(n); if (!def) return { done: 0, total: 0, remaining: 0, list: [] };
      const crit = def.milestones[m].criteria; const w = this.week(n);
      const list = crit.map((c, i) => ({ i, text: this.tpl(c.text), minutes: c.minutes, next: this.tpl(c.next), done: !!(w.milestones[m].criteria[i] && w.milestones[m].criteria[i].done), preuve: (w.milestones[m].criteria[i] || {}).preuve || "" }));
      const done = list.filter(c => c.done).length;
      return { done, total: list.length, remaining: list.filter(c => !c.done).reduce((s, c) => s + c.minutes, 0), list };
    },
    lastQcm(n, m) { const a = this.week(n).milestones[m].qcm; return a.length ? a[a.length - 1] : null; },
    qcmPassed(n, m) { return this.week(n).milestones[m].qcm.some(a => a.pass); },
    testPassed(n, m) { const t = this.week(n).milestones[m].test; return !!(t && t.pass); },
    canSubmit(n, m) { const c = this.criteriaDone(n, m); return c.done === c.total && this.qcmPassed(n, m) && this.testPassed(n, m); },

    // Transitions de tranche : uniquement par action humaine explicite.
    trancheLabel(st) {
      const salariee = this.data.profile && this.data.profile.statut === "salariee";
      const map = salariee
        ? { non_due: "Non due", due: "Validée (suivi pédagogique)", facturee: "Validée", payee: "Validée" }
        : { non_due: "Non due", due: "Due — prête à facturer", facturee: "Facturée", payee: "Payée" };
      return map[st] || st;
    },
    advanceTranche(n, m, to, who) {
      const t = this.week(n).milestones[m]; const tr = this.week(n).tranches[m];
      const order = ["non_due", "due", "facturee", "payee"];
      if (order.indexOf(to) !== order.indexOf(tr.state) + 1) return false;
      if (to === "due" && t.state !== "accepte") return false; // seule l'acceptation humaine rend une tranche due
      tr.state = to; tr.history.push({ to, who, at: new Date().toISOString() }); this.save(); return true;
    },

    // ---- Journal, inventaire ----
    log(type, text, extra) { this.data.journal.push(Object.assign({ ts: new Date().toISOString(), day: this.todayISO(), type, text }, extra || {})); if (this.data.journal.length > 2000) this.data.journal.shift(); this.save(); },
    addInventory(type, title, body, week) {
      if (this.data.inventory.some(i => i.title === title)) return;
      this.data.inventory.unshift({ id: uid(), type, title, body: body || "", week: week || this.currentWeekNumber(), date: this.todayISO() }); this.save();
    },
    today() { const k = this.todayISO(); if (!this.data.days[k]) { this.data.days[k] = { ideaDone: false, cardDone: null, opened: new Date().toISOString() }; this.save(); } return this.data.days[k]; },
    lastOpenedBefore(today) { const keys = Object.keys(this.data.days).filter(k => k < today).sort(); return keys.length ? keys[keys.length - 1] : null; },
    daysSinceLastOpen() { const t = this.todayISO(); const last = this.lastOpenedBefore(t); if (!last) return 0; return Math.round((new Date(t) - new Date(last)) / 86400000); },

    // ---- Flux ----
    fluxA() {
      const out = { non_due: 0, due: 0, facturee: 0, payee: 0, total: 0 };
      Object.keys(this.data.weeks).forEach(n => { const w = this.data.weeks[n]; w.tranches.forEach((t, i) => { out[t.state] += w.amounts[i]; out.total += w.amounts[i]; }); });
      return out;
    },
    fluxB() {
      const out = { remis: 0, accepte: 0, facture: 0, paye: 0 };
      this.data.fluxB.forEach(e => { out[e.state] = (out[e.state] || 0) + Number(e.montant || 0); });
      return out;
    },
    fluxC(months) {
      months = months || 1;
      const b = this.fluxB().paye; const tools = this.data.costs.tools.reduce((s, t) => s + Number(t.monthly || 0), 0) * months;
      const cot = b * Number(this.data.costs.cotisationRate || 0);
      return { paye: b, tools, cot, reste: b - tools - cot };
    },
  };
  window.State = State;
})();
