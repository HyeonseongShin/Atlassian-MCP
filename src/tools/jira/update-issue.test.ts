import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerUpdateIssue } from "./update-issue.js";

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
    getBrowseUrl: vi.fn(),
    searchIssues: vi.fn(),
    getIssue: vi.fn(),
    createIssue: vi.fn(),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn(),
    listProjects: vi.fn(),
    getTransitions: vi.fn(),
    doTransition: vi.fn(),
    ...overrides,
  };
}

describe("registerUpdateIssue", () => {
  it("업데이트할 필드가 없으면 updateIssue를 호출하지 않는다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerUpdateIssue(server, jira);
    const result = await getHandler()({ issueKey: "ENG-1" }) as { content: Array<{ text: string }> };

    expect(jira.updateIssue).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("No fields to update");
  });

  it("summary만 업데이트한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerUpdateIssue(server, jira);
    const result = await getHandler()({ issueKey: "ENG-1", summary: "New title" }) as { content: Array<{ text: string }> };

    expect(jira.updateIssue).toHaveBeenCalledWith("ENG-1", { summary: "New title" });
    expect(result.content[0].text).toContain("ENG-1 updated");
  });

  it("assignee와 priority를 객체 형태로 래핑한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerUpdateIssue(server, jira);
    await getHandler()({ issueKey: "ENG-1", assignee: "alice", priority: "Low" });

    expect(jira.updateIssue).toHaveBeenCalledWith(
      "ENG-1",
      expect.objectContaining({
        assignee: { name: "alice" },
        priority: { name: "Low" },
      })
    );
  });
});
