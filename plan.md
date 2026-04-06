# Plan: Atlassian DC MCP Server (JIRA + Confluence)

## Context
사내 Atlassian **Data Center** 환경(dedicated server)의 JIRA와 Confluence를 Claude Code에서 사용할 수 있는 MCP 서버를 TypeScript로 구축한다.
단일 `atlassian-mcp` 패키지에 두 서비스를 통합하고, Docker로 배포하여 팀원들이 공유 가능하도록 한다. **Cloud는 지원하지 않는다.**

---

## Project Structure

```
atlassian-mcp/
├── src/
│   ├── index.ts                  # 엔트리포인트: 서버 생성, 툴 등록, transport 연결
│   ├── server.ts                 # McpServer 팩토리 (elicitation capability 선언)
│   ├── config.ts                 # 환경변수 로드 및 Zod 검증
│   ├── confirm.ts                # 쿼리 확인 게이트 (elicitation + 세션 autoApprove 상태)
│   ├── client/
│   │   ├── atlassian.ts          # 추상 베이스 HTTP client (Bearer auth, fetch wrapper, 401 핸들링)
│   │   ├── jira.ts               # JiraClient — JIRA REST API v2 메서드
│   │   └── confluence.ts         # ConfluenceClient — Confluence REST API v1 메서드
│   └── tools/
│       ├── index.ts              # registerAllTools() 진입점
│       ├── jira/
│       │   ├── index.ts
│       │   ├── search-issues.ts
│       │   ├── get-issue.ts
│       │   ├── create-issue.ts
│       │   ├── update-issue.ts
│       │   ├── add-comment.ts
│       │   ├── list-projects.ts
│       │   └── transition-issue.ts
│       ├── confluence/
│       │   ├── index.ts
│       │   ├── search.ts
│       │   ├── get-page.ts
│       │   ├── create-page.ts
│       │   ├── update-page.ts
│       │   └── list-spaces.ts
│       └── reset-auto-approve.ts # atlassian_reset_auto_approve — 세션 자동승인 해제
├── .env.example                  # 커밋 O — 실제 .env는 팀원이 로컬에서 생성
├── .mcp.json.example             # 커밋 O — 실제 .mcp.json은 팀원이 로컬에서 생성 (경로 치환 필요)
├── .gitignore
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

타입은 각 파일에서 zod 스키마 + `z.infer`로 도출 — 별도의 `src/types/`는 두지 않는다.

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  },
  "engines": { "node": ">=18.0.0" },
  "type": "module"
}
```

tsconfig: `"module": "Node16"`, `"moduleResolution": "Node16"` 필수 (SDK가 ESM)

---

## Authentication (DC PAT Bearer 단일화)

JIRA와 Confluence는 **각각 독립된 호스트와 PAT**을 가지며, 별도 환경변수로 받는다.

| 환경변수 | 필수 | 설명 |
|----------|------|------|
| `JIRA_BASE_URL` | ✅ | 예: `https://jira.company.com` |
| `JIRA_API_TOKEN` | ✅ | JIRA DC Personal Access Token |
| `CONFLUENCE_BASE_URL` | ✅ | 예: `https://confluence.company.com` |
| `CONFLUENCE_API_TOKEN` | ✅ | Confluence DC Personal Access Token |

```typescript
// config.ts
const ConfigSchema = z.object({
  JIRA_BASE_URL: z.string().url(),
  JIRA_API_TOKEN: z.string().min(1),
  CONFLUENCE_BASE_URL: z.string().url(),
  CONFLUENCE_API_TOKEN: z.string().min(1),
});
```

두 클라이언트 모두 PAT을 `Authorization: Bearer <token>` 헤더로 전송한다. Cloud Basic Auth 분기 및 자동 감지 로직은 없다.

### 토큰 만료 처리
401 응답을 감싸 서비스를 구분해 에러 메시지를 반환한다 (자동 갱신 없음 — 의도적 설계):

