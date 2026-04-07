import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { config } from "./config.js";
import { JiraClient } from "./client/jira.js";
import { ConfluenceClient } from "./client/confluence.js";
import { registerAllTools } from "./tools/index.js";

async function main(): Promise<void> {
  const server = createServer();

  const requireConfirm = config.ATLASSIAN_MCP_REQUIRE_CONFIRM;

  const jira = new JiraClient(
    server,
    config.JIRA_BASE_URL,
    config.JIRA_API_TOKEN,
    requireConfirm
  );
  const confluence = new ConfluenceClient(
    server,
    config.CONFLUENCE_BASE_URL,
    config.CONFLUENCE_API_TOKEN,
    requireConfirm
  );

  registerAllTools(server, jira, confluence);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `Atlassian MCP server started (requireConfirm=${requireConfirm})\n`
  );
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
