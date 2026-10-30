// Charge le site (données + logique) dans un contexte Node et lit les enregistrements partagés (tâches, exceptions de garde, décisions...) dans Supabase.
// Utilisé par le flux iCal et le récapitulatif hebdomadaire. SYNC_URL / SYNC_KEY surchargent la configuration (tests).
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";

export async function loadSite() {
  let stored = [];
  const ctx = vm.createContext({ document: {}, console, localStorage: { getItem: () => JSON.stringify(stored), setItem() {} } });
  ctx.window = ctx;
  const load = f => vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
  readdirSync("data").filter(f => f.endsWith(".js")).forEach(f => load("data/" + f));
  ["assets/common.js", "assets/schedule.js", "assets/records.js", "assets/week.js"].forEach(load);
  const run = code => vm.runInContext(code, ctx);
  const cfg = { url: process.env.SYNC_URL || (ctx.SYNC_CONFIG || {}).url, key: process.env.SYNC_KEY || (ctx.SYNC_CONFIG || {}).key };
  if (cfg.url && cfg.key) {
    try {
      const res = await fetch(`${cfg.url}/rest/v1/family_tasks?select=id,data`, { headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      stored = (await res.json()).map(r => r && r.data).filter(d => d && typeof d === "object" && d.id !== undefined);
    } catch (e) { console.error(`::warning::Enregistrements non lus dans Supabase (${e.message}) : résultat généré sans eux.`); }
  }
  run("Records.apply()");
  const today = new Date(new Date().toLocaleString("sv-SE", { timeZone: "Europe/Brussels" }).slice(0, 10) + "T12:00:00Z").toISOString().slice(0, 10);
  const J = x => JSON.stringify(x);
  return { ctx, run, J, stored, today, names: ids => run(`String(${J(ids || "")}).split(",").filter(Boolean).map(i => ((window.PEOPLE.find(p => p.id === i) || {}).name || i).replace(/ \\(.*\\)/, "")).join(", ")`) };
}
