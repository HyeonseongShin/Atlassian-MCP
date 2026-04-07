import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";

const AddCommentSchema = z.object({
  issueKey: z.string().describe("Issue key (e.g. ENG-123)"),
  body: z.string().describe("Comment body (plain text)"),
});

export function registerAddComment(server: McpServer, jira: IJiraClient): void {
  server.tool(
    "jira_add_comment",
    "Add a comment to a JIRA issue",
    AddCommentSchema.shape,
    async (args) => {
      const { issueKey, body } = AddCommentSchema.parse(args);
      const result = await jira.addComment(issueKey, body);
      const commentId = result.id as string;

      return {
        content: [
          {
            type: "text",
            text: `Comment added to ${issueKey}. (Comment ID: ${commentId})`,
          },
        ],
      };
    }
  );
}
