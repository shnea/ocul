# 작업 지침 (Harness-Driven)

1. **신규 프로젝트 생성:** 직접 폴더를 만들지 말고 반드시 `harness init <id> --stack <stack>`을 사용한다.
2. **코어 관리 페이지 작업:** `core/dashboard/` 관련 작업은 반드시 `core/dashboard/AGENTS.md` 지침을 우선 적용한다.
3. **규칙 수정 금지:** 프로젝트 내 린트 설정(`analysis_options.yaml`, `eslint.config.mjs` 등)을 임의로 수정하거나 `eslint-disable` / `// ignore:` / `// HACK:` 주석으로 에러를 회피하지 않는다.
4. **완료 조건:** 코드를 수정한 뒤에는 반드시 `harness verify`를 실행해 `RESULT: PASSED`를 확인한다. 실패 시 출력된 `Fix:` 안내에 따라 근본 원인을 수정한다.
5. **미검증 코드 격리:** `harness verify`를 통과하지 못한 상태에서는 `main` 브랜치에 커밋하지 않는다. 작업 보존이 필요하면 `wip/<작업명>` 브랜치를 사용한다.
6. **보고 형식:** 완료 보고 시 (1) 변경 요약, (2) `harness verify` 최종 출력 결과, (3) 미확인/수동 확인 필요 사항만 간결하게 보고한다.
