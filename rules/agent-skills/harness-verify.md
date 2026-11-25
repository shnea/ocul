---
name: harness-verify
scope: common
provider: local
---

# harness-verify

모든 프로젝트 및 코어 도구의 단일 검증 진입점(`harness verify`) 실행 및 `Fix:` 기반 자가 복구 스킬입니다.

## 절차
1. 작업 완료 전 반드시 `harness verify [project-id]` 실행
2. 실패 시 출력된 `Fix:` 안내를 따라 근본 원인을 수정 (주석 우회·규칙 파일 변조 금지)
3. `RESULT: PASSED` 확인 후 변경 요약과 최종 출력만 간결하게 보고
