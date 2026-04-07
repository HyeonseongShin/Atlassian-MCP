import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";

const TransitionIssueSchema = z.object({
  issueKey: z.string().describe("Issue key (e.g. ENG-123)"),
  transitionId: z
    .string()
    .optional()
    .describe(
      "Transition ID. If omitted, returns the list of available transitions. Call this tool again with the desired transition ID."
    ),
});

export function registerTransitionIssue(
  server: McpServer,
  jira: IJiraClient
): void {
  server.tool(
    "jira_transition_issue",
    "Change the status of a JIRA issue. Omit transitionId to get the list of available transitions.",
    TransitionIssueSchema.shape,
    async (args) => {
      const { issueKey, transitionId } = TransitionIssueSchema.parse(args);

      if (!transitionId) {
        const { transitions } = await jira.getTransitions(issueKey);
        const list = transitions
          .map((t) => `  id: ${t.id} → ${t.name} (→ ${t.to.name})`)
          .join("\n");
        return {
          content: [
            {
              type: "text",
              text:
                `Available transitions for ${issueKey}:\n\n${list}\n\n` +
                `Call this tool again with the desired transition ID.\n` +
                `Example: { "issueKey": "${issueKey}", "transitionId": "<id>" }`,
            },
          ],
        };
      }

      await jira.doTransition(issueKey, transitionId);

      return {
        content: [
          {
            type: "text",
            text: `Issue ${issueKey} transitioned. (Transition ID: ${transitionId})`,
          },
        ],
      };
    }
  );
}
