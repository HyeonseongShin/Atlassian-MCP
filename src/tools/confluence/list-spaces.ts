import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";

const ListSpacesSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Maximum number of results to return (1-100, default: 50)"),
  type: z
    .enum(["global", "personal"])
    .optional()
    .describe("Space type filter (omit to return all types)"),
});

export function registerListSpaces(
  server: McpServer,
  confluence: IConfluenceClient
): void {
  server.tool(
    "confluence_list_spaces",
    "List all Confluence spaces accessible to the current user",
    ListSpacesSchema.shape,
    async (args) => {
      const { limit, type } = ListSpacesSchema.parse(args);
      const result = await confluence.listSpaces(limit, type);

      return {
        content: [
          {
            type: "text",
            text:
              `Spaces (${result.size}):\n\n` +
              result.results
                .map(
                  (s) =>
                    `[${s.key}] ${s.name} (Type: ${s.type}, Status: ${s.status})`
                )
                .join("\n"),
          },
        ],
      };
    }
  );
}
