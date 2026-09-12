import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const AnswerSkillSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes."),
  description: z.string(),
  body: z.string().min(1),
  path: z.string(),
});

type AnswerSkill = z.infer<typeof AnswerSkillSchema>;

const skillsDir = fileURLToPath(new URL("./skills", import.meta.url));

function parseFrontmatter(content: string, path: string): AnswerSkill {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`${path} must start with YAML frontmatter.`);
  }

  const [, frontmatter, body] = match;
  const fields = Object.fromEntries(
    frontmatter
      .split("\n")
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
      .filter((lineMatch): lineMatch is RegExpMatchArray => Boolean(lineMatch))
      .map((lineMatch) => [
        lineMatch[1],
        lineMatch[2].replace(/^["']|["']$/g, "").trim(),
      ]),
  );

  return AnswerSkillSchema.parse({
    name: fields.name,
    description: fields.description,
    body: body.trim(),
    path,
  });
}

export function loadAnswerSkills(): AnswerSkill[] {
  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(`${skillsDir}/${entry.name}/SKILL.md`))
      .map((entry) => {
        const skillPath = `${skillsDir}/${entry.name}/SKILL.md`;
        const skill = parseFrontmatter(readFileSync(skillPath, "utf8"), skillPath);

        if (skill.name !== entry.name) {
          throw new Error(
            `${skillPath} name must match its parent directory (${entry.name}).`,
          );
        }

        return skill;
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[answer-skills] Could not load skills: ${message}`);
    return [];
  }
}

export function formatAnswerSkillsForPrompt(): string {
  const skills = loadAnswerSkills();

  if (skills.length === 0) {
    return "No local answer skills are currently configured.";
  }

  return skills
    .map((skill) => {
      return [
        `- ${skill.name}`,
        `  Description: ${skill.description}`,
        `  Source: ${skill.path}`,
      ].join("\n");
    })
    .join("\n\n");
}

export const list_answer_skills = tool(
  async () =>
    JSON.stringify(
      loadAnswerSkills().map(({ name, description, path }) => ({
        name,
        description,
        path,
      })),
      null,
      2,
    ),
  {
    name: "list_answer_skills",
    description:
      "List the local answer skills this project exposes to improve assistant responses.",
    schema: z.object({}),
  },
);

export const get_answer_skill = tool(
  async ({ skillName }: { skillName: string }) => {
    const skill = loadAnswerSkills().find(
      (candidate) => candidate.name === skillName,
    );

    if (!skill) {
      return `No answer skill found for "${skillName}".`;
    }

    return [
      `# ${skill.name}`,
      "",
      `Description: ${skill.description}`,
      `Source: ${skill.path}`,
      "",
      skill.body,
    ].join("\n");
  },
  {
    name: "get_answer_skill",
    description:
      "Get the full SKILL.md instructions for one local answer skill by name.",
    schema: z.object({
      skillName: z
        .string()
        .describe("The skill name, for example visual-analysis."),
    }),
  },
);

export const answer_skill_tools = [list_answer_skills, get_answer_skill];