```
JIRA API token expired or invalid.
Please regenerate your JIRA PAT and update JIRA_API_TOKEN.
```
```
Confluence API token expired or invalid.
Please regenerate your Confluence PAT and update CONFLUENCE_API_TOKEN.
```

각 클라이언트는 자기 서비스 이름을 알고 있어야 하며, 베이스 클래스에서 `serviceName`을 받아 에러 포맷에 사용한다.

---

## Tools (12개)

### JIRA (7개) — REST API v2
| Tool | 기능 |
|------|------|
| `jira_search_issues` | JQL 검색, fields/maxResults 옵션 |
| `jira_get_issue` | 이슈 키로 상세 조회 (e.g. ENG-123) |
| `jira_create_issue` | 프로젝트/타입/제목/설명/담당자/우선순위 |
| `jira_update_issue` | 필드 부분 업데이트 |
| `jira_add_comment` | 평문 입력 |
| `jira_list_projects` | 접근 가능한 프로젝트 목록 |
| `jira_transition_issue` | transitionId 없으면 목록 반환, 있으면 상태 변경 |

### Confluence (5개) — REST API v1 (`/rest/api/...`)
| Tool | 기능 |
|------|------|
| `confluence_search` | CQL 검색 via `/rest/api/search` |
| `confluence_get_page` | `pageId` 또는 `title + spaceKey` via `/rest/api/content` |
| `confluence_create_page` | `spaceKey + title + body(Storage Format)` via `/rest/api/content` |
| `confluence_update_page` | 버전 번호 필수 (`currentVersion + 1`) |
| `confluence_list_spaces` | `/rest/api/space` |

---

## Key Implementation Notes

1. **JIRA DC는 REST v2 사용**: DC에서도 v2는 plain text description/comment를 그대로 받으므로 ADF 변환 불필요. v3/ADF 관련 처리는 추가하지 않는다.
2. **Confluence는 v1 API 전면 사용 (DC 호환)**: v2는 Cloud 전용이라 DC에서 404. 페이지 본문은 Storage Format(`representation: "storage"`)으로 전송.
3. **Confluence 업데이트 optimistic locking**: 반드시 `get_page` 먼저 호출 → version 확인 → `version + 1`로 업데이트. 400/409 시 사용자에게 재조회 안내.
4. **Transition 2단계 패턴**: `transitionId`는 프로젝트마다 다른 opaque ID. 생략 시 가용 transition 목록을 반환하되 응답 텍스트에 "원하는 transition의 id로 이 툴을 다시 호출하세요" 가이드 문구를 명시적으로 포함해 LLM이 재호출하기 쉽게 한다.
5. **401 핸들링은 베이스 클라이언트에서**: `AtlassianBaseClient`가 `serviceName: "JIRA" | "Confluence"`를 생성자에서 받아 401 응답을 서비스별 에러 메시지로 변환.
6. **Docker `-i` 필수**: stdin 연결 없으면 MCP 연결 즉시 끊김.
7. **PAT 만료**: DC PAT는 생성 시 만료일 지정. 만료되면 재발급 후 env 갱신 필요. README에 JIRA/Confluence 각각의 PAT 발급 경로를 안내.

---

## Query Confirmation Gate

모든 JIRA/Confluence API 호출은 **실제 HTTP 전송 직전에 사용자 확인을 받는다.** 읽기/쓰기 구분 없이 12개 툴 전부에 적용.

### 동작 흐름
1. 툴이 호출되면 베이스 클라이언트는 요청을 빌드하되 바로 `fetch`를 실행하지 않는다.
2. MCP **elicitation**(`elicitation/create`)을 사용해 사용자에게 아래 4지선다 프롬프트를 띄운다. 프롬프트에는 실제 적용될 쿼리가 그대로 표시된다:
   ```
   [Atlassian MCP] 다음 요청을 보내시겠습니까?

     service : JIRA
     method  : POST
     url     : https://jira.company.com/rest/api/2/issue
     body    : {
       "fields": {
         "project": { "key": "ENG" },
         "summary": "...",
         ...
       }
     }

     1) 이번 한 번만 실행
     2) 이 세션 동안 항상 자동 승인
     3) 쿼리 수정 후 실행
     4) 거절
   ```
