# Ocul — Central Harness (Base Template)

여러 기술 스택(`react-ts`, `flutter-app`, `node-api`)의 프로젝트를 **결정론적 가드레일(린트·계층 경계·검증 CLI)**로 중앙 통제하고, DB 없이 파일 기반으로 상태를 시각화하는 **중앙 하네스(Central Harness) 원천 베이스**입니다.

Codex / Antigravity(`AGENTS.md`), Claude Code(`CLAUDE.md`), Gemini CLI(`GEMINI.md`) 등 어떤 AI 에이전트가 투입되어도 동일한 규칙과 검증 파이프라인을 따릅니다.

---

## 빠른 시작 (1분 세팅)

Node.js 20 이상이 필요합니다. (외부 npm 의존성 없이 바로 동작합니다.)

```bash
# 1. 전역 harness CLI 연결
npm link

# 2. 중앙 규칙 동기화 및 코어 대시보드 자가 검증
harness sync --all
harness verify core-dashboard

# 3. 로컬 코어 관리 대시보드 실행 (http://127.0.0.1:4310)
harness ui
```

---

## 새 프로젝트 생성

```bash
harness init <kebab-case-id> --stack <react-ts|flutter-app|node-api>
```

자동으로 4계층 구조(`core`/`platform`/`ui-kit`/`features`), `registry/projects.json` 등록, 멀티 에이전트 지침(`AGENTS.md`/`CLAUDE.md`/`GEMINI.md`) 동기화, Git `pre-commit` 검증 훅까지 한 번에 세팅됩니다.

---

## 디렉터리 구조

```text
ocul/
├── AGENTS.md / CLAUDE.md / GEMINI.md   # 멀티 에이전트 진입 지침 (SSOT)
├── USER_PLAYBOOK.md                    # 실사용자 행동강령 및 프롬프트 가이드
├── registry/projects.json              # 일반 + 코어 프로젝트 통합 레지스트리
├── templates/                          # 스택별 골든 패스 (react-ts, flutter-app, node-api)
├── rules/                              # 공통 가드레일 SSOT (lint, boundary, skills, hooks)
├── cli/harness-cli/                    # init / sync / verify / ui 통합 CLI
├── core/dashboard/                     # No-DB 로컬 관리 페이지 (127.0.0.1)
└── .harness/logs/verify.jsonl          # verify 실행 로그 (Git 제외)
```

> 시크릿(API 키·토큰)은 Git 저장소 외부(`~/.harness/secrets.enc`, AES-256-GCM, `0600`)에 격리 저장됩니다.

---

## 테스트 실행

```bash
npm test
```

자세한 실전 운영 방법과 AI 지시 예시는 [`USER_PLAYBOOK.md`](./USER_PLAYBOOK.md)를 참고하세요.
