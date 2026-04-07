import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfirmationGate } from "../confirm.js";
import { registerResetAutoApprove } from "./reset-auto-approve.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

function makeGate(): IConfirmationGate {
  return { confirm: vi.fn(), reset: vi.fn() };
}

describe("registerResetAutoApprove", () => {
  it("gate.reset()을 호출한다", async () => {
    const { server, getHandler } = makeServer();
    const gate = makeGate();

    registerResetAutoApprove(server, gate);
    await getHandler()({});

    expect(gate.reset).toHaveBeenCalledOnce();
  });

  it("성공 메시지를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const gate = makeGate();

    registerResetAutoApprove(server, gate);
    const result = await getHandler()({}) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("reset");
  });
});
