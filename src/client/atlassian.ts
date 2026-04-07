import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { confirmRequest, type RequestInfo } from "../confirm.js";

export abstract class AtlassianBaseClient {
  readonly baseUrl: string;
  private readonly token: string;
  protected readonly server: McpServer;
  private readonly requireConfirm: boolean;
  abstract readonly serviceName: "JIRA" | "Confluence";

  constructor(
    server: McpServer,
    baseUrl: string,
    token: string,
    requireConfirm: boolean
  ) {
    this.server = server;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.requireConfirm = requireConfirm;
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const req: RequestInfo = {
      service: this.serviceName,
      method: method.toUpperCase(),
      url,
      body,
    };

    const confirmedReq = this.requireConfirm
      ? await confirmRequest(this.server, req)
      : req;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const fetchOptions: RequestInit = {
      method: confirmedReq.method,
      headers,
    };

    if (
      confirmedReq.body !== undefined &&
      confirmedReq.method !== "GET" &&
      confirmedReq.method !== "HEAD"
    ) {
      fetchOptions.body = JSON.stringify(confirmedReq.body);
    }

    const response = await fetch(confirmedReq.url, fetchOptions);

    if (response.status === 401) {
      throw new Error(
        `${this.serviceName} API token expired or invalid.\n` +
          `Please regenerate your ${this.serviceName} PAT and update ${this.serviceName === "JIRA" ? "JIRA_API_TOKEN" : "CONFLUENCE_API_TOKEN"}.`
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorDetail: string;
      try {
        errorDetail = JSON.stringify(JSON.parse(errorText), null, 2);
      } catch {
        errorDetail = errorText;
      }
      throw new Error(
        `${this.serviceName} API error ${response.status}: ${errorDetail}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
