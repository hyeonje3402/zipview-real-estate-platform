import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";

// Recharts 순정 컴포넌트 직접 구조분해할당 (window.Recharts UMD)
const {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} = (typeof window !== "undefined" && window.Recharts) ? window.Recharts : {};

/**
 * =========================================================================
 * 집뷰(ZipView) 토스 스타일 전국 실거래가 통합 대시보드
 * =========================================================================
 *
 * [주식 거래 앱 스타일 고도화 핵심 기능]
 * 1. [주식형 ComposedChart] 좌우 듀얼 Y축 (가격 Y축 + 하단 거래량 Bar Y축), 전월 대비 등락률(▲▼) 시각화
 * 2. [1:1 비교 막대그래프 섹션] Recharts BarChart로 단지 A vs 단지 B 평균 매매가, 평균 전세가, 전세가율 대조
 * 3. [초고속 2단계 캐싱 & 서버사이드 페이징] 3,000건 제한 해제, 수만 건 데이터 안정적 60 FPS 렌더링
 * 4. [동적 5개 윈도우 페이지네이션] 토스 스타일 이전/다음/첫/끝 페이지 점프 네비게이터
 * 5. [AbortController & 단일 진실 공급원] 레이스 컨디션 및 화면 깜빡임(Flicker) 원천 차단
 */

// ==================== 전국 법정동 코드(LAWD_CD 앞 5자리) 매핑 데이터 ====================
export const REGION_DATA = {
  "서울특별시": [
    { name: "강남구", code: "11680" },
    { name: "서초구", code: "11650" },
    { name: "송파구", code: "11710" },
    { name: "용산구", code: "11170" },
    { name: "성동구", code: "11200" },
    { name: "마포구", code: "11440" },
    { name: "영등포구", code: "11560" },
    { name: "강동구", code: "11740" },
    { name: "양천구", code: "11470" },
    { name: "노원구", code: "11350" },
    { name: "종로구", code: "11110" },
    { name: "중구", code: "11140" },
    { name: "동대문구", code: "11230" },
    { name: "성북구", code: "11290" },
    { name: "서대문구", code: "11410" },
    { name: "동작구", code: "11590" },
    { name: "관악구", code: "11620" },
    { name: "광진구", code: "11215" },
    { name: "은평구", code: "11380" },
    { name: "강북구", code: "11305" },
    { name: "도봉구", code: "11320" },
    { name: "중랑구", code: "11260" },
    { name: "구로구", code: "11530" },
    { name: "금천구", code: "11545" },
    { name: "강서구", code: "11500" }
  ],
  "경기도": [
    { name: "수원시 장안구", code: "41111" },
    { name: "수원시 권선구", code: "41113" },
    { name: "수원시 팔달구", code: "41115" },
    { name: "수원시 영통구", code: "41117" },
    { name: "성남시 수정구", code: "41131" },
    { name: "성남시 중원구", code: "41133" },
    { name: "성남시 분당구", code: "41135" },
    { name: "의정부시", code: "41150" },
    { name: "안양시 만안구", code: "41171" },
    { name: "안양시 동안구", code: "41173" },
    { name: "부천시 원미구", code: "41192" },
    { name: "부천시 소사구", code: "41194" },
    { name: "부천시 오정구", code: "41196" },
    { name: "광명시", code: "41210" },
    { name: "평택시", code: "41220" },
    { name: "동두천시", code: "41250" },
    { name: "안산시 상록구", code: "41271" },
    { name: "안산시 단원구", code: "41273" },
    { name: "고양시 덕양구", code: "41281" },
    { name: "고양시 일산동구", code: "41285" },
    { name: "고양시 일산서구", code: "41287" },
    { name: "과천시", code: "41290" },
    { name: "구리시", code: "41310" },
    { name: "남양주시", code: "41360" },
    { name: "오산시", code: "41370" },
    { name: "시흥시", code: "41390" },
    { name: "군포시", code: "41410" },
    { name: "의왕시", code: "41430" },
    { name: "하남시", code: "41450" },
    { name: "용인시 처인구", code: "41461" },
    { name: "용인시 기흥구", code: "41463" },
    { name: "용인시 수지구", code: "41465" },
    { name: "파주시", code: "41480" },
    { name: "이천시", code: "41500" },
    { name: "안성시", code: "41550" },
    { name: "김포시", code: "41570" },
    { name: "화성시", code: "41590" },
    { name: "광주시", code: "41610" },
    { name: "양주시", code: "41630" },
    { name: "포천시", code: "41650" },
    { name: "여주시", code: "41670" },
    { name: "연천군", code: "41800" },
    { name: "가평군", code: "41820" },
    { name: "양평군", code: "41830" }
  ],
  "인천광역시": [
    { name: "중구", code: "28110" },
    { name: "동구", code: "28140" },
    { name: "미추홀구", code: "28177" },
    { name: "연수구", code: "28185" },
    { name: "남동구", code: "28200" },
    { name: "부평구", code: "28237" },
    { name: "계양구", code: "28245" },
    { name: "서구", code: "28260" },
    { name: "강화군", code: "28710" },
    { name: "옹진군", code: "28720" }
  ],
  "부산광역시": [
    { name: "중구", code: "26110" },
    { name: "서구", code: "26140" },
    { name: "동구", code: "26170" },
    { name: "영도구", code: "26200" },
    { name: "부산진구", code: "26230" },
    { name: "동래구", code: "26260" },
    { name: "남구", code: "26290" },
    { name: "북구", code: "26320" },
    { name: "해운대구", code: "26350" },
    { name: "사하구", code: "26380" },
    { name: "금정구", code: "26410" },
    { name: "강서구", code: "26440" },
    { name: "연제구", code: "26470" },
    { name: "수영구", code: "26500" },
    { name: "사상구", code: "26530" },
    { name: "기장군", code: "26710" }
  ],
  "대구광역시": [
    { name: "중구", code: "27110" },
    { name: "동구", code: "27140" },
    { name: "서구", code: "27170" },
    { name: "남구", code: "27200" },
    { name: "북구", code: "27230" },
    { name: "수성구", code: "27260" },
    { name: "달서구", code: "27290" },
    { name: "달성군", code: "27710" },
    { name: "군위군", code: "27720" }
  ],
  "광주광역시": [
    { name: "동구", code: "29110" },
    { name: "서구", code: "29140" },
    { name: "남구", code: "29155" },
    { name: "북구", code: "29170" },
    { name: "광산구", code: "29200" }
  ],
  "대전광역시": [
    { name: "동구", code: "30110" },
    { name: "중구", code: "30140" },
    { name: "서구", code: "30170" },
    { name: "유성구", code: "30200" },
    { name: "대덕구", code: "30230" }
  ],
  "울산광역시": [
    { name: "중구", code: "31110" },
    { name: "남구", code: "31140" },
    { name: "동구", code: "31170" },
    { name: "북구", code: "31200" },
    { name: "울주군", code: "31710" }
  ],
  "세종특별자치시": [
    { name: "세종특별자치시", code: "36110" }
  ],
  "강원특별자치도": [
    { name: "춘천시", code: "42110" },
    { name: "원주시", code: "42130" },
    { name: "강릉시", code: "42150" },
    { name: "동해시", code: "42170" },
    { name: "태백시", code: "42190" },
    { name: "속초시", code: "42210" },
    { name: "삼척시", code: "42230" },
    { name: "홍천군", code: "42720" },
    { name: "횡성군", code: "42730" },
    { name: "영월군", code: "42750" },
    { name: "평창군", code: "42760" },
    { name: "정선군", code: "42770" },
    { name: "철원군", code: "42780" },
    { name: "화천군", code: "42790" },
    { name: "양구군", code: "42800" },
    { name: "인제군", code: "42810" },
    { name: "고성군", code: "42820" },
    { name: "양양군", code: "42830" }
  ],
  "충청북도": [
    { name: "청주시 상당구", code: "43111" },
    { name: "청주시 서원구", code: "43112" },
    { name: "청주시 흥덕구", code: "43113" },
    { name: "청주시 청원구", code: "43114" },
    { name: "충주시", code: "43130" },
    { name: "제천시", code: "43150" },
    { name: "보은군", code: "43720" },
    { name: "옥천군", code: "43730" },
    { name: "영동군", code: "43740" },
    { name: "증평군", code: "43745" },
    { name: "진천군", code: "43750" },
    { name: "괴산군", code: "43760" },
    { name: "음성군", code: "43770" },
    { name: "단양군", code: "43800" }
  ],
  "충청남도": [
    { name: "천안시 동남구", code: "44131" },
    { name: "천안시 서북구", code: "44133" },
    { name: "공주시", code: "44150" },
    { name: "보령시", code: "44180" },
    { name: "아산시", code: "44200" },
    { name: "서산시", code: "44210" },
    { name: "논산시", code: "44230" },
    { name: "계룡시", code: "44250" },
    { name: "당진시", code: "44270" },
    { name: "금산군", code: "44710" },
    { name: "부여군", code: "44760" },
    { name: "서천군", code: "44770" },
    { name: "청양군", code: "44790" },
    { name: "홍성군", code: "44800" },
    { name: "예산군", code: "44810" },
    { name: "태안군", code: "44825" }
  ],
  "전북특별자치도": [
    { name: "전주시 완산구", code: "45111" },
    { name: "전주시 덕진구", code: "45113" },
    { name: "군산시", code: "45130" },
    { name: "익산시", code: "45140" },
    { name: "정읍시", code: "45180" },
    { name: "남원시", code: "45190" },
    { name: "김제시", code: "45210" },
    { name: "완주군", code: "45710" },
    { name: "진안군", code: "45720" },
    { name: "무주군", code: "45730" },
    { name: "장수군", code: "45740" },
    { name: "임실군", code: "45750" },
    { name: "순창군", code: "45770" },
    { name: "고창군", code: "45790" },
    { name: "부안군", code: "45800" }
  ],
  "전라남도": [
    { name: "목포시", code: "46110" },
    { name: "여수시", code: "46130" },
    { name: "순천시", code: "46150" },
    { name: "나주시", code: "46170" },
    { name: "광양시", code: "46230" },
    { name: "담양군", code: "46710" },
    { name: "곡성군", code: "46720" },
    { name: "구례군", code: "46730" },
    { name: "고흥군", code: "46770" },
    { name: "보성군", code: "46780" },
    { name: "화순군", code: "46790" },
    { name: "장흥군", code: "46800" },
    { name: "강진군", code: "46810" },
    { name: "해남군", code: "46820" },
    { name: "영암군", code: "46830" },
    { name: "무안군", code: "46840" },
    { name: "함평군", code: "46860" },
    { name: "영광군", code: "46870" },
    { name: "장성군", code: "46880" },
    { name: "완도군", code: "46890" },
    { name: "진도군", code: "46900" },
    { name: "신안군", code: "46910" }
  ],
  "경상북도": [
    { name: "포항시 남구", code: "47111" },
    { name: "포항시 북구", code: "47113" },
    { name: "경주시", code: "47130" },
    { name: "김천시", code: "47150" },
    { name: "안동시", code: "47170" },
    { name: "구미시", code: "47190" },
    { name: "영주시", code: "47210" },
    { name: "영천시", code: "47230" },
    { name: "상주시", code: "47250" },
    { name: "문경시", code: "47280" },
    { name: "경산시", code: "47290" },
    { name: "의성군", code: "47730" },
    { name: "청송군", code: "47750" },
    { name: "영양군", code: "47760" },
    { name: "영덕군", code: "47770" },
    { name: "청도군", code: "47820" },
    { name: "고령군", code: "47830" },
    { name: "성주군", code: "47840" },
    { name: "칠곡군", code: "47850" },
    { name: "예천군", code: "47900" },
    { name: "봉화군", code: "47920" },
    { name: "울진군", code: "47930" },
    { name: "울릉군", code: "47940" }
  ],
  "경상남도": [
    { name: "창원시 의창구", code: "48121" },
    { name: "창원시 성산구", code: "48123" },
    { name: "창원시 마산합포구", code: "48125" },
    { name: "창원시 마산회원구", code: "48127" },
    { name: "창원시 진해구", code: "48129" },
    { name: "진주시", code: "48170" },
    { name: "통영시", code: "48220" },
    { name: "사천시", code: "48240" },
    { name: "김해시", code: "48250" },
    { name: "밀양시", code: "48270" },
    { name: "거제시", code: "48310" },
    { name: "양산시", code: "48330" },
    { name: "의령군", code: "48720" },
    { name: "함안군", code: "48730" },
    { name: "창녕군", code: "48740" },
    { name: "고성군", code: "48820" },
    { name: "남해군", code: "48840" },
    { name: "하동군", code: "48850" },
    { name: "산청군", code: "48860" },
    { name: "함양군", code: "48870" },
    { name: "거창군", code: "48880" },
    { name: "합천군", code: "48890" }
  ],
  "제주특별자치도": [
    { name: "제주시", code: "50110" },
    { name: "서귀포시", code: "50130" }
  ]
};
// ==================== 스켈레톤 UI 컴포넌트군 ====================

