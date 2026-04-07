import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";

const SearchIssuesSchema = z.object({
  jql: z.string().describe("JQL query string (e.g. 'assignee = currentUser()')"),
  fields: z
    .array(z.string())
    .optional()
    .describe("Fields to return (default: summary, status, assignee, priority)"),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Maximum number of results to return (1-100, default: 20)"),
});

export function registerSearchIssues(
  server: McpServer,
  jira: IJiraClient
): void {
  server.tool(
    "jira_search_issues",
    "Search JIRA issues using JQL",
    SearchIssuesSchema.shape,
    async (args) => {
      const { jql, fields, maxResults } = SearchIssuesSchema.parse(args);
      const defaultFields = fields ?? [
        "summary",
        "status",
        "assignee",
        "priority",
        "issuetype",
        "created",
        "updated",
      ];
      const result = await jira.searchIssues(jql, defaultFields, maxResults);

      const issues = result.issues.map((issue) => ({
        key: issue.key,
        browseUrl: jira.getBrowseUrl(issue.key),
        summary: (issue.fields.summary as string) ?? "",
        status: (issue.fields.status as { name: string })?.name ?? "",
        assignee:
          (issue.fields.assignee as { displayName: string })?.displayName ??
          "Unassigned",
        priority: (issue.fields.priority as { name: string })?.name ?? "",
        issuetype: (issue.fields.issuetype as { name: string })?.name ?? "",
      }));

      return {
        content: [
          {
            type: "text",
            text:
              `Search results: ${result.total} found (showing: ${issues.length})\n\n` +
              issues
                .map(
                  (i) =>
                    `[${i.key}] ${i.summary}\n  URL: ${i.browseUrl}\n  Status: ${i.status} | Type: ${i.issuetype} | Assignee: ${i.assignee} | Priority: ${i.priority}`
                )
                .join("\n\n"),
          },
        ],
      };
    }
  );
}
