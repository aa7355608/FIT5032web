// Builds the iCalendar (.ics) file attached to the confirmation email (BR D.2).
// Pure functions, no dependencies — unit-tested in tests/.

const pad = (n) => String(n).padStart(2, "0");

// Escape text per RFC 5545 §3.3.11 so event text can't break out of a field.
export function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold lines longer than 75 characters (RFC 5545 §3.1).
export function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}

// "9:00 AM – 12:00 PM" -> { start: [9, 0], end: [12, 0] } (24h). null if unparseable.
export function parseTimeRange(timeText) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[\u2013\u2014-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(timeText || "");
  if (!m) return null;
  const to24 = (h, min, ap) => {
    let hour = Number(h) % 12;
    if (ap.toUpperCase() === "PM") hour += 12;
    return [hour, Number(min)];
  };
  return { start: to24(m[1], m[2], m[3]), end: to24(m[4], m[5], m[6]) };
}

function stamp(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function buildIcs(event, { now = new Date() } = {}) {
  const [y, mo, d] = event.date.split("-");
  const day = `${y}${mo}${d}`;
  const range = parseTimeRange(event.time);

  // Floating local times (no timezone suffix): the event appears at 9:00 in
  // the attendee's own calendar, which is right for a local Melbourne event.
  const when = range
    ? [
        `DTSTART:${day}T${pad(range.start[0])}${pad(range.start[1])}00`,
        `DTEND:${day}T${pad(range.end[0])}${pad(range.end[1])}00`,
      ]
    : [`DTSTART;VALUE=DATE:${day}`];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GreenRoots Connect//Event Confirmation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@greenroots-connect`,
    `DTSTAMP:${stamp(now)}`,
    ...when,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(`${event.suburb}, VIC`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
