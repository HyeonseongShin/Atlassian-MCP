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
│   ├── server.ts                 # McpServer 팩토리
│   ├── config.ts                 # 환경변수 로드 및 Zod 검증
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
│       └── confluence/
│           ├── index.ts
│           ├── search.ts
│           ├── get-page.ts
│           ├── create-page.ts
│           ├── update-page.ts
│           └── list-spaces.ts
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
3. `src/client/atlassian.ts` — 추상 베이스 HTTP client (Bearer, 401 → 서비스별 에러)
4. `src/client/jira.ts` + `src/client/confluence.ts` (병렬 가능)
5. `src/server.ts` + `src/index.ts` — 서버 연결
6. 각 tool 파일들 구현 (순서 무관, 독립적)
7. `Dockerfile`
8. `.env.example`, `.mcp.json.example`, `.gitignore`(`.env`, `.mcp.json` 포함), `README.md`(셋업 가이드)

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
6. Docker 빌드: `docker build -t atlassian-mcp .` → `docker run --rm -i --env-file /absolute/path/to/.env atlassian-mcp`
