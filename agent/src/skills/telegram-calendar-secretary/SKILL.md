---
name: telegram-calendar-secretary
description: Build a Telegram secretary that extracts confirmed events from new messages and exports them as a portable iCalendar (.ics) file.
kind: instruction
version: 0.1.0
source: custom
category: Development Tools
tags:
  - telegram
  - calendar
  - icalendar
  - hackathon
---

# Telegram Calendar Secretary

Use this skill when adapting this project into a Telegram bot that turns conversation into calendar-ready events. The deliverable is an `.ics` file; do not add Google Calendar, OAuth, or MCP integrations unless the user explicitly asks.

## Outcome

The bot receives new Telegram messages, identifies plausible calendar events, shows the user what will be exported, and sends a valid `.ics` attachment after confirmation. The file must import into common iCalendar-compatible products, including Google Calendar, Outlook, Proton Calendar, and Apple Calendar.

## Scope and boundaries

- Read only new messages delivered to the bot. Do not claim that Telegram Bot API supplies message history.
- Support `channel_post` and group `message` updates. A group bot must be an administrator or have Privacy Mode disabled to receive all messages.
- Keep candidate events structured: `title`, `start`, `end`, `timezone`, `description`, and `sourceMessageId`.
- Do not export an event with no date/time. Ask for clarification or leave it out.
- Treat a date with no timezone as the configured project timezone; do not silently use an arbitrary locale.
- Do not create external calendar events. The user's explicit confirmation only permits generation and delivery of the `.ics` file.
- Store neither `TELEGRAM_BOT_TOKEN` nor user content in source control or logs beyond what is needed for the active demo.

## Implementation shape

1. Add a Telegram update handler using the project's existing runtime. Read `TELEGRAM_BOT_TOKEN` only from environment configuration.
2. Send new message text and the current candidate list to the agent. Require structured output rather than parsing prose.
3. Deduplicate candidates by source message and normalized start time.
4. Reply with a compact event preview and a confirmation action such as `/agenda`.
5. On confirmation, generate an RFC 5545 iCalendar file with `VCALENDAR` and one `VEVENT` per confirmed candidate. Escape text fields and use CRLF line endings.
6. Send the resulting file with MIME type `text/calendar` and a useful name such as `agenda.ics`.

## Verification

Prove one complete interaction with three messages: an unrelated message, an event with date and time, and an ambiguous event. The export must include only the confirmed, fully dated event. Open or inspect the `.ics` output to verify `BEGIN:VCALENDAR`, `BEGIN:VEVENT`, `DTSTART`, `DTEND`, `SUMMARY`, and matching closing markers.

## Demo script

1. Post: “A reunião de design é amanhã às 15h, por 45 minutos.”
2. Show the bot's preview, including the interpreted timezone.
3. Confirm with `/agenda`.
4. Download `agenda.ics` and import it into any calendar client.
