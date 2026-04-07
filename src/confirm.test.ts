import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  NoopConfirmationGate,
  McpConfirmationGate,
  type RequestInfo,
} from "./confirm.js";

const baseReq: RequestInfo = {
  service: "JIRA",
  method: "GET",
  url: "https://jira.example.com/rest/api/2/issue/ENG-1",
};

// McpServer mock 팩토리
function makeServer(elicitResults: Array<{ action: string; content?: Record<string, unknown> }>) {
  const elicitInput = vi.fn();
  elicitResults.forEach((r) =>
    elicitInput.mockResolvedValueOnce(r)
  );
  return {
    server: {
      getClientCapabilities: vi.fn().mockReturnValue({ elicitation: true }),
      elicitInput,
    },
  } as unknown as McpServer;
}

describe("NoopConfirmationGate", () => {
  it("요청을 즉시 그대로 반환한다", async () => {
    const gate = new NoopConfirmationGate();
    const result = await gate.confirm(baseReq);
    expect(result).toBe(baseReq);
  });

  it("reset()은 아무 동작도 하지 않는다", () => {
    const gate = new NoopConfirmationGate();
    expect(() => gate.reset()).not.toThrow();
  });
});

describe("McpConfirmationGate", () => {
  it("elicitation 미지원 클라이언트면 throw 한다", async () => {
    const server = {
      server: {
        getClientCapabilities: vi.fn().mockReturnValue({}),
        elicitInput: vi.fn(),
      },
    } as unknown as McpServer;

    const gate = new McpConfirmationGate(server);
    await expect(gate.confirm(baseReq)).rejects.toThrow(
      "does not support elicitation"
    );
  });

  it("choice 1 (한 번만 실행): 요청을 그대로 반환한다", async () => {
    const server = makeServer([
      { action: "accept", content: { action: "1" } },
    ]);
    const gate = new McpConfirmationGate(server);
    const result = await gate.confirm(baseReq);
    expect(result).toEqual(baseReq);
  });

  it("choice 2 (항상 자동 승인): 이후 요청은 elicitInput 없이 통과된다", async () => {
    const server = makeServer([
      { action: "accept", content: { action: "2" } },
    ]);
    const gate = new McpConfirmationGate(server);

    await gate.confirm(baseReq); // autoApprove 설정
    await gate.confirm(baseReq); // 두 번째 — elicit 없이 통과

    expect(server.server.elicitInput).toHaveBeenCalledTimes(1);
  });

  it("choice 4 (거부): throw 한다", async () => {
    const server = makeServer([
      { action: "accept", content: { action: "4" } },
    ]);
    const gate = new McpConfirmationGate(server);
    await expect(gate.confirm(baseReq)).rejects.toThrow("User rejected");
  });

  it("action=cancel 이면 throw 한다", async () => {
    const server = makeServer([{ action: "cancel" }]);
    const gate = new McpConfirmationGate(server);
    await expect(gate.confirm(baseReq)).rejects.toThrow("User rejected");
  });

  it("action=decline 이면 throw 한다", async () => {
    const server = makeServer([{ action: "decline" }]);
    const gate = new McpConfirmationGate(server);
    await expect(gate.confirm(baseReq)).rejects.toThrow("User rejected");
  });

  it("elicitInput 호출 자체가 실패하면 throw 한다", async () => {
    const server = {
      server: {
        getClientCapabilities: vi.fn().mockReturnValue({ elicitation: true }),
        elicitInput: vi.fn().mockRejectedValue(new Error("connection error")),
      },
    } as unknown as McpServer;
    const gate = new McpConfirmationGate(server);
    await expect(gate.confirm(baseReq)).rejects.toThrow("User rejected");
  });

  it("reset() 호출 후 autoApprove 상태가 초기화된다", async () => {
    // 먼저 autoApprove 설정
    const server = makeServer([
      { action: "accept", content: { action: "2" } }, // autoApprove 설정
      { action: "accept", content: { action: "1" } }, // reset 후 다시 묻기
    ]);
    const gate = new McpConfirmationGate(server);

    await gate.confirm(baseReq); // autoApprove true
    gate.reset(); // 리셋
    await gate.confirm(baseReq); // 다시 elicit

    expect(server.server.elicitInput).toHaveBeenCalledTimes(2);
  });

  it("choice 3 (편집): 유효한 JSON으로 편집하면 수정된 요청을 반환한다", async () => {
    const editedJson = JSON.stringify({
      method: "POST",
      url: "https://jira.example.com/rest/api/2/issue/ENG-1",
      body: { foo: "bar" },
    });
    const server = makeServer([
      { action: "accept", content: { action: "3" } },  // edit 선택
      { action: "accept", content: { json: editedJson } }, // 편집 내용 제출
      { action: "accept", content: { action: "1" } },  // 편집 후 확인
    ]);
    const gate = new McpConfirmationGate(server);
    const result = await gate.confirm(baseReq);

    expect(result.method).toBe("POST");
    expect(result.body).toEqual({ foo: "bar" });
  });

  it("편집 JSON이 다른 origin이면 보안 에러 후 재시도를 유도한다", async () => {
    const maliciousJson = JSON.stringify({
      url: "https://evil.example.com/rest/api/2/issue",
    });
    const server = makeServer([
      { action: "accept", content: { action: "3" } },      // edit 선택
      { action: "accept", content: { json: maliciousJson } }, // 악의적 URL
      { action: "accept", content: { action: "4" } },        // 결국 거부
    ]);
    const gate = new McpConfirmationGate(server);
    await expect(gate.confirm(baseReq)).rejects.toThrow("User rejected");
  });
});

describe("McpConfirmationGate — 복수 인스턴스 격리", () => {
  it("두 인스턴스의 autoApprove 상태는 독립적이다", async () => {
    const server1 = makeServer([
      { action: "accept", content: { action: "2" } }, // gate1 autoApprove
    ]);
    const server2 = makeServer([
      { action: "accept", content: { action: "1" } }, // gate2는 여전히 묻는다
    ]);

    const gate1 = new McpConfirmationGate(server1);
    const gate2 = new McpConfirmationGate(server2);

    await gate1.confirm(baseReq); // gate1 autoApprove=true
    await gate2.confirm(baseReq); // gate2는 독립 — elicit 호출

    expect(server2.server.elicitInput).toHaveBeenCalledTimes(1);
  });
});
