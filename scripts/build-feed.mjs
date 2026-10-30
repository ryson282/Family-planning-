// Génère le flux iCal « famille » (à s'abonner dans Google Agenda ou une autre application) : changements de garde, congés,
// événements scolaires, tâches avec échéance, rappels annuels, alertes « garde à organiser ». Les alarmes sont intégrées aux événements.
// Usage : FEED_TOKEN=<secret> node scripts/build-feed.mjs <dossier du site>   -> <dossier>/ics/<jeton>/famille.ics
// Sans FEED_TOKEN (secret GitHub), rien n'est généré. Le jeton fait partie de l'adresse : ne pas la partager.
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { vevent, alarmAllDay, alarmBefore, calendar } from "./lib-ics.mjs";
import { loadSite } from "./lib-site.mjs";

const out = process.argv[2] || "dist", token = process.env.FEED_TOKEN || "";
if (token.length < 16) { console.log("::warning::FEED_TOKEN absent ou trop court (16 caractères minimum) : flux iCal non généré."); process.exit(0); }
if (!/^[A-Za-z0-9_-]+$/.test(token)) { console.error("FEED_TOKEN ne doit contenir que des lettres, chiffres, - et _."); process.exit(1); }

const { ctx, run, stored, recordsOk, today, names } = await loadSite();
// Base illisible : on ne publie pas un flux sans les tâches (Google Agenda retirerait les rappels). L'ancien flux reste en place.
if (!recordsOk) { console.error("::error::Base Supabase illisible : flux iCal non généré (le précédent reste valable)."); process.exit(1); }
const horizon = 400, limit = run(`addDays(${JSON.stringify(today)}, ${horizon})`);
const events = [];
const TITLES = { moi: "Garde A² chez Yves", autre: "A² chez Emeline", echange: "Jour d'échange A²" }; // le prénom n'apparaît que dans ce flux privé (comme l'export de garde)

// 1. Changements de garde (jours consécutifs avec le même parent), alarme la veille à 18 h
{
  let run0 = null;
  const flush = () => { if (run0) events.push(vevent({ uid: `garde-${run0.start}-${run0.who}`, date: run0.start, end: run0.end, summary: TITLES[run0.who] || run0.who, description: run0.est ? "Estimation par règle" : "", alarms: [alarmAllDay(1, 18, `Demain : ${TITLES[run0.who] || run0.who}`)] })); };
  for (let k = today; k <= run(`addDays(${JSON.stringify(today)}, 120)`); k = run(`addDays(${JSON.stringify(k)}, 1)`)) {
    const who = run(`custodyOn(${JSON.stringify(k)})`), est = run(`custodyEstimated(${JSON.stringify(k)})`);
    if (!who) { flush(); run0 = null; continue; }
    if (run0 && run0.who === who) { run0.end = k; run0.est = run0.est || est; } else { flush(); run0 = { who, start: k, end: k, est }; }
  }
  flush();
}

// 2. Congés (une entrée par congé, avec les personnes concernées)
run(`congesUpcoming(${JSON.stringify(today)}, ${JSON.stringify(limit)})`).forEach(c => {
  const end = c.groups.reduce((m, g) => (g.end > m ? g.end : m), c.start);
  events.push(vevent({ uid: `conge-${c.name}-${c.start}`.replace(/[^\w-]+/g, "_"), date: c.start, end, summary: `Congé : ${c.name}`, description: c.groups.map(g => `${names(g.persons.join(","))} jusqu'au ${g.end}`).join(" ; ") }));
});

// 3. Événements scolaires (alarme la veille à 18 h pour les rendez-vous importants)
const KEY_EVENT = /réunion|bulletin|délibération|voyage|CEB|classes de neige|examen|proclamation|concours|session/i;
run(`allEvents()`).filter(e => e.source === "École" && e.end >= today && e.date <= limit && !/^(Congé : |ULiège : (vacances|congé))/.test(e.title)).forEach(e => {
  const who = names(e.person), summary = e.title + (who ? ` (${who})` : "");
  const alarms = [];
  if (KEY_EVENT.test(e.title) || e.todo || e.needsParent) alarms.push(alarmAllDay(1, 18, `Demain : ${summary}`));
  events.push(vevent({ uid: `ecole-${e.date}-${e.title}`.replace(/[^\w-]+/g, "_"), date: e.date, end: e.end, time: e.time || undefined, timeEnd: e.time ? e.timeEnd || undefined : undefined, summary, description: [e.todo, e.amount, e.note].filter(Boolean).join(" — "), alarms }));
});

