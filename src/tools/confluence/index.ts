import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConfluenceClient } from "../../client/confluence.js";
import { registerConfluenceSearch } from "./search.js";
import { registerGetPage } from "./get-page.js";
import { registerCreatePage } from "./create-page.js";
import { registerUpdatePage } from "./update-page.js";
import { registerListSpaces } from "./list-spaces.js";

export function registerConfluenceTools(
  server: McpServer,
  confluence: ConfluenceClient
): void {
  registerConfluenceSearch(server, confluence);
  registerGetPage(server, confluence);
  registerCreatePage(server, confluence);
  registerUpdatePage(server, confluence);
  registerListSpaces(server, confluence);
}
