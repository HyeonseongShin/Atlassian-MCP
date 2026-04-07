import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resetAutoApprove } from "../confirm.js";

export function registerResetAutoApprove(server: McpServer): void {
  server.tool(
    "atlassian_reset_auto_approve",
    "Reset the session auto-approve state. After calling this, all API requests will show the confirmation prompt again.",
    {},
    async () => {
      resetAutoApprove();
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