// 3 bis. Événements saisis dans le site (rendez-vous, sorties, déplacements) : alarme 1 h avant, ou la veille à 18 h pour une journée entière
run(`allEvents()`).filter(e => e.rec && e.end >= today && e.date <= limit).forEach(e => {
  const who = names(e.person), summary = e.title + (who ? ` (${who})` : "");
  const alarms = [e.time ? alarmBefore(60, summary) : alarmAllDay(1, 18, `Demain : ${summary}`)];
  events.push(vevent({ uid: `site-${e.rec}`, date: e.date, end: e.end, time: e.time || undefined, timeEnd: e.time ? e.timeEnd || undefined : undefined, summary, description: e.note, alarms, transparent: !e.time }));
});

// 4. Tâches avec échéance (non terminées, non écartées) ; celles en retard se représentent chaque jour jusqu'à ce qu'elles soient faites
const tasks = stored.filter(t => !t.kind && !t.done && !t.dismissed && t.due);
tasks.forEach(t => {
  const late = t.due < today, date = late ? today : t.due;
  if (date > limit) return;
  const label = `${late ? "En retard : " : "À faire : "}${t.title}`;
  const alarms = t.time ? [alarmBefore(60, label)] : [alarmAllDay(1, 18, `Demain : ${t.title}`), alarmAllDay(0, 8, label)];
  events.push(vevent({ uid: `tache-${t.id}`, date, time: late ? undefined : t.time, timeEnd: undefined, summary: label, description: names(t.who) ? `Pour : ${names(t.who)}` : "", alarms, transparent: true }));
});
const known = new Set(stored.filter(t => !t.kind).map(t => t.title));

// 5. Rappels annuels (tâches annuelles et échéances du foyer) pas encore ajoutés à la liste
run(`annualTasks(${JSON.stringify(today)}, { all: true })`).filter(a => !known.has(a.title) && a.start <= limit).forEach(a => {
  const days = Math.min(a.lead || 14, 14);
  events.push(vevent({ uid: `annuel-${a.title}`.replace(/[^\w-]+/g, "_"), date: a.start, summary: `Rappel : ${a.title}`, description: [names(a.who) && `Pour : ${names(a.who)}`, a.note].filter(Boolean).join(" — "), alarms: [alarmAllDay(days, 9, `Dans ${days} jours : ${a.title}`), alarmAllDay(1, 18, `Demain : ${a.title}`)] }));
});

// 6. Alertes « à organiser » : garde de A² pendant un congé, garde de Lana ; se représentent chaque jour jusqu'à ce que ce soit réglé
const fmtDay = k => run(`fmt(parse(${JSON.stringify(k)}))`);
run(`childcareGaps().filter(g => g.end >= ${JSON.stringify(today)} && g.start <= addDays(${JSON.stringify(today)}, 28))`).forEach(g => {
  const date = run(`addDays(${JSON.stringify(g.start)}, -14)`) > today ? run(`addDays(${JSON.stringify(g.start)}, -14)`) : today;
  const label = `⚠ Garde de A² à organiser : ${g.start === g.end ? fmtDay(g.start) : `du ${fmtDay(g.start)} au ${fmtDay(g.end)}`} (${g.holiday.replace(/ \(.*\)/, "")})`;
  events.push(vevent({ uid: `alerte-garde-${g.start}`, date, summary: label, alarms: [alarmAllDay(0, 9, label)] }));
});
(ctx.HOUSE_EMPTY || []).filter(a => !a.sitter && a.end >= today && a.start <= run(`addDays(${JSON.stringify(today)}, 42)`)).forEach(a => {
  const date = run(`addDays(${JSON.stringify(a.start)}, -21)`) > today ? run(`addDays(${JSON.stringify(a.start)}, -21)`) : today;
  const label = `⚠ Qui garde Lana ? ${fmtDay(a.start)} au ${fmtDay(a.end)}`;
  events.push(vevent({ uid: `alerte-lana-${a.start}`, date, summary: label, alarms: [alarmAllDay(0, 9, label)] }));
});

// 7. Vacances décidées (« on part ») : dates retenues et destination
(stored.filter(r => r.kind === "holiday" && r.status === "part" && r.from && r.to) || []).forEach(r =>
  events.push(vevent({ uid: `vacances-${r.id}`, date: r.from, end: r.to, summary: `Vacances${r.dest ? " : " + r.dest : ""}`, description: [r.note, r.budget && `Budget ${r.budget}`].filter(Boolean).join(" — "), transparent: false })));

const dir = `${out}/ics/${token}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/famille.ics`, calendar("Famille (rappels)", events));
appendFileSync(`${out}/_headers`, "\n/ics/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n");
console.log(`Flux iCal : ${events.length} événements -> ${dir}/famille.ics`);
