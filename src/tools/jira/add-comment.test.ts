import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IJiraClient } from "../../client/jira.js";
import { registerAddComment } from "./add-comment.js";

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
    addComment: vi.fn().mockResolvedValue({ id: "500" }),
    listProjects: vi.fn(),
    getTransitions: vi.fn(),
    doTransition: vi.fn(),
    ...overrides,
  };
}

describe("registerAddComment", () => {
  it("issueKey와 body를 addComment에 전달한다", async () => {
    const { server, getHandler } = makeServer();
    const jira = makeJira();

    registerAddComment(server, jira);
    const result = await getHandler()({ issueKey: "ENG-1", body: "Hello world" }) as { content: Array<{ text: string }> };

    expect(jira.addComment).toHaveBeenCalledWith("ENG-1", "Hello world");
    expect(result.content[0].text).toContain("ENG-1");
    expect(result.content[0].text).toContain("500");
  });
});
