import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConfluenceClient } from "../../client/confluence.js";

const UpdatePageSchema = z.object({
  pageId: z.string().describe("Page ID"),
  title: z
    .string()
    .describe(
      "Page title (use the existing title if you do not want to change it)"
    ),
  body: z.string().describe("Full page body (Storage Format HTML)"),
  currentVersion: z
    .number()
    .int()
    .describe(
      "Current page version number. Retrieve it with confluence_get_page first. The server saves as currentVersion+1."
    ),
});

export function registerUpdatePage(
  server: McpServer,
  confluence: ConfluenceClient
): void {
  server.tool(
    "confluence_update_page",
    "Update a Confluence page. Always call confluence_get_page first to obtain the current version number.",
    UpdatePageSchema.shape,
    async (args) => {
      const { pageId, title, body, currentVersion } =
        UpdatePageSchema.parse(args);

      try {
        const page = await confluence.updatePage(
          pageId,
          title,
          body,
          currentVersion
        );
        return {
          content: [
            {
              type: "text",
              text: [
                `Page updated.`,
                `Title: ${page.title}`,
                `ID: ${page.id}`,
                `New version: ${page.version?.number ?? currentVersion + 1}`,
              ].join("\n"),
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("400") || msg.includes("409")) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Update failed (possible version conflict): ${msg}\n\n` +
                  `Retrieve the latest version number with confluence_get_page and try again.`,
              },
            ],
          };
        }
        throw e;
      }
    }
  );
}
