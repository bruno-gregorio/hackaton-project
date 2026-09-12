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

function extractCandidates(text: string, sourceMessageId: number) {
  const dateMatch = /(?<![\p{L}\p{N}_])(hoje|amanhã|amanha)(?![\p{L}\p{N}_])/iu.exec(text);
  const timeMatch = /\b(?:às|as)?\s*(\d{1,2})(?:h|:)(\d{2})?\b/i.exec(text);
  if (!dateMatch || !timeMatch) return [];

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  if (hour > 23 || minute > 59) return [];

  const start = new Date();
  const relativeDay = dateMatch[1].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  if (relativeDay === "amanha") start.setDate(start.getDate() + 1);
  start.setHours(hour, minute, 0, 0);

  const durationMatch = /\bpor\s+(\d+)\s*(?:minutos?|mins?|min)\b/i.exec(text);
  const durationMinutes = durationMatch ? Number(durationMatch[1]) : 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    return [];
  }

  const dateStart = dateMatch.index ?? 0;
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
    "PRODID:-//Secretaria Hackaton//Telegram Calendar Secretary//PT-BR",
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
      const startsAt = new Intl.DateTimeFormat("pt-BR", {
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
    `Anotei ${unique.length === 1 ? "um possível evento" : `${unique.length} possíveis eventos`}:\n${preview(unique)}\n\nEnvie /agenda neste chat para confirmar e receber o arquivo .ics.`,
  );
}

bot.command("start", (ctx) =>
  ctx.reply("Sou sua secretária de agenda. Envie mensagens com data e horário; quando quiser exportar os eventos encontrados, use /agenda."),
);

bot.command("agenda", async (ctx) => {
  const chatId = ctx.chat.id;
  const events = candidatesByChat.get(chatId) ?? [];
  if (events.length === 0) {
    await ctx.reply("Ainda não encontrei eventos com data e horário neste chat.");
    return;
  }

  const file = new InputFile(Buffer.from(makeCalendar(events), "utf8"), "agenda.ics");
  await ctx.replyWithDocument(file, {
    caption: `Agenda pronta com ${events.length} evento(s). Importe o arquivo no seu calendário preferido.`,
  });
  candidatesByChat.delete(chatId);
});

bot.command("limpar", async (ctx) => {
  candidatesByChat.delete(ctx.chat.id);
  await ctx.reply("Eventos pendentes removidos.");
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
