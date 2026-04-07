import type { IConfirmationGate, RequestInfo } from "../confirm.js";

export interface IHttpFetcher {
  fetch(url: string, init: RequestInit): Promise<Response>;
}

class NodeFetch implements IHttpFetcher {
  async fetch(url: string, init: RequestInit): Promise<Response> {
    return globalThis.fetch(url, init);
  }
}

export abstract class AtlassianBaseClient {
  readonly baseUrl: string;
  private readonly token: string;
  private readonly gate: IConfirmationGate;
  private readonly fetcher: IHttpFetcher;
  abstract readonly serviceName: "JIRA" | "Confluence";

  constructor(
    gate: IConfirmationGate,
    baseUrl: string,
    token: string,
    fetcher: IHttpFetcher = new NodeFetch()
  ) {
    this.gate = gate;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.fetcher = fetcher;
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

    const confirmedReq = await this.gate.confirm(req);

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

    const response = await this.fetcher.fetch(confirmedReq.url, fetchOptions);

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
