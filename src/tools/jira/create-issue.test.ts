import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerCreateIssue } from "./create-issue.js";

function makeServer() {
  let capturedHandler: (args: unknown) => Promise<unknown>;
  const server = {
    tool: vi.fn((_name, _desc, _schema, handler) => { capturedHandler = handler; }),
  } as unknown as McpServer;
  return { server, getHandler: () => capturedHandler };
}

const createdIssue = { id: "1", key: "ENG-1", self: "", fields: {} };

function makeJira(overrides: Partial<IJiraClient> = {}): IJiraClient {
  return {
    baseUrl: "https://jira.example.com",
    getBrowseUrl: vi.fn().mockReturnValue("https://jira.example.com/browse/ENG-1"),
    searchIssues: vi.fn(),
    getIssue: vi.fn(),
    createIssue: vi.fn().mockResolvedValue(createdIssue),
    updateIssue: vi.fn(),
    addComment: vi.fn(),
    listProjects: vi.fn(),
    getTransitions: vi.fn(),
    doTransition: vi.fn(),
    ...overrides,
  };
}

describe("registerCreateIssue", () => {
  it("필수 필드만으로 이슈를 생성한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerCreateIssue(server, jira);
    const result = await getHandler()({
      projectKey: "ENG",
      issueType: "Bug",
      summary: "New bug",
    }) as { content: Array<{ text: string }> };

    expect(jira.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        project: { key: "ENG" },
        issuetype: { name: "Bug" },
        summary: "New bug",
      })
    );
    expect(result.content[0].text).toContain("ENG-1");
    expect(result.content[0].text).toContain("Issue created");
  });

  it("선택 필드(description, assignee, priority)를 포함해 생성한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerCreateIssue(server, jira);
    await getHandler()({
      projectKey: "ENG",
      summary: "Full issue",
      description: "Detailed desc",
      assignee: "alice",
      priority: "High",
    });

    expect(jira.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Detailed desc",
        assignee: { name: "alice" },
        priority: { name: "High" },
      })
    );
  });

  it("선택 필드가 없으면 payload에 포함하지 않는다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerCreateIssue(server, jira);
    await getHandler()({ projectKey: "ENG", summary: "Minimal" });

    const fields = (jira.createIssue as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(fields).not.toHaveProperty("description");
    expect(fields).not.toHaveProperty("assignee");
    expect(fields).not.toHaveProperty("priority");
  });
});
