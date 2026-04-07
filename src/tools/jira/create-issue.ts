import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../../client/jira.js";

const CreateIssueSchema = z.object({
  projectKey: z.string().describe("Project key (e.g. ENG)"),
  issueType: z
    .string()
    .default("Task")
    .describe("Issue type (e.g. Bug, Task, Story)"),
  summary: z.string().describe("Issue summary"),
  description: z.string().optional().describe("Issue description (plain text)"),
  assignee: z.string().optional().describe("Assignee username"),
  priority: z
    .enum(["Highest", "High", "Medium", "Low", "Lowest"])
    .optional()
    .describe("Priority"),
});

export function registerCreateIssue(
  server: McpServer,
  jira: JiraClient
): void {
  server.tool(
    "jira_create_issue",
    "Create a JIRA issue",
    CreateIssueSchema.shape,
    async (args) => {
      const parsed = CreateIssueSchema.parse(args);

      const fields: Record<string, unknown> = {
        project: { key: parsed.projectKey },
        issuetype: { name: parsed.issueType },
        summary: parsed.summary,
      };

      if (parsed.description) fields.description = parsed.description;
      if (parsed.assignee) fields.assignee = { name: parsed.assignee };
      if (parsed.priority) fields.priority = { name: parsed.priority };

      const issue = await jira.createIssue(fields);
      const browseUrl = jira.getBrowseUrl(issue.key);

      return {
        content: [
          {
            type: "text",
            text: `Issue created.\nKey: ${issue.key}\nURL: ${browseUrl}`,
          },
        ],
      };
    }
  );
}
