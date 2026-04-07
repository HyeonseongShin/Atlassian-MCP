import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfirmationGate } from "../confirm.js";

export function registerResetAutoApprove(
  server: McpServer,
  gate: IConfirmationGate
): void {
  server.tool(
    "atlassian_reset_auto_approve",
    "Reset the session auto-approve state. After calling this, all API requests will show the confirmation prompt again.",
    {},
    async () => {
      gate.reset();
      return {
        content: [
          {
            type: "text",
            text: "Auto-approve has been reset. All subsequent API requests will require confirmation.",
          },
        ],
      };
    }
  );
}
