import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";
import { registerCreatePage } from "./create-page.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

const createdPage = {
  id: "999",
  title: "New Page",
  type: "page",
  space: { key: "ENG", name: "Engineering" },
};

function makeConfluence(overrides: Partial<IConfluenceClient> = {}): IConfluenceClient {
  return {
    search: vi.fn(),
    getPageById: vi.fn(),
    getPageByTitle: vi.fn(),
    createPage: vi.fn().mockResolvedValue(createdPage),
    updatePage: vi.fn(),
    listSpaces: vi.fn(),
    ...overrides,
  };
}

describe("registerCreatePage", () => {
  it("기본 파라미터로 페이지를 생성하고 결과를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerCreatePage(server, confluence);
    const result = await getHandler()({
      spaceKey: "ENG",
      title: "New Page",
      body: "<p>Hello</p>",
    }) as { content: Array<{ text: string }> };

    expect(confluence.createPage).toHaveBeenCalledWith("ENG", "New Page", "<p>Hello</p>", undefined);
    expect(result.content[0].text).toContain("Page created");
    expect(result.content[0].text).toContain("New Page");
    expect(result.content[0].text).toContain("999");
  });

  it("parentId가 있으면 함께 전달한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerCreatePage(server, confluence);
    await getHandler()({
      spaceKey: "ENG",
      title: "Child Page",
      body: "<p>Child</p>",
      parentId: "456",
    });

    expect(confluence.createPage).toHaveBeenCalledWith("ENG", "Child Page", "<p>Child</p>", "456");
  });
});
