# Ocul 중앙 하네스 — 실사용자 행동강령 (User Playbook)

이 문서는 **사람(사용자)**이 중앙 하네스(`ocul`)와 AI 에이전트(Codex, Gemini, Claude 등)를 함께 쓰면서,
최소한의 신경만 쓰고도 프로젝트 품질과 일관성을 자동으로 유지하기 위한 **실전 행동 지침서**입니다.

> **핵심 한 줄 요약**
> 코딩·검증·동기화 실행은 전부 **AI 몫**입니다.
> 사람은 **① `RESULT: PASSED` 확인, ② 예외 허용 금지, ③ 같은 실수 2번이면 "규칙에 박아줘" 지시** — 이 3가지만 지키면 됩니다.

---

## 1. 역할 분담: 내가 할 일 vs AI가 할 일

| 구분 | 사람이 하는 일 (판단·승인·트리거) | AI가 하는 일 (실행·검증·동기화) |
| :--- | :--- | :--- |
| **새 프로젝트 생성** | 이름과 스택만 말하기 | `harness init` 실행, 템플릿 복사, 규칙 동기화, Git·훅 설치 |
| **기능 개발 / 버그 수정** | 원하는 기능과 조건 설명 | 4계층 구조에 맞춰 코드 작성 + `harness verify` 실행 |
| **품질 검증** | 보고서 끝의 `RESULT: PASSED` 확인 | `sync-check` → `boundary` → `lint` → `test` → `build` 통과 |
| **반복 실수 차단** | "이 실수 또 나왔네, 규칙에 박아줘" 지시 | `rules/`에 규칙·`Fix:` 추가 + `harness sync --all` 전파 |
| **키 / 토큰 관리** | `harness ui` → **키 연결**에서 등록 | `~/.harness/secrets.enc` 암호화 저장, 코드에 평문 미노출 |
| **주간·종료 정리** | 대시보드 10초 확인 후 "정리해줘" 지시 | `AGENTS.md` 다이어트 + 검증된 구조 `templates/` 역반영 |

---

## 2. 최초 1회 세팅 (처음 딱 한 번만)

터미널에서 아래 명령어를 한 번만 실행해 두면 어느 폴더에서든 `harness` 명령어를 쓸 수 있습니다.

```bash
cd <ocul-저장소-경로>
npm link          # 전역 harness 명령어 등록
git init          # ocul 중앙 저장소 버전 관리 시작 (선택)
```

상태를 눈으로 보고 싶을 때는 언제든 아래 명령어로 로컬 관리 페이지를 켭니다.

```bash
harness ui        # 브라우저에서 http://127.0.0.1:4310 열기
```

---

## 3. 상황별 행동강령 (복사해서 바로 쓰는 지시문)

### 상황 A. 새 프로젝트를 시작할 때
* **행동:** 직접 폴더를 만들거나 기존 프로젝트를 복사하지 마세요.
* **AI에게 이렇게 말하세요:**
  > `"ocul 하네스로 photo-resizer 프로젝트 만들어줘. 스택은 flutter-app으로 해."`
* **자동으로 되는 것:** `kebab-case` 검사 → 4계층 폴더 생성 → `registry/projects.json` 등록 → `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` 동기화 → Git 초기화 및 `pre-commit` 커밋 차단 훅 자동 설치.

---

### 상황 B. 평소 기능 구현 / 버그 수정을 시킬 때
* **행동:** 길게 규칙을 설명할 필요 없이 **"무엇을 만들지 + `harness verify` 통과"**만 붙여서 말합니다.
* **기능 구현 예시:**
  > `"photo-resizer의 features/compress/에 용량 슬라이더 추가해 줘. 파일 저장은 platform/ 인터페이스를 쓰고, 끝나면 harness verify 통과 결과만 보고해."`
* **버그 수정 예시:**
  > `"setTimeout 같은 임시 우회 말고 상태 흐름에서 근본 원인을 고쳐줘. harness verify 통과 확인 후 변경 요약만 알려줘."`

---

### 상황 C. 코어 관리 페이지(`core/dashboard`)를 수정할 때
* **행동:** 코어 대시보드는 보안·읽기 전용 경계가 엄격하므로 전용 지침을 명시해 줍니다.
* **AI에게 이렇게 말하세요:**
  > `"core/dashboard/AGENTS.md 지침 지켜서 로그 화면에 기간 필터 추가해 줘. routes/에서 직접 fs 쓰지 말고 scanners/를 통해 읽고, harness verify core-dashboard 통과 후 보고해."`

---

### 상황 D. AI가 "다 했어요"라고 보고했을 때
코드를 한 줄씩 다 읽으려 하지 말고, **딱 3가지만 체크**하세요.

1. **`RESULT: PASSED`가 찍혀 있는가?**
   * 안 찍혀 있으면: `"harness verify 돌려서 RESULT: PASSED 확인해 줘."`
