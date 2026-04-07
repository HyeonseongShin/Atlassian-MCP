import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerTransitionIssue } from "./transition-issue.js";

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
    updateIssue: vi.fn(),
    addComment: vi.fn(),
    listProjects: vi.fn(),
    getTransitions: vi.fn().mockResolvedValue({
      transitions: [
        { id: "11", name: "In Progress", to: { name: "In Progress" } },
        { id: "21", name: "Done", to: { name: "Done" } },
      ],
    }),
    doTransition: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("registerTransitionIssue", () => {
  it("transitionId 없이 호출하면 전환 목록을 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerTransitionIssue(server, jira);
    const result = await getHandler()({ issueKey: "ENG-1" }) as { content: Array<{ text: string }> };

    expect(jira.getTransitions).toHaveBeenCalledWith("ENG-1");
    expect(jira.doTransition).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("In Progress");
    expect(result.content[0].text).toContain("Done");
    expect(result.content[0].text).toContain("id: 11");
  });

  it("transitionId를 제공하면 doTransition을 호출한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerTransitionIssue(server, jira);
    const result = await getHandler()({ issueKey: "ENG-1", transitionId: "21" }) as { content: Array<{ text: string }> };

    expect(jira.doTransition).toHaveBeenCalledWith("ENG-1", "21");
    expect(result.content[0].text).toContain("ENG-1 transitioned");
    expect(result.content[0].text).toContain("21");
  });
});
