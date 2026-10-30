// Récapitulatif hebdomadaire (Markdown) de la semaine qui vient : à traiter, jour par jour, échéances, à anticiper.
// Usage : node scripts/weekly-digest.mjs > digest.md   (publié le dimanche en « issue » GitHub et, si configuré, par e-mail)
import { loadSite } from "./lib-site.mjs";

const { run, J, stored, today, names } = await loadSite();
const fmt = k => run(`fmt(parse(${J(k)}))`), add = (k, n) => run(`addDays(${J(k)}, ${n})`);
const range = (a, b) => (a === b ? fmt(a) : `du ${fmt(a)} au ${fmt(b)}`);
// La semaine qui vient : le lundi suivant (un dimanche), sinon le lundi de la semaine en cours si on est lundi.
const dow = run(`parse(${J(today)}).getDay()`), monday = add(today, dow === 1 ? 0 : (8 - dow) % 7 || 7), sunday = add(monday, 6);

const model = run(`WeekView.model(${J(monday)}, allEvents(), Object.fromEntries(childcareDays().map(d => [d.date, d])))`);
const tasks = stored.filter(t => !t.kind && !t.done && !t.dismissed);
const L = [];
L.push(`# Semaine du ${fmt(monday)} au ${fmt(sunday)}`, "");

// À traiter
const todo = [];
const late = tasks.filter(t => t.due && t.due < today);
if (late.length) todo.push(`⚠ **${late.length} tâche${late.length > 1 ? "s" : ""} en retard** : ${late.slice(0, 5).map(t => t.title).join(" · ")}${late.length > 5 ? " …" : ""}`);
run(`childcareGaps().filter(g => g.end >= ${J(today)} && g.start <= addDays(${J(today)}, 21))`).forEach(g => todo.push(`⚠ **Garde de A² à organiser** ${range(g.start, g.end)} (${g.holiday.replace(/ \(.*\)/, "")})`));
run(`(window.HOUSE_EMPTY || []).filter(a => !a.sitter && a.end >= ${J(today)} && a.start <= addDays(${J(today)}, 42))`).forEach(a => todo.push(`⚠ **Qui garde Lana ?** ${range(a.start, a.end)}`));
run(`(window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "vacances" && h.end >= ${J(today)} && h.start <= addDays(${J(today)}, 42))`).forEach(h => {
  if (run(`(() => { for (let k = ${J(h.start > today ? h.start : today)}; k <= ${J(h.end)}; k = addDays(k, 1)) if (custodyEstimated(k)) return true; return false; })()`)) todo.push(`Garde **estimée par règle** pendant ${h.name.replace(/ \(.*\)/, "")} (${range(h.start, h.end)}) : à confirmer avec l'autre parent`);
});
if (todo.length) L.push("## À traiter", "", ...todo.map(t => `- ${t}`), "");

// Jour par jour : garde, congés, changements et événements
L.push("## Jour par jour", "");
const T = m => run(`Sched.T(${m})`), LAB = { moi: "Enfants chez moi", autre: "Enfants chez l'autre parent", echange: "Jour d'échange" };
model.days.forEach(d => {
  const conges = run(`congesOn(${J(d.k)})`).map(c => `${c.name} (${names(c.persons.join(","))})`);
  L.push(`**${fmt(d.k)}** — ${[d.custody && LAB[d.custody] + (d.estimated ? " (estimé)" : ""), ...conges.map(c => "Congé : " + c)].filter(Boolean).join(" · ") || "rien de particulier"}`);
  d.rows.forEach(r => r.items.filter(x => (x.status !== "same" && !x.cause) || x.conflict).forEach(x => {
    const who = r.id === "moi" ? "Yves" : r.id === "famille" ? "Famille" : names(r.id);
    const t = x.a !== undefined ? ` ${T(x.a)}${x.b !== undefined ? "–" + T(x.b) : ""}` : "";
    L.push(`  - ${who} : ${x.status === "removed" ? "~~" + x.label + "~~" : x.label}${t}${x.why ? ` (${x.why})` : ""}${x.conflict ? " ⚠ conflit" : ""}`);
  }));
  L.push("");
});

// Tâches à échéance cette semaine, rappels et actions à venir
const week = tasks.filter(t => t.due && t.due >= monday && t.due <= sunday);
if (week.length) L.push("## Tâches à faire cette semaine", "", ...week.sort((a, b) => a.due.localeCompare(b.due)).map(t => `- ${fmt(t.due)} : ${t.title}${t.who && t.who !== "famille" ? ` (${names(t.who)})` : ""}`), "");
const known = new Set(stored.filter(t => !t.kind).map(t => t.title));
const ahead = [
  ...run(`annualTasks(${J(today)})`).filter(a => !known.has(a.title) && a.due <= add(sunday, 14)).map(a => ({ d: a.due, t: "Rappel : " + a.title })),
  ...run(`schoolTodos(${J(today)}, { lead: 21 })`).filter(a => !known.has(a.title)).map(a => ({ d: a.due, t: a.title + (a.note ? ` — ${a.note}` : "") })),
  ...run(`congesUpcoming(${J(sunday)}, addDays(${J(sunday)}, 30))`).filter(c => c.start > sunday).map(c => ({ d: c.start, t: `Congé : ${c.name} (${names(c.groups.flatMap(g => g.persons).join(","))})` }))
].sort((a, b) => a.d.localeCompare(b.d));
if (ahead.length) L.push("## À anticiper (2 à 4 semaines)", "", ...ahead.slice(0, 10).map(a => `- ${fmt(a.d)} : ${a.t}`), "");
L.push("_Récapitulatif généré automatiquement le dimanche. Détails dans l'application._");
console.log(L.join("\n"));
