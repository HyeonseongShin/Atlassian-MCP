import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../client/jira.js";
import type { IConfluenceClient } from "../client/confluence.js";
import type { IConfirmationGate } from "../confirm.js";
import { registerJiraTools } from "./jira/index.js";
import { registerConfluenceTools } from "./confluence/index.js";
import { registerResetAutoApprove } from "./reset-auto-approve.js";

export function registerAllTools(
  server: McpServer,
  jira: IJiraClient,
  confluence: IConfluenceClient,
  gate: IConfirmationGate
): void {
  registerJiraTools(server, jira);
  registerConfluenceTools(server, confluence);
  registerResetAutoApprove(server, gate);
}
