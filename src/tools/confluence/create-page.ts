import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConfluenceClient } from "../../client/confluence.js";

const CreatePageSchema = z.object({
  spaceKey: z.string().describe("Space key (e.g. ENG)"),
  title: z.string().describe("Page title"),
  body: z
    .string()
    .describe("Page body (Confluence Storage Format HTML)"),
  parentId: z
    .string()
    .optional()
    .describe("Parent page ID (if specified, the page is created as a child)"),
});

export function registerCreatePage(
  server: McpServer,
  confluence: ConfluenceClient
): void {
  server.tool(
    "confluence_create_page",
    "Create a Confluence page. The body must be in Storage Format (HTML).",
    CreatePageSchema.shape,
    async (args) => {
      const { spaceKey, title, body, parentId } = CreatePageSchema.parse(args);
      const page = await confluence.createPage(spaceKey, title, body, parentId);

      return {
        content: [
          {
            type: "text",
            text: [
              `Page created.`,
              `Title: ${page.title}`,
              `ID: ${page.id}`,
              `Space: ${spaceKey}`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
