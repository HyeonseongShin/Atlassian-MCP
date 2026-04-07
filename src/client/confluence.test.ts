import { describe, it, expect, vi } from "vitest";
import { NoopConfirmationGate } from "../confirm.js";
import { ConfluenceClient } from "./confluence.js";

const BASE_URL = "https://confluence.example.com";

function makeClient() {
  const client = new ConfluenceClient(new NoopConfirmationGate(), BASE_URL, "token");
  const requestSpy = vi.spyOn(client as unknown as { request: () => unknown }, "request");
  return { client, requestSpy };
}

const fakePage = {
  id: "123",
  title: "Test Page",
  type: "page",
  space: { key: "ENG", name: "Engineering" },
  version: { number: 3 },
  body: { storage: { value: "<p>content</p>", representation: "storage" } },
};

describe("ConfluenceClient", () => {
  describe("search", () => {
    it("GET /rest/api/search?cql=... 를 호출한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [], totalSize: 0, start: 0, limit: 20 });

      await client.search("type = page", 20);

      expect(requestSpy).toHaveBeenCalledWith(
        "GET",
        expect.stringContaining("/rest/api/search?")
      );
      const path = (requestSpy.mock.calls[0] as unknown[])[1] as string;
      expect(path).toContain("cql=type+%3D+page");
      expect(path).toContain("limit=20");
    });

    it("limit 없이 호출하면 쿼리 파라미터에 limit이 없다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [], totalSize: 0, start: 0, limit: 20 });

      await client.search("type = page");

      const path = (requestSpy.mock.calls[0] as unknown[])[1] as string;
      expect(path).not.toContain("limit=");
    });
  });

  describe("getPageById", () => {
    it("GET /rest/api/content/:id?expand=... 를 호출한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(fakePage);

      await client.getPageById("123");

      expect(requestSpy).toHaveBeenCalledWith(
        "GET",
        expect.stringContaining("/rest/api/content/123?expand=body.storage,version,space")
      );
    });
  });

  describe("getPageByTitle", () => {
    it("결과가 있으면 첫 번째 페이지를 반환한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [fakePage], size: 1 });

      const result = await client.getPageByTitle("ENG", "Test Page");

      expect(result).toEqual(fakePage);
    });

    it("결과가 없으면 null을 반환한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [], size: 0 });

      const result = await client.getPageByTitle("ENG", "Non Existent");

      expect(result).toBeNull();
    });

    it("쿼리 파라미터에 spaceKey, title, expand를 포함한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [], size: 0 });

      await client.getPageByTitle("ENG", "My Page");

      const path = (requestSpy.mock.calls[0] as unknown[])[1] as string;
      expect(path).toContain("spaceKey=ENG");
      expect(path).toContain("title=My+Page");
      expect(path).toContain("expand=body.storage%2Cversion%2Cspace");
    });
  });

  describe("createPage", () => {
    it("POST /rest/api/content 로 올바른 payload를 전달한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(fakePage);

      await client.createPage("ENG", "New Page", "<p>Hello</p>");

      expect(requestSpy).toHaveBeenCalledWith(
        "POST",
        "/rest/api/content",
        expect.objectContaining({
          type: "page",
          title: "New Page",
          space: { key: "ENG" },
          body: {
            storage: { value: "<p>Hello</p>", representation: "storage" },
          },
        })
      );
    });

    it("parentId가 있으면 ancestors에 포함한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(fakePage);

      await client.createPage("ENG", "Child Page", "<p>Child</p>", "456");

      const body = (requestSpy.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
      expect(body.ancestors).toEqual([{ id: "456" }]);
    });

    it("parentId가 없으면 ancestors가 없다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(fakePage);

      await client.createPage("ENG", "Root Page", "<p>Root</p>");

      const body = (requestSpy.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
      expect(body).not.toHaveProperty("ancestors");
    });
  });

  describe("updatePage", () => {
    it("PUT /rest/api/content/:id 로 currentVersion+1을 전달한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(fakePage);

      await client.updatePage("123", "Updated Title", "<p>Updated</p>", 3);

      expect(requestSpy).toHaveBeenCalledWith(
        "PUT",
        "/rest/api/content/123",
        expect.objectContaining({
          type: "page",
          title: "Updated Title",
          version: { number: 4 },
        })
      );
    });
  });

  describe("listSpaces", () => {
    it("GET /rest/api/space 를 호출한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [], start: 0, limit: 50, size: 0 });

      await client.listSpaces();

      expect(requestSpy).toHaveBeenCalledWith("GET", "/rest/api/space");
    });

    it("type 필터와 limit이 쿼리 파라미터에 포함된다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ results: [], start: 0, limit: 10, size: 0 });

      await client.listSpaces(10, "global");

      const path = (requestSpy.mock.calls[0] as unknown[])[1] as string;
      expect(path).toContain("type=global");
      expect(path).toContain("limit=10");
    });
  });
});
