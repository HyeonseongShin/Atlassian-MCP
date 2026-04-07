import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AtlassianBaseClient } from "./atlassian.js";

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: Record<string, unknown>;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string };
}

export class JiraClient extends AtlassianBaseClient {
  readonly serviceName = "JIRA" as const;

  constructor(
    server: McpServer,
    baseUrl: string,
    token: string,
    requireConfirm: boolean
  ) {
    super(server, baseUrl, token, requireConfirm);
  }

  /** Returns the browser-accessible URL for the given issue key. */
  getBrowseUrl(issueKey: string): string {
    return `${this.baseUrl}/browse/${encodeURIComponent(issueKey)}`;
  }

  async searchIssues(
    jql: string,
    fields?: string[],
    maxResults?: number
  ): Promise<JiraSearchResult> {
    const body: Record<string, unknown> = { jql };
    if (fields) body.fields = fields;
    if (maxResults !== undefined) body.maxResults = maxResults;
    return this.request<JiraSearchResult>("POST", "/rest/api/2/search", body);
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(
      "GET",
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}`
    );
  }

  async createIssue(fields: Record<string, unknown>): Promise<JiraIssue> {
    return this.request<JiraIssue>("POST", "/rest/api/2/issue", { fields });
  }

  async updateIssue(
    issueKey: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    return this.request<void>(
      "PUT",
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}`,
      { fields }
    );
  }

  async addComment(
    issueKey: string,
    body: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "POST",
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`,
      { body }
    );
  }

  async listProjects(): Promise<JiraProject[]> {
    return this.request<JiraProject[]>("GET", "/rest/api/2/project");
  }

  async getTransitions(
    issueKey: string
  ): Promise<{ transitions: JiraTransition[] }> {
    return this.request<{ transitions: JiraTransition[] }>(
      "GET",
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`
    );
  }

  async doTransition(issueKey: string, transitionId: string): Promise<void> {
    return this.request<void>(
      "POST",
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`,
      { transition: { id: transitionId } }
    );
  }
}
