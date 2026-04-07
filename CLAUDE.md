# CLAUDE.md — Atlassian MCP

## 프로젝트 개요

사내 Atlassian **Data Center** 환경(JIRA + Confluence)용 MCP 서버.
TypeScript + `@modelcontextprotocol/sdk` 기반. **Cloud는 지원하지 않는다.**

---

## 빌드 / 실행

```bash
npm ci           # 의존성 설치
npm run build    # tsc → dist/
node dist/index.js  # 로컬 실행 (환경변수 필요)
docker build -t atlassian-mcp .   # Docker 이미지 빌드
```

---

## 테스트 철학 (최우선 원칙)

이 프로젝트는 **TDD를 최우선으로** 한다. 새 기능 추가나 버그 수정 시 **테스트를 먼저 작성**하고 구현한다.

### 테스트 가능한 코드 작성 규칙
- **인터페이스 의존**: 새 계층을 추가할 때 구체 클래스 대신 인터페이스에 의존한다. 현재 핵심 인터페이스: `IConfirmationGate`, `IHttpFetcher`, `IJiraClient`, `IConfluenceClient`.
- **전역 상태 금지**: 가변 상태는 반드시 클래스 인스턴스 필드에 둔다. 모듈 레벨 `let` 변수는 테스트 간 오염을 유발하므로 사용 금지.
- **모듈 로드 시 부작용 금지**: `export const x = heavyInit()` 패턴 금지. 초기화는 함수 호출로 지연시킨다 (예: `loadConfig()` → `src/index.ts`의 `main()` 내에서 호출).
- **테스트 파일 co-location**: `foo.ts` 옆에 `foo.test.ts`. 별도 `__tests__` 디렉터리 사용 금지.
- **신규 툴에 테스트 필수**: `src/tools/<service>/<tool-name>.ts`를 추가하면 반드시 `src/tools/<service>/<tool-name>.test.ts`도 함께 작성한다. 테스트 없는 툴은 완성되지 않은 것으로 간주한다.

### 커버리지 기준
- 라인/함수 커버리지 **70% 이상** 유지 필수 (현재 베이스라인 ~94%).
- `npm run test:coverage`로 확인. `src/index.ts`와 aggregator `index.ts`는 커버리지 제외 대상.

### Mock 패턴
```typescript
// 클라이언트 mock: IHttpFetcher로 HTTP 레이어 교체
const fakeFetcher: IHttpFetcher = { fetch: vi.fn().mockResolvedValue(new Response(...)) };
const client = new JiraClient(new NoopConfirmationGate(), "https://jira.example.com", "token", fakeFetcher);

// 툴 mock: server.tool() 핸들러를 직접 추출해 실행
let capturedHandler: Function;
const mockServer = { tool: (_n, _d, _s, h) => { capturedHandler = h; } } as unknown as McpServer;
const mockJira: IJiraClient = { searchIssues: vi.fn().mockResolvedValue({...}), ... };
registerSearchIssues(mockServer, mockJira);
const result = await capturedHandler({ jql: "project = ENG" });
```

---

## 코드 구조 규칙

### 타입 정의
- 별도 `src/types/` 디렉터리 없음.
- 타입은 각 파일에서 `z.object(...)` + `z.infer<typeof Schema>`로 도출.

### 클라이언트 계층
- `AtlassianBaseClient` (`src/client/atlassian.ts`) — Bearer auth, 401 핸들링, confirmRequest 게이트
- `JiraClient` / `ConfluenceClient` — 서비스별 메서드만 추가. 인증/확인 로직 절대 중복 금지.

### 툴 등록
- 각 툴은 독립 파일 (`src/tools/<service>/<tool-name>.ts`).
- `register<ToolName>(server, client)` 패턴으로 export.
- `src/tools/index.ts` → `registerAllTools(server, jira, confluence)` 단일 진입점.

### API 버전
- JIRA: **REST API v2** (`/rest/api/2/...`). v3/ADF 절대 사용 금지.
- Confluence: **REST API v1** (`/rest/api/...`). v2는 Cloud 전용이라 DC에서 404.

---

## 핵심 동작 원칙

1. **확인 게이트**: 모든 HTTP 요청은 `AtlassianBaseClient.request()` → `confirmRequest()` 경로를 통과. 개별 툴/클라이언트에서 `fetch`를 직접 호출하지 않는다.

2. **401 처리**: 베이스 클라이언트가 `serviceName` ("JIRA" | "Confluence")을 생성자에서 받아 서비스별 에러 메시지를 반환. 자동 갱신 없음.

3. **Confluence 업데이트**: `confluence_update_page` 호출 전 반드시 `confluence_get_page`로 현재 version 번호 확인 필수. 400/409 시 사용자에게 재조회 안내.

4. **Transition 2단계**: `transitionId` 생략 시 목록 반환 + "원하는 id로 재호출" 안내 문구 명시.

5. **보안 (쿼리 수정 시)**: Authorization 헤더는 확인 프롬프트에 노출 금지. 수정된 URL의 origin을 원본 서비스 BASE_URL과 비교하여 다른 호스트로의 요청 차단.

---

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `JIRA_BASE_URL` | ✅ | `https://jira.company.com` 형식 |
| `JIRA_API_TOKEN` | ✅ | JIRA DC PAT |
| `CONFLUENCE_BASE_URL` | ✅ | `https://confluence.company.com` 형식 |
| `CONFLUENCE_API_TOKEN` | ✅ | Confluence DC PAT |
| `ATLASSIAN_MCP_REQUIRE_CONFIRM` | - | `false`로 설정 시 확인 게이트 비활성화 |

---

## 주의사항

- `.env`와 `.mcp.json`은 **절대 커밋 금지** (`.gitignore` 포함됨).
- Docker 실행 시 `-i` 플래그 필수 (stdin 없으면 MCP 연결 즉시 끊김).
- `--env-file` 경로는 반드시 절대경로. 토큰 값에 따옴표 사용 금지.
- `ATLASSIAN_MCP_REQUIRE_CONFIRM`의 기본값은 `true` (확인 게이트 활성화).
