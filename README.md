# Atlassian MCP

사내 Atlassian **Data Center** 환경(JIRA + Confluence)을 Claude Code에서 사용할 수 있는 MCP 서버입니다.
**Cloud 환경은 지원하지 않습니다.**

## 요구사항

- Docker
- Claude Code (MCP elicitation 지원 버전 필수)
- JIRA DC / Confluence DC Personal Access Token (PAT)

> **중요:** 이 서버는 MCP elicitation 기능을 사용하여 모든 API 요청 전 사용자 확인을 요청합니다.
> Claude Code 최신 버전이 필요하며, elicitation을 지원하지 않는 클라이언트에서는 기본적으로 모든 요청이 거부됩니다.
> (`ATLASSIAN_MCP_REQUIRE_CONFIRM=false`로 확인 게이트를 비활성화할 수 있습니다.)

---

## 팀원 셋업 가이드

### 1. 레포 클론 및 Docker 이미지 빌드

```bash
git clone <repo-url>
cd atlassian-mcp
docker build -t atlassian-mcp .
```

### 2. 환경변수 파일 설정

```bash
cp .env.example .env
```

`.env`를 열어 4개 값을 채워넣습니다:

```
JIRA_BASE_URL=https://jira.yourcompany.com
JIRA_API_TOKEN=<JIRA PAT>
CONFLUENCE_BASE_URL=https://confluence.yourcompany.com
CONFLUENCE_API_TOKEN=<Confluence PAT>
```

> **주의:** `.env` 파일은 절대 커밋하지 마세요. `.gitignore`에 포함되어 있습니다.

### 3. MCP 설정 파일 설정

```bash
cp .mcp.json.example .mcp.json
```

`.mcp.json`을 열어 `--env-file` 인자를 본인 환경의 `.env` **절대경로**로 수정합니다:

- macOS/Linux: `/Users/alice/work/atlassian-mcp/.env`
- Windows: `C:\\Users\\alice\\work\\atlassian-mcp\\.env` (JSON이므로 백슬래시 이스케이프)

> **주의:**
> - `--env-file` 경로는 반드시 **절대경로**여야 합니다. 상대경로는 동작하지 않습니다.
> - `.env` 파일에서 토큰 값에 따옴표를 두르지 마세요. Docker `--env-file`은 따옴표를 값의 일부로 처리합니다.

### 4. Claude Code에서 확인

레포 루트에서 Claude Code를 실행한 후:

```bash
claude mcp list
```

`atlassian` 서버가 목록에 표시되면 정상입니다.

---

## PAT 발급 방법

### JIRA DC

1. JIRA 상단 우측 프로필 아이콘 → **Profile**
2. 좌측 메뉴 → **Personal Access Tokens**
3. **Create token** → 이름 입력 + 만료일 설정 → 생성
4. 생성된 토큰을 복사하여 `.env`의 `JIRA_API_TOKEN`에 붙여넣기

### Confluence DC

1. Confluence 상단 우측 프로필 아이콘 → **Profile**
2. 좌측 메뉴 → **Personal Access Tokens**
3. **Create token** → 이름 입력 + 만료일 설정 → 생성
4. 생성된 토큰을 복사하여 `.env`의 `CONFLUENCE_API_TOKEN`에 붙여넣기

> **토큰 만료 시:** PAT는 생성 시 지정한 만료일에 자동 만료됩니다. 만료되면 각 서비스에서 새 PAT를 발급하고 `.env`를 갱신한 후 Docker 컨테이너를 재시작하세요.

---

## 제공 툴 (12개)

### JIRA (7개)

| 툴 이름 | 설명 |
|---------|------|
| `jira_search_issues` | JQL로 이슈 검색 |
| `jira_get_issue` | 이슈 키로 상세 조회 (예: ENG-123) |
| `jira_create_issue` | 이슈 생성 |
| `jira_update_issue` | 이슈 필드 부분 업데이트 |
| `jira_add_comment` | 이슈에 댓글 추가 |
| `jira_list_projects` | 접근 가능한 프로젝트 목록 |
| `jira_transition_issue` | 이슈 상태 변경 (ID 생략 시 가용 목록 반환) |

### Confluence (5개)

| 툴 이름 | 설명 |
|---------|------|
| `confluence_search` | CQL로 콘텐츠 검색 |
| `confluence_get_page` | 페이지 조회 (ID 또는 spaceKey+title) |
| `confluence_create_page` | 페이지 생성 (Storage Format) |
| `confluence_update_page` | 페이지 업데이트 (버전 번호 필수) |
| `confluence_list_spaces` | 스페이스 목록 |

### 유틸리티 (1개)

| 툴 이름 | 설명 |
|---------|------|
| `atlassian_reset_auto_approve` | 세션 자동 승인 상태 초기화 |

---

## 확인 게이트 (Query Confirmation Gate)

모든 API 호출 전 사용자 확인 프롬프트가 표시됩니다:

```
[Atlassian MCP] 다음 요청을 보내시겠습니까?

  service : JIRA
  method  : GET
  url     : https://jira.company.com/rest/api/2/project

  1) 이번 한 번만 실행
  2) 이 세션 동안 항상 자동 승인
  3) 쿼리 수정 후 실행
  4) 거절
```

- **1) 수동 승인**: 현재 요청만 전송
- **2) 자동 승인**: 세션 동안 모든 요청을 확인 없이 전송. `atlassian_reset_auto_approve`로 초기화 가능
- **3) 쿼리 수정**: 요청 JSON을 직접 편집 후 재확인 (다른 호스트로의 요청은 차단)
- **4) 거절**: 해당 요청 취소

확인 게이트를 비활성화하려면 `.env`에 추가:

```
ATLASSIAN_MCP_REQUIRE_CONFIRM=false
```

---

## Docker 직접 실행 (테스트용)

```bash
docker run --rm -i --env-file /absolute/path/to/.env atlassian-mcp
```

> `-i` 플래그는 필수입니다. stdin이 없으면 MCP 연결이 즉시 끊깁니다.
