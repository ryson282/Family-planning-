// Outils iCalendar (RFC 5545) partagés par les scripts : échappement, pliage des lignes, événements, alarmes.
export const icsText = t => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Pliage à 75 octets (UTF-8), les lignes suivantes commencent par une espace.
export function fold(line) {
  const enc = new TextEncoder(), parts = []; let cur = "", limit = 75;
  for (const ch of line) { if (enc.encode(cur + ch).length > limit) { parts.push(cur); cur = ch; limit = 74; } else cur += ch; }
  parts.push(cur);
  return parts.join("\r\n ");
}
export const ymd = s => s.replaceAll("-", "");
export const addDay = (s, n = 1) => new Date(Date.parse(s + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

// Alarme pour un événement sur une journée entière (début à 00:00) : `daysBefore` jours avant, à `hour` heures (ex. 1 jour avant à 18 h ; 0 jour, 8 h = le jour même à 8 h).
export function alarmAllDay(daysBefore, hour, text) {
  const mins = hour * 60 - daysBefore * 1440;
  return ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(text)}`, `TRIGGER:${mins < 0 ? "-" : ""}PT${Math.abs(mins)}M`, "END:VALARM"];
}
export const alarmBefore = (minutes, text) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(text)}`, `TRIGGER:-PT${minutes}M`, "END:VALARM"];

// Événement : journée(s) entière(s) (date, end inclus) ou horaire (time, timeEnd = "HH:MM", heure locale flottante).
export function vevent({ uid, date, end, time, timeEnd, summary, description, alarms = [], transparent = true }) {
  const out = ["BEGIN:VEVENT", `UID:${uid}@family-planning`, `DTSTAMP:${stamp()}`];
  if (time) {
    const hm = t => t.replace(":", "") + "00";
    out.push(`DTSTART:${ymd(date)}T${hm(time)}`, `DTEND:${ymd(end || date)}T${hm(timeEnd || time)}`);
  } else out.push(`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(addDay(end || date))}`);
  out.push(`SUMMARY:${icsText(summary)}`);
  if (description) out.push(`DESCRIPTION:${icsText(description)}`);
  if (transparent) out.push("TRANSP:TRANSPARENT");
  out.push(...alarms.flat(), "END:VEVENT");
  return out;
}

export function calendar(name, events, { refresh = "PT6H" } = {}) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Family planning//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsText(name)}`, "X-WR-TIMEZONE:Europe/Brussels",
    `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`, `X-PUBLISHED-TTL:${refresh}`, ...events.flat(), "END:VCALENDAR"];
  return lines.map(fold).join("\r\n") + "\r\n";
}
