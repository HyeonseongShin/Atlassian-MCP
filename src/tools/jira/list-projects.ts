import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";

export function registerListProjects(
  server: McpServer,
  jira: IJiraClient
): void {
  server.tool(
    "jira_list_projects",
    "List all JIRA projects accessible to the current user",
    {},
    async () => {
      const projects = await jira.listProjects();

      return {
        content: [
          {
            type: "text",
            text:
              `Projects (${projects.length}):\n\n` +
              projects
                .map((p) => `[${p.key}] ${p.name} (Type: ${p.projectTypeKey})`)
                .join("\n"),
          },
        ],
      };
    }
  );
}
