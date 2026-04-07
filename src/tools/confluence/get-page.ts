import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";

const GetPageShape = {
  pageId: z.string().optional().describe("Page ID (numeric string)"),
  spaceKey: z
    .string()
    .optional()
    .describe("Space key (used together with title)"),
  title: z.string().optional().describe("Page title (used together with spaceKey)"),
};

const GetPageSchema = z.object(GetPageShape).refine(
  (d) =>
    d.pageId !== undefined ||
    (d.spaceKey !== undefined && d.title !== undefined),
  { message: "Provide either pageId or both spaceKey and title." }
);

export function registerGetPage(
  server: McpServer,
  confluence: IConfluenceClient
): void {
  server.tool(
    "confluence_get_page",
    "Retrieve a Confluence page by pageId, or by spaceKey + title.",
    GetPageShape,
    async (args) => {
      const parsed = GetPageSchema.parse(args);

      let page;
      if (parsed.pageId) {
        page = await confluence.getPageById(parsed.pageId);
      } else {
        page = await confluence.getPageByTitle(parsed.spaceKey!, parsed.title!);
        if (!page) {
          return {
            content: [
              {
                type: "text",
                text: `No page found with title "${parsed.title}" in space "${parsed.spaceKey}".`,
              },
            ],
          };
        }
      }

      const bodyContent = page.body?.storage?.value ?? "(no body)";
      const version = page.version?.number ?? "unknown";

      return {
        content: [
          {
            type: "text",
            text: [
              `Title: ${page.title}`,
              `ID: ${page.id}`,
              `Space: ${page.space?.key ?? ""}`,
              `Version: ${version}`,
              ``,
              `Body (Storage Format):`,
              bodyContent,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
