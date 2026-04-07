import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerGetIssue } from "./get-issue.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

function makeJira(overrides: Partial<IJiraClient> = {}): IJiraClient {
  return {
    baseUrl: "https://jira.example.com",
    getBrowseUrl: vi.fn().mockImplementation((key: string) => `https://jira.example.com/browse/${key}`),
    searchIssues: vi.fn(),
    getIssue: vi.fn().mockResolvedValue({
      id: "1",
      key: "ENG-1",
      self: "",
      fields: {
        summary: "Test issue",
        issuetype: { name: "Bug" },
        status: { name: "Open" },
        priority: { name: "Medium" },
        assignee: { displayName: "Alice" },
        reporter: { displayName: "Bob" },
        created: "2024-01-01",
        updated: "2024-01-02",
        description: "A bug description",
      },
    }),
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    addComment: vi.fn(),
    listProjects: vi.fn(),
    getTransitions: vi.fn(),
    doTransition: vi.fn(),
    ...overrides,
  };
}

describe("registerGetIssue", () => {
  it("이슈 상세 정보를 포맷해 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerGetIssue(server, jira);
    const result = await getHandler()({ issueKey: "ENG-1" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("ENG-1");
    expect(result.content[0].text).toContain("Test issue");
    expect(result.content[0].text).toContain("Bug");
    expect(result.content[0].text).toContain("Open");
    expect(result.content[0].text).toContain("Alice");
    expect(result.content[0].text).toContain("A bug description");
  });

  it("getIssue가 throw 하면 에러가 전파된다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira({
      getIssue: vi.fn().mockRejectedValue(new Error("Not found")),
    });

    registerGetIssue(server, jira);
    await expect(getHandler()({ issueKey: "ENG-999" })).rejects.toThrow("Not found");
  });
});