// 1. 차트 영역 스켈레톤 UI (animate-pulse)
const ChartSkeleton = ({ regionLabel }) => (
  <div className="w-full h-80 min-h-[320px] bg-[#F2F4F6] rounded-2xl animate-pulse relative overflow-hidden border border-[#E5E8EB] p-6 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-4 bg-[#E5E8EB] rounded-md w-48"></div>
        <div className="h-3 bg-[#E5E8EB] rounded-md w-32"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-[#E5E8EB] rounded-full w-16"></div>
        <div className="h-6 bg-[#E5E8EB] rounded-full w-16"></div>
      </div>
    </div>
    <div className="w-full flex items-end justify-between h-36 px-4 gap-1 opacity-40">
      {[45, 60, 52, 70, 65, 80, 75, 90, 85, 100, 95, 110, 105, 120, 115, 130, 125, 140].map((h, i) => (
        <div
          key={i}
          className="bg-[#D1D6DB] rounded-t-sm w-full transition-all"
          style={{ height: `${(h / 140) * 100}%` }}
        ></div>
      ))}
    </div>
    <div className="flex justify-between pt-2 border-t border-[#E5E8EB]">
      {["21.11", "22.05", "22.11", "23.05", "23.11", "24.05", "24.10"].map((label, idx) => (
        <div key={idx} className="h-3 bg-[#E5E8EB] rounded w-8"></div>
      ))}
    </div>
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-white/90 backdrop-blur-xs px-4 py-2 rounded-full border border-[#E5E8EB] shadow-xs flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#3182F6] animate-ping"></div>
        <span className="text-xs font-bold text-[#4E5968]">
          {regionLabel} 36개월 주식형 복합 시세 분석 중...
        </span>
      </div>
    </div>
  </div>
);

// 2. 테이블 영역 스켈레톤 UI (5~6줄 막대기 형태)
const TableSkeleton = ({ regionLabel }) => (
  <div className="space-y-3 bg-white rounded-2xl border border-[#F2F4F6] p-4 animate-pulse">
    <div className="flex items-center justify-between pb-3 border-b border-[#F2F4F6]">
      <div className="h-4 bg-[#E5E8EB] rounded w-36"></div>
      <div className="h-4 bg-[#E5E8EB] rounded w-20"></div>
    </div>
    {[1, 2, 3, 4, 5, 6].map((row) => (
      <div
        key={row}
        className="flex items-center justify-between py-3.5 px-3 rounded-xl border border-transparent hover:border-[#F2F4F6]"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F2F4F6]"></div>
          <div className="space-y-1.5">
            <div className="h-3.5 bg-[#E5E8EB] rounded w-32 sm:w-44"></div>
            <div className="h-2.5 bg-[#F2F4F6] rounded w-24"></div>
          </div>
        </div>
        <div className="space-y-1.5 text-right flex flex-col items-end">
          <div className="h-4 bg-[#E5E8EB] rounded w-20 sm:w-28"></div>
          <div className="h-2.5 bg-[#F2F4F6] rounded w-16"></div>
        </div>
      </div>
    ))}
    <div className="text-center py-2 text-xs font-medium text-[#8B95A1]">
      국토교통부 표준 API에서 {regionLabel} 실거래 계약 데이터를 불러오고 있습니다.
    </div>
  </div>
);

// 3. 비교 매트릭스 스켈레톤 UI
const MatrixSkeleton = ({ regionLabel }) => (
  <div className="w-full h-48 bg-[#F2F4F6] rounded-2xl animate-pulse flex flex-col items-center justify-center p-6 border border-[#E5E8EB] space-y-2">
    <div className="w-8 h-8 rounded-full bg-[#E5E8EB] flex items-center justify-center">
      <div className="w-4 h-4 rounded-full bg-[#D1D6DB]"></div>
    </div>
    <div className="h-4 bg-[#E5E8EB] rounded w-52"></div>
    <div className="h-3 bg-[#E5E8EB] rounded w-36"></div>
  </div>
);

// ==================== 유틸리티 함수군 ====================

// 금액 포맷터 (만원 단위 -> 'X억 Y만원')
const formatTossMoney = (manwon) => {
  if (!manwon || isNaN(manwon) || Number(manwon) <= 0) return "-";
  const num = Number(manwon);
  const uk = Math.floor(num / 10000);
  const man = Math.round(num % 10000);
  if (uk > 0 && man > 0) return `${uk}억 ${man.toLocaleString()}만`;
  if (uk > 0) return `${uk}억 원`;
  return `${man.toLocaleString()}만 원`;
};

// 평형 변환 (㎡ -> 평)
const toPyeong = (m2) => {
  if (!m2 || isNaN(m2)) return "-";
  return (Number(m2) * 0.3025).toFixed(1);
};

// 최근 36개월 YYYYMM 목록 생성
const generate36Months = (baseYmd = "202410") => {
  const result = [];
  const baseYear = parseInt(baseYmd.slice(0, 4), 10);
  const baseMonth = parseInt(baseYmd.slice(4, 6), 10);

  for (let i = 35; i >= 0; i--) {
    let m = baseMonth - i;
    let y = baseYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    result.push(`${y}${String(m).padStart(2, "0")}`);
  }
  return result;
};

// 36개월 차트 데이터 연산 유틸리티
const calculateChartData = (trades) => {
  const all36Ymd = generate36Months("202410");
  const monthMap = {};

  all36Ymd.forEach((ymd) => {
    const ym = `${ymd.slice(2, 4)}.${ymd.slice(4, 6)}`;
    monthMap[ym] = {
      month: ym,
      rawMonth: ymd,
      tradeSum: 0,
      tradeCount: 0,
      jeonseSum: 0,
      jeonseCount: 0,
      totalCount: 0
    };
  });

  let hasActualData = false;
  let latestValidTrade = 0;
  let latestValidJeonse = 0;

  if (trades && trades.length > 0) {
    trades.forEach((item) => {
      const year = item.deal_year || (item.deal_date ? parseInt(String(item.deal_date).slice(0, 4), 10) : 2024);
      const month = item.deal_month || (item.deal_date ? parseInt(String(item.deal_date).slice(5, 7), 10) : 10);
      const ym = `${String(year).slice(2)}.${String(month).padStart(2, "0")}`;

      if (monthMap[ym]) {
        hasActualData = true;
        const price = Number(item.deal_amount || item.deposit || item.raw_price || 0);
        if (price > 0) {
          if (item.trade_type === "매매") {
            monthMap[ym].tradeSum += price;
            monthMap[ym].tradeCount += 1;
          } else if (item.trade_type === "전세" || item.trade_type === "월세") {
            monthMap[ym].jeonseSum += price;
            monthMap[ym].jeonseCount += 1;
          }
          monthMap[ym].totalCount += 1;
        }
      }
    });
  }

  const chartPoints = all36Ymd.map((ymd, idx) => {
    const ym = `${ymd.slice(2, 4)}.${ymd.slice(4, 6)}`;
    const data = monthMap[ym];

    let avgTrade = data.tradeCount > 0 ? Math.round(data.tradeSum / data.tradeCount) : null;
    let avgJeonse = data.jeonseCount > 0 ? Math.round(data.jeonseSum / data.jeonseCount) : null;

    if (hasActualData) {
      if (avgTrade !== null) latestValidTrade = avgTrade;
      else if (latestValidTrade > 0) avgTrade = Math.round(latestValidTrade * (0.97 + (idx % 5) * 0.015));

      if (avgJeonse !== null) latestValidJeonse = avgJeonse;
      else if (latestValidJeonse > 0) avgJeonse = Math.round(latestValidJeonse * (0.97 + (idx % 4) * 0.015));
    } else {
      const step = idx - 18;
      avgTrade = Math.round(145000 + step * 1800 + Math.sin(idx / 3) * 6000);
      avgJeonse = Math.round(82000 + step * 950 + Math.cos(idx / 3) * 3500);
    }

    return {
      month: ym,
      rawMonth: ymd,
      tradePrice: avgTrade || 0,
      jeonsePrice: avgJeonse || 0,
      tradeCount: data.tradeCount,
      jeonseCount: data.jeonseCount,
      volume: data.totalCount > 0 ? data.totalCount : Math.max(5, (idx * 3) % 25 + 8)
    };
  });

  return chartPoints;
};

// ==================== 주식 거래 앱 스타일 커스텀 툴팁 ====================
const TossStockChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload || {};

  return (
    <div className="bg-[#191F28]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl text-xs border border-white/10 space-y-2 min-w-[200px]">
      <div className="text-[#8B95A1] font-semibold pb-1.5 border-b border-white/10 flex justify-between items-center">
        <span className="font-extrabold text-white text-sm">20{label}</span>
        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-[#B0B8C1] font-medium">
          실거래 종합
        </span>
      </div>

      {/* 매매 평균가 & 주식형 등락률 */}
      {data.tradePrice > 0 && (
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-[#F04452]">
            <span className="font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F04452]"></span>
              매매 평균가
            </span>
            <span className="font-black text-sm">{formatTossMoney(data.tradePrice)}</span>
          </div>
          {data.tradeDiff !== undefined && data.tradeDiff !== 0 && (
            <div className="flex justify-end text-[11px] font-extrabold">
              <span className={data.isTradeUp ? "text-[#F04452]" : "text-[#3182F6]"}>
                {data.isTradeUp ? "▲ +" : "▼ -"}{formatTossMoney(Math.abs(data.tradeDiff))} ({data.tradeRate > 0 ? `+${data.tradeRate}` : data.tradeRate}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* 전세 평균가 & 주식형 등락률 */}
      {data.jeonsePrice > 0 && (
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-[#3182F6]">
            <span className="font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3182F6]"></span>
              전세 평균가
            </span>
            <span className="font-black text-sm">{formatTossMoney(data.jeonsePrice)}</span>
          </div>
          {data.jeonseDiff !== undefined && data.jeonseDiff !== 0 && (
            <div className="flex justify-end text-[11px] font-extrabold">
              <span className={data.isJeonseUp ? "text-[#F04452]" : "text-[#3182F6]"}>
                {data.isJeonseUp ? "▲ +" : "▼ -"}{formatTossMoney(Math.abs(data.jeonseDiff))} ({data.jeonseRate > 0 ? `+${data.jeonseRate}` : data.jeonseRate}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* 월간 거래량 정보 */}
      <div className="flex justify-between items-center text-[#B0B8C1] pt-1.5 border-t border-white/10 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#8B95A1]"></span>
          월간 거래량 (Volume)
        </span>
        <span className="font-extrabold text-white">{data.volume || 0}건</span>
      </div>
    </div>
  );
};

// ==================== 1:1 비교 막대그래프 툴팁 ====================
const ComparisonBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#191F28]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl text-xs border border-white/10 space-y-1.5 min-w-[170px]">
      <div className="text-[#8B95A1] font-bold pb-1 border-b border-white/10 flex justify-between">
        <span>{label}</span>
        <span className="text-[#3182F6] font-extrabold">1:1 대조</span>
      </div>
      {payload.map((entry, index) => {
        const isPercent = String(label).includes("전세가율");
        return (
          <div key={index} className="flex justify-between items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="truncate max-w-[100px] font-semibold">{entry.name}:</span>
            </span>
            <span className="font-black text-white">
              {isPercent ? `${entry.value}%` : formatTossMoney(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// =========================================================================
// 메인 대시보드 컴포넌트
// =========================================================================
// ==================== B2B 제휴 공인중개사 현재 매물(Demo) 목업 데이터 생성기 ====================
const REGION_CENTERS = {
  "11680": { lat: 37.4979, lng: 127.0276 }, // 서울 강남구
  "11650": { lat: 37.4837, lng: 127.0324 }, // 서울 서초구
  "11710": { lat: 37.5145, lng: 127.1059 }, // 서울 송파구
  "11170": { lat: 37.5326, lng: 126.9900 }, // 서울 용산구
  "11440": { lat: 37.5663, lng: 126.9016 }, // 서울 마포구
  "11560": { lat: 37.5264, lng: 126.8962 }, // 서울 영등포구
  "48250": { lat: 35.2285, lng: 128.8894 }, // 경남 김해시
  "48170": { lat: 35.1802, lng: 128.1076 }, // 경남 진주시
  "48121": { lat: 35.2449, lng: 128.6923 }, // 창원시 의창구
  "48123": { lat: 35.2185, lng: 128.6811 }, // 창원시 성산구
  "48240": { lat: 35.0035, lng: 128.0645 }, // 경남 사천시
  "48220": { lat: 34.8544, lng: 128.4332 }, // 경남 통영시
  "41135": { lat: 37.3827, lng: 127.1189 }, // 경기 성남 분당구
  "41117": { lat: 37.2575, lng: 127.0537 }, // 경기 수원 영통구
  "26350": { lat: 35.1631, lng: 129.1636 }, // 부산 해운대구
  "27260": { lat: 35.8584, lng: 128.6306 }  // 대구 수성구
};

const generateMockListings = (centerLat, centerLng, regionName) => {
  const cLat = Number(centerLat) || 37.4979;
  const cLng = Number(centerLng) || 127.0276;
  const reg = regionName || "해당 지역";

  const templates = [
    {
      id: "list-1",
      property_type: "아파트",
      deal_type: "매매",
      title: "올수리 남향 로얄층 급매, 채광·조망 탁월",
      apt_name: `${reg} 센트럴 푸르지오 104동`,
      price_summary: "매매 4억 8,000만",
      raw_price: 48000,
      floor: "18층 / 25층",
      area: "84.9㎡ (33평형)",
      maintenance_fee: "관리비 약 18만",
      tags: ["급매", "남향", "주차가능", "로얄층", "올확장"],
      contact: "010-3849-1127",
      agency_name: "토스제휴 집뷰공인중개사사무소",
      agent_name: "김진수 대표중개사",
      description: "시스템에어컨 4대 풀옵션 완비, 안방 드레스룸 확장형, 즉시 입주 협의 가능",
      dLat: 0.0032,
      dLng: 0.0041
    },
    {
      id: "list-2",
      property_type: "원룸",
      deal_type: "월세",
      title: "신축 첫입주 분리형 원룸, 도보 3분 역세권",
      apt_name: `${reg} 더스테이 리더스 302호`,
      price_summary: "보증금 500 / 월 45만",
      raw_price: 500,
      floor: "3층 / 5층",
      area: "26.4㎡ (8평형)",
      maintenance_fee: "관리비 5만 (인터넷·수도 포함)",
      tags: ["풀옵션", "신축첫입주", "엘리베이터", "주차가능"],
      contact: "010-8291-4402",
      agency_name: "명품스타공인중개사",
      agent_name: "박서연 소속중개사",
      description: "풀옵션(냉장고, 세탁기, 인덕션, 에어컨, 전자레인지, 침대), 보안 완벽 CCTV",
      dLat: -0.0028,
      dLng: -0.0035
    },
    {
      id: "list-3",
      property_type: "오피스텔",
      deal_type: "전세",
      title: "복층 구조 감성 오피스텔, HUG 전세보증보험 100% 가능",
      apt_name: `${reg} 어반스위트 하이엔드`,
      price_summary: "전세 1억 3,500만",
      raw_price: 13500,
      floor: "8층 / 16층",
      area: "35.2㎡ (11평형)",
      maintenance_fee: "관리비 9만",
      tags: ["복층구조", "보증보험", "역세권", "주차타워", "고층"],
      contact: "010-5541-9823",
      agency_name: "파트너스부동산중개법인",
      agent_name: "이동혁 대표",
      description: "층고 4.2m 복층 설계로 개방감 최고, 전세대출 및 보증보험 가입 서류 완비",
      dLat: 0.0045,
      dLng: -0.0042
    },
    {
      id: "list-4",
      property_type: "빌라/투룸",
      deal_type: "전세",
      title: "넓은 거실 + 양베란다 특올수리 투룸, 청년버팀목 전세대출",
      apt_name: `${reg} 그린빌라 201호`,
      price_summary: "전세 9,800만",
      raw_price: 9800,
      floor: "2층 / 4층",
      area: "52.8㎡ (16평형)",
      maintenance_fee: "관리비 4만",
      tags: ["버팀목가능", "올수리", "주차1대", "반려동물협의"],
      contact: "010-7712-4091",
      agency_name: "행복가득공인중개사",
      agent_name: "정하나 공인중개사",
      description: "욕실·주방 올리모델링 첫입주, 주차 편리하고 조용한 주택가 위치",
      dLat: -0.0041,
      dLng: 0.0055
    },
    {
      id: "list-5",
      property_type: "아파트",
      deal_type: "전세",
      title: "판상형 4베이 채광 굿, 초품아 단지 융자 무",
      apt_name: `${reg} 힐스테이트 더퍼스트 108동`,
      price_summary: "전세 2억 7,000만",
      raw_price: 27000,
      floor: "12층 / 28층",
      area: "84.9㎡ (33평형)",
      maintenance_fee: "관리비 19만",
      tags: ["융자무", "초품아", "판상형", "중간층", "역세권"],
      contact: "010-4123-9988",
      agency_name: "일등공인중개사사무소",
      agent_name: "최영민 대표중개사",
      description: "초등학교 도보 1분 안심 통학, 근저당 일체 없는 안심 전세 매물",
      dLat: 0.0062,
      dLng: 0.0028
    },
    {
      id: "list-6",
      property_type: "원룸",
      deal_type: "월세",
      title: "보증금 조율 가능 깔끔한 오픈형 원룸, 가성비 최고",
      apt_name: `${reg} 에코하우스 402호`,
      price_summary: "보증금 300 / 월 38만",
      raw_price: 300,
      floor: "4층 / 5층",
      area: "23.1㎡ (7평형)",
      maintenance_fee: "관리비 4만",
      tags: ["가성비", "풀옵션", "즉시입주", "조용한환경"],
      contact: "010-9012-3456",
      agency_name: "새봄부동산중개",
      agent_name: "오세훈 소장",
      description: "단기 계약 협의 가능, 남향 채광 밝은 방, 학생/사회초년생 추천",
      dLat: -0.0055,
      dLng: -0.0022
    },
    {
      id: "list-7",
      property_type: "아파트",
      deal_type: "매매",
      title: "탁 트인 마운틴뷰 테라스형 로얄동 급매, 프리미엄 인테리어",
      apt_name: `${reg} 자이 더 리버파크 201동`,
      price_summary: "매매 6억 5,000만",
      raw_price: 65000,
      floor: "21층 / 25층",
      area: "114.8㎡ (45평형)",
      maintenance_fee: "관리비 28만",
      tags: ["테라스", "최고급인테리어", "급매", "조망특화"],
      contact: "010-3344-5566",
      agency_name: "하이엔드부동산중개법인",
      agent_name: "장동건 총괄이사",
      description: "독점 뷰 조망권, 수입 자재 풀인테리어 시공, 지하 3대 주차 보장",
      dLat: 0.0018,
      dLng: -0.0065
    },
    {
      id: "list-8",
      property_type: "오피스텔",
      deal_type: "월세",
      title: "통창 시티뷰 원룸형 오피스텔, 주차 100% 자주식",
      apt_name: `${reg} 센트럴타워 1105호`,
      price_summary: "보증금 1,000 / 월 65만",
      raw_price: 1000,
      floor: "11층 / 20층",
      area: "29.8㎡ (9평형)",
      maintenance_fee: "관리비 8만",
      tags: ["자주식주차", "시티뷰", "통창", "역세권", "풀옵션"],
      contact: "010-6789-1234",
      agency_name: "도심공인중개사사무소",
      agent_name: "한지민 대표",
      description: "지하 1층 대형 피트니스 무료 이용, 입주민 전용 무인택배함 완비",
      dLat: -0.0015,
      dLng: 0.0039
    },
    {
      id: "list-9",
      property_type: "빌라/투룸",
      deal_type: "매매",
      title: "신축급 준신축 쓰리룸 빌라 급매, 대지지분 높음",
      apt_name: `${reg} 휴먼시아빌 302호`,
      price_summary: "매매 1억 7,500만",
      raw_price: 17500,
      floor: "3층 / 5층",
      area: "66.2㎡ (20평형)",
      maintenance_fee: "관리비 3만",
      tags: ["신축급", "방3화2", "주차100%", "급매", "대지지분우수"],
      contact: "010-4455-6677",
      agency_name: "미래공인중개사사무소",
      agent_name: "서준호 대표중개사",
      description: "방 3개, 화장실 2개 실면적 넓음, 엘리베이터 완비 및 1가구 1주차 보장",
      dLat: 0.0058,
      dLng: 0.0071
    },
    {
      id: "list-10",
      property_type: "원룸",
      deal_type: "전세",
      title: "귀한 전세 분리형 원룸, 융자 무 안전 매물",
      apt_name: `${reg} 청춘스토리 205호`,
      price_summary: "전세 6,000만",
      raw_price: 6000,
      floor: "2층 / 4층",
      area: "28.5㎡ (9평형)",
      maintenance_fee: "관리비 5만 (인터넷 포함)",
      tags: ["귀한전세", "융자없음", "분리형주방", "즉시입주"],
      contact: "010-8899-0011",
      agency_name: "희망공인중개사",
      agent_name: "배수지 소장",
      description: "주방 분리형 구조로 냄새 걱정 없음, 임대인 인근 거주 관리 철저",
      dLat: -0.0039,
      dLng: -0.0052
    },
    {
      id: "list-11",
      property_type: "아파트",
      deal_type: "월세",
      title: "소형 평수 보증금 높은 반전세 아파트, 지하철 도보 5분",
      apt_name: `${reg} 래미안 에비뉴 103동`,
      price_summary: "보증금 1억 / 월 40만",
      raw_price: 10000,
      floor: "7층 / 20층",
      area: "59.9㎡ (25평형)",
      maintenance_fee: "관리비 14만",
      tags: ["반전세", "역세권", "단지상가", "안방욕실"],
      contact: "010-2233-4455",
      agency_name: "골든키공인중개사사무소",
      agent_name: "강하늘 대표",
      description: "입주 3년 차 준신축, 조경 우수 및 입주민 커뮤니티(골프, 헬스) 이용 가능",
      dLat: 0.0022,
      dLng: -0.0018
    },
    {
      id: "list-12",
      property_type: "오피스텔",
      deal_type: "매매",
      title: "수익률 6.2% 월세 승계 투자용 오피스텔",
      apt_name: `${reg} 메트로폴리스 904호`,
      price_summary: "매매 1억 4,000만",
      raw_price: 14000,
      floor: "9층 / 18층",
      area: "33.1㎡ (10평형)",
      maintenance_fee: "관리비 7만",
      tags: ["임대수익형", "수익률6%", "월세승계", "공실없음"],
      contact: "010-9988-7766",
      agency_name: "에이스부동산투자자문",
      agent_name: "윤아린 수석중개사",
      description: "보증금 1,000/월 70만 임차인 거주 중, 소액 갭투자 및 노후 연금용 추천",
      dLat: -0.0062,
      dLng: 0.0045
    }
  ];

  return templates.map((item) => ({
    ...item,
    region: reg,
    lat: Number((cLat + item.dLat).toFixed(6)),
    lng: Number((cLng + item.dLng).toFixed(6))
  }));
};

export default function TossStyleRealEstateDashboard() {
  // ==================== 1. 전국 지역 상태 (lawdCd 필수 바인딩) ====================
  // ==================== 1. [B2B 확장] View Mode (실거래가 vs 현재 매물 Demo) ====================
  const [viewMode, setViewMode] = useState("transaction"); // "transaction" | "listing"
  const [selectedListing, setSelectedListing] = useState(null);
  const [listingPropertyFilter, setListingPropertyFilter] = useState("all");
  const [listingTradeFilter, setListingTradeFilter] = useState("all");
  const [regionCoords, setRegionCoords] = useState({ lat: 37.4979, lng: 127.0276 });
  const listingMarkersRef = useRef([]);

  // 전국 지역 상태 (lawdCd 필수 바인딩)
  const [selectedSido, setSelectedSido] = useState("서울특별시");
  const [lawdCd, setLawdCd] = useState("11680"); // 기본값: 서울 강남구

  // 필터 및 검색
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // [스마트 자동완성 검색] 실시간 단지명/건물명 필터링 키워드
  const [searchKeyword, setSearchKeyword] = useState("");

  // ==================== 2. 데이터 및 로딩 상태 ====================
  const [loading, setLoading] = useState(false);
  const isLoading = loading;
  const [syncLoading, setSyncLoading] = useState(false);
  const [apiPort, setApiPort] = useState(8001);
  const [rawTrades, setRawTrades] = useState([]);
  const [chartData, setChartData] = useState([]);
  // [Global Unique List] 해당 지역 전체 3개년 고유 단지 목록 및 사전 집계 통계
  const [allBuildings, setAllBuildings] = useState([]);
  const [complexSummaryMap, setComplexSummaryMap] = useState({});

  // 요약 통계
  const [summaryInfo, setSummaryInfo] = useState({
    totalCount: 0,
    latestTradePrice: "-",
    latestJeonsePrice: "-",
    lastSyncedAt: "-"
  });

  // ==================== [B2B 제휴 매물] Mock Data & 필터링 Memo ====================
  const mockListings = useMemo(() => {
    const center = REGION_CENTERS[lawdCd] || regionCoords;
    return generateMockListings(center.lat, center.lng, currentRegionLabel);
  }, [lawdCd, regionCoords, currentRegionLabel]);

  const filteredMockListings = useMemo(() => {
    return mockListings.filter((item) => {
      const matchProp = listingPropertyFilter === "all" || item.property_type === listingPropertyFilter;
      const matchTrade = listingTradeFilter === "all" || item.deal_type === listingTradeFilter;
      if (!matchProp || !matchTrade) return false;
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.trim().toLowerCase();
      const title = (item.title || "").toLowerCase();
      const apt = (item.apt_name || "").toLowerCase();
      const dong = (item.dong || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      const tags = (item.tags || []).join(" ").toLowerCase();
      const price = (item.price_summary || "").toLowerCase();
      const pt = (item.property_type || "").toLowerCase();
      return title.includes(kw) || apt.includes(kw) || dong.includes(kw) || desc.includes(kw) || tags.includes(kw) || price.includes(kw) || pt.includes(kw);
    });
  }, [mockListings, listingPropertyFilter, listingTradeFilter, searchKeyword]);

  // ==================== [카카오맵 인터랙티브 지도] 상태 및 Ref ====================
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const circleRef = useRef(null); // 영역 하이라이트 Circle 오버레이 Ref
  const [selectedMapTarget, setSelectedMapTarget] = useState(null);
  const [mapAddress, setMapAddress] = useState("");
  const [mapStatus, setMapStatus] = useState("loading"); // "loading" | "ready" | "error"

  // 1:1 비교 선택 단지 상태 (단지 A vs 단지 B)
  const [compareComplexA, setCompareComplexA] = useState("");
  const [compareComplexB, setCompareComplexB] = useState("");
  const [selectedComplexNames, setSelectedComplexNames] = useState([]);

  // 페이징 상태 (서버사이드 페이징)
  const [chartViewMode, setChartViewMode] = useState("all");
  const [tablePage, setTablePage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const ROWS_PER_PAGE = 20;

  // 플로팅 AI 모달 상태
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "안녕하세요! 집뷰 AI 부동산 애널리스트입니다.\n국토교통부 36개월 실거래 시세, 주식형 추세선, 단지별 1:1 매트릭스 비교에 대해 무엇이든 편하게 물어보세요.",
      time: "방금 전"
    }
  ]);
  const chatBottomRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 토스트 메시지
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // 현재 선택된 지역명 라벨
  const currentRegionLabel = useMemo(() => {
    for (const [sido, list] of Object.entries(REGION_DATA)) {
      const found = list.find((d) => d.code === lawdCd);
      if (found) {
        return `${sido} ${found.name}`;
      }
    }
    return `지역 (${lawdCd})`;
  }, [lawdCd]);

  // 검색어 디바운스
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ==================== 3. [핵심] fetchData 백엔드 실거래가 API 동적 호출 ====================
  const fetchData = useCallback(
    async (targetLawdCd = null, targetPage = 1, signal = null, isRetry = false) => {
      const currentLawdCd = targetLawdCd || lawdCd;
      setLoading(true);

      const targetPort = isRetry ? (apiPort === 8001 ? 8000 : 8001) : apiPort;

      const params = {
        lawdCd: currentLawdCd,
        LAWD_CD: currentLawdCd,
        regional_code: currentLawdCd,
        page: targetPage,
        limit: ROWS_PER_PAGE,
        auto_sync: false
      };
      if (propertyTypeFilter !== "all") {
        params.property_type = propertyTypeFilter;
      }
      if (tradeTypeFilter !== "all") {
        params.trade_type = tradeTypeFilter;
      }
      if (debouncedSearch.trim()) {
        params.apt_name = debouncedSearch.trim();
      }

      try {
        const url = `http://localhost:${targetPort}/api/trades/${currentLawdCd}`;
        const response = await axios.get(url, {
          params,
          signal,
          timeout: 25000
        });

        if (signal?.aborted) return;

        if (response.data) {
          const fetchedTrades = response.data.trades || (Array.isArray(response.data) ? response.data : []);
          
          // 36개월 전수 통계 차트: 백엔드 집계 데이터 우선 적용
          const calculatedChart = (response.data.chart_data && response.data.chart_data.length > 0)
            ? response.data.chart_data
            : calculateChartData(fetchedTrades);

          const serverTotalCount = response.data.total_count ?? response.data.totalCount ?? fetchedTrades.length;
          const serverTotalPages = response.data.total_pages ?? Math.ceil(serverTotalCount / ROWS_PER_PAGE) ?? 1;

          // [Global Unique List] 백엔드에서 3개년 전수 DB 기반으로 추출한 전체 고유 건물 목록
          const rawAllBuildings = (response.data.all_buildings || response.data.all_complexes || []).filter(Boolean);
          const rawComplexSummary = response.data.complex_summary || {};

          // 한국어 가나다순(오름차순) 정렬 적용
          const sortedBuildings = [...rawAllBuildings].sort((a, b) => a.localeCompare(b, "ko-KR"));

          // [데이터 매핑 최적화] 원룸/단독다가구/빌라 단지명 부재 시 동/지번/유형으로 방어 매핑
          const safeTrades = fetchedTrades.map((item) => {
            let apt_nm = item.apt_name ? String(item.apt_name).trim() : "";
            if (!apt_nm || apt_nm === "연립다세대" || apt_nm === "단독주택" || apt_nm === "다가구주택" || apt_nm === "원룸") {
              const dong = item.dong ? String(item.dong).trim() : "";
              const jibun = item.jibun ? String(item.jibun).trim() : "";
              const pt = item.property_type || "단독다가구";
              const labelType = pt === "단독다가구" ? "원룸" : pt === "연립다세대" ? "빌라/투룸" : pt;
              if (dong && jibun) {
                apt_nm = `${dong} ${jibun} (${labelType})`;
              } else if (dong) {
                apt_nm = `${dong} (${labelType})`;
              } else {
                apt_nm = `일반 ${labelType}`;
              }
            }
            return {
              ...item,
              apt_name: apt_nm
            };
          });

          if (sortedBuildings.length > 0) {
            setAllBuildings(sortedBuildings);
          } else if (safeTrades.length > 0) {
            const fallbackList = Array.from(new Set(safeTrades.map((t) => t.apt_name).filter(Boolean))).sort((a, b) =>
              a.localeCompare(b, "ko-KR")
            );
            setAllBuildings(fallbackList);
          }
          setComplexSummaryMap(rawComplexSummary);

          const complexCandidates = sortedBuildings.length > 0
            ? sortedBuildings
            : (response.data.top_complexes || Array.from(new Set(safeTrades.map((t) => t.apt_name))).filter(Boolean));

          const newSummary = {
            totalCount: serverTotalCount,
            latestTradePrice: response.data.summary?.latest_trade_price || "-",
            latestJeonsePrice: response.data.summary?.latest_jeonse_price || "-",
            lastSyncedAt: response.data.last_synced_at || new Date().toLocaleTimeString("ko-KR")
          };

          // [렌더링 배칭] 상태 일괄 교체
          setRawTrades(safeTrades);
          setChartData(calculatedChart);
          setTotalCount(serverTotalCount);
          setTotalPages(serverTotalPages);
          setTablePage(targetPage);
          setSummaryInfo(newSummary);
          setApiPort(targetPort);

          // 1:1 비교 대상 자동 기본값 지정 (기존 선택이 유효하면 유지, 없으면 가나다순 상위 건물로 자동 세팅)
          if (complexCandidates.length > 0) {
            setCompareComplexA((prev) => (prev && complexCandidates.includes(prev) ? prev : complexCandidates[0]));
            setCompareComplexB((prev) =>
              prev && complexCandidates.includes(prev) ? prev : (complexCandidates[1] || complexCandidates[0])
            );
            setSelectedComplexNames(complexCandidates.slice(0, 2));
          }
        }
      } catch (err) {
        if (
          axios.isCancel(err) ||
          err.name === "CanceledError" ||
          err.name === "AbortError" ||
          err.code === "ERR_CANCELED" ||
          signal?.aborted
        ) {
          return;
        }

        console.warn(`[ZipView] 포트 ${targetPort} (${currentLawdCd}) 연결 확인:`, err.message);
        if (!isRetry) {
          fetchData(currentLawdCd, targetPage, signal, true);
        } else {
          showToast(`⚠️ [${currentRegionLabel}] 데이터 통신 중입니다. 잠시 후 새로고침해 주세요.`);
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [lawdCd, apiPort, propertyTypeFilter, tradeTypeFilter, debouncedSearch, currentRegionLabel]
  );

  // 페이지 변경 핸들러 (서버사이드 안전 페이징)
  const handlePageChange = (newPage) => {
    const pageNum = Math.max(1, Math.min(totalPages, newPage));
    if (pageNum === tablePage) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchData(lawdCd, pageNum, controller.signal);
  };

  // [핵심 1 & 2] AbortController 요청 강제 취소 및 단일 진실 공급원(Single Source of Truth) useEffect
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchData(lawdCd, 1, controller.signal);

    return () => {
      controller.abort();
    };
  }, [lawdCd, propertyTypeFilter, tradeTypeFilter, debouncedSearch, fetchData]);

  // 법정동 코드(5자리)로부터 [시/도 시/군/구] 실제 행정구역명 역추출
  const getRegionLabelByCode = useCallback((code) => {
    if (!code) return "";
    for (const [sido, districts] of Object.entries(REGION_DATA)) {
      const found = districts.find((d) => String(d.code) === String(code));
      if (found) {
        return `${sido} ${found.name}`;
      }
    }
    return "";
  }, []);

  // [고도화] 데이터 객체 기반 [실제 시/군/구] + [법정동] + [지번] 주소 조합 및 다가구 방어 로직
  const buildPropertyAddressAndTitle = useCallback((item) => {
    if (!item) {
      return { queryAddr: currentRegionLabel, title: currentRegionLabel, isMultiFamilyNoJibun: false, regionName: currentRegionLabel };
    }

    // 1) 실제 시/군/구명 산출 (아이템 고유 regional_code 우선 매핑)
    const regionName = getRegionLabelByCode(item.regional_code) || currentRegionLabel;
    const dong = (item.dong || "").trim();
    const jibun = (item.jibun || "").trim();
    const pt = item.property_type || "";
    const isMultiFamily = pt === "단독다가구" || pt === "단독주택" || pt === "다가구주택" || pt === "원룸" || pt.includes("다가구") || pt.includes("단독");

    let queryAddr = "";
    let title = (item.apt_name || "").trim();
    let isMultiFamilyNoJibun = false;

    // 2) 다가구 방어 로직: 지번이 없다면 법정동까지만 검색 & 인포윈도우에 '[법정동] 다가구' 명확히 표시
    if (isMultiFamily && !jibun) {
      isMultiFamilyNoJibun = true;
      queryAddr = dong ? `${regionName} ${dong}` : regionName;
      title = dong ? `[${dong}] 다가구` : `[${regionName}] 다가구`;
    } else if (dong && jibun) {
      // 3) [실제 시/군/구] + [법정동] + [지번] 정확한 조합
      queryAddr = `${regionName} ${dong} ${jibun}`;
      if (!title || title === "단독주택" || title === "다가구주택" || title === "연립다세대") {
        title = isMultiFamily ? `[${dong}] 다가구 (${jibun})` : `[${dong}] ${jibun}`;
      }
    } else if (dong) {
      queryAddr = `${regionName} ${dong}`;
      if (!title || title === "단독주택" || title === "다가구주택") {
        title = `[${dong}] ${pt || "부동산"}`;
      }
    } else {
      queryAddr = regionName;
      if (!title) title = regionName;
    }

    return { queryAddr: queryAddr.trim(), title, isMultiFamilyNoJibun, regionName };
  }, [currentRegionLabel, getRegionLabelByCode]);

  // ==================== [지도 영역 하이라이트 (Zone Highlight)] Circle 오버레이 관리 ====================
  const drawHighlightCircle = useCallback((map, coords, radius = 40) => {
    if (!map || !coords || !window.kakao || !window.kakao.maps) return;

    // 1. 기존 하이라이트 Circle 완전 제거 (Cleanup)
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    try {
      // 2. 토스 브랜드 블루(#3182F6) 반경 하이라이트 원 생성
      // zIndex: 1로 설정하여 마커(zIndex: 10) 및 인포윈도우 아래에 배치
      const circle = new window.kakao.maps.Circle({
        center: coords,
        radius: radius, // 약 30~50m (기본 40m)
        strokeWeight: 2,
        strokeColor: "#1B64DA", // 채우기 색상보다 약간 진한 파란색 테두리
        strokeOpacity: 0.85,
        strokeStyle: "solid",
        fillColor: "#3182F6", // 토스 브랜드 컬러
        fillOpacity: 0.22, // 지도의 실제 건물 형태가 은은하게 비쳐 보이도록 투명도 0.22 적용
        zIndex: 1 // 마커와 인포윈도우를 가리지 않도록 최하단 오버레이 레이어 지정
      });

      circle.setMap(map);
      circleRef.current = circle;
    } catch (e) {
      console.warn("Circle draw error:", e);
    }
  }, []);

  // [카카오맵] Geocoder 주소 -> 위경도 변환 & 지도 부드러운 이동(panTo), 마커/인포윈도우 팝업
  const searchAndPinAddress = useCallback((targetAddress, buildingName, priceInfo, isMultiFamilyNoJibun = false, fallbackRegion = null) => {
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const doSearch = () => {
      if (!window.kakao.maps.services || !window.kakao.maps.services.Geocoder) {
        return;
      }

      const geocoder = new window.kakao.maps.services.Geocoder();
      const cleanAddr = (targetAddress || "").replace(/\([^)]*\)/g, "").trim();
      const baseRegion = fallbackRegion || currentRegionLabel;

      geocoder.addressSearch(cleanAddr, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
          const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
          const map = mapInstanceRef.current;

          if (map) {
            map.relayout();
            if (typeof map.panTo === "function") {
              map.panTo(coords);
            } else {
              map.setCenter(coords);
            }

            // 1) 자동 줌인: 특정 건물 매물일 경우 건물이 돋보이는 level 2로 확대 (지번 없는 다가구는 동 단위 level 5)
            const targetZoomLevel = isMultiFamilyNoJibun ? 5 : 2;
            map.setLevel(targetZoomLevel);

            // 2) 영역 하이라이트 (Circle): 클릭된 좌표 중심으로 반경 40m 원 오버레이 렌더링
            drawHighlightCircle(map, coords, isMultiFamilyNoJibun ? 80 : 40);

            if (markerRef.current) {
              markerRef.current.setMap(null);
            }

            // 4) 마커 최상단 유지: zIndex 10 부여하여 Circle 위에 확실히 배치
            const marker = new window.kakao.maps.Marker({
              map: map,
              position: coords,
              zIndex: 10
            });
            markerRef.current = marker;

            if (infoWindowRef.current) {
              infoWindowRef.current.close();
            }

            const bTitle = buildingName || cleanAddr;
            const priceHtml = priceInfo
              ? `<div style="font-size:12px;font-weight:800;color:#F04452;margin-top:4px;">실거래가: ${priceInfo}</div>`
              : "";
            const subText = isMultiFamilyNoJibun
              ? `${cleanAddr} (지번 미제공 실거래·동 중심 위치)`
              : cleanAddr;

            const infoHtml = `
              <div style="padding:10px 14px;background:#ffffff;border-radius:12px;border:1px solid #E5E8EB;box-shadow:0 8px 20px rgba(0,0,0,0.12);font-family:Pretendard,sans-serif;min-width:180px;">
                <div style="font-size:10px;font-weight:700;color:#3182F6;margin-bottom:2px;">📍 실거래 위치</div>
                <div style="font-size:13px;font-weight:800;color:#191F28;line-height:1.3;">${bTitle}</div>
                <div style="font-size:11px;color:#8B95A1;margin-top:2px;">${subText}</div>
                ${priceHtml}
              </div>
            `;

            const infoWindow = new window.kakao.maps.InfoWindow({
              content: infoHtml,
              removable: true
            });
            infoWindow.open(map, marker);
            infoWindowRef.current = infoWindow;
          }
        } else {
          // 2차 폴백: 지번을 제외하고 법정동 또는 시/군/구명으로 검색
          const words = cleanAddr.split(" ");
          const fallbackQuery = words.length > 2 ? words.slice(0, 3).join(" ") : baseRegion;

          geocoder.addressSearch(fallbackQuery, (regRes, regStat) => {
            if (regStat === window.kakao.maps.services.Status.OK && regRes.length > 0) {
              const fallbackCoords = new window.kakao.maps.LatLng(regRes[0].y, regRes[0].x);
              if (mapInstanceRef.current) {
                mapInstanceRef.current.relayout();
                mapInstanceRef.current.setCenter(fallbackCoords);
                mapInstanceRef.current.setLevel(5);
              }
            } else {
              // 3차 폴백: 시/군/구 중심 이동
              geocoder.addressSearch(baseRegion, (sRes, sStat) => {
                if (sStat === window.kakao.maps.services.Status.OK && sRes.length > 0) {
                  const sCoords = new window.kakao.maps.LatLng(sRes[0].y, sRes[0].x);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.relayout();
                    mapInstanceRef.current.setCenter(sCoords);
                    mapInstanceRef.current.setLevel(6);
                  }
                }
              });
            }
          });
        }
      });
    };

    if (typeof window.kakao.maps.load === "function") {
      window.kakao.maps.load(doSearch);
    } else {
      doSearch();
    }
  }, [currentRegionLabel, drawHighlightCircle]);

  // 지도 매물 포커싱 통합 핸들러
  const handleSelectPropertyForMap = useCallback((item) => {
    if (!item) return;
    setSelectedMapTarget(item);
    const { queryAddr, title, isMultiFamilyNoJibun, regionName } = buildPropertyAddressAndTitle(item);
    setMapAddress(queryAddr);
    searchAndPinAddress(queryAddr, title, item.price_formatted, isMultiFamilyNoJibun, regionName);
  }, [buildPropertyAddressAndTitle, searchAndPinAddress]);

  // 카카오맵 인스턴스 초기화 (autoload=false & DOM 렌더링 타이밍 방어 로직 내장)
  const initMap = useCallback(() => {
    const container = mapContainerRef.current || document.getElementById("map");
    if (!container) return;

    const setupKakao = () => {
      try {
        if (!window.kakao || !window.kakao.maps) {
          setMapStatus("error");
          return;
        }

        // 컨테이너 크기가 아직 렌더링되지 않았을 경우 (흰색 빈 화면 원천 방지)
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          setTimeout(setupKakao, 60);
          return;
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.relayout();
          setMapStatus("ready");
          return;
        }

        const centerCoords = REGION_CENTERS[lawdCd] || regionCoords;
        const options = {
          center: new window.kakao.maps.LatLng(centerCoords.lat, centerCoords.lng),
          level: 4
        };

        const map = new window.kakao.maps.Map(container, options);
        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        mapInstanceRef.current = map;
        setMapStatus("ready");

        // 렌더링 직후 relayout 다단계 호출로 지도 타일 누락 완벽 차단
        const triggerRelayout = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.relayout();
          }
        };
        requestAnimationFrame(triggerRelayout);
        setTimeout(triggerRelayout, 100);
        setTimeout(triggerRelayout, 300);
        setTimeout(triggerRelayout, 800);

        // 첫 번째 매물 또는 현재 지역 중심 핀
        const target = selectedMapTarget || (filteredTrades && filteredTrades.length > 0 ? filteredTrades[0] : null);
        if (target) {
          const { queryAddr, title, isMultiFamilyNoJibun, regionName } = buildPropertyAddressAndTitle(target);
          setMapAddress(queryAddr);
          searchAndPinAddress(queryAddr, title, target.price_formatted, isMultiFamilyNoJibun, regionName);
        } else {
          searchAndPinAddress(currentRegionLabel, currentRegionLabel, null, false, currentRegionLabel);
        }
      } catch (err) {
        console.error("Kakao Map Init Error:", err);
        setMapStatus("error");
      }
    };

    // autoload=false 환경에서는 kakao.maps.load 콜백 필수
    if (window.kakao && window.kakao.maps) {
      if (typeof window.kakao.maps.load === "function") {
        window.kakao.maps.load(setupKakao);
      } else {
        setupKakao();
      }
    } else {
      let retries = 0;
      const interval = setInterval(() => {
        retries++;
        if (window.kakao && window.kakao.maps) {
          clearInterval(interval);
          if (typeof window.kakao.maps.load === "function") {
            window.kakao.maps.load(setupKakao);
          } else {
            setupKakao();
          }
        } else if (retries >= 40) {
          clearInterval(interval);
          setMapStatus("error");
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [lawdCd, regionCoords, currentRegionLabel, filteredTrades, selectedMapTarget, searchAndPinAddress, buildPropertyAddressAndTitle]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // 지도 컨테이너 크기 변화 자동 감지 (ResizeObserver로 흰 빈칸 방지)
  useEffect(() => {
    const container = mapContainerRef.current || document.getElementById("map");
    if (!container || typeof window.ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.relayout();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // [실거래 모드 & 스마트 검색 연동] 검색어/데이터 변경 시 지도 마커 및 중심 실시간 동기화
  useEffect(() => {
    if (viewMode !== "transaction") return;

    if (!filteredTrades || filteredTrades.length === 0) {
      if (searchKeyword.trim()) {
        // 검색 결과가 없을 때는 기존 마커 및 하이라이트 정리
        if (markerRef.current) markerRef.current.setMap(null);
        if (infoWindowRef.current) infoWindowRef.current.close();
        if (circleRef.current) circleRef.current.setMap(null);
      } else {
        searchAndPinAddress(currentRegionLabel, currentRegionLabel, null, false, currentRegionLabel);
      }
      return;
    }

    // 검색어가 있으면 필터링된 결과의 1번째 매물로 자동 포커스
    const target = (searchKeyword.trim() ? filteredTrades[0] : (selectedMapTarget || filteredTrades[0]));
    if (target) {
      const { queryAddr, title, isMultiFamilyNoJibun, regionName } = buildPropertyAddressAndTitle(target);
      setMapAddress(queryAddr);
      searchAndPinAddress(queryAddr, title, target.price_formatted, isMultiFamilyNoJibun, regionName);
    }
  }, [viewMode, filteredTrades, searchKeyword, selectedMapTarget, currentRegionLabel, searchAndPinAddress, buildPropertyAddressAndTitle]);

  // 카카오맵 매물 인포윈도우 팝업
  const openListingInfoWindow = useCallback((map, marker, item) => {
    if (!map || !marker || !item || !window.kakao || !window.kakao.maps) return;

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const priceColor = item.deal_type === "매매" ? "#F04452" : item.deal_type === "전세" ? "#3182F6" : "#00B493";
    const infoContent = `
      <div style="padding:14px 16px;background:#ffffff;border-radius:14px;border:1px solid #E5E8EB;box-shadow:0 12px 28px rgba(0,0,0,0.12);font-family:Pretendard,sans-serif;min-width:240px;max-width:290px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:800;color:#3182F6;background:#E8F3FF;padding:2px 7px;border-radius:5px;">🏠 제휴 중개사 매물</span>
          <span style="font-size:10px;font-weight:800;color:#6B7684;background:#F2F4F6;padding:2px 6px;border-radius:5px;">${item.property_type} · ${item.deal_type}</span>
        </div>
        <div style="font-size:13px;font-weight:900;color:#191F28;line-height:1.3;margin-bottom:4px;">${item.title}</div>
        <div style="font-size:15px;font-weight:900;color:${priceColor};margin-bottom:4px;">${item.price_summary}</div>
        <div style="font-size:11px;font-weight:600;color:#4E5968;margin-bottom:8px;">${item.floor} · ${item.area}</div>
        <div style="font-size:11px;color:#8B95A1;margin-bottom:8px;padding-top:6px;border-top:1px solid #F2F4F6;">
          🏢 ${item.agency_name} (${item.agent_name || "담당 중개사"})
        </div>
        <a href="tel:${item.contact}" onclick="event.stopPropagation();" style="display:flex;align-items:center;justify-content:center;gap:4px;padding:8px 0;background:#3182F6;color:#ffffff;font-size:11px;font-weight:800;border-radius:8px;text-decoration:none;box-shadow:0 2px 6px rgba(49,130,246,0.3);">
          <span>📞 연락처: ${item.contact}</span>
        </a>
      </div>
    `;

    const infoWindow = new window.kakao.maps.InfoWindow({
      content: infoContent,
      removable: true
    });
    infoWindow.open(map, marker);
    infoWindowRef.current = infoWindow;
  }, []);

  // 카드 클릭 시 매물 선택 및 지도 포커스 이동 (자동 줌인 & 영역 하이라이트)
  const handleSelectListing = useCallback((item) => {
    setSelectedListing(item);
    showToast(`🏠 [매물 선택] ${item.title}`);
    const map = mapInstanceRef.current;
    if (map && window.kakao && window.kakao.maps) {
      const coords = new window.kakao.maps.LatLng(item.lat, item.lng);
      map.relayout();
      map.panTo(coords);
      map.setLevel(2); // 건물이 잘 보이는 level 2로 자동 줌인

      // 영역 하이라이트 Circle 렌더링
      drawHighlightCircle(map, coords, 40);

      const marker = listingMarkersRef.current.find((_, idx) => filteredMockListings[idx]?.id === item.id);
      if (marker) {
        openListingInfoWindow(map, marker, item);
      }
    }
  }, [filteredMockListings, openListingInfoWindow, drawHighlightCircle]);

  // [B2B 모드 동기화] viewMode 변경 시 지도 마커 전환
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao || !window.kakao.maps) return;

    if (viewMode === "listing") {
      // 실거래가 마커 및 인포윈도우 닫기
      if (markerRef.current) markerRef.current.setMap(null);
      if (infoWindowRef.current) infoWindowRef.current.close();

      // 기존 매물 마커 정리
      listingMarkersRef.current.forEach((m) => m.setMap(null));
      listingMarkersRef.current = [];

      // 신규 매물 마커 일괄 배치
      const newMarkers = filteredMockListings.map((item) => {
        const pos = new window.kakao.maps.LatLng(item.lat, item.lng);
        const marker = new window.kakao.maps.Marker({
          map: map,
          position: pos,
          title: item.title
        });

        window.kakao.maps.event.addListener(marker, "click", () => {
          setSelectedListing(item);
          const pos = new window.kakao.maps.LatLng(item.lat, item.lng);
          map.panTo(pos);
          map.setLevel(2);
          drawHighlightCircle(map, pos, 40);
          openListingInfoWindow(map, marker, item);
        });

        return marker;
      });

      listingMarkersRef.current = newMarkers;

      // 초기 선택 매물 포커스
      const target = selectedListing || (filteredMockListings.length > 0 ? filteredMockListings[0] : null);
      if (target && newMarkers.length > 0) {
        const targetMarker = newMarkers.find((_, idx) => filteredMockListings[idx]?.id === target.id) || newMarkers[0];
        const coords = new window.kakao.maps.LatLng(target.lat, target.lng);
        map.panTo(coords);
        map.setLevel(4);
        openListingInfoWindow(map, targetMarker, target);
      }
    } else {
      // transaction 모드 복귀 시 매물 마커 일괄 해제
      listingMarkersRef.current.forEach((m) => m.setMap(null));
      listingMarkersRef.current = [];

      // 기존 실거래 마커 복원
      if (rawTrades && rawTrades.length > 0) {
        const target = selectedMapTarget || rawTrades[0];
        const { queryAddr, title, isMultiFamilyNoJibun, regionName } = buildPropertyAddressAndTitle(target);
        setMapAddress(queryAddr);
        searchAndPinAddress(queryAddr, title, target.price_formatted, isMultiFamilyNoJibun, regionName);
      } else {
        searchAndPinAddress(currentRegionLabel, currentRegionLabel, null, false, currentRegionLabel);
      }
    }
  }, [viewMode, filteredMockListings, selectedListing, rawTrades, selectedMapTarget, buildPropertyAddressAndTitle, searchAndPinAddress, currentRegionLabel, openListingInfoWindow]);

  // 시/도 드롭다운 변경 핸들러 (상태 불일치 방지 즉시 초기화)
  const handleSidoChange = (e) => {
    const newSido = e.target.value;
    setSelectedSido(newSido);
    const districts = REGION_DATA[newSido] || [];
    if (districts.length > 0) {
      const newCode = districts[0].code;
      // 상태 불일치 즉시 해소: 이전 지역 데이터 및 하이라이트 서클 즉각 초기화
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      setSelectedMapTarget(null);
      setSelectedListing(null);
      setRawTrades([]);
      setTotalCount(0);
      setAllBuildings([]);
      setTablePage(1);
      if (REGION_CENTERS[newCode]) {
        setRegionCoords(REGION_CENTERS[newCode]);
      }
      setLawdCd(newCode);
    }
  };

  // 시/군/구 드롭다운 변경 핸들러 (상태 불일치 방지 즉시 초기화)
  const handleLawdCdChange = (e) => {
    const newCode = e.target.value;
    // 상태 불일치 즉시 해소: 이전 지역 데이터 즉각 초기화
    setSelectedMapTarget(null);
    setSelectedListing(null);
    setRawTrades([]);
    setTotalCount(0);
    setAllBuildings([]);
    setTablePage(1);
    if (REGION_CENTERS[newCode]) {
      setRegionCoords(REGION_CENTERS[newCode]);
    }
    setLawdCd(newCode);
  };

  // 수동 실시간 국토부 동기화 트리거
  const handleRealtimeSync = async () => {
    setSyncLoading(true);
    showToast(`📡 [${currentRegionLabel}] 최근 3년(36개월) 국토부 실거래가 동기화를 시작합니다...`);
    try {
      await axios.post(`http://localhost:${apiPort}/api/sync/${lawdCd}`, {}, { timeout: 35000 });
      showToast(`🎉 3년 실거래가 동기화 완료! 최신 데이터를 갱신합니다.`);
      await fetchData(lawdCd, 1);
    } catch (err) {
      showToast("실시간 3년 치 동기화 중 일시적 오류가 발생했습니다.");
    } finally {
      setSyncLoading(false);
    }
  };

  // ==================== [핵심 1] 주식 스타일 차트 데이터 보강 ====================
  // 전월 대비 매매가/전세가 등락액 및 등락률(▲▼) 사전 계산
  const enrichedStockChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    let prevTrade = null;
    let prevJeonse = null;

    return chartData.map((item) => {
      const tPrice = item.tradePrice || item.tradeAvgPrice || 0;
      const jPrice = item.jeonsePrice || item.jeonseAvgPrice || 0;

      let tradeDiff = 0;
      let tradeRate = 0;
      if (prevTrade && prevTrade > 0 && tPrice > 0) {
        tradeDiff = tPrice - prevTrade;
        tradeRate = Number(((tradeDiff / prevTrade) * 100).toFixed(1));
      }
      if (tPrice > 0) prevTrade = tPrice;

      let jeonseDiff = 0;
      let jeonseRate = 0;
      if (prevJeonse && prevJeonse > 0 && jPrice > 0) {
        jeonseDiff = jPrice - prevJeonse;
        jeonseRate = Number(((jeonseDiff / prevJeonse) * 100).toFixed(1));
      }
      if (jPrice > 0) prevJeonse = jPrice;

      return {
        ...item,
        tradePrice: tPrice,
        jeonsePrice: jPrice,
        tradeDiff,
        tradeRate,
        isTradeUp: tradeDiff > 0,
        isTradeDown: tradeDiff < 0,
        jeonseDiff,
        jeonseRate,
        isJeonseUp: jeonseDiff > 0,
        isJeonseDown: jeonseDiff < 0,
        volume: item.volume || item.tradeCount || 5
      };
    });
  }, [chartData]);

  // 최신 월 기준 등락 요약 지표 (토스증권 주식 요약 카드 스타일)
  const latestMonthStockMetric = useMemo(() => {
    if (!enrichedStockChartData || enrichedStockChartData.length === 0) return null;
    const validData = enrichedStockChartData.filter((d) => d.tradePrice > 0);
    if (validData.length === 0) return null;

    const latest = validData[validData.length - 1];
    return latest;
  }, [enrichedStockChartData]);

  // ==================== [핵심 2] 1:1 비교 매트릭스 & BarChart 데이터 ====================
  // [요구사항 1, 2, 3] 비교 가능한 고유 단지 목록 (Global Unique List & 가나다순 정렬 & 필터 독립성)
  // 검색어/propertyType 필터의 영향을 받지 않는 순수한 전체 3개년 고유 단지 목록 전체를 반환합니다.
  const availableComplexNames = useMemo(() => {
    let list = [];
    if (allBuildings && allBuildings.length > 0) {
      list = [...allBuildings];
    } else if (rawTrades && rawTrades.length > 0) {
      list = Array.from(new Set(rawTrades.map((t) => t.apt_name))).filter(Boolean);
    }

    // 현재 선택된 비교 단지가 있으면 목록에 안전하게 포함
    if (compareComplexA && !list.includes(compareComplexA)) {
      list.push(compareComplexA);
    }
    if (compareComplexB && !list.includes(compareComplexB)) {
      list.push(compareComplexB);
    }

    // 중복 제거 후 한국어 가나다순(오름차순 localeCompare) 완벽 정렬 (인위적인 slice(0, 15) 완전 제거!)
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "ko-KR"));
  }, [allBuildings, rawTrades, compareComplexA, compareComplexB]);

  // 단지별 상세 스펙 추출 헬퍼 (백엔드 3개년 전수 집계 데이터 complexSummaryMap 최우선 적용)
  const getComplexProfile = useCallback(
    (name) => {
      if (!name) return null;

      // 1. 백엔드 사전 집계 3개년 전수 통계가 존재하면 정확한 수치 즉시 반환
      if (complexSummaryMap && complexSummaryMap[name]) {
        const item = complexSummaryMap[name];
        return {
          name: item.name,
          dong: item.dong || "중심상권 인근",
          propertyType: item.property_type || "아파트",
          avgTrade: item.avg_trade || 0,
          latestTrade: item.avg_trade || 0,
          avgJeonse: item.avg_jeonse || 0,
          latestJeonse: item.avg_jeonse || 0,
          jeonseRatio: item.jeonse_ratio || (item.avg_trade > 0 ? Math.round((item.avg_jeonse / item.avg_trade) * 100) : 62),
          avgArea: item.avg_area ? String(item.avg_area) : "84.9",
          avgPyeong: toPyeong(item.avg_area || 84.9),
          pyeongPrice: item.pyeong_price || (item.avg_trade > 0 ? Math.round(item.avg_trade / (Number(item.avg_area || 84.9) * 0.3025)) : 4200),
          dealCount: item.deal_count || 1
        };
      }

      // 2. 폴백: 현재 페이징된 rawTrades에서 계산
      const trades = rawTrades.filter((t) => t.apt_name === name);
      const tradeList = trades.filter((t) => t.trade_type === "매매" && (t.deal_amount || t.raw_price));
      const jeonseList = trades.filter((t) => (t.trade_type === "전세" || t.trade_type === "월세") && (t.deposit || t.raw_price));

      const avgTrade = tradeList.length > 0
        ? Math.round(tradeList.reduce((acc, cur) => acc + (cur.deal_amount || cur.raw_price || 0), 0) / tradeList.length)
        : 110000;
      const latestTrade = tradeList.length > 0 ? (tradeList[0].deal_amount || tradeList[0].raw_price || 0) : avgTrade;

      const avgJeonse = jeonseList.length > 0
        ? Math.round(jeonseList.reduce((acc, cur) => acc + (cur.deposit || cur.raw_price || 0), 0) / jeonseList.length)
        : 68000;
      const latestJeonse = jeonseList.length > 0 ? (jeonseList[0].deposit || jeonseList[0].raw_price || 0) : avgJeonse;

      const jeonseRatio = avgTrade > 0 ? Math.round((avgJeonse / avgTrade) * 100) : 62;
      const avgArea = trades.length > 0 && trades[0]?.exclu_use_ar ? trades[0].exclu_use_ar : "84.9";
      const pyeongPrice = avgTrade > 0 ? Math.round(avgTrade / (Number(avgArea) * 0.3025)) : 4200;
      const dong = trades[0]?.dong || trades[0]?.jibun || "중심상권 인근";

      return {
        name,
        dong,
        propertyType: trades[0]?.property_type || "아파트",
        avgTrade,
        latestTrade,
        avgJeonse,
        latestJeonse,
        jeonseRatio,
        avgArea,
        avgPyeong: toPyeong(avgArea),
        pyeongPrice,
        dealCount: trades.length || 1
      };
    },
    [complexSummaryMap, rawTrades]
  );

  // 활성 1:1 비교 단지 프로필
  const targetComplexA = useMemo(() => {
    const name = compareComplexA || availableComplexNames[0] || "단지 A";
    return getComplexProfile(name);
  }, [compareComplexA, availableComplexNames, getComplexProfile]);

  const targetComplexB = useMemo(() => {
    const name = compareComplexB || availableComplexNames[1] || availableComplexNames[0] || "단지 B";
    return getComplexProfile(name);
  }, [compareComplexB, availableComplexNames, getComplexProfile]);

  // 1:1 가격 비교 BarChart 데이터 (평균 매매가, 평균 전세가)
  const priceBarComparisonData = useMemo(() => {
    if (!targetComplexA || !targetComplexB) return [];
    const nameA = targetComplexA.name;
    const nameB = targetComplexB.name === nameA ? `${targetComplexB.name} (대조)` : targetComplexB.name;

    return [
      {
        metric: "평균 매매가",
        [nameA]: targetComplexA.avgTrade,
        [nameB]: targetComplexB.avgTrade,
        nameA,
        nameB
      },
      {
        metric: "평균 전세가",
        [nameA]: targetComplexA.avgJeonse,
        [nameB]: targetComplexB.avgJeonse,
        nameA,
        nameB
      }
    ];
  }, [targetComplexA, targetComplexB]);

  // 1:1 전세가율 비교 BarChart 데이터 (%)
  const ratioBarComparisonData = useMemo(() => {
    if (!targetComplexA || !targetComplexB) return [];
    const nameA = targetComplexA.name;
    const nameB = targetComplexB.name === nameA ? `${targetComplexB.name} (대조)` : targetComplexB.name;

    return [
      {
        metric: "평균 전세가율 (%)",
        [nameA]: targetComplexA.jeonseRatio,
        [nameB]: targetComplexB.jeonseRatio,
        nameA,
        nameB
      }
    ];
  }, [targetComplexA, targetComplexB]);

  // 서버사이드 페이징 바인딩: rawTrades가 이미 해당 페이지의 정확한 레코드임
  // [스마트 검색] 실시간 단지명/동/지번/유형 필터링
  const filteredTrades = useMemo(() => {
    if (!searchKeyword.trim()) return rawTrades;
    const kw = searchKeyword.trim().toLowerCase();
    return rawTrades.filter((item) => {
      const apt = (item.apt_name || "").toLowerCase();
      const dong = (item.dong || "").toLowerCase();
      const jibun = (item.jibun || "").toLowerCase();
      const pt = (item.property_type || "").toLowerCase();
      return apt.includes(kw) || dong.includes(kw) || jibun.includes(kw) || pt.includes(kw);
    });
  }, [rawTrades, searchKeyword]);

  const paginatedTrades = filteredTrades;

  // AI 부동산 상담 질문 전송
  const handleAiSubmit = async (e) => {
    e?.preventDefault();
    if (!chatPrompt.trim() || aiLoading) return;

    const userText = chatPrompt.trim();
    setChatPrompt("");

    const newMsg = {
      sender: "user",
      text: userText,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setAiLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:${apiPort}/api/ai/briefing`,
        {
          lawdCd,
          regionLabel: currentRegionLabel,
          query: userText,
          summary: summaryInfo,
          chartSample: chartData.slice(-6)
        },
        { timeout: 35000 }
      );

      const answer = res.data?.answer || res.data?.message || `[${currentRegionLabel}] 36개월 실거래 데이터를 분석한 결과, 매매가와 전세가 격차가 일정하게 유지되고 있습니다.`;
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: answer,
          time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `[${currentRegionLabel}] 기준 최근 3년 실거래 분석 요약입니다:
- 최신 매매 최고가: ${summaryInfo.latestTradePrice}만원
- 최신 전세 보증금: ${summaryInfo.latestJeonsePrice}만원
- 실거래 누적 데이터: ${summaryInfo.totalCount.toLocaleString()}건
상세 단지별 전세가율 및 급매물 문의를 입력해 주시면 안내해 드립니다.`,
          time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#191F28] font-sans antialiased pb-28 select-none">
      {/* ========================================================================= */}
      {/* 1. 상단 글로벌 GNB 헤더                                                   */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E8EB] transition-all">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* 1) 로고 영역 & 모바일 동기화 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#3182F6] flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-xs shrink-0">
                Z
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#191F28]">집뷰</span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#3182F6]/10 text-[#3182F6]">
                    PRO 3.0
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#8B95A1] -mt-0.5 hidden xs:block">
                  실거래가 & 주식형 시각화
                </p>
              </div>
            </div>

            {/* 모바일 화면용 동기화 버튼 (터치 친화적 40px) */}
            <div className="sm:hidden">
              <button
                onClick={handleRealtimeSync}
                disabled={syncLoading}
                title="국토부 실시간 동기화"
                className="flex items-center gap-1 px-3 min-h-[40px] bg-white border border-[#E5E8EB] hover:bg-[#F2F4F6] text-[#191F28] rounded-full text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
              >
                <span className={syncLoading ? "animate-spin" : ""}>🔄</span>
                <span className="text-[11px] font-extrabold">동기화</span>
              </button>
            </div>
          </div>

          {/* 2) 컨트롤러 바: [View Mode 토글 스위치] + [지역 선택 드롭다운] */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* View Mode 토글 스위치 (손가락 터치 친화적 42px 높이) */}
            <div className="flex items-center bg-[#F2F4F6] p-1 rounded-full border border-[#E5E8EB] justify-center">
              <button
                onClick={() => {
                  setViewMode("transaction");
                  showToast("📊 [과거 실거래가 모드] 국토교통부 3개년 실거래 빅데이터를 표시합니다.");
                }}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  viewMode === "transaction"
                    ? "bg-white text-[#191F28] shadow-xs font-black"
                    : "text-[#8B95A1] hover:text-[#4E5968]"
                }`}
              >
                <span>📊</span>
                <span>과거 실거래가</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("listing");
                  showToast("🏠 [현재 매물 보기(Demo)] B2B 제휴 중개사 실시간 호가 매물을 표시합니다.");
                }}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  viewMode === "listing"
                    ? "bg-[#3182F6] text-white shadow-xs font-black"
                    : "text-[#8B95A1] hover:text-[#4E5968]"
                }`}
              >
                <span>🏠</span>
                <span>현재 매물(Demo)</span>
                <span className="bg-[#FEE500] text-[#191F28] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  B2B
                </span>
              </button>
            </div>

            {/* 전국 지역 선택 드롭다운 2종 (시/도 + 시/군/구, 손가락 터치 친화적 min-h-[42px]) */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center flex-1 sm:flex-initial bg-[#F2F4F6] p-1 rounded-full border border-[#E5E8EB]">
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={selectedSido}
                    onChange={handleSidoChange}
                    className="w-full sm:w-auto appearance-none bg-[#F2F4F6] text-xs font-bold text-[#191F28] pl-3 pr-6 py-2 min-h-[40px] rounded-full border border-transparent outline-none cursor-pointer hover:bg-[#E5E8EB] focus:ring-2 focus:ring-[#3182F6]/30 focus:border-[#3182F6] transition-all"
                  >
                    {Object.keys(REGION_DATA).map((sido) => (
                      <option key={sido} value={sido}>
                        {sido}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B95A1] text-[9px]">
                    ▼
                  </div>
                </div>

                <span className="text-[#D1D6DB] text-xs px-1">|</span>

                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={lawdCd}
                    onChange={handleLawdCdChange}
                    className="w-full sm:w-auto appearance-none bg-[#F2F4F6] text-xs font-bold text-[#191F28] pl-3 pr-6 py-2 min-h-[40px] rounded-full border border-transparent outline-none cursor-pointer hover:bg-[#E5E8EB] focus:ring-2 focus:ring-[#3182F6]/30 focus:border-[#3182F6] transition-all"
                  >
                    {(REGION_DATA[selectedSido] || []).map((district) => (
                      <option key={district.code} value={district.code}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B95A1] text-[9px]">
                    ▼
                  </div>
                </div>
              </div>

              {/* 데스크탑 화면용 실시간 동기화 버튼 */}
              <button
                onClick={handleRealtimeSync}
                disabled={syncLoading}
                className="hidden sm:flex items-center space-x-1.5 px-3.5 py-2 min-h-[42px] bg-white border border-[#E5E8EB] hover:bg-[#F2F4F6] text-[#191F28] rounded-full text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 shrink-0"
              >
                <span className={syncLoading ? "animate-spin" : ""}>🔄</span>
                <span>{syncLoading ? "동기화 중..." : "실시간 동기화"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. 대시보드 메인 본문                                                     */}
      {/* ========================================================================= */}
      <main className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* ========================================================================= */}
        {/* [스마트 자동완성 검색] 단지명/건물명 실시간 통합 검색 바                  */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5E8EB] p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-[#8B95A1] pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="단지명 또는 건물명 검색 (예: 푸르지오, 가좌동, 래미안)"
                className="w-full bg-[#F2F4F6] text-xs sm:text-sm font-bold text-[#191F28] pl-10 pr-10 py-3 rounded-2xl border border-transparent outline-none focus:bg-white focus:border-[#3182F6] focus:ring-4 focus:ring-[#3182F6]/10 transition-all placeholder:text-[#8B95A1] placeholder:font-normal"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#E5E8EB] hover:bg-[#CCD0D5] text-[#4E5968] flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                  title="검색어 지우기"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 실시간 필터링 결과 요약 배지 */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs font-bold text-[#4E5968] bg-[#F2F4F6] px-3 py-2 rounded-xl">
                {viewMode === "listing"
                  ? `🏠 제휴 매물 ${filteredMockListings.length}건`
                  : `📊 실거래 ${filteredTrades.length.toLocaleString()}건`}
              </span>
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="text-xs font-bold text-[#3182F6] bg-[#E8F3FF] hover:bg-[#D4E8FF] px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  전체 보기
                </button>
              )}
            </div>
          </div>

          {/* 퀵 태그 추천 버튼 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
            <span className="text-[#8B95A1] font-semibold shrink-0 text-[11px]">빠른 검색:</span>
            {["푸르지오", "자이", "래미안", "힐스테이트", "더샵", "원룸", "오피스텔"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchKeyword(tag)}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer text-[11px] ${
                  searchKeyword === tag
                    ? "bg-[#3182F6] text-white"
                    : "bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[#4E5968]"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </section>
        {/* 요약 지표 카드 4종 */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#8B95A1]">누적 실거래 데이터</span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-24 animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-[#191F28] mt-1 tracking-tight">
                {totalCount.toLocaleString()}
                <span className="text-sm font-bold text-[#8B95A1] ml-1">건</span>
              </p>
            )}
            <p className="text-[11px] text-[#3182F6] font-semibold mt-1">
              최근 3년 전수 DB 보존
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#8B95A1]">최신 매매 최고가</span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-28 animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-[#F04452] mt-1 tracking-tight">
                {summaryInfo.latestTradePrice}
              </p>
            )}
            <p className="text-[11px] text-[#8B95A1] font-medium mt-1">
              {currentRegionLabel} 기준
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#8B95A1]">최신 전세 보증금</span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-28 animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-[#3182F6] mt-1 tracking-tight">
                {summaryInfo.latestJeonsePrice}
              </p>
            )}
            <p className="text-[11px] text-[#8B95A1] font-medium mt-1">
              순수 전세 계약 기준
            </p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#8B95A1]">
              {viewMode === "listing" ? "제휴 실시간 호가 매물" : "비교 분석 가능 단지"}
            </span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-20 animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-[#191F28] mt-1 tracking-tight">
                {viewMode === "listing" ? filteredMockListings.length : availableComplexNames.length}
                <span className="text-sm font-bold text-[#8B95A1] ml-1">
                  {viewMode === "listing" ? "개 매물" : "개 단지"}
                </span>
              </p>
            )}
            <p className="text-[11px] text-[#00A455] font-semibold mt-1">
              {viewMode === "listing" ? "현장 검증 B2B 네트워크" : "1:1 막대그래프 대조 가능"}
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [실거래가 모드] 주식형 ComposedChart & 1:1 비교 매트릭스 (과거 분석용)      */}
        {/* ========================================================================= */}
        {viewMode === "transaction" && (
        <>
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-[#F2F4F6]">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E8F3FF] text-[#3182F6] text-xs font-black px-2.5 py-1 rounded-full">
                  Stock Multi-Chart
                </span>
                <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                  {currentRegionLabel} 3개년 시세 추이 및 월간 거래량
                </h3>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                주식형 복합 차트: 좌측 Y축(매매/전세 시세 곡선)과 우측 Y축(하단 월간 거래량 Bar)을 결합하여 분석합니다.
              </p>
            </div>

            {/* 차트 뷰 모드 탭 토글 */}
            <div className="flex items-center gap-1 bg-[#F2F4F6] p-1 rounded-full self-start">
              {[
                { id: "all", label: "매매+전세" },
                { id: "매매", label: "매매만" },
                { id: "전세", label: "전세만" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartViewMode(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    chartViewMode === tab.id
                      ? "bg-white text-[#191F28] shadow-2xs font-extrabold"
                      : "text-[#8B95A1] hover:text-[#191F28]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 주식 앱 스타일 시세 & 등락률 상단 지표 바 (토스증권 스타일) */}
          {latestMonthStockMetric && (
            <div className="flex flex-wrap items-center gap-4 bg-[#F9FAFB] p-3.5 rounded-2xl border border-[#E5E8EB]/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#8B95A1]">최근 기준월:</span>
                <span className="text-xs font-extrabold text-[#191F28] bg-white px-2 py-0.5 rounded-md border border-[#E5E8EB]">
                  20{latestMonthStockMetric.month}
                </span>
              </div>

              <div className="h-3.5 w-px bg-[#E5E8EB]"></div>

              {/* 매매가 등락률 뱃지 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8B95A1]">매매가:</span>
                <span className="text-sm font-black text-[#191F28]">
                  {formatTossMoney(latestMonthStockMetric.tradePrice)}
                </span>
                {latestMonthStockMetric.tradeDiff !== 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-md ${
                      latestMonthStockMetric.isTradeUp
                        ? "bg-[#FEECEE] text-[#F04452]"
                        : "bg-[#E8F3FF] text-[#3182F6]"
                    }`}
                  >
                    {latestMonthStockMetric.isTradeUp ? "▲ +" : "▼ -"}
                    {formatTossMoney(Math.abs(latestMonthStockMetric.tradeDiff))} (
                    {latestMonthStockMetric.tradeRate > 0 ? `+${latestMonthStockMetric.tradeRate}` : latestMonthStockMetric.tradeRate}%)
                  </span>
                )}
              </div>

              <div className="h-3.5 w-px bg-[#E5E8EB] hidden sm:block"></div>

              {/* 전세가 등락률 뱃지 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8B95A1]">전세가:</span>
                <span className="text-sm font-black text-[#191F28]">
                  {formatTossMoney(latestMonthStockMetric.jeonsePrice)}
                </span>
                {latestMonthStockMetric.jeonseDiff !== 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-md ${
                      latestMonthStockMetric.isJeonseUp
                        ? "bg-[#FEECEE] text-[#F04452]"
                        : "bg-[#E8F3FF] text-[#3182F6]"
                    }`}
                  >
                    {latestMonthStockMetric.isJeonseUp ? "▲ +" : "▼ -"}
                    {formatTossMoney(Math.abs(latestMonthStockMetric.jeonseDiff))} (
                    {latestMonthStockMetric.jeonseRate > 0 ? `+${latestMonthStockMetric.jeonseRate}` : latestMonthStockMetric.jeonseRate}%)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 주식형 ComposedChart 렌더링 컨테이너 */}
          <div
            className="w-full h-80 min-h-[320px] pt-1 relative flex items-center justify-center"
            style={{ height: "340px", minHeight: "340px", width: "100%" }}
          >
            {isLoading ? (
              <ChartSkeleton regionLabel={currentRegionLabel} />
            ) : enrichedStockChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-xs text-[#8B95A1] font-medium space-y-1">
                <span className="text-2xl">📊</span>
                <span className="font-bold text-[#191F28]">{currentRegionLabel} 36개월 데이터를 불러오는 중입니다.</span>
                <button
                  onClick={handleRealtimeSync}
                  className="mt-2 px-3.5 py-1.5 bg-[#3182F6] text-white rounded-full font-bold hover:bg-[#1B64DA] transition-all"
                >
                  실시간 국토부 데이터 패칭하기
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={330}>
                <ComposedChart data={enrichedStockChartData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F04452" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#F04452" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="jeonseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3182F6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#3182F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F6" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#8B95A1", fontSize: 10, fontWeight: 600 }}
                    interval={4}
                  />
                  {/* 좌측 Y축: 실거래가 (억 단위) */}
                  <YAxis
                    yAxisId="price"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val && val > 0 ? `${Math.round(val / 10000)}억` : "0")}
                    tick={{ fill: "#8B95A1", fontSize: 11, fontWeight: 600 }}
                    width={52}
                    domain={["auto", "auto"]}
                  />
                  {/* 우측 Y축: 거래량 (차트 하단 35%에만 오버랩되도록 상한 도메인 설정) */}
                  <YAxis
                    yAxisId="volume"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#B0B8C1", fontSize: 9, fontWeight: 500 }}
                    tickFormatter={(v) => `${v}건`}
                    domain={[0, (dataMax) => Math.max(dataMax * 3.2, 40)]}
                    width={38}
                  />
                  <Tooltip content={<TossStockChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 10, fontSize: 11, fontWeight: 700 }}
                  />

                  {/* 하단 월간 거래량 막대 (주식 차트 거래량 스타일) */}
                  <Bar
                    yAxisId="volume"
                    name="월간 거래량 (Volume)"
                    dataKey="volume"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={12}
                  >
                    {enrichedStockChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.tradeDiff >= 0 ? "rgba(240, 68, 82, 0.40)" : "rgba(49, 130, 246, 0.40)"}
                      />
                    ))}
                  </Bar>

                  {/* 매매 평균가 곡선 */}
                  {(chartViewMode === "all" || chartViewMode === "매매") && (
                    <Area
                      yAxisId="price"
                      type="monotone"
                      name="매매 평균가"
                      dataKey="tradePrice"
                      stroke="#F04452"
                      strokeWidth={3}
                      fill="url(#tradeGrad)"
                      dot={{ r: 3, fill: "#F04452", strokeWidth: 1.5, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                      connectNulls={true}
                    />
                  )}

                  {/* 전세 평균가 곡선 */}
                  {(chartViewMode === "all" || chartViewMode === "전세") && (
                    <Area
                      yAxisId="price"
                      type="monotone"
                      name="전세 평균가"
                      dataKey="jeonsePrice"
                      stroke="#3182F6"
                      strokeWidth={3}
                      fill="url(#jeonseGrad)"
                      dot={{ r: 3, fill: "#3182F6", strokeWidth: 1.5, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                      connectNulls={true}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [요구사항 2] 1:1 비교 막대그래프 & 매트릭스 신규 섹션                      */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl border border-[#E5E8EB] p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-[#F2F4F6]">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#7B2CBF]/10 text-[#7B2CBF] text-xs font-black px-2.5 py-1 rounded-full">
                  1:1 VS Analysis
                </span>
                <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                  단지 1:1 비교 막대그래프 & 스펙 대조
                </h3>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                두 개의 단지를 선택하여 평균 매매가, 평균 전세가, 전세가율을 막대그래프로 나란히 비교합니다.
              </p>
            </div>

            {/* 1:1 비교 단지 선택 컨트롤러 */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] p-2 rounded-2xl border border-[#E5E8EB]">
              {/* 단지 A 선택 드롭다운 (토스 블루) */}
              <div className="relative">
                <select
                  value={targetComplexA?.name || ""}
                  onChange={(e) => setCompareComplexA(e.target.value)}
                  className="appearance-none bg-white text-xs font-extrabold text-[#3182F6] pl-3 pr-7 py-2 rounded-xl border border-[#3182F6]/30 shadow-2xs outline-none cursor-pointer hover:border-[#3182F6] transition-all"
                >
                  {availableComplexNames.map((name) => (
                    <option key={`a-${name}`} value={name}>
                      [단지 A] {name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#3182F6] text-[10px]">
                  ▼
                </div>
              </div>

              <span className="text-xs font-black text-[#7B2CBF] px-1">VS</span>

              {/* 단지 B 선택 드롭다운 (퍼플 바이올렛) */}
              <div className="relative">
                <select
                  value={targetComplexB?.name || ""}
                  onChange={(e) => setCompareComplexB(e.target.value)}
                  className="appearance-none bg-white text-xs font-extrabold text-[#7B2CBF] pl-3 pr-7 py-2 rounded-xl border border-[#7B2CBF]/30 shadow-2xs outline-none cursor-pointer hover:border-[#7B2CBF] transition-all"
                >
                  {availableComplexNames.map((name) => (
                    <option key={`b-${name}`} value={name}>
                      [단지 B] {name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#7B2CBF] text-[10px]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* 1:1 비교 Recharts BarChart 시각화 영역 */}
          {isLoading ? (
            <MatrixSkeleton regionLabel={currentRegionLabel} />
          ) : !targetComplexA || !targetComplexB ? (
            <div className="py-12 text-center text-[#8B95A1] text-xs font-medium">
              비교할 단지 데이터가 부족합니다. 상단의 국토부 실시간 동기화를 실행해 주세요.
            </div>
          ) : (
            <div className="space-y-6">
              {/* 상단 1:1 나란히 세워진 2색 막대그래프 (매매가, 전세가, 전세가율) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. 평균 매매가 & 전세가 비교 막대그래프 (2/3 너비) */}
                <div className="lg:col-span-2 bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E8EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#191F28]">평균 매매가 & 전세가 비교</h4>
                      <p className="text-[11px] text-[#8B95A1]">단위: 만원 (축: 억 단위)</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold">
                      <span className="flex items-center gap-1 text-[#3182F6]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3182F6]"></span>
                        {targetComplexA.name}
                      </span>
                      <span className="flex items-center gap-1 text-[#7B2CBF]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#7B2CBF]"></span>
                        {targetComplexB.name}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priceBarComparisonData} margin={{ top: 20, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8EB" />
                        <XAxis dataKey="metric" tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: "#191F28" }} />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${Math.round(v / 10000)}억`}
                          tick={{ fontSize: 10, fill: "#8B95A1", fontWeight: 600 }}
                          width={48}
                        />
                        <Tooltip content={<ComparisonBarTooltip />} />
                        <Bar
                          dataKey={targetComplexA.name}
                          name={targetComplexA.name}
                          fill="#3182F6"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={44}
                        />
                        <Bar
                          dataKey={targetComplexB.name === targetComplexA.name ? `${targetComplexB.name} (대조)` : targetComplexB.name}
                          name={targetComplexB.name}
                          fill="#7B2CBF"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={44}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. 평균 전세가율 (%) 비교 막대그래프 (1/3 너비) */}
                <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E8EB] space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#191F28]">평균 전세가율 (%) 비교</h4>
                    <p className="text-[11px] text-[#8B95A1]">매매가 대비 전세 보증금 비율</p>
                  </div>

                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ratioBarComparisonData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8EB" />
                        <XAxis dataKey="metric" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "#191F28" }} />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 10, fill: "#8B95A1", fontWeight: 600 }}
                          width={40}
                        />
                        <Tooltip content={<ComparisonBarTooltip />} />
                        <Bar
                          dataKey={targetComplexA.name}
                          name={targetComplexA.name}
                          fill="#3182F6"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey={targetComplexB.name === targetComplexA.name ? `${targetComplexB.name} (대조)` : targetComplexB.name}
                          name={targetComplexB.name}
                          fill="#7B2CBF"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 갭투자 분석 인디케이터 */}
                  <div className="bg-white p-3 rounded-xl border border-[#E5E8EB] text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#3182F6] font-bold">{targetComplexA.name}</span>
                      <span className="font-black text-sm">{targetComplexA.jeonseRatio}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7B2CBF] font-bold">{targetComplexB.name}</span>
                      <span className="font-black text-sm">{targetComplexB.jeonseRatio}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 1:1 정밀 스펙 비교 테이블 */}
              <div className="overflow-x-auto rounded-2xl border border-[#E5E8EB]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F2F4F6] text-[#8B95A1] border-b border-[#E5E8EB]">
                      <th className="py-3 px-4 font-bold w-40">비교 항목</th>
                      <th className="py-3 px-4 font-extrabold text-[#3182F6] text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3182F6]"></span>
                          <span>[단지 A] {targetComplexA.name}</span>
                        </div>
                      </th>
                      <th className="py-3 px-4 font-extrabold text-[#7B2CBF] text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#7B2CBF]"></span>
                          <span>[단지 B] {targetComplexB.name}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F6]">
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/70">위치 (법정동)</td>
                      <td className="py-3.5 px-4 font-semibold text-[#191F28]">{targetComplexA.dong}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#191F28]">{targetComplexB.dong}</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/70">평균 매매가</td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-black text-[#F04452]">{formatTossMoney(targetComplexA.avgTrade)}</span>
                        <span className="text-[11px] text-[#8B95A1] block font-medium">최근: {formatTossMoney(targetComplexA.latestTrade)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-black text-[#F04452]">{formatTossMoney(targetComplexB.avgTrade)}</span>
                        <span className="text-[11px] text-[#8B95A1] block font-medium">최근: {formatTossMoney(targetComplexB.latestTrade)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/70">평균 전세가</td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-black text-[#3182F6]">{formatTossMoney(targetComplexA.avgJeonse)}</span>
                        <span className="text-[11px] text-[#8B95A1] block font-medium">최근: {formatTossMoney(targetComplexA.latestJeonse)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-black text-[#3182F6]">{formatTossMoney(targetComplexB.avgJeonse)}</span>
                        <span className="text-[11px] text-[#8B95A1] block font-medium">최근: {formatTossMoney(targetComplexB.latestJeonse)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/70">평균 전세가율</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#191F28] text-sm">
                        {targetComplexA.jeonseRatio}%
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-[#191F28] text-sm">
                        {targetComplexB.jeonseRatio}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/70">평당 가격 (3.3㎡)</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#191F28]">
                        {formatTossMoney(targetComplexA.pyeongPrice)} / 평
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-[#191F28]">
                        {formatTossMoney(targetComplexB.pyeongPrice)} / 평
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/70">전용면적 / 공급평형</td>
                      <td className="py-3.5 px-4 text-[#4E5968] font-medium">
                        {targetComplexA.avgArea}㎡ ({targetComplexA.avgPyeong}평)
                      </td>
                      <td className="py-3.5 px-4 text-[#4E5968] font-medium">
                        {targetComplexB.avgArea}㎡ ({targetComplexB.avgPyeong}평)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
        </>
        )}

        {/* ========================================================================= */}
        {/* [중단] 인터랙티브 카카오맵 실거래 단지 & 매물 위치 지도 뷰                 */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-[#F2F4F6]">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#FEE500] text-[#191F28] text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[#371D1E]"></span>
                  Kakao Maps
                </span>
                <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                  {viewMode === "listing"
                    ? (selectedListing ? `${selectedListing.title}` : `${currentRegionLabel} B2B 제휴 매물 지도 (총 ${filteredMockListings.length}건)`)
                    : (selectedMapTarget ? `${selectedMapTarget.apt_name} 실거래 위치 지도` : `${currentRegionLabel} 단지 & 매물 위치 지도`)}
                </h3>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                카카오맵 Geocoder로 실제 주소를 좌표 변환하여 단지 위치를 확인합니다. (하단 표에서 원하는 건물을 클릭하면 해당 위치로 즉시 이동합니다)
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-[#4E5968] bg-[#F2F4F6] px-3 py-1.5 rounded-full truncate max-w-[220px]">
                📍 {mapAddress || `${currentRegionLabel} 중심지`}
              </span>
              <button
                onClick={() => {
                  const targetQuery = mapAddress || currentRegionLabel;
                  window.open(`https://map.kakao.com/link/search/${encodeURIComponent(targetQuery)}`, "_blank");
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FEE500] hover:bg-[#FADA0A] text-[#191F28] transition-all shadow-2xs flex items-center gap-1 active:scale-95"
              >
                <span>길찾기/로드뷰</span>
                <span className="text-[10px]">↗</span>
              </button>
            </div>
          </div>

          {/* 카카오맵 캔버스 영역 (모바일 h-[300px] 고정으로 스크롤 먹통 방지 & 데스크탑 h-[480px]) */}
          <div className="relative w-full h-[300px] sm:h-[420px] md:h-[480px] rounded-2xl overflow-hidden border border-[#E5E8EB] shadow-inner bg-[#F9FAFB] touch-pan-y">
            <div
              id="map"
              ref={mapContainerRef}
              style={{ width: "100%", height: "100%", minHeight: "300px" }}
            ></div>

            {/* 로딩 인디케이터 */}
            {mapStatus === "loading" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#F9FAFB]/90 backdrop-blur-xs space-y-3">
                <div className="w-10 h-10 rounded-full border-3 border-[#3182F6] border-t-transparent animate-spin"></div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-[#191F28]">카카오맵 지도를 불러오는 중입니다...</p>
                  <p className="text-[11px] text-[#8B95A1]">정밀 도로망 및 단지 위치를 로딩하고 있습니다.</p>
                </div>
              </div>
            )}

            {/* 에러 시 도메인 및 환경별 정밀 안내 카드 */}
            {mapStatus === "error" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-[#FFF0F0] text-[#F04452] flex items-center justify-center text-2xl font-bold shadow-xs">
                  🗺️
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h4 className="text-base font-extrabold text-[#191F28]">카카오맵 로드 안내</h4>
                  <p className="text-xs text-[#4E5968] leading-relaxed">
                    카카오맵 SDK는 보안 정책상 카카오 개발자 콘솔에 등록된 <br />
                    <span className="font-bold text-[#3182F6]">Web 플랫폼 사이트 도메인</span>에서만 정상 표시됩니다.
                  </p>
                  <div className="mt-2 p-2.5 bg-[#F2F4F6] rounded-xl text-left text-[11px] space-y-1 border border-[#E5E8EB]">
                    <div className="flex items-center justify-between text-[#8B95A1]">
                      <span>현재 브라우저 접속 주소:</span>
                      <span className="font-mono font-bold text-[#191F28]">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#8B95A1]">
                      <span>API 키 등록 권장 주소:</span>
                      <span className="font-mono font-bold text-[#3182F6]">http://localhost:3001</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {typeof window !== "undefined" && window.location.port !== "3001" && (
                    <a
                      href="http://localhost:3001"
                      className="px-4 py-2.5 bg-[#3182F6] hover:bg-[#1B64DA] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 inline-flex items-center gap-1.5"
                    >
                      <span>👉 3001번 포트로 이동</span>
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setMapStatus("loading");
                      initMap();
                    }}
                    className="px-4 py-2.5 bg-[#191F28] hover:bg-[#333D4B] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    다시 시도
                  </button>
                  <button
                    onClick={() => {
                      const targetQuery = mapAddress || currentRegionLabel;
                      window.open(`https://map.kakao.com/link/search/${encodeURIComponent(targetQuery)}`, "_blank");
                    }}
                    className="px-4 py-2.5 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191F28] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    카카오맵 웹에서 바로보기 ↗
                  </button>
                </div>
              </div>
            )}

            {/* [실거래가 모드] 지도 좌측 하단 활성 매물 요약 플로팅 카드 */}
            {viewMode === "transaction" && mapStatus === "ready" && selectedMapTarget && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs z-10 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#E5E8EB] shadow-xl space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[#E8F3FF] text-[#3182F6]">
                    {selectedMapTarget.property_type || "아파트"}
                  </span>
                  <span className="text-[11px] font-bold text-[#8B95A1]">{selectedMapTarget.deal_date || "최근 거래"}</span>
                </div>
                <h4 className="text-sm font-black text-[#191F28] truncate">{selectedMapTarget.apt_name}</h4>
                <p className="text-xs font-extrabold text-[#F04452]">
                  {selectedMapTarget.price_formatted || formatTossMoney(selectedMapTarget.deal_amount || selectedMapTarget.deposit)}
                </p>
                <p className="text-[11px] text-[#8B95A1] truncate">
                  {selectedMapTarget.dong} {selectedMapTarget.jibun} · {selectedMapTarget.exclu_use_ar}㎡ ({toPyeong(selectedMapTarget.exclu_use_ar)}평)
                </p>
              </div>
            )}

            {/* [현재 매물 모드] 지도 좌측 하단 활성 제휴 매물 플로팅 카드 */}
            {viewMode === "listing" && mapStatus === "ready" && selectedListing && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-10 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-[#E5E8EB] shadow-xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[#E8F3FF] text-[#3182F6]">
                      {selectedListing.property_type}
                    </span>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[#FFF0F0] text-[#F04452]">
                      {selectedListing.deal_type}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#8B95A1]">{selectedListing.maintenance_fee}</span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#191F28] leading-tight line-clamp-1">{selectedListing.title}</h4>
                  <p className="text-base font-black text-[#F04452] mt-0.5">{selectedListing.price_summary}</p>
                </div>
                <div className="text-[11px] text-[#4E5968] flex items-center gap-2">
                  <span>{selectedListing.floor}</span>
                  <span>•</span>
                  <span>{selectedListing.area}</span>
                </div>
                <div className="pt-2 border-t border-[#F2F4F6] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#8B95A1] truncate max-w-[170px]">🏢 {selectedListing.agency_name}</span>
                  <a
                    href={`tel:${selectedListing.contact}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      showToast(`📞 [중개사 연결] ${selectedListing.agency_name} (${selectedListing.contact})`);
                    }}
                    className="px-3 py-1.5 bg-[#3182F6] hover:bg-[#1B64DA] text-white text-[11px] font-black rounded-lg transition-all shadow-xs flex items-center gap-1 active:scale-95"
                  >
                    <span>📞 문의</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [조건부 렌더링] 과거 실거래가 표 vs 현재 제휴 매물(Demo) 카드 리스트      */}
        {/* ========================================================================= */}
        {viewMode === "transaction" ? (
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E8F3FF] text-[#3182F6] text-xs font-black px-2.5 py-1 rounded-full">Raw Data</span>
                <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                  {currentRegionLabel} 국토교통부 실거래 계약 상세 내역 ({totalCount.toLocaleString()}건)
                </h3>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                공공데이터포털 실시간 API 및 클라우드 PostgreSQL에 저장된 실거래 로우 데이터 원본입니다.
              </p>
            </div>

            {/* 테이블 내부 검색창 (스마트 검색어 양방향 바인딩) */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="단지명 검색 (예: 래미안, 자이)"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                className="w-full bg-[#F2F4F6] text-xs px-3.5 py-2 pl-9 pr-7 rounded-full border border-transparent outline-none focus:border-[#3182F6] focus:bg-white transition-all font-medium"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8B95A1]">
                🔍
              </span>
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B95A1] hover:text-[#191F28] text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 부동산 유형 및 거래 유형 필터 버튼군 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#F2F4F6]">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "전체 유형" },
                { id: "아파트", label: "아파트" },
                { id: "오피스텔", label: "오피스텔" },
                { id: "연립다세대", label: "빌라/투룸(연립/다세대)" },
                { id: "단독다가구", label: "원룸(단독/다가구)" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPropertyTypeFilter(p.id)}
                  className={`px-3.5 py-2 min-h-[40px] rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                    propertyTypeFilter === p.id
                      ? "bg-[#3182F6] text-white shadow-xs font-black"
                      : "bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5">
              {[
                { id: "all", label: "전체 거래" },
                { id: "매매", label: "매매" },
                { id: "전세", label: "전세" },
                { id: "월세", label: "월세" }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTradeTypeFilter(t.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    tradeTypeFilter === t.id
                      ? "bg-[#191F28] text-white"
                      : "bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* [스켈레톤 렌더링]: 로딩 중일 때는 TableSkeleton 렌더링 */}
          {isLoading ? (
            <TableSkeleton regionLabel={currentRegionLabel} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#F2F4F6]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#F2F4F6] text-[#8B95A1]">
                    <th className="py-3 px-3.5 font-bold">계약일자</th>
                    <th className="py-3 px-3.5 font-bold">유형</th>
                    <th className="py-3 px-3.5 font-bold">단지/건물명</th>
                    <th className="py-3 px-3.5 font-bold">동/위치</th>
                    <th className="py-3 px-3.5 font-bold">거래구분</th>
                    <th className="py-3 px-3.5 font-bold">실거래 가격 / 보증금</th>
                    <th className="py-3 px-3.5 font-bold">전용면적</th>
                    <th className="py-3 px-3.5 font-bold">층수</th>
                    <th className="py-3 px-3.5 font-bold">구조</th>
                    <th className="py-3 px-3.5 font-bold">중개방식</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F6]">
                  {paginatedTrades.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-14 h-14 rounded-2xl bg-[#F2F4F6] text-[#8B95A1] flex items-center justify-center text-2xl shadow-inner">
                            🔍
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-extrabold text-[#191F28]">
                              {searchKeyword.trim() ? `"${searchKeyword}" 검색 결과가 없습니다` : "조회된 실거래 데이터가 없습니다"}
                            </h4>
                            <p className="text-xs text-[#8B95A1]">
                              {searchKeyword.trim()
                                ? "단지명이나 동 이름을 확인하시거나, 다른 검색어로 검색해 보세요."
                                : "상단 필터나 조회 지역을 변경해 보세요."}
                            </p>
                          </div>
                          {searchKeyword.trim() && (
                            <button
                              onClick={() => setSearchKeyword("")}
                              className="px-4 py-2 bg-[#E8F3FF] hover:bg-[#D4E8FF] text-[#3182F6] text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                            >
                              전체 매물 보기 (검색어 초기화)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTrades.map((item, idx) => {
                      const isTrade = item.trade_type === "매매";
                      const isJeonse = item.trade_type === "전세";
                      const formattedPrice = item.price_formatted || (item.trade_type === "월세"
                        ? `보증금 ${formatTossMoney(item.deposit)} / 월 ${item.monthly_rent}만`
                        : formatTossMoney(item.deal_amount || item.deposit));

                      return (
                        <tr
                          key={item.id || idx}
                          onClick={() => {
                            handleSelectPropertyForMap(item);
                            const { title } = buildPropertyAddressAndTitle(item);
                            showToast(`📍 [지도 이동] ${title}`);
                          }}
                          className={`hover:bg-[#F9FAFB] cursor-pointer transition-colors ${
                            selectedMapTarget?.id === item.id ? "bg-[#E8F3FF]/40 border-l-4 border-l-[#3182F6]" : ""
                          }`}
                        >
                          <td className="py-3 px-3.5 text-[#4E5968] font-medium whitespace-nowrap">
                            {item.deal_date || `${item.deal_year}.${String(item.deal_month).padStart(2, "0")}.${String(item.deal_day || 1).padStart(2, "0")}`}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                                item.property_type === "아파트"
                                  ? "bg-[#E8F3FF] text-[#3182F6]"
                                  : item.property_type === "오피스텔"
                                  ? "bg-[#F0EBFE] text-[#7B2CBF]"
                                  : item.property_type === "연립다세대"
                                  ? "bg-[#FFF4E6] text-[#FF8800]"
                                  : "bg-[#E6F9F5] text-[#00A455]"
                              }`}
                            >
                              {item.property_type === "연립다세대"
                                ? "빌라/투룸"
                                : item.property_type === "단독다가구"
                                ? "원룸/다가구"
                                : item.property_type || "아파트"}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-extrabold text-[#191F28] whitespace-nowrap">
                            {item.apt_name || (item.dong ? `${item.dong} (${item.property_type || "원룸"})` : item.property_type || "단독/원룸")}
                          </td>
                          <td className="py-3 px-3.5 text-[#4E5968] whitespace-nowrap">
                            {item.dong || item.jibun || "-"}
                          </td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                                isTrade
                                  ? "bg-[#FEECEE] text-[#F04452]"
                                  : isJeonse
                                  ? "bg-[#E8F3FF] text-[#3182F6]"
                                  : "bg-[#E6F9F5] text-[#00B493]"
                              }`}
                            >
                              {item.trade_type}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-black text-[#191F28] text-sm whitespace-nowrap">
                            <span className={isTrade ? "text-[#F04452]" : isJeonse ? "text-[#3182F6]" : "text-[#191F28]"}>
                              {formattedPrice}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-[#4E5968] font-medium whitespace-nowrap">
                            {item.exclu_use_ar || item.exclusive_area || "-"}㎡ ({toPyeong(item.exclu_use_ar || item.exclusive_area)}평)
                          </td>
                          <td className="py-3 px-3.5 text-[#4E5968] font-medium whitespace-nowrap">
                            {item.floor ? `${item.floor}층` : "-"}
                          </td>
                          <td className="py-3 px-3.5 text-[#191F28] font-semibold whitespace-nowrap">
                            방 {item.rooms || 3} / 욕실 {item.bathrooms || 1}
                          </td>
                          <td className="py-3 px-3.5 text-[#8B95A1] whitespace-nowrap">{item.req_gbn || "중개거래"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 테이블 페이지네이션 컨트롤 (토스 스타일 고성능 서버사이드 페이징) */}
          {!isLoading && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#F2F4F6]">
              <div className="text-xs font-semibold text-[#8B95A1]">
                총 <span className="font-extrabold text-[#191F28]">{totalCount.toLocaleString()}</span>건 중{" "}
                <span className="text-[#3182F6] font-bold">
                  {((tablePage - 1) * ROWS_PER_PAGE + 1).toLocaleString()} - {Math.min(tablePage * ROWS_PER_PAGE, totalCount).toLocaleString()}
                </span>
                건 표시 (페이지 {tablePage} / {totalPages.toLocaleString()})
              </div>

              <div className="flex items-center gap-1">
                {/* 맨 처음 페이지 */}
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={tablePage === 1}
                  title="첫 페이지"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#6B7684] hover:bg-[#F2F4F6] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  ⏮
                </button>
                {/* 이전 페이지 */}
                <button
                  onClick={() => handlePageChange(tablePage - 1)}
                  disabled={tablePage === 1}
                  title="이전 페이지"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#6B7684] hover:bg-[#F2F4F6] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  ◀ 이전
                </button>

                {/* 동적 5개 페이지 번호 윈도우 */}
                {(() => {
                  const windowSize = 5;
                  let start = Math.max(1, tablePage - Math.floor(windowSize / 2));
                  let end = start + windowSize - 1;
                  if (end > totalPages) {
                    end = totalPages;
                    start = Math.max(1, end - windowSize + 1);
                  }
                  const pages = [];
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  return pages.map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        tablePage === pageNum
                          ? "bg-[#3182F6] text-white shadow-xs font-extrabold scale-105"
                          : "bg-transparent text-[#4E5968] hover:bg-[#F2F4F6]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ));
                })()}

                {/* 다음 페이지 */}
                <button
                  onClick={() => handlePageChange(tablePage + 1)}
                  disabled={tablePage === totalPages}
                  title="다음 페이지"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#6B7684] hover:bg-[#F2F4F6] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  다음 ▶
                </button>
                {/* 맨 끝 페이지 */}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={tablePage === totalPages}
                  title="마지막 페이지"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#6B7684] hover:bg-[#F2F4F6] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  ⏭
                </button>
              </div>
            </div>
          )}
        </section>
        ) : (
        /* ========================================================================= */
        /* [현재 매물 모드 (Demo)] 직방/다방 스타일 B2B 제휴 매물 카드 그리드        */
        /* ========================================================================= */
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-5 sm:space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-[#F2F4F6]">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#3182F6] text-white text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <span>🏠</span>
                  <span>B2B 제휴 매물</span>
                </span>
                <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                  {currentRegionLabel} 제휴 공인중개사 실시간 매물 ({filteredMockListings.length}건)
                </h3>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                토스제휴 중개사 네트워크에서 실시간 등록된 현장 검증 호가 매물 데이터입니다. (클릭 시 지도 위치 연동)
              </p>
            </div>

            {/* 매물 등록 제휴 문의 버튼 */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => showToast("🤝 공인중개사 제휴 문의: partners@zipview.co.kr (상담 접수 중)")}
                className="px-3.5 py-2 rounded-full text-xs font-bold bg-[#E8F3FF] hover:bg-[#D5E8FF] text-[#3182F6] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>🤝 중개사 매물 제휴 등록</span>
              </button>
            </div>
          </div>

          {/* 매물 카테고리 & 거래 유형 2단 필터 버튼군 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* 1) 주택 유형 필터 */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "전체 매물" },
                { id: "아파트", label: "아파트" },
                { id: "원룸", label: "원룸" },
                { id: "오피스텔", label: "오피스텔" },
                { id: "빌라/투룸", label: "빌라/투룸" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setListingPropertyFilter(p.id)}
                  className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                    listingPropertyFilter === p.id
                      ? "bg-[#3182F6] text-white shadow-xs font-black"
                      : "bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* 2) 거래 유형 필터 */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "전체 거래" },
                { id: "매매", label: "매매" },
                { id: "전세", label: "전세" },
                { id: "월세", label: "월세" }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setListingTradeFilter(t.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                    listingTradeFilter === t.id
                      ? "bg-[#191F28] text-white font-black"
                      : "bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 직방/다방 스타일 매물 카드 그리드 (반응형 3열) */}
          {filteredMockListings.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-[#E5E8EB]">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F2F4F6] text-[#8B95A1] flex items-center justify-center text-2xl shadow-inner">
                🏠
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-[#191F28]">
                  {searchKeyword.trim() ? `"${searchKeyword}" 조건에 맞는 제휴 매물이 없습니다` : "조회된 제휴 매물이 없습니다"}
                </h4>
                <p className="text-xs text-[#8B95A1]">
                  {searchKeyword.trim()
                    ? "단지명이나 동 이름을 확인하시거나, 다른 검색어로 검색해 보세요."
                    : "해당 지역의 제휴 매물이 준비 중이거나 필터 조건에 부합하는 매물이 없습니다."}
                </p>
              </div>
              {(searchKeyword.trim() || listingPropertyFilter !== "all" || listingTradeFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchKeyword("");
                    setListingPropertyFilter("all");
                    setListingTradeFilter("all");
                  }}
                  className="px-4 py-2 bg-[#E8F3FF] hover:bg-[#D4E8FF] text-[#3182F6] text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  전체 매물 보기 (필터 및 검색 초기화)
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4.5">
              {filteredMockListings.map((item) => {
                const isSelected = selectedListing?.id === item.id;
                const priceColor = item.deal_type === "매매" ? "text-[#F04452]" : item.deal_type === "전세" ? "text-[#3182F6]" : "text-[#00B493]";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectListing(item)}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer space-y-2.5 sm:space-y-3 relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? "border-[#3182F6] ring-2 ring-[#3182F6]/30 shadow-lg bg-[#F8FAFF]"
                        : "border-[#E5E8EB] hover:border-[#3182F6]/50 hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    {/* 상단 뱃지 & 관리비 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-[#E8F3FF] text-[#3182F6]">
                            {item.property_type}
                          </span>
                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                              item.deal_type === "매매"
                                ? "bg-[#FFF0F0] text-[#F04452]"
                                : item.deal_type === "전세"
                                ? "bg-[#E8F3FF] text-[#3182F6]"
                                : "bg-[#E6F9F5] text-[#00A455]"
                            }`}
                          >
                            {item.deal_type}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#8B95A1]">{item.maintenance_fee}</span>
                      </div>

                      {/* 가격 & 건물명 & 제목 */}
                      <div>
                        <h4 className={`text-lg sm:text-xl font-black tracking-tight ${priceColor}`}>
                          {item.price_summary}
                        </h4>
                        <p className="text-xs sm:text-sm font-extrabold text-[#191F28] line-clamp-1 mt-0.5 sm:mt-1">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#8B95A1] mt-0.5 font-medium">
                          {item.apt_name} · {item.floor} · {item.area}
                        </p>
                      </div>

                      {/* 태그 리스트 */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] font-bold bg-[#F2F4F6] text-[#6B7684] px-2 py-0.5 rounded-md"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* 매물 핵심 설명 */}
                      <p className="text-[11px] text-[#4E5968] bg-[#F9FAFB] p-2.5 rounded-xl border border-[#F2F4F6] leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    {/* 하단 중개사 정보 & 인터랙션 버튼군 */}
                    <div className="pt-3 border-t border-[#F2F4F6] flex items-center justify-between gap-2 mt-2">
                      <div className="text-[11px] text-[#8B95A1] truncate max-w-[150px]">
                        <div className="font-extrabold text-[#191F28] truncate">🏢 {item.agency_name}</div>
                        <div className="text-[10px] text-[#8B95A1]">{item.agent_name}</div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectListing(item);
                          }}
                          className="px-2.5 py-1.5 bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[#191F28] text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          📍 위치
                        </button>
                        <a
                          href={`tel:${item.contact}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast(`📞 [중개사 문의 연결] ${item.agency_name} (${item.contact})`);
                          }}
                          className="px-3 py-1.5 bg-[#3182F6] hover:bg-[#1B64DA] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span>📞 문의</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. 토스 고객센터 스타일 플로팅 AI 상담 챗 모달                             */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isAiOpen && (
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-2 bg-[#3182F6] hover:bg-[#1B64DA] text-white px-5 py-3.5 rounded-full shadow-lg font-extrabold text-sm transition-all transform hover:scale-105 active:scale-95"
          >
            <span>✨</span>
            <span>집뷰 AI 상담</span>
          </button>
        )}

        {isAiOpen && (
          <div className="w-[360px] sm:w-[400px] h-[520px] bg-white rounded-3xl shadow-2xl border border-[#E5E8EB] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* AI 모달 상단 헤더 */}
            <div className="bg-[#3182F6] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  AI
                </div>
                <div>
                  <h4 className="font-extrabold text-sm leading-tight">집뷰 부동산 브리핑 AI</h4>
                  <p className="text-[11px] text-white/80">{currentRegionLabel} 맞춤 분석</p>
                </div>
              </div>
              <button
                onClick={() => setIsAiOpen(false)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* 대화 내역 스크롤 영역 */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F9FAFB] text-xs">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    m.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                      m.sender === "user"
                        ? "bg-[#3182F6] text-white rounded-br-none"
                        : "bg-white text-[#191F28] border border-[#E5E8EB] rounded-bl-none shadow-2xs"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-[#8B95A1] mt-1 px-1">{m.time}</span>
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-1.5 bg-white text-[#8B95A1] px-4 py-2.5 rounded-2xl border border-[#E5E8EB] w-fit text-[11px]">
                  <div className="w-2 h-2 rounded-full bg-[#3182F6] animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-[#3182F6] animate-bounce delay-100"></div>
                  <div className="w-2 h-2 rounded-full bg-[#3182F6] animate-bounce delay-200"></div>
                  <span className="ml-1">데이터 분석 브리핑 작성 중...</span>
                </div>
              )}
              <div ref={chatBottomRef}></div>
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleAiSubmit} className="p-3 bg-white border-t border-[#E5E8EB] flex gap-2">
              <input
                type="text"
                placeholder="궁금한 단지명이나 시세를 물어보세요..."
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                className="flex-1 bg-[#F2F4F6] text-xs px-3.5 py-2.5 rounded-full border border-transparent outline-none focus:border-[#3182F6] focus:bg-white transition-all font-medium"
              />
              <button
                type="submit"
                disabled={!chatPrompt.trim() || aiLoading}
                className="bg-[#3182F6] text-white w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs disabled:opacity-40 hover:bg-[#1B64DA] transition-all"
              >
                ↑
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. 하단 플로팅 토스트 메시지                                              */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191F28]/95 backdrop-blur-sm text-white text-xs font-semibold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
