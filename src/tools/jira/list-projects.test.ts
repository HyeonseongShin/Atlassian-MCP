import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerListProjects } from "./list-projects.js";

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
    listProjects: vi.fn().mockResolvedValue([
      { id: "1", key: "ENG", name: "Engineering", projectTypeKey: "software" },
      { id: "2", key: "OPS", name: "Operations", projectTypeKey: "business" },
    ]),
    getTransitions: vi.fn(),
    doTransition: vi.fn(),
    ...overrides,
  };
}

describe("registerListProjects", () => {
  it("프로젝트 목록을 포맷해 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerListProjects(server, jira);
    const result = await getHandler()({}) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("ENG");
    expect(result.content[0].text).toContain("Engineering");
    expect(result.content[0].text).toContain("OPS");
    expect(result.content[0].text).toContain("Projects (2)");
  });

  it("빈 목록이면 Projects (0) 을 반환한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira({ listProjects: vi.fn().mockResolvedValue([]) });

    registerListProjects(server, jira);
    const result = await getHandler()({}) as { content: Array<{ text: string }> };

    expect(result.content[0].text).toContain("Projects (0)");
  });
});
