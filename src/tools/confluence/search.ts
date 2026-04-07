import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConfluenceClient } from "../../client/confluence.js";

const SearchSchema = z.object({
  cql: z
    .string()
    .describe(
      'CQL query string (e.g. \'space.key = "ENG" AND type = page AND title ~ "API"\')'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Maximum number of results to return (1-50, default: 20)"),
});

export function registerConfluenceSearch(
  server: McpServer,
  confluence: ConfluenceClient
): void {
  server.tool(
    "confluence_search",
    "Search Confluence content using CQL",
    SearchSchema.shape,
    async (args) => {
      const { cql, limit } = SearchSchema.parse(args);
      const result = await confluence.search(cql, limit);

      const items = result.results.map(
        (r) =>
          `[${r.type}] ${r.title}` +
          (r.space ? ` (Space: ${r.space.key})` : "") +
          (r.excerpt
            ? `\n  ${r.excerpt.replace(/<[^>]+>/g, "").slice(0, 100)}...`
            : "")
      );

      return {
        content: [
          {
            type: "text",
            text:
              `Search results: ${result.totalSize} found (showing: ${result.results.length})\n\n` +
              items.join("\n\n"),
          },
        ],
      };
    }
  );
}
