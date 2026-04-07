import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../../client/jira.js";

const GetIssueSchema = z.object({
  issueKey: z.string().describe("Issue key (e.g. ENG-123)"),
});

export function registerGetIssue(server: McpServer, jira: JiraClient): void {
  server.tool(
    "jira_get_issue",
    "Get detailed information about a JIRA issue",
    GetIssueSchema.shape,
    async (args) => {
      const { issueKey } = GetIssueSchema.parse(args);
      const issue = await jira.getIssue(issueKey);
      const f = issue.fields;

      const lines = [
        `Issue: ${issue.key}`,
        `URL: ${jira.getBrowseUrl(issue.key)}`,
        `Summary: ${f.summary as string}`,
        `Type: ${(f.issuetype as { name: string })?.name ?? ""}`,
        `Status: ${(f.status as { name: string })?.name ?? ""}`,
        `Priority: ${(f.priority as { name: string })?.name ?? ""}`,
        `Assignee: ${(f.assignee as { displayName: string })?.displayName ?? "Unassigned"}`,
        `Reporter: ${(f.reporter as { displayName: string })?.displayName ?? ""}`,
        `Created: ${f.created as string}`,
        `Updated: ${f.updated as string}`,
        ``,
        `Description:`,
        `${(f.description as string) ?? "(none)"}`,
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );
}
