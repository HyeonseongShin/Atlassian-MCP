import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoopConfirmationGate, type IConfirmationGate, type RequestInfo } from "../confirm.js";
import { JiraClient } from "./jira.js";
import type { IHttpFetcher } from "./atlassian.js";

const BASE_URL = "https://jira.example.com";
const TOKEN = "my-secret-token";

function makeResponse(body: unknown, status = 200): Response {
  return new Response(
    status === 204 ? null : JSON.stringify(body),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function makeFetcher(response: Response): IHttpFetcher {
  return { fetch: vi.fn().mockResolvedValue(response) };
}

describe("AtlassianBaseClient.request()", () => {
  it("Authorization: Bearer 헤더를 전송한다", async () => {
    const fetcher = makeFetcher(makeResponse({ issues: [], total: 0, maxResults: 20, startAt: 0 }));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    await client.searchIssues("project = ENG");

    expect(fetcher.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rest/api/2/search"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      })
    );
  });

  it("200 응답 — JSON을 파싱해 반환한다", async () => {
    const payload = { issues: [], total: 0, maxResults: 20, startAt: 0 };
    const fetcher = makeFetcher(makeResponse(payload));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    const result = await client.searchIssues("project = ENG");
    expect(result).toEqual(payload);
  });

  it("204 응답 — undefined 를 반환한다", async () => {
    const fetcher = makeFetcher(makeResponse(null, 204));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    const result = await client.updateIssue("ENG-1", { summary: "new" });
    expect(result).toBeUndefined();
  });

  it("401 응답 — 서비스명 포함 에러를 throw 한다", async () => {
    const fetcher = makeFetcher(new Response("Unauthorized", { status: 401 }));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    await expect(client.listProjects()).rejects.toThrow("JIRA API token expired or invalid");
  });

  it("non-ok 응답 — JSON 에러 body를 포함해 throw 한다", async () => {
    const errorBody = { errorMessages: ["Issue does not exist"] };
    const fetcher = makeFetcher(new Response(JSON.stringify(errorBody), { status: 404 }));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    await expect(client.getIssue("ENG-999")).rejects.toThrow("JIRA API error 404");
  });

  it("non-ok 응답 — text body 에러도 처리한다", async () => {
    const fetcher = makeFetcher(new Response("Internal Server Error", { status: 500 }));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    await expect(client.listProjects()).rejects.toThrow("JIRA API error 500");
  });

  it("GET 요청은 body를 포함하지 않는다", async () => {
    const fetcher = makeFetcher(makeResponse([]));
    const client = new JiraClient(new NoopConfirmationGate(), BASE_URL, TOKEN, fetcher);

    await client.listProjects();

    expect(fetcher.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "GET" })
    );
    const callArgs = (fetcher.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBeUndefined();
  });

  it("gate.confirm()을 호출한다", async () => {
    const confirmSpy = vi.fn().mockImplementation(async (req: RequestInfo) => req);
    const gate: IConfirmationGate = { confirm: confirmSpy, reset: vi.fn() };
    const fetcher = makeFetcher(makeResponse([]));
    const client = new JiraClient(gate, BASE_URL, TOKEN, fetcher);

    await client.listProjects();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({ service: "JIRA", method: "GET" })
    );
  });

  it("baseUrl에서 trailing slash를 제거한다", async () => {
    const fetcher = makeFetcher(makeResponse([]));
    const client = new JiraClient(
      new NoopConfirmationGate(),
      "https://jira.example.com/",
      TOKEN,
      fetcher
    );

    await client.listProjects();

    expect(fetcher.fetch).toHaveBeenCalledWith(
      "https://jira.example.com/rest/api/2/project",
      expect.any(Object)
    );
  });
});
