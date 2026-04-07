import { z } from "zod";

const ConfigSchema = z.object({
  JIRA_BASE_URL: z.string().url(),
  JIRA_API_TOKEN: z.string().min(1),
  CONFLUENCE_BASE_URL: z.string().url(),
  CONFLUENCE_API_TOKEN: z.string().min(1),
  // Case-insensitive: "false", "FALSE", "False" all disable the confirmation gate
  ATLASSIAN_MCP_REQUIRE_CONFIRM: z
    .string()
    .optional()
    .transform((val) => val?.toLowerCase() !== "false"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(
  env: Record<string, string | undefined> = process.env
): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${missing}`);
  }
  return result.data;
}

