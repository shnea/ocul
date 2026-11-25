# 코어 관리 페이지 작업 지침 (`core/dashboard/AGENTS.md`)

이 문서는 중앙 하네스(`ocul`) 내부에 위치하는 코어 프로젝트 `core/dashboard`의 설계·보안·구현·검증 기준을 정의합니다. 루트 `AGENTS.md`와 충돌하는 세부 사항은 이 문서를 우선합니다.

---

## 1. 목적 및 권한 경계 (Strict Read/Write Boundary)

* 이 프로젝트는 중앙 하네스의 상태(프로젝트, 스킬, MCP, 플러그인, 검증 로그, 키 연결)를 한눈에 확인하는 **로컬 관리 도구**입니다.
* **읽기 전용 (Read-Only):** 대시보드, 프로젝트 목록, 스킬, MCP, 플러그인, 로그는 파일 시스템을 읽기만 하며 **절대 직접 수정·생성·삭제하지 않습니다.**
* **쓰기 유일 허용 (Write-Only Exception):** 오직 **키/환경변수/토큰(Secrets) 등록·수정·삭제** 기능만 쓰기 API를 허용합니다.
* **상태 변경 위임:** 향후 UI에서 프로젝트 생성(`init`), 규칙 동기화(`sync`), 검증(`verify`) 실행 버튼이 필요해지더라도 파일을 직접 조작하지 않고 반드시 `harness-cli` 서브프로세스 호출로만 수행합니다.

---

## 2. 데이터 소스 규약 (No-DB, File SSOT)

* **대시보드 (읽기):** `registry/projects.json` + `.harness/logs/verify.jsonl`
* **프로젝트 (읽기):** `registry/projects.json` + 각 프로젝트 `harness.json`, `CHECKLIST.md`
* **스킬 (읽기):** `rules/agent-skills/`(공통) + 각 프로젝트 `.agent/`(프로젝트별) YAML Frontmatter(`name`, `scope`, `provider`)
* **MCP / 플러그인 (읽기):** 하네스 및 로컬 MCP·플러그인 설정 파일(`.json`)
* **로그 (읽기):** `.harness/logs/verify.jsonl` 역순(최신순) 파싱
* **키 연결 (읽기/쓰기):** Git 외부 격리 저장소 (`~/.harness/secrets.enc`)

---

## 3. 보안 및 키 저장 규약 (Secrets Isolation)

1. 키·토큰·환경변수 원문은 **절대 Git 저장소 내부에 평문으로 저장하지 않습니다.**
2. 저장 경로는 Git 외부(`~/.harness/secrets.enc`)로 고정하며, 파일 권한 `0600` 및 AES-256-GCM 암호화를 적용합니다.
3. 조회 API(`GET /api/secrets`)는 원문을 절대 반환하지 않으며 마스킹 문자열(`sk-****1234`)과 메타데이터만 응답합니다.
4. 백엔드 서버는 기본으로 `127.0.0.1`에만 바인딩합니다.
5. 파일 스캐너는 오직 중앙 하네스 루트와 `registry/projects.json`에 등록된 프로젝트 경로 내부만 읽을 수 있으며 외부 경로 탐색을 차단합니다.

---

## 4. 코드 아키텍처 및 계층 경계

* **백엔드 경계 규칙:** `server/routes/`에서 Node `fs` 모듈을 직접 import하는 것을 금지합니다. 모든 파일 읽기는 `server/scanners/`를, 키 쓰기는 `server/vault/`를 통해서만 수행합니다.
* **프런트엔드 경계 규칙:** `web/src/features/`에서 `fetch`/`axios` 직접 호출과 `useEffect` 남용을 금지하며, 반드시 `web/src/platform/` API 클라이언트와 데이터 페칭 훅을 통해 호출합니다.

---

## 5. 검증 및 완료 조건

1. 모든 코드 수정 후 `harness verify core-dashboard`를 실행해 `RESULT: PASSED`를 확인합니다.
2. API 응답 구조나 `verify.jsonl` 스키마를 수정하면 `shared/types.ts`를 먼저 갱신합니다.
3. `server/vault/` 또는 `server/scanners/` 수정 시 보안 단위 테스트(`tests/security.test.mjs`) 통과가 필수입니다.
