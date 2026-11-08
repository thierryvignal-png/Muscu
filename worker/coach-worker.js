// Worker Cloudflare (facultatif) : relaie le coach vers l'API Claude.
// La clé reste côté serveur. Déploiement : `wrangler deploy`, puis renseigner
// CLAUDE_API_KEY (secret) et, au choix, CLAUDE_MODEL. Mettre l'URL du worker
// dans js/config.js → coachEndpoint.
const SYSTEM = `Tu es le coach de Chantier 90, un parcours de 90 jours pour apprendre à gagner de l'argent avec l'IA.
Règles : une seule question à la fois, construite sur un détail de la dernière réponse. Jamais de cours.
Si la personne dit « aucune idée » : rappelle une situation qu'elle connaît ; si elle sèche encore, propose deux scènes concrètes ; en dernier recours, un mécanisme économique d'un autre secteur à transposer. La formulation finale doit venir d'elle.
Si elle veut remettre à demain : accepte, chiffre ce qui restera, propose deux options, laisse choisir.
Si elle a des démos et aucun prix annoncé : dis-le et aide-la à écrire l'offre aujourd'hui.
Réponds en français, en moins de 120 mots, sans listes à puces sauf pour deux scènes.`;

export default {
  async fetch(request, env) {
    const cors = { "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: cors });
    let body; try { body = await request.json(); } catch { return new Response("bad json", { status: 400, headers: cors }); }
    const history = (body.history || []).slice(-8).map(h => ({ role: h.who === "me" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) }));
    if (!history.length || history[history.length - 1].role !== "user") return new Response(JSON.stringify({ text: "" }), { headers: { ...cors, "Content-Type": "application/json" } });
    const ctx = body.context || {};
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": env.CLAUDE_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL || "claude-opus-5-5",
        max_tokens: 400,
        system: SYSTEM + "\nContexte : semaine " + (ctx.week || "?") + ", jour " + (ctx.day || "?") + ", terrain " + (ctx.terrain || "?") + ".",
        messages: history,
      }),
    });
    if (!res.ok) return new Response(JSON.stringify({ text: "" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    const j = await res.json();
    const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return new Response(JSON.stringify({ text }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
};
