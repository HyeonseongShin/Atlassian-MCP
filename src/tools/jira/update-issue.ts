import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";

const UpdateIssueSchema = z.object({
  issueKey: z.string().describe("Issue key (e.g. ENG-123)"),
  summary: z.string().optional().describe("New summary"),
  description: z.string().optional().describe("New description (plain text)"),
  assignee: z.string().optional().describe("New assignee username"),
  priority: z
    .enum(["Highest", "High", "Medium", "Low", "Lowest"])
    .optional()
    .describe("New priority"),
});

export function registerUpdateIssue(
  server: McpServer,
  jira: IJiraClient
): void {
  server.tool(
    "jira_update_issue",
    "Partially update fields of a JIRA issue",
    UpdateIssueSchema.shape,
    async (args) => {
      const parsed = UpdateIssueSchema.parse(args);
      const fields: Record<string, unknown> = {};

      if (parsed.summary !== undefined) fields.summary = parsed.summary;
      if (parsed.description !== undefined)
        fields.description = parsed.description;
      if (parsed.assignee !== undefined)
        fields.assignee = { name: parsed.assignee };
      if (parsed.priority !== undefined)
        fields.priority = { name: parsed.priority };

      if (Object.keys(fields).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No fields to update. Specify at least one field.",
            },
          ],
        };
      }

      await jira.updateIssue(parsed.issueKey, fields);

      return {
        content: [
          {
            type: "text",
            text: `Issue ${parsed.issueKey} updated.`,
          },
        ],
      };
    }
  );
}
