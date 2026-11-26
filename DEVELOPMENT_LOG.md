# DEVELOPMENT_LOG

## 2026-11-26 — 공개 문서 및 테스트 실패 기록

- 목적: API 테스트와 프런트엔드 빌드를 실행하고 공개 문서의 상태를 최신화했다.
- 검증: \`python -m pytest tests/api -q\`에서 21개 중 20개 통과, 1개 실패. 실패 테스트 \`test_gemini_failure_is_visible_in_rule_based_fallback\`는 Gemini 오류가 발생한 뒤 규칙 기반 응답에 실패 안내 문구가 포함되기를 기대하지만 현재 응답에 해당 문구가 없어 실패했다. \`npm run build\`는 통과했다.
- 변경: README에 재현된 실패와 검증 범위를 기록했다. 핵심 코드 수정은 요청 범위 밖이어서 하지 않았다.
- 판단: 실패한 테스트와 운영 배포 미검증을 고려해 \`develop\`을 유지하고 \`main\`으로 승격하지 않는다.
