import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadConfig } from "./config.js";
import { McpConfirmationGate, NoopConfirmationGate } from "./confirm.js";
import { JiraClient } from "./client/jira.js";
import { ConfluenceClient } from "./client/confluence.js";
import { registerAllTools } from "./tools/index.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer();

  const requireConfirm = config.ATLASSIAN_MCP_REQUIRE_CONFIRM;

  const gate = requireConfirm
    ? new McpConfirmationGate(server)
    : new NoopConfirmationGate();

  const jira = new JiraClient(gate, config.JIRA_BASE_URL, config.JIRA_API_TOKEN);
  const confluence = new ConfluenceClient(
    gate,
    config.CONFLUENCE_BASE_URL,
    config.CONFLUENCE_API_TOKEN
  );

  registerAllTools(server, jira, confluence, gate);

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