3. 사용자의 선택에 따라 분기:
   - **1) 수동 승인**: 현재 요청만 전송.
   - **2) 세션 자동 승인**: 세션 in-memory 플래그(`autoApprove = true`)를 켠 뒤 전송. 이후 이 세션의 모든 요청은 프롬프트 없이 바로 전송.
   - **3) 쿼리 수정**: elicitation을 한 번 더 띄워 JSON 편집 가능한 입력 필드를 제공. 사용자가 반환한 JSON(메서드/URL/body)으로 요청을 덮어쓰고 **다시 1번 프롬프트부터 시작**(수정본을 재확인).
   - **4) 거절**: 해당 툴 호출을 MCP 에러로 종료 — "User rejected the request." 를 LLM에 반환.

### 구현 위치
- **`src/confirm.ts` (신규)**: 세션 상태(`autoApprove` 플래그)와 `confirmRequest(server, req): Promise<Request>` 함수를 제공. `server`는 MCP 서버 인스턴스(elicitation 호출용).
- **`src/client/atlassian.ts`**: 베이스 클라이언트의 `request()` 메서드가 실제 `fetch` 직전에 `confirmRequest(...)`를 반드시 호출. 모든 하위 클라이언트/툴은 자동으로 게이트를 통과.
- **`src/server.ts`**: `McpServer` 생성 시 elicitation 핸들러 능력(capability) 선언, 서버 인스턴스를 베이스 클라이언트 생성자에 주입.

### 세션 상태
- `autoApprove` 플래그는 **이 MCP 서버 프로세스가 사는 동안**만 유효 (= Claude Code 세션 1회). 컨테이너가 종료되면 자동 초기화.
- 세션 중 수동으로 초기화하고 싶을 때를 위해 보조 툴 `atlassian_reset_auto_approve`를 추가로 제공(플래그를 false로 되돌림).

### 표시/편집 시 보안
- 프롬프트에 출력하는 요청 객체에는 `Authorization` 헤더를 포함하지 않는다 (URL + method + body만 표시).
- "쿼리 수정" 입력의 URL은 **해당 서비스의 BASE_URL과 동일한 origin** 인지 검증. 다른 호스트로의 요청은 거부하여 사용자가 실수/악의로 외부 URL을 주입하는 것을 막는다.
- 수정된 body가 유효한 JSON이 아니면 에러 메시지와 함께 3)번 단계를 반복.

### 클라이언트 호환성
- MCP elicitation을 지원하는 클라이언트(Claude Code 최신 버전)가 필요하다. README에 최소 요구사항 명시.
- elicitation 미지원 클라이언트에서 서버가 기능을 감지하면, **기본적으로 모든 요청을 거부**하는 안전한 동작으로 폴백(환경변수 `ATLASSIAN_MCP_REQUIRE_CONFIRM=false`로 명시적 비활성화 가능).

---

## Deployment

### Dockerfile (multi-stage)
- Build stage: `node:22-alpine` + `npm ci` + `tsc`
- Runtime stage: `--omit=dev`, non-root user

