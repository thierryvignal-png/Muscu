// Moteur de QCM : construit les 10 questions, applique le seuil et les bloquantes.
(function () {
  const CFG = window.CHANTIER_CONFIG;
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const Qcm = {
    // Questions d'un jalon ; attempt > 0 → variantes.
    build(n, m, attempt) {
      const S = window.State; let base;
      if (n === 1) { const t = S.terrain(); const u = m === 0 ? window.QCM.week1.m1 : window.QCM.week1.m2; const k = (t.kitQuestions || {})[m === 0 ? "q1" : "q2"] || []; base = u.concat(k); }
      else base = window.QCM.weeks[n] || [];
      base = base.slice(0, 10);
      return base.map(q => {
        let src = q; if (attempt > 0 && q.v) src = Object.assign({}, q, q.v);
        const opts = src.o.map((o, i) => ({ t: S.tpl(o), i }));
        const order = attempt > 0 && !q.v ? shuffle(opts) : opts;
        return { q: S.tpl(src.q), options: order.map(o => o.t).concat(["Je ne sais pas"]), map: order.map(o => o.i), a: src.a, b: !!q.b, e: q.e };
      });
    },
    challenge(id) {
      const S = window.State; const base = window.QCM.challenges[id] || [];
      return base.map(q => ({ q: q.q, options: q.o.concat(["Je ne sais pas"]), map: [0, 1, 2, 3], a: q.a, b: !!q.b, e: q.e }));
    },
    // answers : index choisi dans options (4 = je ne sais pas) → index d'origine ou -1.
    grade(questions, chosen) {
      const answers = chosen.map((c, i) => (c === 4 || c == null) ? -1 : questions[i].map[c]);
      const correct = answers.map((a, i) => a === questions[i].a);
      const score = correct.filter(Boolean).length;
      const bloquantesOk = questions.every((q, i) => !q.b || correct[i]);
      return { answers, correct, score, bloquantesOk, pass: score >= CFG.qcmPassScore && bloquantesOk };
    },
  };
  window.Qcm = Qcm;
})();
