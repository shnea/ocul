# 프로젝트 작업 지침 (Harness-Driven SSOT)

> 이 파일은 중앙 하네스(`ocul/rules/agent-instructions/`)에서 자동 동기화됩니다. 직접 수정하지 마세요.

1. **4계층 구조 준수:** 모든 코드는 `core/`(순수 도메인), `platform/`(I/O·API 래퍼), `ui-kit/`(공통 UI), `features/`(기능 구현) 경계를 지킨다.
2. **규칙 변조·우회 금지:** `eslint.config.mjs`, `analysis_options.yaml`, `.harness-rules/`를 수정하거나 `eslint-disable` / `// ignore:` / `// HACK:` 주석으로 에러를 회피하지 않는다.
3. **단일 검증 완료 조건:** 코드 수정 후 반드시 중앙 하네스의 `harness verify`를 실행해 `RESULT: PASSED`를 확인한다. 실패 시 출력된 `Fix:` 안내에 따라 근본 원인을 수정한다.
4. **미검증 코드 격리:** `harness verify` 통과 전에는 `main` 브랜치에 커밋하지 않는다(`pre-commit` 훅이 차단함). 임시 보존은 `wip/<작업명>` 브랜치를 사용한다.
5. **스킬 우선순위:** 프로젝트 `.agent/<스킬명>.md`가 존재하면 중앙 `rules/agent-skills/<스킬명>.md`보다 우선 적용한다(공통 기본값 + 예외 오버라이드).
6. **보고 형식:** (1) 변경 요약, (2) `harness verify` 최종 출력 결과, (3) 미확인 사항만 간결히 보고한다.
