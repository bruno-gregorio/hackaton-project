import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Bot, InputFile, type Context } from "grammy";
import { ChatOpenAI } from "@langchain/openai";

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
const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "gpt-5.4",
  temperature: 0,
});

const candidatesByChat = new Map<number, CalendarCandidate[]>();

function messageText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) =>
        typeof item === "object" && item && "text" in item
          ? String(item.text)
          : "",
      )
      .join("");
  }
  return String(content ?? "");
}

function parseCandidates(raw: string, sourceMessageId: number) {
  try {
    const parsed = JSON.parse(raw) as { events?: unknown[] };
    if (!Array.isArray(parsed.events)) return [];

    return parsed.events.flatMap((event) => {
      if (!event || typeof event !== "object") return [];
      const value = event as Record<string, unknown>;
      const title = String(value.title ?? "").trim();
      const start = String(value.start ?? "");
      const end = String(value.end ?? "");
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);

      if (!title || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return [];
      }

      return [
        {
          title,
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
          timezone: String(value.timezone ?? timezone),
          description: String(value.description ?? "").trim(),
          sourceMessageId,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function extractCandidates(text: string, sourceMessageId: number) {
  const now = new Date().toISOString();
  const response = await model.invoke(`You extract only explicit calendar events from Telegram messages.

Current instant: ${now}
Default timezone: ${timezone}
Message: ${JSON.stringify(text)}

Return JSON only, with this exact shape:
{"events":[{"title":"string","start":"ISO-8601 with UTC offset","end":"ISO-8601 with UTC offset","timezone":"IANA timezone","description":"short source context"}]}

Rules:
- Return an empty events array for casual conversation, tasks without a date/time, or ambiguous times.
- Resolve relative dates using the current instant and default timezone.
- An event needs a concrete start date and time. If a duration is omitted, use one hour for end.
- Do not invent attendees, locations, or dates.
- Include no Markdown and no explanation.`);

  return parseCandidates(messageText(response.content), sourceMessageId);
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

  const extracted = await extractCandidates(text, sourceMessageId);
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
