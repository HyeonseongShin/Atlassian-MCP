import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoopConfirmationGate } from "../confirm.js";
import { JiraClient } from "./jira.js";

const BASE_URL = "https://jira.example.com";

function makeClient() {
  const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, "token");
  const requestSpy = vi.spyOn(client as unknown as { request: () => unknown }, "request");
  return { client, requestSpy };
}

describe("JiraClient", () => {
  describe("getBrowseUrl", () => {
    it("올바른 browse URL을 반환한다", () => {
      const { client } = makeClient();
      expect(client.getBrowseUrl("ENG-123")).toBe(
        "https://jira.example.com/browse/ENG-123"
      );
    });

    it("이슈 키를 URL 인코딩한다", () => {
      const { client } = makeClient();
      expect(client.getBrowseUrl("ENG 1")).toContain("ENG%201");
    });
  });

  describe("searchIssues", () => {
    it("POST /rest/api/2/search 로 jql과 fields, maxResults를 전달한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ issues: [], total: 0, maxResults: 10, startAt: 0 });

      await client.searchIssues("project = ENG", ["summary"], 10);

      expect(requestSpy).toHaveBeenCalledWith("POST", "/rest/api/2/search", {
        jql: "project = ENG",
        fields: ["summary"],
        maxResults: 10,
      });
    });

    it("fields가 없으면 body에 fields 키를 포함하지 않는다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ issues: [], total: 0, maxResults: 20, startAt: 0 });

      await client.searchIssues("project = ENG");

      const body = (requestSpy.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
      expect(body).not.toHaveProperty("fields");
    });
  });

  describe("getIssue", () => {
    it("GET /rest/api/2/issue/:key 를 호출한다", async () => {
      const { client, requestSpy } = makeClient();
      const issue = { id: "1", key: "ENG-1", self: "", fields: {} };
      requestSpy.mockResolvedValue(issue);

      const result = await client.getIssue("ENG-1");

      expect(requestSpy).toHaveBeenCalledWith(
        "GET",
        "/rest/api/2/issue/ENG-1"
      );
      expect(result).toEqual(issue);
    });
  });

  describe("createIssue", () => {
    it("fields를 { fields: ... } 로 래핑해 POST한다", async () => {
      const { client, requestSpy } = makeClient();
      const fields = { project: { key: "ENG" }, summary: "Test" };
      requestSpy.mockResolvedValue({ id: "1", key: "ENG-1", self: "", fields: {} });

      await client.createIssue(fields);

      expect(requestSpy).toHaveBeenCalledWith(
        "POST",
        "/rest/api/2/issue",
        { fields }
      );
    });
  });

  describe("updateIssue", () => {
    it("PUT /rest/api/2/issue/:key 로 fields를 래핑해 전달한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(undefined);

      await client.updateIssue("ENG-1", { summary: "Updated" });

      expect(requestSpy).toHaveBeenCalledWith(
        "PUT",
        "/rest/api/2/issue/ENG-1",
        { fields: { summary: "Updated" } }
      );
    });
  });

  describe("addComment", () => {
    it("POST /rest/api/2/issue/:key/comment 로 body 문자열을 전달한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ id: "100" });

      await client.addComment("ENG-1", "Hello world");

      expect(requestSpy).toHaveBeenCalledWith(
        "POST",
        "/rest/api/2/issue/ENG-1/comment",
        { body: "Hello world" }
      );
    });
  });

  describe("listProjects", () => {
    it("GET /rest/api/2/project 를 호출한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue([]);

      await client.listProjects();

      expect(requestSpy).toHaveBeenCalledWith("GET", "/rest/api/2/project");
    });
  });

  describe("getTransitions", () => {
    it("GET /rest/api/2/issue/:key/transitions 를 호출한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue({ transitions: [] });

      await client.getTransitions("ENG-1");

      expect(requestSpy).toHaveBeenCalledWith(
        "GET",
        "/rest/api/2/issue/ENG-1/transitions"
      );
    });
  });

  describe("doTransition", () => {
    it("POST /rest/api/2/issue/:key/transitions 로 transition.id를 전달한다", async () => {
      const { client, requestSpy } = makeClient();
      requestSpy.mockResolvedValue(undefined);

      await client.doTransition("ENG-1", "21");

      expect(requestSpy).toHaveBeenCalledWith(
        "POST",
        "/rest/api/2/issue/ENG-1/transitions",
        { transition: { id: "21" } }
      );
    });
  });
});
