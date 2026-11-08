// Vérifications automatiques des tests pratiques.
(function () {
  function run(check, value) {
    const v = String(value || "");
    switch (check.type) {
      case "maxlen": return v.trim().length > 0 && v.trim().length <= check.max;
      case "minlen": return v.trim().length >= check.min;
      case "containsAny": return check.values.some(x => v.toLowerCase().includes(x.toLowerCase()));
      case "notContainsAny": return v.trim().length > 0 && !check.values.some(x => v.toLowerCase().includes(x.toLowerCase()));
      case "url": return /^https?:\/\/\S+\.\S+/.test(v.trim());
      case "number": return v.trim() !== "" && !isNaN(Number(v));
      default: return false;
    }
  }
  window.Checks = {
    evaluate(fields, values) {
      const results = [];
      fields.forEach(f => (f.checks || []).forEach(c => results.push({ field: f.id, label: c.label, ok: run(c, values[f.id]) })));
      return { results, pass: results.length > 0 && results.every(r => r.ok) };
    },
  };
})();
