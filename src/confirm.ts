import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface RequestInfo {
  service: "JIRA" | "Confluence";
  method: string;
  url: string;
  body?: unknown;
}

// Valid only for the lifetime of this MCP server process (auto-reset on container restart)
let autoApprove = false;

export function resetAutoApprove(): void {
  autoApprove = false;
}

export function isAutoApprove(): boolean {
  return autoApprove;
}

function formatRequest(req: RequestInfo): string {
  const lines = [
    `  service : ${req.service}`,
    `  method  : ${req.method}`,
    `  url     : ${req.url}`,
  ];
  if (req.body !== undefined) {
    lines.push(`  body    : ${JSON.stringify(req.body, null, 4)}`);
  }
  return lines.join("\n");
}

export async function confirmRequest(
  server: McpServer,
  req: RequestInfo
): Promise<RequestInfo> {
  if (autoApprove) {
    return req;
  }

  // Check whether the client supports elicitation
  const clientCaps = server.server.getClientCapabilities();
  if (!clientCaps?.elicitation) {
    throw new Error(
      "This MCP client does not support elicitation. " +
        "All Atlassian API requests will be denied. " +
        "Use a recent version of Claude Code, or set ATLASSIAN_MCP_REQUIRE_CONFIRM=false to disable the confirmation gate."
    );
  }

  return await promptUser(server, req);
}

async function promptUser(
  server: McpServer,
  req: RequestInfo
): Promise<RequestInfo> {
  const prompt =
    `[Atlassian MCP] Send the following request?\n\n` +
    `${formatRequest(req)}\n\n` +
    `Select an option:`;

  let result: Awaited<ReturnType<typeof server.server.elicitInput>>;
  try {
    result = await server.server.elicitInput({
      message: prompt,
      requestedSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            title: "Choice",
            description: "Select an option",
            enum: ["1", "2", "3", "4"],
            enumNames: [
              "Run this request once",
              "Always auto-approve for this session",
              "Edit the request and run",
              "Deny",
            ],
          },
        },
        required: ["action"],
      },
    });
  } catch (e) {
    // elicitation call itself failed (connection issue, etc.)
    process.stderr.write(
      `[atlassian-mcp] elicitInput call failed: ${e instanceof Error ? e.message : String(e)}\n`
    );
    throw new Error("User rejected the request.");
  }

  // user cancelled or declined
  if (result.action === "cancel" || result.action === "decline") {
    throw new Error("User rejected the request.");
  }

  const choice = (result.content?.["action"] as string | undefined)?.trim();

  if (choice === "1") {
    return req;
  } else if (choice === "2") {
    autoApprove = true;
    return req;
  } else if (choice === "3") {
    return await promptEdit(server, req);
  } else {
    // "4" or unexpected value
    throw new Error("User rejected the request.");
  }
}

async function promptEdit(
  server: McpServer,
  req: RequestInfo,
  errorMsg?: string
): Promise<RequestInfo> {
  const currentJson = JSON.stringify(
    { method: req.method, url: req.url, body: req.body },
    null,
    2
  );

  const header = errorMsg
    ? `[Error] ${errorMsg}\n\n[Atlassian MCP] Edit the request (JSON format):`
    : `[Atlassian MCP] Edit the request (JSON format):`;

  let result: Awaited<ReturnType<typeof server.server.elicitInput>>;
  try {
    result = await server.server.elicitInput({
      message: `${header}\n\nCurrent request:\n${currentJson}`,
      requestedSchema: {
        type: "object",
        properties: {
          json: {
            type: "string",
            title: "Edited request JSON",
            description:
              "Enter a JSON object with method, url, and body fields",
          },
        },
        required: ["json"],
      },
    });
  } catch (e) {
    process.stderr.write(
      `[atlassian-mcp] elicitInput(edit) call failed: ${e instanceof Error ? e.message : String(e)}\n`
    );
    throw new Error("User rejected the request.");
  }

  if (result.action === "cancel" || result.action === "decline") {
    throw new Error("User rejected the request.");
  }

  const jsonInput = result.content?.["json"] as string | undefined;
  if (!jsonInput) {
    throw new Error("User rejected the request.");
  }

  let parsed: { method?: string; url?: string; body?: unknown };
  try {
    parsed = JSON.parse(jsonInput);
  } catch {
    // retry step 3 with an error message on JSON parse failure
    return await promptEdit(server, req, "Invalid JSON. Please enter a valid JSON object.");
  }

  // origin validation — block requests to a different host
  const baseOrigin = new URL(req.url).origin;
  if (parsed.url) {
    let editedOrigin: string;
    try {
      editedOrigin = new URL(parsed.url).origin;
    } catch {
      return await promptEdit(server, req, "The edited URL is invalid.");
    }
    if (editedOrigin !== baseOrigin) {
      return await promptEdit(
        server,
        req,
        `Security error: the edited URL origin (${editedOrigin}) does not match the allowed origin (${baseOrigin}).`
      );
    }
  }

  const updatedReq: RequestInfo = {
    service: req.service,
    method: (parsed.method ?? req.method).toUpperCase(),
    url: parsed.url ?? req.url,
    // use the value of "body" if the key is explicitly present (even if undefined),
    // otherwise keep the original body
    body: "body" in parsed ? parsed.body : req.body,
  };

  // re-confirm the edited request (restart from step 1)
  return await promptUser(server, updatedReq);
}