2. **우회 주석이나 규칙 파일 수정 흔적이 없는가?**
   * AI가 `"린트 에러가 나서 eslint-disable로 넘겼습니다"` 또는 `"eslint.config.mjs를 조금 수정했습니다"`라고 하면 **즉시 반려**합니다.
   * 반려 멘트: `"우회 주석과 규칙 수정 원복하고, Fix: 안내대로 근본 원인을 고쳐서 다시 harness verify 통과시켜."`
3. **미확인 / 수동 확인 사항이 있는가?**
   * UI 화면 확인이나 외부 API 연동처럼 AI가 못 본 항목만 내가 직접 눈으로 확인합니다.

---

### 상황 E. AI가 같은 실수를 2번째 했을 때 (가장 중요한 습관: 투 스트라이크 룰)
하네스가 시간이 갈수록 똑똑해지는 핵심 장치입니다.

* **1번째 실수:** 그냥 고치라고 합니다. (`"여기 잘못됐어, 고쳐줘."`)
* **2번째 같은 실수:** **즉시 작업을 멈추고** 코드가 아니라 **중앙 규칙(`rules/`)**을 업데이트시킵니다.
* **AI에게 이렇게 말하세요:**
  > `"방금 같은 실수가 또 나왔어. AGENTS.md에 글 쓰지 말고, ocul/rules/에 이걸 자동으로 막는 규칙 1개랑 Fix: 안내 메시지를 추가해 줘. 그리고 harness sync --all로 전체 프로젝트에 전파해."`
* **효과:** 그 순간부터 앞으로 어떤 에이전트(Codex, Gemini, Claude)가 와도 같은 실수는 **물리적으로 불가능**해집니다.

---

### 상황 F. 작업 중간에 끊고 저장해야 할 때 (아직 `FAILED` 상태)
* **행동:** `main` 브랜치에 미검증 코드를 억지로 커밋하지 마세요. (어차피 `pre-commit` 훅이 막아줍니다.)
* **AI에게 이렇게 말하세요:**
  > `"아직 작업 중이니까 wip/<작업명> 브랜치로 옮겨서 임시 저장해 둬. 나중에 검증 통과하면 main에 합치자."`
* `wip/*` 브랜치에서는 `pre-commit` 훅이 경고만 띄우고 임시 커밋을 허용해 줍니다.

---

### 상황 G. API 키 · 토큰 · 환경변수를 연결할 때
* **행동:** 키 원문을 코드, `AGENTS.md`, 또는 Git 저장소 안의 파일에 붙여넣지 마세요.
* **올바른 방법:**
  1. 터미널에서 `harness ui` 실행 → `http://127.0.0.1:4310` 접속
  2. 좌측 **키 연결 (Secrets)** 메뉴에서 키 이름·프로젝트·값 입력 후 **암호화 저장**
  3. Git 외부(`~/.harness/secrets.enc`, AES-256-GCM, 권한 `0600`)에 안전하게 보관되며, 화면에는 `sk-****1234`처럼 마스킹되어 표시됩니다.

---

### 상황 H. 다른 AI 에이전트(Codex / Gemini / Claude)로 갈아탈 때
* **행동:** 특별한 설정 없이 그냥 `ocul` 루트 또는 개별 프로젝트 폴더를 열면 됩니다.
  * Codex / Antigravity → `AGENTS.md` 자동 인식
  * Claude Code → `CLAUDE.md` 자동 인식 → `AGENTS.md`로 유도
  * Gemini CLI → `GEMINI.md` 자동 인식 → `AGENTS.md`로 유도
* 혹시 에이전트가 지침을 놓치더라도 Git `pre-commit` 훅이 `harness verify`를 강제하므로 `main` 브랜치는 안전하게 보호됩니다.

---

### 상황 I. 필요한 스킬을 새로 추가하고 싶을 때 (공통 기본값 + 예외 오버라이드)
* **원칙:** 대다수 프로젝트가 공유하는 절차(예: 표준 배포)는 **공통 스킬 1개**로 두고, 방식이 다른 1~2개 프로젝트만 같은 이름의 **프로젝트 전용 스킬**로 덮어씁니다(Override).
* **모든 프로젝트 공통 스킬 (`ocul/rules/agent-skills/`, `scope: common`):**
  > `"표준 배포 스킬 만들어서 ocul/rules/agent-skills/deploy.md에 공통 스킬로 추가해 줘. Frontmatter(name: deploy, scope: common, provider: local) 꼭 넣어줘."`
* **예외 프로젝트 전용 스킬 (`<프로젝트>/.agent/`, `scope: project`):**
  > `"이 프로젝트만 배포 방식이 달라. 프로젝트 .agent/deploy.md에 scope: project로 전용 배포 스킬을 만들어서 공통 deploy.md 대신 우선 적용되게 해줘."`
