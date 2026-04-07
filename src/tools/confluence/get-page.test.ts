import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";
import { registerGetPage } from "./get-page.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

const fakePage = {
  id: "123",
  title: "Test Page",
  type: "page",
  space: { key: "ENG", name: "Engineering" },
  version: { number: 3 },
  body: { storage: { value: "<p>content</p>", representation: "storage" } },
};

function makeConfluence(overrides: Partial<IConfluenceClient> = {}): IConfluenceClient {
  return {
    search: vi.fn(),
    getPageById: vi.fn().mockResolvedValue(fakePage),
    getPageByTitle: vi.fn().mockResolvedValue(fakePage),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    listSpaces: vi.fn(),
    ...overrides,
  };
}

describe("registerGetPage", () => {
  it("pageId로 페이지를 조회한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerGetPage(server, confluence);
    const result = await getHandler()({ pageId: "123" }) as { content: Array<{ text: string }> };

    expect(confluence.getPageById).toHaveBeenCalledWith("123");
    expect(result.content[0].text).toContain("Test Page");
    expect(result.content[0].text).toContain("Version: 3");
    expect(result.content[0].text).toContain("<p>content</p>");
  });

  it("spaceKey + title로 페이지를 조회한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerGetPage(server, confluence);
    const result = await getHandler()({ spaceKey: "ENG", title: "Test Page" }) as { content: Array<{ text: string }> };

    expect(confluence.getPageByTitle).toHaveBeenCalledWith("ENG", "Test Page");
    expect(result.content[0].text).toContain("Test Page");
  });

  it("spaceKey+title 조회 시 페이지가 없으면 not found 메시지를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      getPageByTitle: vi.fn().mockResolvedValue(null),
    });

    registerGetPage(server, confluence);
    const result = await getHandler()({ spaceKey: "ENG", title: "Non Existent" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("No page found");
    expect(result.content[0].text).toContain("Non Existent");
  });
});
