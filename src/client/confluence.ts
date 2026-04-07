import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AtlassianBaseClient } from "./atlassian.js";

export interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  space?: { key: string; name: string };
  version?: { number: number };
  body?: {
    storage?: { value: string; representation: string };
  };
  _links?: Record<string, string>;
}

export interface ConfluenceSearchResult {
  results: Array<{
    id: string;
    title: string;
    type: string;
    space?: { key: string; name: string };
    excerpt?: string;
    url?: string;
  }>;
  totalSize: number;
  start: number;
  limit: number;
}

export interface ConfluenceSpace {
  id: number;
  key: string;
  name: string;
  type: string;
  status: string;
}

export interface ConfluenceSpaceList {
  results: ConfluenceSpace[];
  start: number;
  limit: number;
  size: number;
}

export class ConfluenceClient extends AtlassianBaseClient {
  readonly serviceName = "Confluence" as const;

  constructor(
    server: McpServer,
    baseUrl: string,
    token: string,
    requireConfirm: boolean
  ) {
    super(server, baseUrl, token, requireConfirm);
  }

  async search(cql: string, limit?: number): Promise<ConfluenceSearchResult> {
    const params = new URLSearchParams({ cql });
    if (limit !== undefined) params.set("limit", String(limit));
    return this.request<ConfluenceSearchResult>(
      "GET",
      `/rest/api/search?${params}`
    );
  }

  async getPageById(pageId: string): Promise<ConfluencePage> {
    return this.request<ConfluencePage>(
      "GET",
      `/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage,version,space`
    );
  }

  async getPageByTitle(
    spaceKey: string,
    title: string
  ): Promise<ConfluencePage | null> {
    const params = new URLSearchParams({
      spaceKey,
      title,
      expand: "body.storage,version,space",
    });
    const result = await this.request<{
      results: ConfluencePage[];
      size: number;
    }>("GET", `/rest/api/content?${params}`);
    return result.results[0] ?? null;
  }

  async createPage(
    spaceKey: string,
    title: string,
    body: string,
    parentId?: string
  ): Promise<ConfluencePage> {
    const payload: Record<string, unknown> = {
      type: "page",
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: body,
          representation: "storage",
        },
      },
    };
    if (parentId) {
      payload.ancestors = [{ id: parentId }];
    }
    return this.request<ConfluencePage>("POST", "/rest/api/content", payload);
  }

  async updatePage(
    pageId: string,
    title: string,
    body: string,
    currentVersion: number
  ): Promise<ConfluencePage> {
    return this.request<ConfluencePage>(
      "PUT",
      `/rest/api/content/${encodeURIComponent(pageId)}`,
      {
        type: "page",
        title,
        version: { number: currentVersion + 1 },
        body: {
          storage: {
            value: body,
            representation: "storage",
          },
        },
      }
    );
  }

  async listSpaces(
    limit?: number,
    type?: "global" | "personal"
  ): Promise<ConfluenceSpaceList> {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.request<ConfluenceSpaceList>(
      "GET",
      `/rest/api/space${query ? `?${query}` : ""}`
    );
  }
}
