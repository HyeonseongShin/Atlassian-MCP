import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerSearchIssues } from "./search-issues.js";
import { registerGetIssue } from "./get-issue.js";
import { registerCreateIssue } from "./create-issue.js";
import { registerUpdateIssue } from "./update-issue.js";
import { registerAddComment } from "./add-comment.js";
import { registerListProjects } from "./list-projects.js";
import { registerTransitionIssue } from "./transition-issue.js";

export function registerJiraTools(
  server: McpServer,
  jira: IJiraClient
): void {
  registerSearchIssues(server, jira);
  registerGetIssue(server, jira);
  registerCreateIssue(server, jira);
  registerUpdateIssue(server, jira);
  registerAddComment(server, jira);
  registerListProjects(server, jira);
  registerTransitionIssue(server, jira);
}
