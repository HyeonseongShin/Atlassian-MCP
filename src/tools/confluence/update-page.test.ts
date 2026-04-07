import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IConfluenceClient } from "../../client/confluence.js";
import { registerUpdatePage } from "./update-page.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

const updatedPage = {
  id: "123",
  title: "Updated Title",
  type: "page",
  version: { number: 4 },
};

function makeConfluence(overrides: Partial<IConfluenceClient> = {}): IConfluenceClient {
  return {
    search: vi.fn(),
    getPageById: vi.fn(),
    getPageByTitle: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn().mockResolvedValue(updatedPage),
    listSpaces: vi.fn(),
    ...overrides,
  };
}

describe("registerUpdatePage", () => {
  it("페이지를 업데이트하고 새 버전을 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence();

    registerUpdatePage(server, confluence);
    const result = await getHandler()({
      pageId: "123",
      title: "Updated Title",
      body: "<p>Updated</p>",
      currentVersion: 3,
    }) as { content: Array<{ text: string }> };

    expect(confluence.updatePage).toHaveBeenCalledWith("123", "Updated Title", "<p>Updated</p>", 3);
    expect(result.content[0].text).toContain("Page updated");
    expect(result.content[0].text).toContain("Updated Title");
    expect(result.content[0].text).toContain("4");
  });

  it("400 에러 시 버전 충돌 안내 메시지를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      updatePage: vi.fn().mockRejectedValue(new Error("API error 400: version conflict")),
    });

    registerUpdatePage(server, confluence);
    const result = await getHandler()({
      pageId: "123",
      title: "Title",
      body: "<p>body</p>",
      currentVersion: 2,
    }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("Update failed");
    expect(result.content[0].text).toContain("confluence_get_page");
  });

  it("409 에러 시 버전 충돌 안내 메시지를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      updatePage: vi.fn().mockRejectedValue(new Error("API error 409: conflict")),
    });

    registerUpdatePage(server, confluence);
    const result = await getHandler()({
      pageId: "123",
      title: "Title",
      body: "<p>body</p>",
      currentVersion: 2,
    }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("Update failed");
  });

  it("다른 에러는 throw 된다", async () => {
    const { server, getHandler } = makeServer();
    const confluence = makeConfluence({
      updatePage: vi.fn().mockRejectedValue(new Error("Network error")),
    });

    registerUpdatePage(server, confluence);
    await expect(
      getHandler()({ pageId: "123", title: "T", body: "<p>b</p>", currentVersion: 1 })
    ).rejects.toThrow("Network error");
  });
});
