const MS = 86400000;
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const fmt = d => d.toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function inRange(day, start, end) { return day >= start && day <= end; }

function holidayOn(day) {
  return (window.SCHOOL_HOLIDAYS || []).find(h => inRange(day, h.start, h.end));
}

function custodyOn(day) {
  const c = window.CUSTODY;
  if (!c || !c.enabled) return null;
  const o = (c.overrides || []).find(x => inRange(day, x.start, x.end));
  if (o) return o.withMe;
  const weeks = Math.floor((parse(day) - parse(c.startMonday)) / (7 * MS));
  return weeks % 2 === 0;
}

// Tous les événements ponctuels, normalisés : { date (début), end, title, source, person }
function allEvents() {
  const out = [];
  (window.CALENDAR_EVENTS || []).forEach(e => out.push({ date: e.start.slice(0, 10), end: (e.end || e.start).slice(0, 10), title: e.title, source: e.calendar, time: e.allDay ? "" : e.start.slice(11, 16) }));
  (window.SCHOOL_EVENTS || []).forEach(e => out.push({ date: e.date, end: e.date, title: e.title, source: "École", person: e.person }));
  return out;
}

function personColor(id) {
  const p = (window.PEOPLE || []).find(x => x.id === id);
  return p ? p.color : "var(--accent)";
}

function nav(active) {
  document.querySelector("header").insertAdjacentHTML("beforeend",
    `<nav><a href="index.html" class="${active === "p" ? "on" : ""}">Planning</a><a href="taches.html" class="${active === "t" ? "on" : ""}">Tâches</a></nav>`);
}
