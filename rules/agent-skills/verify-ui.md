---
name: verify-ui
scope: common
provider: local
---

# verify-ui

UI 변경 후 시각적 회귀 및 콘솔 에러 여부를 확인하고, 최종적으로 `harness verify` 통과를 검증하는 공통 스킬입니다.

## 절차
1. `harness verify` 실행으로 `sync-check`, `boundary`, `lint`, `test`, `build` 통과 확인
2. UI 변경 시 로컬 서버(`harness ui` 또는 앱 dev 서버)에서 렌더링 및 네트워크 오류 여부 확인
3. `features/`에 `fetch`/`useEffect` 직접 호출이 없는지 재확인
