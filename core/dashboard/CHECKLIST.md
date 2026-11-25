# core-dashboard Checklist

- [x] `AGENTS.md` 및 `harness.json` 연결
- [x] `shared/types.ts` 공용 스키마 정의
- [x] `server/scanners/` 읽기 전용 파일 스캐너 및 경로 탐색 차단 구현
- [x] `server/vault/` AES-256-GCM 암호화 키 저장소 (`~/.harness/secrets.enc`, 0600) 구현
- [x] `server/routes/` API 라우터 (직접 `fs` 호출 금지) 구현
- [x] `web/src/` 4계층 대시보드 UI 구현
- [x] 보안 단위 테스트 (`tests/security.test.mjs`) 작성 및 `harness verify core-dashboard` 통과
