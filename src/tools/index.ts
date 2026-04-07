import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../client/jira.js";
import type { ConfluenceClient } from "../client/confluence.js";
import { registerJiraTools } from "./jira/index.js";
import { registerConfluenceTools } from "./confluence/index.js";
import { registerResetAutoApprove } from "./reset-auto-approve.js";

export function registerAllTools(
  server: McpServer,
  jira: JiraClient,
  confluence: ConfluenceClient
): void {
  registerJiraTools(server, jira);
  registerConfluenceTools(server, confluence);
  registerResetAutoApprove(server);
}
