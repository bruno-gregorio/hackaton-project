import { tool } from "@langchain/core/tools";
import { Exa } from "exa-js";
import { z } from "zod";

const WebSearchInput = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Provide a search query.")
    .max(500, "Keep the search query under 500 characters.")
    .describe("The search query in natural language"),
});

function getExaClient() {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Web search is not configured. Set EXA_API_KEY before using web_search.",
    );
  }

  return new Exa(apiKey);
}

export const web_search = tool(
  async ({ query }) => {
    const result = await getExaClient().search(query, {
      type: "auto",
      numResults: 5,
      contents: { highlights: true },
    });

    const formatted = result.results.map((r) => ({
      title: r.title,
      url: r.url,
      highlights: r.highlights,
    }));

    return JSON.stringify(formatted);
  },
  {
    name: "web_search",
    description:
      "Search the web for current, real-world information. Returns up to five sources with titles, URLs, and highlights. Use only when up-to-date facts, documentation, or external sources are needed.",
    schema: WebSearchInput,
  },
);
