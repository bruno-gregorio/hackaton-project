import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Bot, InputFile, type Context } from "grammy";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

type CalendarCandidate = {
  title: string;
  start: string;
  end: string;
  timezone: string;
  description: string;
  sourceMessageId: number;
};

const token = process.env.TELEGRAM_BOT_TOKEN;
const timezone = process.env.CALENDAR_TIMEZONE ?? "America/Asuncion";

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required. Add it to the root .env file.");
}

const bot = new Bot(token);

const candidatesByChat = new Map<number, CalendarCandidate[]>();
const eventKeyword = /(?<![\p{L}\p{N}_])(reunión|reunion|llamada|cita|evento|taller|clase|entrevista|presentación|presentacion)(?![\p{L}\p{N}_])/iu;

function extractCandidates(text: string, sourceMessageId: number) {
  if (!eventKeyword.test(text)) return [];

  const relativeDateMatch = /(?<![\p{L}\p{N}_])(hoy|mañana|manana)(?![\p{L}\p{N}_])/iu.exec(text);
  const numericDateMatch = /(?<!\d)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?!\d)/u.exec(text);
  const timeMatch = /(?<!\d)(?:a\s+las)?\s*(\d{1,2})(?:\s*(?:h|horas?|:)(\d{2})?)(?![\p{L}\p{N}_])/iu.exec(text);
  if ((!relativeDateMatch && !numericDateMatch) || !timeMatch) return [];

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  if (hour > 23 || minute > 59) return [];

  const start = new Date();
  if (relativeDateMatch) {
    const relativeDay = relativeDateMatch[1].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    if (relativeDay === "manana") start.setDate(start.getDate() + 1);
  } else if (numericDateMatch) {
    const day = Number(numericDateMatch[1]);
    const month = Number(numericDateMatch[2]);
    const rawYear = numericDateMatch[3];
    const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : start.getFullYear();
    start.setFullYear(year, month - 1, day);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
      return [];
    }
  }
  start.setHours(hour, minute, 0, 0);

  const durationMatch = /\bpor\s+(\d+)\s*(?:minutos?|mins?|min)\b/iu.exec(text);
  const durationMinutes = durationMatch ? Number(durationMatch[1]) : 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    return [];
  }

  const dateStart = relativeDateMatch?.index ?? numericDateMatch?.index ?? 0;
  const title = text.slice(0, dateStart).replace(/[,:;\-–]+\s*$/, "").trim();
  if (!title) return [];

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return [
    {
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone,
      description: text.trim(),
      sourceMessageId,
    },
  ];
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function makeCalendar(events: CalendarCandidate[]) {
  const now = icsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Secretaria Hackaton//Agenda de Telegram//ES",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${randomUUID()}@secretaria-hackaton`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
    "",
  ];

  return lines.join("\r\n");
}

function preview(events: CalendarCandidate[]) {
  return events
    .map((event) => {
      const startsAt = new Intl.DateTimeFormat("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: event.timezone,
      }).format(new Date(event.start));
      return `• ${event.title} — ${startsAt}`;
    })
    .join("\n");
}

async function processText(ctx: Context, text: string, sourceMessageId: number) {
  const chatId = ctx.chat?.id;
  if (!chatId || text.startsWith("/")) return;

  const extracted = extractCandidates(text, sourceMessageId);
  if (extracted.length === 0) return;

  const saved = candidatesByChat.get(chatId) ?? [];
  const unique = extracted.filter(
    (candidate) =>
      !saved.some(
        (event) =>
          event.sourceMessageId === candidate.sourceMessageId ||
          (event.title === candidate.title && event.start === candidate.start),
      ),
  );
  if (unique.length === 0) return;

  candidatesByChat.set(chatId, [...saved, ...unique]);
  await ctx.reply(
    `He anotado ${unique.length === 1 ? "un posible evento" : `${unique.length} posibles eventos`}:\n${preview(unique)}\n\nEnvía /agenda en este chat para confirmar y recibir el archivo .ics.`,
  );
}

bot.command("start", (ctx) =>
  ctx.reply("Soy tu secretaria de agenda. Envía mensajes con fecha y hora; cuando quieras exportar los eventos encontrados, usa /agenda."),
);

bot.command("agenda", async (ctx) => {
  const chatId = ctx.chat.id;
  const events = candidatesByChat.get(chatId) ?? [];
  if (events.length === 0) {
    await ctx.reply("Todavía no encontré eventos con fecha y hora en este chat.");
    return;
  }

  const file = new InputFile(Buffer.from(makeCalendar(events), "utf8"), "agenda.ics");
  await ctx.replyWithDocument(file, {
    caption: `Agenda lista con ${events.length} evento(s). Importa el archivo en tu calendario preferido.`,
  });
  candidatesByChat.delete(chatId);
});

bot.command(["limpiar", "limpar"], async (ctx) => {
  candidatesByChat.delete(ctx.chat.id);
  await ctx.reply("Eventos pendientes eliminados.");
});

bot.on("message:text", (ctx) => processText(ctx, ctx.message.text, ctx.message.message_id));
bot.on("channel_post:text", (ctx) =>
  processText(ctx, ctx.channelPost.text, ctx.channelPost.message_id),
);

bot.catch((error) => {
  console.error("Telegram bot error", error.error);
});

console.log(`Telegram secretary is running with timezone ${timezone}.`);
bot.start({ allowed_updates: ["message", "channel_post"] });
