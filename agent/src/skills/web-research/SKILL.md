---
name: web-research
description: Researches current information on the web and produces concise, source-backed answers. Use when a user asks for current events, live facts, official documentation, or external sources. Do not use for information already present in the conversation or repository.
---

# Web research

Provide a short, trustworthy answer based on current web sources.

## Workflow

1. Identify the user's question, the required freshness, and any requested source type.
2. Use an available web-search tool. In this project, use `web_search` after it has been registered by the integration owner.
3. Search with a focused query. Refine the search only when the first results do not answer the question or are not credible.
4. Prefer primary and authoritative sources. Check dates for time-sensitive claims.
5. Answer the question directly. Include the relevant source title and URL for each important factual claim.

## Boundaries

- Do not invent facts, sources, URLs, or search results.
- If web search is unavailable, explain that current information cannot be verified and ask the user to enable the search integration.
- Do not expose API keys, environment variables, or other secrets in the response.
- Keep the result concise unless the user explicitly asks for a detailed report.

## Example

User request: "Busca la documentación actual de LangGraph para crear agentes."

Expected behavior: Search official LangGraph documentation, summarize the relevant guidance, and return the official documentation link.
