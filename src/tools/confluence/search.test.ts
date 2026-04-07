import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";
import { registerConfluenceSearch } from "./search.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

function makeConfluence(overrides: Partial<IConfluenceClient> = {}): IConfluenceClient {
  return {
    search: vi.fn().mockResolvedValue({
      results: [
        {
          id: "1",
          title: "API Guide",
          type: "page",
          space: { key: "ENG", name: "Engineering" },
          excerpt: "This is the API guide",
        },
      ],
      totalSize: 1,
      start: 0,
      limit: 20,
    }),
    getPageById: vi.fn(),
    getPageByTitle: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    listSpaces: vi.fn(),
    ...overrides,
  };
}

describe("registerConfluenceSearch", () => {
  it("검색 결과를 포맷해 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerConfluenceSearch(server, confluence);
    const result = await getHandler()({ cql: "type = page" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("API Guide");
    expect(result.content[0].text).toContain("ENG");
    expect(result.content[0].text).toContain("1 found");
  });

  it("결과가 없으면 0 found 텍스트를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      search: vi.fn().mockResolvedValue({ results: [], totalSize: 0, start: 0, limit: 20 }),
    });

    registerConfluenceSearch(server, confluence);
    const result = await getHandler()({ cql: "type = page" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("0 found");
  });

  it("excerpt의 HTML 태그를 제거한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      search: vi.fn().mockResolvedValue({
        results: [
          { id: "2", title: "Doc", type: "page", excerpt: "<em>bold</em> text" },
        ],
        totalSize: 1, start: 0, limit: 20,
      }),
    });

    registerConfluenceSearch(server, confluence);
    const result = await getHandler()({ cql: "type = page" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).not.toContain("<em>");
    expect(result.content[0].text).toContain("bold");
  });
});
