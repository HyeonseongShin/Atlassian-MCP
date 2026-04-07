import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerSearchIssues } from "./search-issues.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => {
      capturedHandler = handler;
    }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

function makeJira(overrides: Partial<IJiraClient> = {}): IJiraClient {
  return {
    baseUrl: "https://jira.example.com",
    getBrowseUrl: vi.fn().mockImplementation((key: string) => `https://jira.example.com/browse/${key}`),
    searchIssues: vi.fn().mockResolvedValue({ issues: [], total: 0, maxResults: 20, startAt: 0 }),
    getIssue: vi.fn(),
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    addComment: vi.fn(),
    listProjects: vi.fn(),
    getTransitions: vi.fn(),
    doTransition: vi.fn(),
    ...overrides,
  };
}

describe("registerSearchIssues", () => {
  it("결과가 있을 때 포맷된 텍스트를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira({
      searchIssues: vi.fn().mockResolvedValue({
        issues: [
          {
            key: "ENG-1",
            fields: {
              summary: "Fix bug",
              status: { name: "In Progress" },
              assignee: { displayName: "Alice" },
              priority: { name: "High" },
              issuetype: { name: "Bug" },
            },
          },
        ],
        total: 1,
        maxResults: 20,
        startAt: 0,
      }),
    });

    registerSearchIssues(server, jira);
    const result = await getHandler()({ jql: "project = ENG" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("ENG-1");
    expect(result.content[0].text).toContain("Fix bug");
    expect(result.content[0].text).toContain("1 found");
    expect(result.content[0].text).toContain("In Progress");
    expect(result.content[0].text).toContain("Alice");
  });

  it("결과가 없을 때 0 found 텍스트를 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerSearchIssues(server, jira);
    const result = await getHandler()({ jql: "project = EMPTY" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("0 found");
  });

  it("Unassigned assignee 처리", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira({
      searchIssues: vi.fn().mockResolvedValue({
        issues: [
          { key: "ENG-2", fields: { summary: "Task", status: { name: "Open" }, assignee: null, priority: null, issuetype: null } },
        ],
        total: 1, maxResults: 20, startAt: 0,
      }),
    });

    registerSearchIssues(server, jira);
    const result = await getHandler()({ jql: "project = ENG" }) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("Unassigned");
  });

  it("jira.searchIssues가 throw 하면 에러가 전파된다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira({
      searchIssues: vi.fn().mockRejectedValue(new Error("API error")),
    });

    registerSearchIssues(server, jira);
    await expect(getHandler()({ jql: "project = ENG" })).rejects.toThrow("API error");
  });
});
