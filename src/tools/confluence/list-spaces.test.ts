import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";
import { registerListSpaces } from "./list-spaces.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

function makeConfluence(overrides: Partial<IConfluenceClient> = {}): IConfluenceClient {
  return {
    search: vi.fn(),
    getPageById: vi.fn(),
    getPageByTitle: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    listSpaces: vi.fn().mockResolvedValue({
      results: [
        { id: 1, key: "ENG", name: "Engineering", type: "global", status: "current" },
        { id: 2, key: "OPS", name: "Operations", type: "global", status: "current" },
      ],
      start: 0,
      limit: 50,
      size: 2,
    }),
    ...overrides,
  };
}

describe("registerListSpaces", () => {
  it("스페이스 목록을 포맷해 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerListSpaces(server, confluence);
    const result = await getHandler()({}) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("ENG");
    expect(result.content[0].text).toContain("Engineering");
    expect(result.content[0].text).toContain("OPS");
    expect(result.content[0].text).toContain("Spaces (2)");
  });

  it("type 필터와 limit을 listSpaces에 전달한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      listSpaces: vi.fn().mockResolvedValue({ results: [], start: 0, limit: 10, size: 0 }),
    });

    registerListSpaces(server, confluence);
    await getHandler()({ limit: 10, type: "global" });

    expect(confluence.listSpaces).toHaveBeenCalledWith(10, "global");
  });
});
