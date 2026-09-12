---
name: visual-summary-svg
description: Converts text, conversations, or structured notes into a clear standalone SVG visual summary. Use when a user asks to visualize a summary, make an infographic, map ideas, show a process, or present key points as an SVG image. Do not use when an accurate numeric chart or editable slide deck is required.
---

# Visual summary SVG

Create one readable SVG that communicates the important ideas without requiring the original text.

## Workflow

1. Extract the 3–7 most important ideas, decisions, milestones, or relationships. Ask a focused question if the source lacks a clear purpose or audience.
2. Choose the simplest appropriate structure:
   - Flow for steps or cause and effect.
   - Timeline for events or deadlines.
   - Tree for hierarchy or grouped themes.
   - Comparison for alternatives, trade-offs, or before/after.
3. Create a standalone `.svg` file with a descriptive filename. Use a `viewBox`, a `<title>`, and a short `<desc>` so the visual scales and remains accessible.
4. Use short labels, clear reading order, and sufficient contrast. Keep typography and colors consistent; do not rely on color alone to communicate meaning.
5. Return the SVG file path and a one-sentence description of what it shows.

## Boundaries

- Preserve facts from the supplied content; do not add unsupported claims.
- State when a conclusion is an inference rather than a stated fact.
- Use a charting workflow instead when exact values, axes, or data comparisons are the main requirement.
- Do not embed external images, fonts, scripts, or secrets in the SVG.

## Example

User request: "Resume esta conversación en una imagen SVG con los pendientes."

Expected result: Create an SVG showing the completed work, open tasks, owners when known, and the next action in a clear flow or grouped diagram.