* **우선순위 규칙:** 프로젝트 내 `.agent/<스킬명>.md`가 있으면 중앙 `rules/agent-skills/<스킬명>.md`보다 우선 적용됩니다.
* **자동으로 되는 것:** 별도 등록 없이 `harness ui` → **스킬** 탭에서 `scope`/`provider`별로 자동 스캔되어 바로 조회됩니다.

---

### 상황 J. `useEffect`·`fetch`·파일 I/O 같은 금지 API를 꼭 써야 하는 특수한 경우 (예외 격리 원칙)
`features/`(에이전트 주 작업 구역)에서는 AI가 버그를 만들기 쉬운 API(`useEffect`, `fetch`/`axios`, `setTimeout`, `fs` 등)를 린트로 막아두었습니다.
하지만 **실제 개발 중 특수한 이유로 꼭 써야 하는 경우**가 생기면, `eslint-disable` 같은 예외 주석을 달지 말고 **허용된 계층으로 옮겨 래핑(격리)**합니다.

| 꼭 써야 하는 금지 API | 절대 금지 (❌) | 올바른 격리 위치 (✅) |
| :--- | :--- | :--- |
| `useEffect` (DOM 포커스, 외부 구독, 리사이즈 감지 등) | `features/` 안에서 예외 주석 달고 직접 사용 | **`ui-kit/`**에 전용 훅/컴포넌트로 래핑 후 `features/`에서 호출 |
| `fetch` / `axios` / `setTimeout` / 파일 I/O(`fs`) / DB·OS 접근 | `features/` 안에서 직접 호출 | **`platform/`**에 인터페이스 함수로 래핑 후 `features/`에서 호출 |
| 백엔드 파일 읽기 / 키 쓰기 (`fs`) | `server/routes/`에서 `fs` 직접 import | 읽기는 **`server/scanners/`**, 키 쓰기는 **`server/vault/`**로 분리 |

* **AI에게 이렇게 말하세요:**
  > `"이 기능은 DOM 이벤트 구독 때문에 useEffect가 꼭 필요해. features/에 예외 주석 달지 말고 ui-kit/에 전용 훅으로 래핑해서 격리한 뒤, features/에서는 그 훅만 호출하도록 만들고 harness verify 통과시켜 줘."`
  > `"외부 API 호출이 필요하니까 features/에서 fetch 직접 쓰지 말고 platform/에 클라이언트 함수로 래핑해서 호출해 줘."`

---

## 4. 절대 하면 안 되는 금지 행동 TOP 5

하네스는 기술보다 **사람의 예외 허용 한 번**으로 가장 빨리 무너집니다. 아래 5가지만 피하세요.

1. **"시간 없으니 일단 린트 에러 ignore 처리하고 넘어가"**라고 지시하기
2. **`git commit --no-verify`**로 `pre-commit` 훅을 끄고 `main`에 밀어넣기
3. 개별 프로젝트 안에서 `eslint.config.mjs`나 `analysis_options.yaml`을 직접 고치기 (수정할 일이 있으면 반드시 `ocul/rules/`에서 고치고 `harness sync --all`)
4. AI가 실수할 때마다 `AGENTS.md`에 잔소리 문장을 계속 덧붙여 문서를 100줄 이상으로 늘리기 (텍스트가 아니라 `rules/` 코드로 막아야 함)
5. API 키 원문을 채팅창에 그대로 붙여넣어 프로젝트 파일에 하드코딩시키기

---

## 5. 주간 / 프로젝트 종료 루틴 (5분 컷)

### 매일 또는 주 1회 (10초 확인)
* `harness ui` 실행 → **대시보드** 탭에서 3가지만 봅니다:
  1. **규칙 동기화 경고**가 `0`이 아니면 → AI에게 `"harness sync --all 돌려줘"`
  2. **최다 실패 단계 TOP 5**에 특정 항목이 계속 뜨면 → 규칙 안내(`Fix:`)가 불명확하거나 템플릿 보완이 필요하다는 신호

### 프로젝트 1개 끝났을 때 (AI에게 한 마디)
> `"이번 프로젝트 끝났어. 잘 통했던 구조는 ocul/templates/에 역반영해 주고, 루트 AGENTS.md가 50줄 넘었으면 규칙으로 내릴 수 있는 건 rules/로 옮겨서 다이어트해 줘."`

---

## 6. 빠른 명령어 치트시트 (참고용)

직접 칠 일은 거의 없고, 대부분 AI가 대신 실행합니다.

```bash
harness init <id> --stack <react-ts|flutter-app|node-api>   # 새 프로젝트 생성 + 규칙 동기화 + 훅 설치
harness sync --all                                          # 중앙 rules/ 변경사항을 모든 프로젝트에 전파
harness verify [project-id]                                 # 단일 검증 실행 + verify.jsonl 기록
harness ui                                                  # 코어 관리 대시보드 실행 (http://127.0.0.1:4310)
```
