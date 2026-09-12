import { z } from "zod";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import {
  copilotkitMiddleware,
  CopilotKitStateSchema,
  zodState,
} from "@copilotkit/sdk-js/langgraph";
import { StateSchema } from "@langchain/langgraph";

import {
  stateItem,
  stateStreamingMiddleware,
} from "@copilotkit/sdk-js/langgraph-middlewares";

import { todo_tools, TodoSchema } from "./todos.js";
import { query_data } from "./query.js";
import { search_flights } from "./a2ui_fixed_schema.js";
import { generate_a2ui } from "./a2ui_dynamic_schema.js";
import {
  answer_skill_tools,
  formatAnswerSkillsForPrompt,
} from "./answer_skills.js";

const AgentStateSchema = new StateSchema({
  todos: zodState(z.array(TodoSchema).default(() => [])),
  ...(CopilotKitStateSchema.fields as Record<string, any>),
});

const openRouterHeaders = {
  ...(process.env.OPENROUTER_HTTP_REFERER
    ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
    : {}),
  ...(process.env.OPENROUTER_APP_TITLE
    ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE }
    : {}),
};

const model = new ChatOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    ...(Object.keys(openRouterHeaders).length
      ? { defaultHeaders: openRouterHeaders }
      : {}),
  },
  modelKwargs: { parallel_tool_calls: false },
});

export const graph = createAgent({
  model,
  tools: [
    query_data,
    ...todo_tools,
    generate_a2ui,
    search_flights,
    ...answer_skill_tools,
  ],
  middleware: [
    copilotkitMiddleware,
    stateStreamingMiddleware(
      stateItem({
        stateKey: "todos",
        tool: "manage_todos",
        toolArgument: "todos",
      }),
    ),
  ],
  stateSchema: AgentStateSchema,
  systemPrompt: `
    You are a polished, professional assistant for a quick CopilotKit project.
    Keep answers concise by default, but expand when the user asks for depth or
    when a useful answer needs code, steps, or visual analysis.

    Local chatbot skills:
${formatAnswerSkillsForPrompt()}

    Skill guidance:
    - These are SKILL.md-standard chatbot skills stored under agent/src/skills/<skill-name>/SKILL.md.
    - Apply these local skills silently when they fit the user's request.
    - When a local skill looks relevant, call get_answer_skill and follow its instructions.
    - If the user asks what skills are available, call list_answer_skills.
    - New answer skills can be added in agent/src/skills/<skill-name>/SKILL.md.

    Tool guidance:
    - Flights: call search_flights to show flight cards with a pre-built schema.
    - Dashboards & rich UI: call generate_a2ui to create dashboard UIs with metrics,
      charts, tables, and cards. It handles rendering automatically.
    - Charts: call query_data first, then render with the chart component.
    - Todos: enable app mode first, then manage todos.
    - A2UI actions: when you see a log_a2ui_event result (e.g. "view_details"),
      respond with a brief confirmation. The UI already updated on the frontend.
  `,
});
