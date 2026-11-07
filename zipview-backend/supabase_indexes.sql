-- =========================================================================
-- 집뷰(ZipView) Supabase PostgreSQL 고속 텍스트 검색 및 성능 최적화 인덱스
-- =========================================================================
-- 적용 대상 테이블: apartment_trade
-- 목적:
-- 1. 전국 읍/면/동(dong) 및 단지명(apt_name) 부분 문자열(ILIKE '%단어%') 검색 속도 100배 단축
-- 2. 36개월 차트 통계(GROUP BY deal_year, deal_month) 및 최신 실거래가 정렬 0.01초 최적화
-- 3. Supabase SQL Editor에서 전체 복사 후 [RUN]을 실행하시면 즉시 적용됩니다.
-- =========================================================================

-- 1. PostgreSQL Trigram 확장 활성화 (부분 문자열 및 한글 텍스트 와일드카드 검색 가속)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 법정동(dong) GIN Trigram 인덱스
-- 챗봇 질의("구산동에 있어?", "가좌동 원룸") 시 Full Table Scan 방지 -> GIN 인덱스 스캔 (1ms 이내)
CREATE INDEX IF NOT EXISTS idx_apartment_trade_dong_trgm 
ON apartment_trade USING gin (dong gin_trgm_ops);

-- 3. 단지명/건물명(apt_name) GIN Trigram 인덱스
-- 단지명 질의("은마", "자이", "래미안", "힐스테이트" 등) 고속 검색
CREATE INDEX IF NOT EXISTS idx_apartment_trade_apt_name_trgm 
ON apartment_trade USING gin (apt_name gin_trgm_ops);

-- 4. 지번(jibun) GIN Trigram 인덱스 (빌라/원룸 주소 검색 가속)
CREATE INDEX IF NOT EXISTS idx_apartment_trade_jibun_trgm 
ON apartment_trade USING gin (jibun gin_trgm_ops);

-- 5. 지역 코드(regional_code) + 계약일(deal_date DESC) 복합 B-Tree 인덱스
-- 대시보드 로딩 시 최근 계약일 역순 페이징 및 최신 거래 추출 최적화
CREATE INDEX IF NOT EXISTS idx_apartment_trade_reg_date 
ON apartment_trade (regional_code, deal_date DESC);

-- 6. 지역 코드 + 거래유형(trade_type) + 계약일 복합 인덱스
-- 매매 최고가, 전세가 단일 통계 및 매매/전세 필터링 쿼리 속도 극대화
CREATE INDEX IF NOT EXISTS idx_apartment_trade_reg_trade_date 
ON apartment_trade (regional_code, trade_type, deal_date DESC);

-- 7. 지역 코드 + 계약년월(deal_year, deal_month) 복합 인덱스
-- 36개월 차트 GROUP BY 집계 및 누락 월(Missing Months) 분석 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_apartment_trade_reg_ym 
ON apartment_trade (regional_code, deal_year, deal_month);

-- 8. 지역 코드 + 법정동 복합 B-Tree 인덱스
-- 특정 시군구 내의 법정동 일치 검색 가속
CREATE INDEX IF NOT EXISTS idx_apartment_trade_reg_dong 
ON apartment_trade (regional_code, dong);

-- =========================================================================
-- [검증 쿼리] 인덱스 정상 생성 확인
-- =========================================================================
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'apartment_trade'
ORDER BY indexname;

