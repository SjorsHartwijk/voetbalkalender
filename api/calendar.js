import fs from "fs";
import path from "path";

function pz(n) {
  return String(n).padStart(2, "0");
}

function toICSUTC(date) {
  return (
    date.getUTCFullYear() +
    pz(date.getUTCMonth() + 1) +
    pz(date.getUTCDate()) +
    "T" +
    pz(date.getUTCHours()) +
    pz(date.getUTCMinutes()) +
    pz(date.getUTCSeconds()) +
    "Z"
  );
}

function toICSLocal(date) {
  return (
    date.getFullYear() +
    pz(date.getMonth() + 1) +
    pz(date.getDate()) +
    "T" +
    pz(date.getHours()) +
    pz(date.getMinutes()) +
    pz(date.getSeconds())
  );
}

function escapeICS(text = "") {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildICS(matches, clubName) {

  const nowStamp = toICSUTC(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Voetbalkalender//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(clubName)}`,
    "X-WR-TIMEZONE:Europe/Amsterdam"
  ];

  matches.forEach((m, i) => {

    const start = new Date(m.date);
    const end = new Date(start.getTime() + 7200000);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${clubName}-${start.getTime()}-${i}@voetbalkalender.nl`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;TZID=Europe/Amsterdam:${toICSLocal(start)}`,
      `DTEND;TZID=Europe/Amsterdam:${toICSLocal(end)}`,
      `SUMMARY:${escapeICS(`${m.home} - ${m.away}`)}`,
      `DESCRIPTION:${escapeICS(m.competition)}`
    );

    if (m.venue) {
      lines.push(`LOCATION:${escapeICS(m.venue)}`);
    }

    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export default async function handler(req, res) {

  const {
    comp,
    club,
    filter = "all"
  } = req.query;

  if (!comp || !club) {
    return res.status(400).send("Missing parameters");
  }

  const jsonPath = path.join(
    process.cwd(),
    `${comp}.json`
  );

  const raw = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);

  const team = data.teams.find(
    t => t.id === club
  );

  if (!team) {
    return res.status(404).send("Club not found");
  }

  let matches = data.fixtures
    .filter(
      f =>
        f.homeTeam === club ||
        f.awayTeam === club
    );

  if (filter === "home") {
    matches = matches.filter(
      f => f.homeTeam === club
    );
  }

  matches = matches.map(f => ({
    date: f.date,
    home:
      data.teams.find(
        t => t.id === f.homeTeam
      )?.name,
    away:
      data.teams.find(
        t => t.id === f.awayTeam
      )?.name,
    competition: f.competition,
    venue: f.venue || ""
  }));

  const ics = buildICS(
    matches,
    team.name
  );

  res.setHeader(
    "Content-Type",
    "text/calendar; charset=utf-8"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${team.name}.ics"`
  );

  return res.status(200).send(ics);
}