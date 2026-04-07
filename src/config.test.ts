import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

const validEnv = {
  JIRA_BASE_URL: "https://jira.example.com",
  JIRA_API_TOKEN: "token1",
  CONFLUENCE_BASE_URL: "https://confluence.example.com",
  CONFLUENCE_API_TOKEN: "token2",
};

describe("loadConfig", () => {
  it("유효한 환경변수를 파싱하고 기본값을 적용한다", () => {
    const cfg = loadConfig(validEnv);
    expect(cfg.JIRA_BASE_URL).toBe("https://jira.example.com");
    expect(cfg.JIRA_API_TOKEN).toBe("token1");
    expect(cfg.CONFLUENCE_BASE_URL).toBe("https://confluence.example.com");
    expect(cfg.CONFLUENCE_API_TOKEN).toBe("token2");
    expect(cfg.ATLASSIAN_MCP_REQUIRE_CONFIRM).toBe(true);
  });

  it("ATLASSIAN_MCP_REQUIRE_CONFIRM=false 는 boolean false 로 변환된다", () => {
    const cfg = loadConfig({ ...validEnv, ATLASSIAN_MCP_REQUIRE_CONFIRM: "false" });
    expect(cfg.ATLASSIAN_MCP_REQUIRE_CONFIRM).toBe(false);
  });

  it("ATLASSIAN_MCP_REQUIRE_CONFIRM=FALSE 는 대소문자 무관하게 false 로 변환된다", () => {
    const cfg = loadConfig({ ...validEnv, ATLASSIAN_MCP_REQUIRE_CONFIRM: "FALSE" });
    expect(cfg.ATLASSIAN_MCP_REQUIRE_CONFIRM).toBe(false);
  });

  it("ATLASSIAN_MCP_REQUIRE_CONFIRM=true 는 boolean true 로 변환된다", () => {
    const cfg = loadConfig({ ...validEnv, ATLASSIAN_MCP_REQUIRE_CONFIRM: "true" });
    expect(cfg.ATLASSIAN_MCP_REQUIRE_CONFIRM).toBe(true);
  });

  it("JIRA_BASE_URL 누락 시 throw 한다", () => {
    const { JIRA_BASE_URL: _, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("Invalid configuration");
  });

  it("JIRA_API_TOKEN 누락 시 throw 한다", () => {
    const { JIRA_API_TOKEN: _, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("Invalid configuration");
  });

  it("CONFLUENCE_BASE_URL 누락 시 throw 한다", () => {
    const { CONFLUENCE_BASE_URL: _, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("Invalid configuration");
  });

  it("잘못된 URL 형식이면 throw 한다", () => {
    expect(() => loadConfig({ ...validEnv, JIRA_BASE_URL: "not-a-url" })).toThrow();
  });

  it("빈 API 토큰이면 throw 한다", () => {
    expect(() => loadConfig({ ...validEnv, JIRA_API_TOKEN: "" })).toThrow();
  });
});