### .mcp.json.example (커밋용 템플릿)
`.mcp.json`과 `.env`는 **둘 다 커밋하지 않는다.** 레포에는 `.mcp.json.example`과 `.env.example` 두 템플릿 파일과 README의 셋업 가이드만 커밋한다. 팀원은 셋업 가이드에 따라 두 파일을 로컬에 복사·수정해서 사용한다.

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "docker",
      "args": ["run", "--rm", "-i",
        "--env-file", "/absolute/path/to/atlassian-mcp/.env",
        "atlassian-mcp:latest"
      ]
    }
  }
}
```

주의사항:
- **`--env-file` 경로는 반드시 절대경로여야 한다.** 상대경로는 동작하지 않으므로 팀원은 자기 환경의 실제 `.env` 절대경로로 치환해야 한다.
- `.mcp.json`과 `.env`는 **`.gitignore`에 포함** — 절대 커밋 금지. 레포에는 `.mcp.json.example`과 `.env.example`만 커밋한다.
- `--env-file`은 `KEY=VALUE` 라인만 해석하며 셸 확장이나 따옴표 해석을 하지 않으므로, 토큰 값에 따옴표를 두르지 말 것.

### 팀원 셋업 가이드 (README에 포함)
1. 레포를 클론한 뒤 Docker 이미지 빌드: `docker build -t atlassian-mcp .`
2. `cp .env.example .env` → JIRA/Confluence BASE_URL과 PAT 4개 값 채우기
3. `cp .mcp.json.example .mcp.json` → `--env-file` 인자를 본인 환경의 `.env` **절대경로**로 수정
   - macOS/Linux 예: `/Users/alice/work/atlassian-mcp/.env`
   - Windows 예: `C:\\Users\\alice\\work\\atlassian-mcp\\.env` (JSON이므로 백슬래시 이스케이프)
4. 레포 루트에서 Claude Code 실행 → `claude mcp list`로 `atlassian` 서버가 떠 있는지 확인

### .env.example
```
JIRA_BASE_URL=https://jira.company.com
JIRA_API_TOKEN=
CONFLUENCE_BASE_URL=https://confluence.company.com
CONFLUENCE_API_TOKEN=
```

---

## Implementation Order

1. `package.json`, `tsconfig.json`, `.gitignore` 생성
2. `src/config.ts` — Zod 환경변수 검증 (4개 변수)
3. `src/confirm.ts` — 확인 게이트, 세션 autoApprove 상태, elicitation 래퍼
4. `src/client/atlassian.ts` — 추상 베이스 HTTP client (Bearer, 401 → 서비스별 에러, `request()`에서 `confirm.ts` 호출)
5. `src/client/jira.ts` + `src/client/confluence.ts` (병렬 가능)
6. `src/server.ts` + `src/index.ts` — 서버 연결 (elicitation capability 선언, server 인스턴스를 클라이언트에 주입)
7. 각 tool 파일들 구현 (순서 무관, 독립적) + `atlassian_reset_auto_approve` 툴
8. `Dockerfile`
9. `.env.example`, `.mcp.json.example`, `.gitignore`(`.env`, `.mcp.json` 포함), `README.md`(셋업 가이드 + elicitation 지원 클라이언트 요구사항)

---

## Verification

1. `npm run build` — 컴파일 오류 없음 확인
2. `.env` 파일에 실제 JIRA/Confluence DC URL + PAT 4개 세팅 후 `node dist/index.js` 실행
3. Claude Code에서 `.mcp.json` 로드: `claude mcp list`로 `atlassian` 서버 확인
4. 기본 동작 테스트:
   - `jira_list_projects` → 프로젝트 목록 반환
   - `jira_search_issues` with `jql: "assignee = currentUser()"` → 내 이슈 목록
   - `confluence_list_spaces` → 스페이스 목록
   - `confluence_get_page` with `title + spaceKey` → 페이지 본문 (Storage Format)
5. 토큰 만료 에러 확인: 임의로 `JIRA_API_TOKEN`을 잘못된 값으로 바꾸고 `jira_list_projects` 호출 → "JIRA API token expired or invalid..." 메시지 반환. `CONFLUENCE_API_TOKEN`도 동일 절차로 검증.
6. **확인 게이트 검증**:
   - 아무 툴이나 호출 → 4지선다 프롬프트가 뜨는지 확인
   - 1) 선택 → 한 번만 실행, 다음 호출에서 다시 프롬프트
   - 2) 선택 → 이후 호출부터 프롬프트 없이 실행. `atlassian_reset_auto_approve` 호출 후 다시 프롬프트가 뜨는지 확인
   - 3) 선택 → 편집된 JSON이 실제로 적용되는지 + 다른 origin URL이 거부되는지
   - 4) 선택 → "User rejected the request." 에러 반환
7. Docker 빌드: `docker build -t atlassian-mcp .` → `docker run --rm -i --env-file /absolute/path/to/.env atlassian-mcp`
