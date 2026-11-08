import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import GeminiChatModal from "./GeminiChatModal";

// [Props 체인 복구] GeminiChatModal 브라우저/번들러 런타임 호환 리졸버
const ResolvedGeminiChatModal = (typeof GeminiChatModal !== "undefined" && GeminiChatModal)
  ? (GeminiChatModal.default || GeminiChatModal)
  : ((typeof window !== "undefined" && window.moduleRegistry && window.moduleRegistry["GeminiChatModal"])
    ? (window.moduleRegistry["GeminiChatModal"].default || window.moduleRegistry["GeminiChatModal"])
    : null);

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

// ==================== AI 챗봇 → 대시보드 UI 제어 매핑 (target_view / trade_type) ====================
// 백엔드가 내려주는 target_view 값을 대시보드 viewMode 상태값으로 매핑
export const VIEW_MODE_BY_TARGET = { B2B: "listing", TRANSACTION: "transaction" };
// 거래 유형 필터로 허용되는 값 (매물/차트 필터 버튼의 id 와 동일)
export const TRADE_FILTER_IDS = ["매매", "전세", "월세"];

// ==================== 전국 시/도 및 시/군/구 정규화 매퍼 ====================
export const SIDO_ALIASES = {
  "서울": "서울특별시", "서울시": "서울특별시",
  "경기": "경기도", "경기도": "경기도",
  "인천": "인천광역시", "인천시": "인천광역시",
  "부산": "부산광역시", "부산시": "부산광역시",
  "대구": "대구광역시", "대구시": "대구광역시",
  "광주": "광주광역시", "광주시": "광주광역시",
  "대전": "대전광역시", "대전시": "대전광역시",
  "울산": "울산광역시", "울산시": "울산광역시",
  "세종": "세종특별자치시", "세종시": "세종특별자치시",
  "강원": "강원특별자치도", "강원도": "강원특별자치도",
  "충북": "충청북도", "충청북": "충청북도",
  "충남": "충청남도", "충청남": "충청남도",
  "전북": "전북특별자치도", "전라북도": "전북특별자치도",
  "전남": "전라남도", "전라남": "전라남도",
  "경북": "경상북도", "경상북": "경상북도",
  "경남": "경상남도", "경상남": "경상남도",
  "제주": "제주특별자치도", "제주도": "제주특별자치도"
};

/**
 * 챗봇 또는 외부에서 전달받은 지역 정보(code, sidoName, districtName, label)를
 * REGION_DATA의 정확한 [selectedSido, lawdCd]로 100% 정규화 매핑합니다.
 */
export const resolveRegionFromData = (target) => {
  if (!target) return null;
  const { code, sidoName, districtName, label } = target;

  // 1순위: 5자리 법정동 코드로 매핑
  if (code && String(code).trim().length === 5) {
    const cleanCode = String(code).trim();
    for (const [sido, distList] of Object.entries(REGION_DATA)) {
      const match = distList.find((d) => String(d.code) === cleanCode);
      if (match) {
        return {
          sido,
          districtName: match.name,
          code: match.code,
          label: `${sido} ${match.name}`
        };
      }
    }
  }

  // 2순위: sidoName과 districtName 정규화 매핑
  const cleanSido = sidoName ? String(sidoName).trim() : "";
  const cleanDist = districtName ? String(districtName).trim() : "";

  const resolvedSido =
    SIDO_ALIASES[cleanSido] ||
    cleanSido ||
    Object.keys(REGION_DATA).find((s) => cleanSido && s.startsWith(cleanSido.slice(0, 2)));

  if (resolvedSido && REGION_DATA[resolvedSido]) {
    const list = REGION_DATA[resolvedSido];
    let match = list.find((d) => d.name === cleanDist);
    if (!match && cleanDist) {
      const normDist = cleanDist.replace(/\s+/g, "").replace(/(?:시|군|구)$/g, "");
      match = list.find((d) => {
        const itemNorm = d.name.replace(/\s+/g, "").replace(/(?:시|군|구)$/g, "");
        return itemNorm === normDist || itemNorm.includes(normDist) || normDist.includes(itemNorm);
      });
    }
    if (match) {
      return {
        sido: resolvedSido,
        districtName: match.name,
        code: match.code,
        label: `${resolvedSido} ${match.name}`
      };
    }
  }

  // 3순위: 구 이름만으로 전국 252개 지역 전체 탐색
  if (cleanDist) {
    const normDist = cleanDist.replace(/\s+/g, "").replace(/(?:시|군|구)$/g, "");
    for (const [sido, distList] of Object.entries(REGION_DATA)) {
      const match = distList.find((d) => {
        const itemNorm = d.name.replace(/\s+/g, "").replace(/(?:시|군|구)$/g, "");
        return itemNorm === normDist;
      });
      if (match) {
        return {
          sido,
          districtName: match.name,
          code: match.code,
          label: `${sido} ${match.name}`
        };
      }
    }
  }

  // 4순위: label(전체 문자열)에서 탐색
  if (label) {
    const normLabel = label.replace(/\s+/g, "");
    for (const [sido, distList] of Object.entries(REGION_DATA)) {
      for (const dist of distList) {
        const full = `${sido}${dist.name}`.replace(/\s+/g, "");
        if (normLabel.includes(full) || full.includes(normLabel)) {
          return {
            sido,
            districtName: dist.name,
            code: dist.code,
            label: `${sido} ${dist.name}`
          };
        }
      }
    }
  }

  return null;
};
// ==================== 스켈레톤 UI 컴포넌트군 ====================

// 1. 차트 영역 스켈레톤 및 자동 로딩 스피너 UI (animate-pulse & Spinner)
const ChartSkeleton = ({ regionLabel }) => (
  <div className="w-full h-80 min-h-[320px] bg-[#F2F4F6] rounded-xl relative overflow-hidden border border-[#E5E8EB] p-6 flex flex-col justify-between">
    <div className="flex items-center justify-between animate-pulse">
      <div className="space-y-2">
        <div className="h-4 bg-[#E5E8EB] rounded-md w-48"></div>
        <div className="h-3 bg-[#E5E8EB] rounded-md w-32"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-[#E5E8EB] rounded-full w-16"></div>
        <div className="h-6 bg-[#E5E8EB] rounded-full w-16"></div>
      </div>
    </div>
    <div className="w-full flex items-end justify-between h-36 px-4 gap-1 opacity-40 animate-pulse">
      {[45, 60, 52, 70, 65, 80, 75, 90, 85, 100, 95, 110, 105, 120, 115, 130, 125, 140].map((h, i) => (
        <div
          key={i}
          className="bg-[#D1D6DB] rounded-t-sm w-full transition-all"
          style={{ height: `${(h / 140) * 100}%` }}
        ></div>
      ))}
    </div>
    <div className="flex justify-between pt-2 border-t border-[#E5E8EB] animate-pulse">
      {["21.11", "22.05", "22.11", "23.05", "23.11", "24.05", "24.10"].map((label, idx) => (
        <div key={idx} className="h-3 bg-[#E5E8EB] rounded w-8"></div>
      ))}
    </div>
    {/* 중앙 로딩 스피너 및 상태 안내 */}
    <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-xs z-10 pointer-events-none">
      <div className="bg-white px-5 py-3.5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#0f172a] border-t-transparent rounded-full animate-spin shrink-0"></div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#0F172A]">
            {regionLabel ? `[${regionLabel}] 데이터를 불러오는 중입니다...` : "데이터를 불러오는 중입니다..."}
          </span>
          <span className="text-[10px] text-[#64748B]">최신 36개월 국토교통부 실거래 원장 자동 동기화 중</span>
        </div>
      </div>
    </div>
  </div>
);

// 2. 테이블 영역 스켈레톤 UI (5~6줄 막대기 형태)
const TableSkeleton = ({ regionLabel }) => (
  <div className="space-y-3 bg-white rounded-xl border border-[#F2F4F6] p-4 animate-pulse">
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
    <div className="text-center py-2 text-xs font-medium text-[#8B95A1] flex items-center justify-center gap-2">
      <div className="w-3.5 h-3.5 border-2 border-[#0f172a] border-t-transparent rounded-full animate-spin"></div>
      <span>{regionLabel ? `[${regionLabel}] 실거래 계약 데이터를 불러오는 중입니다...` : "데이터를 불러오는 중입니다..."}</span>
    </div>
  </div>
);

// 3. 비교 매트릭스 스켈레톤 UI
const MatrixSkeleton = ({ regionLabel }) => (
  <div className="w-full h-48 bg-[#F8FAFC] rounded-xl flex flex-col items-center justify-center p-6 border border-[#E5E8EB] space-y-2">
    <div className="w-6 h-6 border-2 border-[#7B2CBF] border-t-transparent rounded-full animate-spin"></div>
    <span className="text-xs font-bold text-[#0F172A]">
      {regionLabel ? `[${regionLabel}] 1:1 비교 분석 데이터를 불러오는 중입니다...` : "데이터를 불러오는 중입니다..."}
    </span>
    <span className="text-[10px] text-[#64748B]">단지별 평균 매매가 및 전세가율 자동 연산 중</span>
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

    // 100% 실제 데이터 기반 (실거래가 없는 월은 0으로 정확하게 표기)
    const finalTrade = avgTrade || 0;
    const finalJeonse = avgJeonse || 0;

    return {
      month: ym,
      rawMonth: ymd,
      tradePrice: finalTrade,
      jeonsePrice: finalJeonse,
      tradeCount: data.tradeCount,
      jeonseCount: data.jeonseCount,
      volume: data.totalCount
    };
  });

  return chartPoints;
};

// ==================== 1:1 비교용 B2B 검색형 드롭다운 (Searchable Combobox) ====================
const SearchableComplexCombobox = ({
  tag = "단지 A",
  theme = "navy", // "navy" | "purple"
  value = "",
  options = [],
  onChange,
  placeholder = "단지명 검색..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // 실시간 텍스트 필터링 (사용자 입력 포함 여부 검색)
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.trim().toLowerCase();
    return options.filter((opt) => String(opt).toLowerCase().includes(term));
  }, [options, searchTerm]);

  // 검색어 입력 시 하이라이트 인덱스 초기화
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // <input> 모드 전환 시 자동 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // 화면 외부 클릭 (Outside Click & Touch) 시 닫힘 처리
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // 키보드 방향키 이동 시 스크롤 자동 추적
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // 키보드 제어 (위/아래 방향키 탐색, Enter 선택, Escape 닫기)
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        setSearchTerm("");
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev - 1 + filteredOptions.length) % filteredOptions.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  const handleSelect = (selectedName) => {
    onChange(selectedName);
    setIsOpen(false);
    setSearchTerm("");
  };

  const isNavy = theme === "navy";
  const badgeClass = isNavy ? "bg-[#0f172a] text-white" : "bg-[#7B2CBF] text-white";
  const borderFocusClass = isNavy
    ? "border-[#0f172a] ring-2 ring-[#0f172a]/10"
    : "border-[#7B2CBF] ring-2 ring-[#7B2CBF]/10";
  const highlightClass = isNavy ? "bg-[#0f172a] text-white" : "bg-[#7B2CBF] text-white";

  return (
    <div ref={containerRef} className="relative w-full text-left" onKeyDown={handleKeyDown}>
      {/* 1. 일반 뷰: 클릭 전 상태 (버튼형 UI) */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setSearchTerm("");
          }}
          className="w-full flex items-center justify-between gap-1.5 bg-white text-xs font-bold pl-2.5 pr-2.5 py-2 rounded-lg border border-[#E2E8F0] hover:border-slate-400 shadow-2xs transition-all cursor-pointer text-left truncate group focus:outline-none focus:ring-2 focus:ring-slate-300"
          title={`${tag}: ${value || "선택"}`}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}>
              {tag}
            </span>
            <span className={`truncate text-xs ${value ? "text-[#0F172A] font-extrabold" : "text-slate-400 font-normal"}`}>
              {value || placeholder}
            </span>
          </div>
          <span className="text-[9px] text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
            ▼
          </span>
        </button>
      ) : (
        /* 2. 검색 뷰: 클릭 시 <input> 모드로 실시간 전환 */
        <div className={`w-full flex items-center gap-1.5 bg-white text-xs pl-2.5 pr-2 py-1.5 rounded-lg border shadow-xs transition-all ${borderFocusClass}`}>
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}>
            {tag}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={value || placeholder}
            className="w-full bg-transparent text-xs font-bold text-[#0F172A] outline-none placeholder:text-slate-400 placeholder:font-normal"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm("");
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 font-bold shrink-0 cursor-pointer"
              title="검색어 초기화"
            >
              ✕
            </button>
          )}
          <span className="text-[9px] text-slate-400 shrink-0 pointer-events-none">
            ▲
          </span>
        </div>
      )}

      {/* 3. 실시간 필터링 드롭다운 결과 목록 */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg border border-[#E2E8F0] shadow-md z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[210px] max-w-full">
          {/* 상단 검색 상태 표시줄 */}
          <div className="bg-[#F8FAFC] px-2.5 py-1 border-b border-[#F1F5F9] flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>{searchTerm ? `"${searchTerm}" 검색 결과` : "전체 단지 목록"}</span>
            <span>{filteredOptions.length}개 단지</span>
          </div>

          {/* 목록 스크롤 컨테이너 (모바일 가상 키보드 대비 max-h-56) */}
          <div ref={listRef} className="max-h-56 overflow-y-auto divide-y divide-[#F8FAFC]">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400 font-medium">
                일치하는 단지가 없습니다.
              </div>
            ) : (
              filteredOptions.map((name, idx) => {
                const isSelected = name === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={`${tag}-${name}`}
                    data-index={idx}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(name)}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${isHighlighted
                        ? highlightClass
                        : isSelected
                          ? "bg-slate-100 font-black text-slate-900"
                          : "text-slate-700 hover:bg-slate-50 font-medium"
                      }`}
                  >
                    <span className="truncate pr-2">{name}</span>
                    {isSelected && (
                      <span className={`text-[11px] font-bold ${isHighlighted ? "text-white" : isNavy ? "text-[#1e3a8a]" : "text-[#7B2CBF]"}`}>
                        ✓
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 주식 거래 앱 스타일 커스텀 툴팁 (모바일 최적화) ====================
const TossStockChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload || {};

  return (
    <div className="bg-[#191F28]/95 backdrop-blur-md text-white px-2.5 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-md text-[11px] sm:text-xs border border-white/10 space-y-1 sm:space-y-2 min-w-[145px] sm:min-w-[190px] max-w-[210px] sm:max-w-none pointer-events-none select-none">
      <div className="text-[#8B95A1] font-semibold pb-1 border-b border-white/10 flex justify-between items-center gap-2">
        <span className="font-extrabold text-white text-xs sm:text-sm">20{label}</span>
        <span className="text-[9px] sm:text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-[#B0B8C1] font-medium shrink-0">
          실거래
        </span>
      </div>

      {/* 매매 평균가 & 주식형 등락률 */}
      {data.tradePrice > 0 && (
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-[#F04452] gap-1.5">
            <span className="font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F04452] shrink-0"></span>
              매매가
            </span>
            <span className="font-black text-xs sm:text-sm">{formatTossMoney(data.tradePrice)}</span>
          </div>
          {data.tradeDiff !== undefined && data.tradeDiff !== 0 && (
            <div className="flex justify-end text-[10px] sm:text-[11px] font-extrabold">
              <span className={data.isTradeUp ? "text-[#F04452]" : "text-[#1e3a8a]"}>
                {data.isTradeUp ? "▲ +" : "▼ -"}{formatTossMoney(Math.abs(data.tradeDiff))} ({data.tradeRate > 0 ? `+${data.tradeRate}` : data.tradeRate}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* 전세 평균가 & 주식형 등락률 */}
      {data.jeonsePrice > 0 && (
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-[#1e3a8a] gap-1.5">
            <span className="font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a] shrink-0"></span>
              전세가
            </span>
            <span className="font-black text-xs sm:text-sm">{formatTossMoney(data.jeonsePrice)}</span>
          </div>
          {data.jeonseDiff !== undefined && data.jeonseDiff !== 0 && (
            <div className="flex justify-end text-[10px] sm:text-[11px] font-extrabold">
              <span className={data.isJeonseUp ? "text-[#F04452]" : "text-[#1e3a8a]"}>
                {data.isJeonseUp ? "▲ +" : "▼ -"}{formatTossMoney(Math.abs(data.jeonseDiff))} ({data.jeonseRate > 0 ? `+${data.jeonseRate}` : data.jeonseRate}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* 월간 거래량 정보 */}
      <div className="flex justify-between items-center text-[#B0B8C1] pt-1 border-t border-white/10 text-[10px] sm:text-[11px] gap-1.5">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8B95A1] shrink-0"></span>
          거래량
        </span>
        <span className="font-extrabold text-white">{data.volume || 0}건</span>
      </div>
    </div>
  );
};

// ==================== 1:1 비교 막대그래프 툴팁 (모바일 최적화) ====================
const ComparisonBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#191F28]/95 backdrop-blur-md text-white px-2.5 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-md text-[11px] sm:text-xs border border-white/10 space-y-1 sm:space-y-1.5 min-w-[135px] sm:min-w-[170px] max-w-[190px] sm:max-w-none pointer-events-none select-none">
      <div className="text-[#8B95A1] font-bold pb-1 border-b border-white/10 flex justify-between items-center gap-2">
        <span className="truncate">{label}</span>
        <span className="text-[#1e3a8a] font-extrabold text-[10px] sm:text-xs shrink-0">1:1 대조</span>
      </div>
      {payload.map((entry, index) => {
        const isPercent = String(label).includes("전세가율");
        return (
          <div key={index} className="flex justify-between items-center gap-2">
            <span className="flex items-center gap-1 text-slate-300 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
              <span className="truncate max-w-[75px] sm:max-w-[100px] font-semibold">{entry.name}:</span>
            </span>
            <span className="font-black text-white shrink-0">
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

// ==================== [B2B 제휴 매물] 국토부/Supabase 실거래 원장 기반 100% 동적 생성기 ====================
const generateListingsFromTrades = (trades, centerLat, centerLng, regionName) => {
  if (!trades || trades.length === 0) return [];
  const cLat = Number(centerLat) || 37.4979;
  const cLng = Number(centerLng) || 127.0276;
  const reg = regionName || "해당 지역";

  return trades.slice(0, 30).map((t, idx) => {
    const formattedPrice = t.price_formatted || (t.trade_type === "월세"
      ? `보증금 ${formatTossMoney(t.deposit)} / 월 ${t.monthly_rent}만`
      : formatTossMoney(t.deal_amount || t.deposit));
    const title = `${t.apt_name || t.dong || "검증 단지"} ${t.trade_type || "실거래"} 확인 매물`;
    const dLat = (idx % 6 - 2.5) * 0.0018;
    const dLng = (Math.floor(idx / 6) - 2.5) * 0.0022;

    return {
      id: `real-listing-${t.id || idx}`,
      property_type: t.property_type || "아파트",
      deal_type: t.trade_type || "매매",
      title,
      apt_name: t.apt_name || (t.dong ? `${t.dong} (${t.property_type || "단지"})` : "실거래 단지"),
      dong: t.dong || "",
      price_summary: `${t.trade_type || "실거래"} ${formattedPrice}`,
      raw_price: t.deal_amount || t.deposit || 0,
      floor: t.floor ? `${t.floor}층` : "-",
      area: t.exclu_use_ar ? `${t.exclu_use_ar}㎡ (${toPyeong(t.exclu_use_ar)}평)` : "-",
      maintenance_fee: "관리비 실비 정산",
      tags: ["실거래검증", t.trade_type || "매매", t.property_type || "아파트", t.dong].filter(Boolean),
      contact: "집뷰 공인중개 네트워크",
      agency_name: `집뷰 B2B 파트너스 (${reg})`,
      agent_name: "공인중개사 네트워크",
      description: `국토교통부 실거래 원장 연동 검증 매물 (${t.deal_date || "최근 실거래"}), 전용 ${t.exclu_use_ar || "-"}㎡`,
      region: reg,
      lat: Number((cLat + dLat).toFixed(6)),
      lng: Number((cLng + dLng).toFixed(6))
    };
  });
};

// ==================== Render 클라우드 배포 백엔드 API 주소 ====================
const RENDER_BACKEND_URL = "https://zipview-real-estate-platform.onrender.com";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined" && window.ZIPVIEW_API_URL) {
    return window.ZIPVIEW_API_URL;
  }
  return RENDER_BACKEND_URL;
};

export default function TossStyleRealEstateDashboard() {
  // ==================== 1. 전국 지역 상태 (lawdCd 필수 바인딩) ====================
  // ==================== 1. [B2B 확장] View Mode (실거래가 vs 현재 매물 Demo) ====================
  const [viewMode, setViewMode] = useState("transaction"); // "transaction" | "listing"
  // [B2B 탭 제어] activeTab 상태 ('실거래 원장 분석' | 'B2B 제휴 매물 현황')
  const [activeTab, setActiveTabState] = useState("실거래 원장 분석");

  const setActiveTab = useCallback((tabName) => {
    const str = String(tabName || "").trim();
    if (str === "B2B" || str.includes("B2B") || str.includes("제휴") || str === "listing") {
      setActiveTabState("B2B 제휴 매물 현황");
      setViewMode("listing");
    } else {
      setActiveTabState("실거래 원장 분석");
      setViewMode("transaction");
    }
    setSelectedListing(null);
  }, []);
  const [selectedListing, setSelectedListing] = useState(null);
  const [listingPropertyFilter, setListingPropertyFilter] = useState("all");
  const [listingTradeFilter, setListingTradeFilter] = useState("all");
  // URL 쿼리 파라미터(?lawdCd=... 또는 ?region=... 등)에서 실시간 초기화하거나 REGION_DATA 기반 동적 바인딩
  const initialRegion = useMemo(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("lawdCd") || params.get("code");
      const urlSido = params.get("sido") || params.get("city");
      const urlDist = params.get("district") || params.get("dist");
      const urlRegion = params.get("region") || params.get("q");

      const resolved = resolveRegionFromData({
        code: urlCode,
        sidoName: urlSido,
        districtName: urlDist || urlRegion,
        label: urlRegion
      });

      if (resolved) {
        return resolved;
      }
    }
    const firstSido = Object.keys(REGION_DATA)[0] || "서울특별시";
    const firstDist = REGION_DATA[firstSido]?.[0] || { name: "강남구", code: "11680" };
    return {
      sido: firstSido,
      districtName: firstDist.name,
      code: firstDist.code,
      label: `${firstSido} ${firstDist.name}`
    };
  }, []);

  // 전국 지역 상태 (URL 및 실시간 동적 바인딩)
  const [selectedSido, setSelectedSido] = useState(initialRegion.sido);
  const [lawdCd, setLawdCd] = useState(initialRegion.code);
  const [regionCoords, setRegionCoords] = useState(REGION_CENTERS[initialRegion.code] || { lat: 37.4979, lng: 127.0276 });
  const listingMarkersRef = useRef([]);

  // 필터 및 검색
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // [스마트 자동완성 검색] 실시간 단지명/건물명 필터링 키워드
  const [searchKeyword, setSearchKeyword] = useState("");
  // [AI 검색 컨텍스트] 챗봇으로 대시보드가 동기화되었을 때 사용자의 원본 질문을 메인 화면에 표시
  const [aiActiveQuery, setAiActiveQuery] = useState("");
  const aiKeywordAppliedRef = useRef(false); // AI(핫스팟 동)가 검색 키워드를 채웠는지 여부

  // AI 검색 컨텍스트 초기화 (사용자가 직접 지역을 바꾸거나 칩을 닫을 때)
  const clearAiContext = () => {
    setAiActiveQuery("");
    if (aiKeywordAppliedRef.current) {
      setSearchKeyword("");
      aiKeywordAppliedRef.current = false;
    }
  };

  // ==================== 2. 데이터 및 로딩 상태 ====================
  const [loading, setLoading] = useState(false);
  const isLoading = loading;
  const [fetchError, setFetchError] = useState(null);
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

  // ==================== [B2B 제휴 매물] 국토부/Supabase 실거래 원장 동적 바인딩 ====================
  const dynamicListings = useMemo(() => {
    const center = REGION_CENTERS[lawdCd] || regionCoords;
    return generateListingsFromTrades(rawTrades, center.lat, center.lng, currentRegionLabel);
  }, [rawTrades, lawdCd, regionCoords, currentRegionLabel]);

  const filteredRealListings = useMemo(() => {
    return dynamicListings.filter((item) => {
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
  }, [dynamicListings, listingPropertyFilter, listingTradeFilter, searchKeyword]);

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
  const [pendingDisambiguation, setPendingDisambiguation] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "안녕하세요! 집뷰 AI 부동산 애널리스트입니다.\n국토교통부 36개월 실거래 시세, 주식형 추세선, 단지별 1:1 매트릭스 비교에 대해 무엇이든 편하게 물어보세요.",
      time: "방금 전"
    }
  ]);
  const chatBottomRef = useRef(null);
  const abortControllerRef = useRef(null);
  const chatSessionIdRef = useRef(`zipview-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

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
      if (!isRetry) {
        setFetchError(null);
      }

      const targetPort = isRetry ? (apiPort === 8001 ? 8000 : 8001) : apiPort;

      const params = {
        lawdCd: currentLawdCd,
        LAWD_CD: currentLawdCd,
        regional_code: currentLawdCd,
        page: targetPage,
        limit: ROWS_PER_PAGE,
        auto_sync: true
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
        const baseUrl = getApiBaseUrl();
        const url = `${baseUrl}/api/trades/${currentLawdCd}`;
        const response = await axios.get(url, {
          params,
          signal,
          timeout: 45000
        });

        if (signal?.aborted) return;

        if (response.data) {
          const fetchedTrades = response.data.trades || (Array.isArray(response.data) ? response.data : []);
          const serverTotalCount = response.data.total_count ?? response.data.totalCount ?? fetchedTrades.length;

          // [침묵의 에러(Silent Fail) 원천 방어]: 0건 응답 시 즉시 에러 발생시켜 Error State 활성화
          if (serverTotalCount === 0 && !debouncedSearch.trim() && propertyTypeFilter === "all" && tradeTypeFilter === "all") {
            throw new Error("국토부 공공데이터 서버 응답 지연 또는 해당 지역 데이터를 불러오지 못했습니다.");
          }

          setFetchError(null);

          // 36개월 전수 통계 차트: 백엔드 집계 데이터 우선 적용
          const calculatedChart = (response.data.chart_data && response.data.chart_data.length > 0)
            ? response.data.chart_data
            : calculateChartData(fetchedTrades);

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

        console.warn(`[ZipView] 백엔드(${getApiBaseUrl()}) 연결/데이터 확인:`, err.message);
        // 즉시 에러 상태 활성화하여 0건짜리 빈 대시보드 및 이전 데이터 잔존 차단
        setFetchError("공공데이터 응답이 지연되었습니다. 잠시 후 다시 시도해주세요.");
        setRawTrades([]);
        setChartData([]);
        setTotalCount(0);
        setTotalPages(1);
        setAllBuildings([]);
        setComplexSummaryMap({});
        setSummaryInfo({
          totalCount: 0,
          latestTradePrice: "-",
          latestJeonsePrice: "-",
          lastSyncedAt: "-"
        });
        showToast(`[${currentRegionLabel}] 공공데이터 서버 응답이 지연되었습니다. [다시 시도]를 눌러주세요.`);
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

  // =========================================================================
  // [요구사항 2] 지역 선택 감지 및 자동 패칭 & 실시간 동기화 (useEffect)
  // =========================================================================
  useEffect(() => {
    // 유효성 조건 검증: '시/도'와 '시/군/구'가 모두 유효하게 선택된 상태에서만 자동 동기화 실행
    const isSidoValid = Boolean(selectedSido && REGION_DATA[selectedSido] && REGION_DATA[selectedSido].length > 0);
    const isLawdCdValid = Boolean(lawdCd && String(lawdCd).trim().length === 5 && !isNaN(Number(lawdCd)));

    if (!isSidoValid || !isLawdCdValid) {
      return;
    }

    // 이전 미완료 비동기 요청 취소 (경쟁 상태 완벽 방어)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 즉시 백엔드 API 데이터 요청 (실시간 자동 동기화)
    fetchData(lawdCd, 1, controller.signal);

    return () => {
      controller.abort();
    };
  }, [selectedSido, lawdCd, propertyTypeFilter, tradeTypeFilter, debouncedSearch, fetchData]);

  // =========================================================================
  // [상용화 2] URL 및 동적 메타데이터 동기화 (SEO, 구글/네이버 검색 엔진 및 봇 대응)
  // =========================================================================
  useEffect(() => {
    if (typeof window === "undefined" || !currentRegionLabel || !lawdCd) return;

    // 1) 브라우저 URL 쿼리 파라미터 실시간 동기화 (SEO 딥링크 및 크롤러 대응)
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("lawdCd") !== lawdCd) {
        url.searchParams.set("lawdCd", lawdCd);
        url.searchParams.set("region", currentRegionLabel);
        window.history.replaceState({ lawdCd, region: currentRegionLabel }, "", url.toString());
      }
    } catch (_) { }

    // 2) 동적 페이지 타이틀(Title) 최적화
    const pageTitle = `${currentRegionLabel} 아파트 실거래가 및 시세 분석 | 집뷰(ZipView)`;
    document.title = pageTitle;

    // 3) 검색엔진 크롤러용 동적 메타 태그(Description, OG, Twitter) 동기화
    const metaDescContent = `${currentRegionLabel} 최근 3개년 아파트·부동산 국토교통부 실거래가 원장, 매매·전세 시세 변동 추이 및 AI 단지 분석 리포트.`;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", metaDescContent);
    } else {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      metaDesc.content = metaDescContent;
      document.head.appendChild(metaDesc);
    }

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", pageTitle);
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", metaDescContent);

    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute("content", pageTitle);
    let twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute("content", metaDescContent);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", window.location.href);
    }
  }, [lawdCd, currentRegionLabel]);

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
        strokeColor: "#0f172a", // 채우기 색상보다 약간 진한 파란색 테두리
        strokeOpacity: 0.85,
        strokeStyle: "solid",
        fillColor: "#1e3a8a", // 토스 브랜드 컬러
        fillOpacity: 0.16, // 지도의 실제 건물 형태가 은은하게 비쳐 보이도록 투명도 0.22 적용
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
              <div style="padding:12px 14px;background:#ffffff;border-radius:6px;border:1px solid #cbd5e1;box-shadow:0 4px 6px -1px rgba(15,23,42,0.08);font-family:Pretendard,sans-serif;min-width:180px;">
                <div style="font-size:10px;font-weight:700;color:#1e3a8a;margin-bottom:2px;letter-spacing:0.02em;">실거래 단지 정보</div>
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
          <span style="font-size:10px;font-weight:700;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;">B2B 제휴 검증 매물</span>
          <span style="font-size:10px;font-weight:800;color:#6B7684;background:#F2F4F6;padding:2px 6px;border-radius:5px;">${item.property_type} · ${item.deal_type}</span>
        </div>
        <div style="font-size:13px;font-weight:900;color:#191F28;line-height:1.3;margin-bottom:4px;">${item.title}</div>
        <div style="font-size:15px;font-weight:900;color:${priceColor};margin-bottom:4px;">${item.price_summary}</div>
        <div style="font-size:11px;font-weight:600;color:#4E5968;margin-bottom:8px;">${item.floor} · ${item.area}</div>
        <div style="font-size:11px;color:#8B95A1;margin-bottom:8px;padding-top:6px;border-top:1px solid #F2F4F6;">
          중개사: ${item.agency_name} (${item.agent_name || "담당자"})
        </div>
        <a href="tel:${item.contact}" onclick="event.stopPropagation();" style="display:flex;align-items:center;justify-content:center;gap:4px;padding:8px 0;background:#0f172a;color:#ffffff;font-size:11px;font-weight:800;border-radius:8px;text-decoration:none;box-shadow:0 2px 6px rgba(49,130,246,0.3);">
          <span>문의: ${item.contact}</span>
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
    showToast(`[매물 선택] ${item.title}`);
    const map = mapInstanceRef.current;
    if (map && window.kakao && window.kakao.maps) {
      const coords = new window.kakao.maps.LatLng(item.lat, item.lng);
      map.relayout();
      map.panTo(coords);
      map.setLevel(2); // 건물이 잘 보이는 level 2로 자동 줌인

      // 영역 하이라이트 Circle 렌더링
      drawHighlightCircle(map, coords, 40);

      const marker = listingMarkersRef.current.find((_, idx) => filteredRealListings[idx]?.id === item.id);
      if (marker) {
        openListingInfoWindow(map, marker, item);
      }
    }
  }, [filteredRealListings, openListingInfoWindow, drawHighlightCircle]);

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
      const newMarkers = filteredRealListings.map((item) => {
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
      const target = selectedListing || (filteredRealListings.length > 0 ? filteredRealListings[0] : null);
      if (target && newMarkers.length > 0) {
        const targetMarker = newMarkers.find((_, idx) => filteredRealListings[idx]?.id === target.id) || newMarkers[0];
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
  }, [viewMode, filteredRealListings, selectedListing, rawTrades, selectedMapTarget, buildPropertyAddressAndTitle, searchAndPinAddress, currentRegionLabel, openListingInfoWindow]);

  // 시/도 드롭다운 변경 핸들러 (상태 불일치 방지 및 로딩 상태 즉시 활성화)
  const handleSidoChange = (e) => {
    const newSido = e.target.value;
    setSelectedSido(newSido);
    setPendingDisambiguation(null);
    clearAiContext();
    const districts = REGION_DATA[newSido] || [];
    if (districts.length > 0) {
      const newCode = districts[0].code;
      // 상태 불일치 즉시 해소 및 로딩 스켈레톤 활성화
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      setSelectedMapTarget(null);
      setSelectedListing(null);
      setLoading(true);
      setFetchError(null);
      setRawTrades([]);
      setChartData([]);
      setTotalCount(0);
      setAllBuildings([]);
      setComplexSummaryMap({});
      setSummaryInfo({
        totalCount: 0,
        latestTradePrice: "-",
        latestJeonsePrice: "-",
        lastSyncedAt: "-"
      });
      setTablePage(1);
      if (REGION_CENTERS[newCode]) {
        setRegionCoords(REGION_CENTERS[newCode]);
      }
      setLawdCd(newCode);
    }
  };

  // 시/군/구 드롭다운 변경 핸들러 (상태 불일치 방지 및 로딩 상태 즉시 활성화)
  const handleLawdCdChange = (e) => {
    const newCode = e.target.value;
    setPendingDisambiguation(null);
    clearAiContext();
    // 상태 불일치 즉시 해소 및 로딩 스켈레톤 활성화
    setSelectedMapTarget(null);
    setSelectedListing(null);
    setLoading(true);
    setFetchError(null);
    setRawTrades([]);
    setChartData([]);
    setTotalCount(0);
    setAllBuildings([]);
    setComplexSummaryMap({});
    setSummaryInfo({
      totalCount: 0,
      latestTradePrice: "-",
      latestJeonsePrice: "-",
      lastSyncedAt: "-"
    });
    setTablePage(1);
    if (REGION_CENTERS[newCode]) {
      setRegionCoords(REGION_CENTERS[newCode]);
    }
    setLawdCd(newCode);
  };

  // 챗봇 또는 외부 호출에 의한 범용 지역 전환 함수 (전국 252개 시/군/구 100% 매핑 & 핫스팟 좌표 이동)
  const applyRegionSwitch = useCallback((regionTarget, hotspotCoord = null, targetDongs = null) => {
    const resolved = resolveRegionFromData(regionTarget);
    if (!resolved) {
      console.warn("[Region Switch] 일치하는 지역을 찾을 수 없습니다:", regionTarget);
      return false;
    }

    const { sido, code, label } = resolved;
    if (code !== lawdCd || sido !== selectedSido || hotspotCoord) {
      console.log(`[Region Switch] 대시보드 지역을 [${label}] (${code})로 전환합니다.`);
      // 1) 시/도 및 시/군/구 드롭다운 상태를 토씨 하나 틀리지 않고 100% 동기화
      setSelectedSido(sido);

      // 2) 이전 지역 잔존 데이터 및 불일치(Inconsistency) 원천 차단
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      setSelectedMapTarget(null);
      setSelectedListing(null);
      setLoading(true);
      setFetchError(null);
      setRawTrades([]);
      setChartData([]);
      setTotalCount(0);
      setAllBuildings([]);
      setComplexSummaryMap({});
      setSummaryInfo({
        totalCount: 0,
        latestTradePrice: "-",
        latestJeonsePrice: "-",
        lastSyncedAt: "-"
      });
      setTablePage(1);

      // 3) 지도 좌표 중심 이동: 핫스팟 랜드마크 좌표가 있으면 우선 이동 및 줌 레벨 조정
      if (hotspotCoord && hotspotCoord.lat && hotspotCoord.lng) {
        const hCoord = { lat: Number(hotspotCoord.lat), lng: Number(hotspotCoord.lng) };
        setRegionCoords(hCoord);
        try {
          if (mapInstanceRef.current && window.kakao && window.kakao.maps) {
            const moveLatLon = new window.kakao.maps.LatLng(hCoord.lat, hCoord.lng);
            mapInstanceRef.current.setCenter(moveLatLon);
            mapInstanceRef.current.setLevel(4);
          }
        } catch (mapErr) {
          console.warn("[Region Switch] 지도 중심 이동 실패:", mapErr);
        }
      } else if (REGION_CENTERS[code]) {
        setRegionCoords(REGION_CENTERS[code]);
      }

      // 4) 핫스팟 인접 동네(target_dongs) 우선 필터링 적용
      if (targetDongs && Array.isArray(targetDongs) && targetDongs.length > 0) {
        setSearchKeyword(targetDongs[0]);
        aiKeywordAppliedRef.current = true;
      } else if (aiKeywordAppliedRef.current) {
        setSearchKeyword("");
        aiKeywordAppliedRef.current = false;
      }

      // 5) 타깃 LAWD_CD 확정 -> useEffect(fetchData) 자동 트리거
      setPendingDisambiguation(null);
      setLawdCd(code);

      if (typeof showToast === "function") {
        const dongNote = (targetDongs && targetDongs.length > 0) ? ` (${targetDongs.join(", ")} 일대)` : "";
        showToast(`[${label}${dongNote}] 분석 대시보드로 전환되었습니다.`);
      }
      return true;
    }
    return false;
  }, [lawdCd, selectedSido, showToast]);

  // =========================================================================
  // [요구사항 2] 부모 컴포넌트 전역 상태 동기화 콜백 (onDashboardSync)
  // - 챗봇 응답에 new_lawd_cd가 있으면 setLawdCd 및 history.replaceState 동기화
  // - 챗봇 응답에 target_view: "B2B" 감지 시 setActiveTab('B2B 제휴 매물 현황') 강제 실행
  // - trade_type 감지 시 거래 유형 필터 자동 세팅
  // - GeminiChatModal(자식) 및 내부 채팅 양쪽에서 100% 호출 호환
  // =========================================================================
  const onDashboardSync = useCallback((newLawdCdOrRegion, targetView, tradeType, userMessage, rawPayload = null) => {
    let targetCode = null;
    let targetSido = null;
    let targetDist = null;
    let targetLabel = null;
    let hotspotCoord = null;
    let targetDongs = null;

    if (typeof newLawdCdOrRegion === "object" && newLawdCdOrRegion !== null) {
      targetCode = newLawdCdOrRegion.code || newLawdCdOrRegion.new_lawd_cd || newLawdCdOrRegion.new_regional_code;
      targetSido = newLawdCdOrRegion.sidoName || newLawdCdOrRegion.new_city_name || newLawdCdOrRegion.new_sido_name;
      targetDist = newLawdCdOrRegion.districtName || newLawdCdOrRegion.new_district_name;
      targetLabel = newLawdCdOrRegion.label || newLawdCdOrRegion.new_region_label;
      hotspotCoord = newLawdCdOrRegion.hotspotCoord || newLawdCdOrRegion.hotspot_coord;
      targetDongs = newLawdCdOrRegion.targetDongs || newLawdCdOrRegion.target_dongs;
    } else if (newLawdCdOrRegion) {
      targetCode = String(newLawdCdOrRegion).trim();
    }

    if (rawPayload && typeof rawPayload === "object") {
      if (!targetCode) targetCode = rawPayload.new_lawd_cd || rawPayload.new_regional_code;
      if (!targetSido) targetSido = rawPayload.new_city_name || rawPayload.new_sido_name;
      if (!targetDist) targetDist = rawPayload.new_district_name;
      if (!targetLabel) targetLabel = rawPayload.new_region_label;
      if (!hotspotCoord) hotspotCoord = rawPayload.hotspot_coord;
      if (!targetDongs) targetDongs = rawPayload.target_dongs;
    }

    // 1) 지역 코드 동기화 및 history.replaceState (UI & URL 동기화)
    if (targetCode) {
      const resolved = resolveRegionFromData({
        code: targetCode,
        sidoName: targetSido,
        districtName: targetDist,
        label: targetLabel
      });

      if (resolved) {
        setSelectedSido(resolved.sido);
        setLawdCd(resolved.code);

        // 이전 지역 잔존 데이터 초기화 및 로딩 시작
        if (circleRef.current) {
          circleRef.current.setMap(null);
          circleRef.current = null;
        }
        setSelectedMapTarget(null);
        setSelectedListing(null);
        setLoading(true);
        setFetchError(null);
        setRawTrades([]);
        setChartData([]);
        setTotalCount(0);
        setAllBuildings([]);
        setComplexSummaryMap({});
        setSummaryInfo({
          totalCount: 0,
          latestTradePrice: "-",
          latestJeonsePrice: "-",
          lastSyncedAt: "-"
        });
        setTablePage(1);

        try {
          const url = new URL(window.location.href);
          url.searchParams.set("lawdCd", resolved.code);
          url.searchParams.set("region", resolved.label);
          window.history.replaceState({ lawdCd: resolved.code, region: resolved.label }, "", url.toString());
        } catch (_) {}

        if (hotspotCoord && hotspotCoord.lat && hotspotCoord.lng) {
          const hCoord = { lat: Number(hotspotCoord.lat), lng: Number(hotspotCoord.lng) };
          setRegionCoords(hCoord);
          try {
            if (mapInstanceRef.current && window.kakao && window.kakao.maps) {
              mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(hCoord.lat, hCoord.lng));
              mapInstanceRef.current.setLevel(4);
            }
          } catch (_) {}
        } else if (REGION_CENTERS[resolved.code]) {
          setRegionCoords(REGION_CENTERS[resolved.code]);
        }

        if (targetDongs && Array.isArray(targetDongs) && targetDongs.length > 0) {
          setSearchKeyword(targetDongs[0]);
          aiKeywordAppliedRef.current = true;
        }

        if (typeof showToast === "function") {
          showToast(`[${resolved.label}] 분석 대시보드로 전환되었습니다.`);
        }
      }
    }

    // 2) target_view: "B2B" 감지 시 setActiveTab('B2B 제휴 매물 현황') 강제 실행
    const viewStr = String(targetView || "").toUpperCase();
    if (viewStr === "B2B" || viewStr.includes("B2B") || viewStr.includes("제휴") || viewStr === "LISTING") {
      setActiveTab("B2B 제휴 매물 현황");
    } else if (viewStr === "TRANSACTION" || viewStr.includes("실거래") || viewStr === "원장") {
      setActiveTab("실거래 원장 분석");
    }

    // 3) 거래 유형 필터 (trade_type) 자동 세팅
    if (tradeType && TRADE_FILTER_IDS.includes(String(tradeType).trim())) {
      const tVal = String(tradeType).trim();
      setTradeTypeFilter(tVal);
      setListingTradeFilter(tVal);
      setTablePage(1);
    }

    // 4) AI 검색 칩 질문 표시
    if (userMessage) {
      setAiActiveQuery(userMessage);
    }
  }, [setActiveTab, showToast]);

  const applyDashboardSync = onDashboardSync;

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
          dong: item.dong || "-",
          propertyType: item.property_type || "아파트",
          avgTrade: item.avg_trade || 0,
          latestTrade: item.avg_trade || 0,
          avgJeonse: item.avg_jeonse || 0,
          latestJeonse: item.avg_jeonse || 0,
          jeonseRatio: item.jeonse_ratio || (item.avg_trade > 0 ? Math.round((item.avg_jeonse / item.avg_trade) * 100) : 0),
          avgArea: item.avg_area ? String(item.avg_area) : "0",
          avgPyeong: toPyeong(item.avg_area || 0),
          pyeongPrice: item.pyeong_price || ((item.avg_trade > 0 && Number(item.avg_area) > 0) ? Math.round(item.avg_trade / (Number(item.avg_area) * 0.3025)) : 0),
          dealCount: item.deal_count || 0
        };
      }

      // 2. 폴백: 현재 페이징된 rawTrades에서 계산
      const trades = rawTrades.filter((t) => t.apt_name === name);
      const tradeList = trades.filter((t) => t.trade_type === "매매" && (t.deal_amount || t.raw_price));
      const jeonseList = trades.filter((t) => (t.trade_type === "전세" || t.trade_type === "월세") && (t.deposit || t.raw_price));

      const avgTrade = tradeList.length > 0
        ? Math.round(tradeList.reduce((acc, cur) => acc + (cur.deal_amount || cur.raw_price || 0), 0) / tradeList.length)
        : 0;
      const latestTrade = tradeList.length > 0 ? (tradeList[0].deal_amount || tradeList[0].raw_price || 0) : avgTrade;

      const avgJeonse = jeonseList.length > 0
        ? Math.round(jeonseList.reduce((acc, cur) => acc + (cur.deposit || cur.raw_price || 0), 0) / jeonseList.length)
        : 0;
      const latestJeonse = jeonseList.length > 0 ? (jeonseList[0].deposit || jeonseList[0].raw_price || 0) : avgJeonse;

      const jeonseRatio = avgTrade > 0 ? Math.round((avgJeonse / avgTrade) * 100) : 0;
      const avgArea = trades.length > 0 && trades[0]?.exclu_use_ar ? trades[0].exclu_use_ar : "0";
      const pyeongPrice = (avgTrade > 0 && Number(avgArea) > 0) ? Math.round(avgTrade / (Number(avgArea) * 0.3025)) : 0;
      const dong = trades[0]?.dong || trades[0]?.jibun || "-";

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
        dealCount: trades.length
      };
    },
    [complexSummaryMap, rawTrades]
  );

  // 활성 1:1 비교 단지 프로필 (실제 고유 단지 목록 기반 100% 동적 바인딩)
  const targetComplexA = useMemo(() => {
    const name = compareComplexA || (availableComplexNames.length > 0 ? availableComplexNames[0] : null);
    return name ? getComplexProfile(name) : null;
  }, [compareComplexA, availableComplexNames, getComplexProfile]);

  const targetComplexB = useMemo(() => {
    const name = compareComplexB || (availableComplexNames.length > 1 ? availableComplexNames[1] : availableComplexNames[0] || null);
    return name ? getComplexProfile(name) : null;
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

  // AI 부동산 상담 질문 전송 (다중 턴 되묻기 & 컨텍스트 유지 지원)
  const handleAiSubmit = async (e, directText = null, selectedOption = null) => {
    e?.preventDefault();
    const userText = directText ? String(directText).trim() : chatPrompt.trim();
    if (!userText || aiLoading) return;

    if (!directText) {
      setChatPrompt("");
    }

    const newMsg = {
      sender: "user",
      text: userText,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setAiLoading(true);

    try {
      const payload = {
        lawdCd,
        regional_code: lawdCd,
        regionLabel: currentRegionLabel,
        prompt: userText,
        query: userText,
        model_choice: "gpt",
        session_id: chatSessionIdRef.current,
        history: chatMessages.slice(-6).map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        })),
        context: pendingDisambiguation || undefined,
        selected_option: selectedOption || undefined
      };

      const res = await axios.post(
        `${getApiBaseUrl()}/api/chat`,
        payload,
        { timeout: 35000 }
      );

      const status = res.data?.status;
      const disambiguation = res.data?.disambiguation;
      const rawAnswer = res.data?.reply || res.data?.answer || res.data?.message || "조건에 맞는 매물이 없습니다.";
      // '만원만원' 단위 중복 방지 정제 필터
      const cleanAnswer = String(rawAnswer)
        .replace(/(?:만원|만\s*원)(?:\s*(?:만원|만\s*원))+/g, "만원")
        .replace(/억\s*만원+/g, "억");

      if (status === "needs_clarification" && disambiguation) {
        setPendingDisambiguation(disambiguation);
      } else {
        setPendingDisambiguation(null);
      }

      // 챗봇 -> 대시보드 전역 UI 제어: 지역 + 탭(target_view) + 거래유형 필터(trade_type) + AI 검색 칩을 한 번에 동기화
      if (status !== "needs_clarification") {
        const newCode = res.data?.new_lawd_cd || res.data?.new_regional_code;
        const hasRegion = Boolean(newCode || res.data?.new_city_name || res.data?.new_district_name);
        applyDashboardSync(
          hasRegion
            ? {
                code: newCode,
                sidoName: res.data.new_city_name || res.data.new_sido_name,
                districtName: res.data.new_district_name,
                label: res.data.new_region_label,
                hotspotCoord: res.data.hotspot_coord,
                targetDongs: res.data.target_dongs
              }
            : null,
          res.data?.target_view,
          res.data?.trade_type,
          // 되묻기 확인 응답("응 맞아")이면 최초 원본 질문을, 아니면 방금 입력한 질문을 표시
          pendingDisambiguation?.original_prompt || userText
        );
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: cleanAnswer,
          time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
          options: disambiguation?.options || null
        }
      ]);
    } catch (err) {
      console.error("[AI Chat Error]:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "국토교통부 데이터 서버 응답이 지연되었습니다. 잠시 후 다시 질문을 입력해 주시기 바랍니다.",
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden box-border bg-[#F9FAFB] text-[#191F28] font-sans antialiased pb-28 select-none">
      {/* ========================================================================= */}
      {/* 1. 상단 글로벌 GNB 헤더                                                   */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 w-full max-w-full bg-white/95 backdrop-blur-md border-b border-[#E5E8EB] transition-all box-border">
        <div className="max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 box-border">
          {/* 1) 로고 영역 & 모바일 동기화 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0f172a] flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-xs shrink-0">
                Z
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#191F28]">집뷰</span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#0f172a]/10 text-[#1e3a8a]">
                    ENTERPRISE
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#8B95A1] -mt-0.5 hidden xs:block">
                  부동산 실거래 원장 데이터 인텔리전스
                </p>
              </div>
            </div>

            {/* 모바일 화면용 자동 동기화 인디케이터 (로딩 중일 때만 표시) */}
            {isLoading && (
              <div className="sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>동기화 중...</span>
              </div>
            )}
          </div>

          {/* 2) 컨트롤러 바: [View Mode 토글 스위치] + [지역 선택 드롭다운] */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* View Mode 토글 스위치 (손가락 터치 친화적 42px 높이) */}
            <div className="flex items-center bg-[#F2F4F6] p-1 rounded-full border border-[#E5E8EB] justify-center">
              <button
                onClick={() => {
                  setActiveTab("실거래 원장 분석");
                  showToast("[실거래가 분석] 국토교통부 3개년 실거래 원장 데이터를 표시합니다.");
                }}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${viewMode === "transaction"
                    ? "bg-white text-[#191F28] shadow-xs font-black"
                    : "text-[#8B95A1] hover:text-[#4E5968]"
                  }`}
              >
                <span>실거래 원장 분석</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("B2B 제휴 매물 현황");
                  showToast("[제휴 매물 현황] B2B 제휴 중개사 현장 확인 매물을 표시합니다.");
                }}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${viewMode === "listing"
                    ? "bg-[#0f172a] text-white shadow-xs font-black"
                    : "text-[#8B95A1] hover:text-[#4E5968]"
                  }`}
              >
                <span>B2B 제휴 매물 현황</span>
                <span className="bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  B2B
                </span>
              </button>
            </div>

            {/* 전국 지역 선택 드롭다운 2종 (시/도 + 시/군/구, 손가락 터치 친화적 min-h-[42px]) */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center flex-1 sm:flex-initial bg-[#F2F4F6] p-1 rounded-full border border-[#E5E8EB]">
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    data-testid="select-sido"
                    aria-label="시/도 선택"
                    value={selectedSido}
                    onChange={handleSidoChange}
                    className="w-full sm:w-auto appearance-none bg-[#F2F4F6] text-xs font-bold text-[#191F28] pl-3 pr-6 py-2 min-h-[40px] rounded-full border border-transparent outline-none cursor-pointer hover:bg-[#E5E8EB] focus:ring-2 focus:ring-[#3182F6]/30 focus:border-[#0f172a] transition-all"
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
                    data-testid="select-district"
                    aria-label="시/군/구 선택"
                    value={lawdCd}
                    onChange={handleLawdCdChange}
                    className="w-full sm:w-auto appearance-none bg-[#F2F4F6] text-xs font-bold text-[#191F28] pl-3 pr-6 py-2 min-h-[40px] rounded-full border border-transparent outline-none cursor-pointer hover:bg-[#E5E8EB] focus:ring-2 focus:ring-[#3182F6]/30 focus:border-[#0f172a] transition-all"
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

              {/* 데스크탑 화면용 실시간 자동 동기화 상태 인디케이터 (수동 버튼 제거) */}
              <div className="hidden sm:flex items-center space-x-2 px-3.5 py-2 min-h-[40px] bg-white border border-[#E5E8EB] rounded-full text-xs font-semibold text-slate-700 shadow-2xs shrink-0 select-none">
                <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`}></span>
                <span className="text-[11px] font-bold text-slate-700">
                  {isLoading ? "실시간 원장 동기화 중..." : "실시간 자동 동기화"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. 대시보드 메인 본문                                                     */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6 box-border min-w-0">
        {/* ========================================================================= */}
        {/* [스마트 자동완성 검색] 단지명/건물명 실시간 통합 검색 바                  */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-xl sm:rounded-xl border border-[#E5E8EB] p-4 sm:p-5 shadow-xs space-y-3 w-full max-w-full box-border min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                검색
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="단지명, 법정동, 지번 검색 (예: 래미안, 역삼동, 자이)"
                className="w-full bg-[#F2F4F6] text-xs sm:text-sm font-bold text-[#191F28] pl-10 pr-10 py-3 rounded-xl border border-transparent outline-none focus:bg-white focus:border-[#0f172a] focus:ring-4 focus:ring-[#3182F6]/10 transition-all placeholder:text-[#8B95A1] placeholder:font-normal"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#E5E8EB] hover:bg-[#CCD0D5] text-[#4E5968] flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                  title="검색어 초기화"
                >
                  <span className="text-[11px] font-bold">x</span>
                </button>
              )}
            </div>

            {/* 실시간 필터링 결과 요약 배지 */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs font-bold text-[#4E5968] bg-[#F2F4F6] px-3 py-2 rounded-xl">
                {viewMode === "listing"
                  ? `검증 매물 ${filteredRealListings.length}건`
                  : `실거래 ${filteredTrades.length.toLocaleString()}건`}
              </span>
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="text-xs font-bold text-[#1e3a8a] bg-[#E8F3FF] hover:bg-[#D4E8FF] px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  전체 보기
                </button>
              )}
            </div>
          </div>

          {/* AI 검색 태그(Chip): 챗봇으로 동기화된 사용자의 원본 질문 표시 */}
          {aiActiveQuery && (
            <div className="flex items-center" data-testid="ai-active-query-chip">
              <div className="inline-flex items-center gap-2 max-w-full bg-[#E8F3FF] border border-[#3182F6]/30 text-[#1e3a8a] rounded-full pl-3.5 pr-2 py-1.5 text-xs sm:text-sm font-bold">
                <span className="shrink-0">🤖 AI 검색:</span>
                <span className="truncate" title={aiActiveQuery}>'{aiActiveQuery}'</span>
                <button
                  type="button"
                  onClick={clearAiContext}
                  aria-label="AI 검색 태그 닫기"
                  data-testid="ai-active-query-clear"
                  className="shrink-0 w-5 h-5 rounded-full bg-white/80 hover:bg-white text-[#1e3a8a] flex items-center justify-center text-[11px] font-bold cursor-pointer"
                >
                  x
                </button>
              </div>
            </div>
          )}

          {/* 퀵 태그 추천 버튼 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
            <span className="text-[#8B95A1] font-semibold shrink-0 text-[11px]">빠른 검색:</span>
            {["푸르지오", "자이", "래미안", "힐스테이트", "더샵", "원룸", "오피스텔"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchKeyword(tag)}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer text-[11px] ${searchKeyword === tag
                    ? "bg-[#0f172a] text-white"
                    : "bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[#4E5968]"
                  }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </section>
        {/* 요약 지표 카드 4종 */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-full box-border min-w-0">
          <div className="bg-white p-5 rounded-xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">누적 실거래 원장</span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-24 animate-pulse mt-1"></div>
            ) : fetchError ? (
              <p className="text-2xl font-black text-slate-400 mt-1">-</p>
            ) : (
              <p className="text-2xl font-black text-[#191F28] mt-1 tracking-tight">
                {totalCount.toLocaleString()}
                <span className="text-sm font-bold text-[#8B95A1] ml-1">건</span>
              </p>
            )}
            <p className="text-[11px] text-[#64748B] font-medium mt-1">
              {fetchError ? "공공데이터 통신 지연" : "36개월 전수 수집 데이터 검증 완료"}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">최신 매매 최고 거래가</span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-28 animate-pulse mt-1"></div>
            ) : fetchError ? (
              <p className="text-2xl font-black text-slate-400 mt-1">-</p>
            ) : (
              <p className="text-2xl font-black text-[#F04452] mt-1 tracking-tight">
                {summaryInfo.latestTradePrice || "-"}
              </p>
            )}
            <p className="text-[11px] text-[#8B95A1] font-medium mt-1">
              {fetchError ? "데이터 수신 대기" : `${currentRegionLabel} 기준`}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">최신 전세 최고 보증금</span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-28 animate-pulse mt-1"></div>
            ) : fetchError ? (
              <p className="text-2xl font-black text-slate-400 mt-1">-</p>
            ) : (
              <p className="text-2xl font-black text-[#1e3a8a] mt-1 tracking-tight">
                {summaryInfo.latestJeonsePrice || "-"}
              </p>
            )}
            <p className="text-[11px] text-[#8B95A1] font-medium mt-1">
              {fetchError ? "데이터 수신 대기" : "순수 전세 계약 기준"}
            </p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#F2F4F6] shadow-2xs">
            <span className="text-xs font-semibold text-[#8B95A1]">
              {viewMode === "listing" ? "제휴 실시간 호가 매물" : "비교 분석 가능 단지"}
            </span>
            {isLoading ? (
              <div className="h-8 bg-[#E5E8EB] rounded-lg w-20 animate-pulse mt-1"></div>
            ) : fetchError ? (
              <p className="text-2xl font-black text-slate-400 mt-1">-</p>
            ) : (
              <p className="text-2xl font-black text-[#191F28] mt-1 tracking-tight">
                {viewMode === "listing" ? filteredRealListings.length : availableComplexNames.length}
                <span className="text-sm font-bold text-[#8B95A1] ml-1">
                  {viewMode === "listing" ? "개 매물" : "개 단지"}
                </span>
              </p>
            )}
            <p className="text-[11px] text-[#64748B] font-semibold mt-1">
              {fetchError ? "데이터 수신 대기" : (viewMode === "listing" ? "현장 검증 B2B 네트워크" : "1:1 막대그래프 대조 가능")}
            </p>
          </div>
        </section>

        {/* 에러 발생 시 차트 및 원장 영역 차단 및 재시도 UI 독립 렌더링 */}
        {fetchError ? (
          <div className="w-full bg-white rounded-2xl border border-red-200 p-8 sm:p-16 shadow-xs text-center flex flex-col items-center justify-center space-y-4 my-8">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-2">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2 max-w-lg">
              <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                공공데이터 응답이 지연되었습니다
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                국토부 공공데이터 서버 응답이 지연되어 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFetchError(null);
                fetchData(lawdCd, 1);
              }}
              className="mt-4 px-6 py-3 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>다시 시도</span>
            </button>
          </div>
        ) : (
          <>

            {/* ========================================================================= */}
            {/* [실거래가 모드] 주식형 ComposedChart & 1:1 비교 매트릭스 (과거 분석용)      */}
            {/* ========================================================================= */}
            {viewMode === "transaction" && (
              <>
                <section className="bg-white rounded-xl sm:rounded-xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-4 w-full max-w-full box-border min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-[#F2F4F6]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#E8F3FF] text-[#1e3a8a] text-xs font-black px-2.5 py-1 rounded-full">
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
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${chartViewMode === tab.id
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
                    <div className="flex flex-wrap items-center gap-4 bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E8EB]/60">
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
                            className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-md ${latestMonthStockMetric.isTradeUp
                                ? "bg-[#FEECEE] text-[#F04452]"
                                : "bg-[#E8F3FF] text-[#1e3a8a]"
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
                            className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-md ${latestMonthStockMetric.isJeonseUp
                                ? "bg-[#FEECEE] text-[#F04452]"
                                : "bg-[#E8F3FF] text-[#1e3a8a]"
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
                    className="w-full h-80 min-h-[320px] pt-1 relative flex items-center justify-center touch-pan-y"
                    style={{ height: "340px", minHeight: "340px", width: "100%", touchAction: "pan-y" }}
                  >
                    {fetchError ? (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="space-y-1 max-w-md">
                          <p className="text-xs sm:text-sm font-bold text-[#0F172A]">
                            국토부 공공데이터 서버 응답이 지연되어 데이터를 불러오지 못했습니다.
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            잠시 후 다시 시도해주세요.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFetchError(null);
                            fetchData(lawdCd, 1);
                          }}
                          className="mt-1 px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>다시 시도</span>
                        </button>
                      </div>
                    ) : isLoading ? (
                      <ChartSkeleton regionLabel={currentRegionLabel} />
                    ) : enrichedStockChartData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-xs text-[#64748B] font-medium space-y-2 p-6 text-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="font-bold text-[#0F172A]">{currentRegionLabel} 36개월 실거래 데이터가 없습니다.</span>
                        <p className="text-[11px] text-[#64748B]">다른 시/군/구를 선택하시면 해당 지역의 데이터가 자동으로 동기화됩니다.</p>
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
                          <Tooltip
                            content={<TossStockChartTooltip />}
                            isAnimationActive={false}
                            allowEscapeViewBox={{ x: false, y: false }}
                            wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
                          />
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
                <section className="bg-white rounded-xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-6 w-full max-w-full box-border min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 gap-3 border-b border-[#F2F4F6]">
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

                    {/* 1:1 비교 단지 선택 컨트롤러 (실시간 검색형 콤보박스) */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-[#F9FAFB] p-2.5 rounded-xl border border-[#E5E8EB] w-full md:w-[520px] box-border">
                      {/* 단지 A 실시간 검색 콤보박스 */}
                      <div className="flex-1 min-w-0 w-full">
                        <SearchableComplexCombobox
                          tag="단지 A"
                          theme="navy"
                          value={targetComplexA?.name || ""}
                          options={availableComplexNames}
                          onChange={(val) => setCompareComplexA(val)}
                          placeholder="단지 A 검색..."
                        />
                      </div>

                      <div className="flex items-center justify-center py-0.5 md:py-0 shrink-0">
                        <span className="text-[11px] font-black text-[#7B2CBF] px-2 py-0.5 bg-[#7B2CBF]/10 rounded-md">VS</span>
                      </div>

                      {/* 단지 B 실시간 검색 콤보박스 */}
                      <div className="flex-1 min-w-0 w-full">
                        <SearchableComplexCombobox
                          tag="단지 B"
                          theme="purple"
                          value={targetComplexB?.name || ""}
                          options={availableComplexNames}
                          onChange={(val) => setCompareComplexB(val)}
                          placeholder="단지 B 검색..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* 1:1 비교 Recharts BarChart 시각화 영역 */}
                  {fetchError ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs font-bold text-red-600">
                        국토부 공공데이터 서버 응답이 지연되어 비교 분석 데이터를 불러오지 못했습니다.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFetchError(null);
                          fetchData(lawdCd, 1);
                        }}
                        className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-md text-xs font-bold transition-all shadow-xs"
                      >
                        다시 시도
                      </button>
                    </div>
                  ) : isLoading ? (
                    <MatrixSkeleton regionLabel={currentRegionLabel} />
                  ) : !targetComplexA || !targetComplexB ? (
                    <div className="py-12 text-center text-[#64748B] text-xs font-medium space-y-1">
                      <p className="font-bold text-[#0F172A]">{currentRegionLabel}에 비교 가능한 단지 정보가 충분하지 않습니다.</p>
                      <p className="text-[11px] text-[#64748B]">해당 조건의 실거래 데이터가 없습니다. 다른 지역을 선택하시면 실거래 단지 데이터가 자동으로 동기화됩니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* 상단 1:1 나란히 세워진 2색 막대그래프 (매매가, 전세가, 전세가율) */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* 1. 평균 매매가 & 전세가 비교 막대그래프 (2/3 너비) */}
                        <div className="lg:col-span-2 bg-[#F9FAFB] p-3.5 sm:p-5 rounded-xl border border-[#E5E8EB] space-y-3 w-full max-w-full box-border min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h4 className="font-extrabold text-sm text-[#191F28]">평균 매매가 & 전세가 비교</h4>
                              <p className="text-[11px] text-[#8B95A1]">단위: 만원 (축: 억 단위)</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                              <span className="flex items-center gap-1 text-[#1e3a8a]">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a]"></span>
                                {targetComplexA.name}
                              </span>
                              <span className="flex items-center gap-1 text-[#7B2CBF]">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#7B2CBF]"></span>
                                {targetComplexB.name}
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-64 touch-pan-y" style={{ touchAction: "pan-y" }}>
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
                                <Tooltip
                                  content={<ComparisonBarTooltip />}
                                  isAnimationActive={false}
                                  allowEscapeViewBox={{ x: false, y: false }}
                                  wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
                                />
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
                        <div className="bg-[#F9FAFB] p-3.5 sm:p-5 rounded-xl border border-[#E5E8EB] space-y-3 flex flex-col justify-between w-full max-w-full box-border min-w-0">
                          <div>
                            <h4 className="font-extrabold text-sm text-[#191F28]">평균 전세가율 (%) 비교</h4>
                            <p className="text-[11px] text-[#8B95A1]">매매가 대비 전세 보증금 비율</p>
                          </div>

                          <div className="w-full h-44 touch-pan-y" style={{ touchAction: "pan-y" }}>
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
                                <Tooltip
                                  content={<ComparisonBarTooltip />}
                                  isAnimationActive={false}
                                  allowEscapeViewBox={{ x: false, y: false }}
                                  wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
                                />
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
                              <span className="text-[#1e3a8a] font-bold">{targetComplexA.name}</span>
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
                      <div className="overflow-x-auto w-full max-w-full rounded-xl border border-[#E5E8EB]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#F2F4F6] text-[#8B95A1] border-b border-[#E5E8EB]">
                              <th className="py-3 px-4 font-bold w-40">비교 항목</th>
                              <th className="py-3 px-4 font-extrabold text-[#1e3a8a] text-sm">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a]"></span>
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
                                <span className="text-sm font-black text-[#1e3a8a]">{formatTossMoney(targetComplexA.avgJeonse)}</span>
                                <span className="text-[11px] text-[#8B95A1] block font-medium">최근: {formatTossMoney(targetComplexA.latestJeonse)}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="text-sm font-black text-[#1e3a8a]">{formatTossMoney(targetComplexB.avgJeonse)}</span>
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
            <section className="bg-white rounded-xl sm:rounded-xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-4 w-full max-w-full box-border min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-[#F2F4F6]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wide">Kakao Map GIS</span>
                    <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                      {viewMode === "listing"
                        ? (selectedListing ? `${selectedListing.title}` : `${currentRegionLabel} B2B 제휴 매물 지도 (총 ${filteredRealListings.length}건)`)
                        : (selectedMapTarget ? `${selectedMapTarget.apt_name} 실거래 위치 지도` : `${currentRegionLabel} 단지 & 매물 위치 지도`)}
                    </h3>
                  </div>
                  <p className="text-xs text-[#8B95A1] font-medium mt-1">
                    국토교통부 실거래 원장의 법정동 및 지번 주소를 좌표 변환하여 공간 위치를 표시합니다.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold text-[#4E5968] bg-[#F2F4F6] px-3 py-1.5 rounded-full truncate max-w-[220px]">
                    위치: {mapAddress || `${currentRegionLabel} 중심지`}
                  </span>
                  <button
                    onClick={() => {
                      const targetQuery = mapAddress || currentRegionLabel;
                      window.open(`https://map.kakao.com/link/search/${encodeURIComponent(targetQuery)}`, "_blank");
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span>카카오 지도 외부 연동</span>
                  </button>
                </div>
              </div>

              {/* 카카오맵 캔버스 영역 (모바일 h-[300px] 고정으로 스크롤 먹통 방지 & 데스크탑 h-[480px]) */}
              <div className="relative w-full h-[300px] sm:h-[420px] md:h-[480px] rounded-xl overflow-hidden border border-[#E5E8EB] shadow-inner bg-[#F9FAFB] touch-pan-y">
                <div
                  id="map"
                  ref={mapContainerRef}
                  style={{ width: "100%", height: "100%", minHeight: "300px" }}
                ></div>

                {/* 로딩 인디케이터 */}
                {mapStatus === "loading" && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#F9FAFB]/90 backdrop-blur-xs space-y-3">
                    <div className="w-10 h-10 rounded-full border-3 border-[#0f172a] border-t-transparent animate-spin"></div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-[#191F28]">카카오맵 지도를 불러오는 중입니다...</p>
                      <p className="text-[11px] text-[#8B95A1]">정밀 도로망 및 단지 위치를 로딩하고 있습니다.</p>
                    </div>
                  </div>
                )}

                {/* 에러 시 도메인 및 환경별 정밀 안내 카드 */}
                {mapStatus === "error" && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-xl bg-[#FFF0F0] text-[#F04452] flex items-center justify-center text-2xl font-bold shadow-xs">

                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <h4 className="text-base font-extrabold text-[#191F28]">카카오맵 로드 안내</h4>
                      <p className="text-xs text-[#4E5968] leading-relaxed">
                        카카오맵 SDK는 보안 정책상 카카오 개발자 콘솔에 등록된 <br />
                        <span className="font-bold text-[#1e3a8a]">Web 플랫폼 사이트 도메인</span>에서만 정상 표시됩니다.
                      </p>
                      <div className="mt-2 p-2.5 bg-[#F2F4F6] rounded-xl text-left text-[11px] space-y-1 border border-[#E5E8EB]">
                        <div className="flex items-center justify-between text-[#8B95A1]">
                          <span>현재 브라우저 접속 주소:</span>
                          <span className="font-mono font-bold text-[#191F28]">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#8B95A1]">
                          <span>API 키 등록 권장 주소:</span>
                          <span className="font-mono font-bold text-[#1e3a8a]">http://localhost:3001</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {typeof window !== "undefined" && window.location.port !== "3001" && (
                        <a
                          href="http://localhost:3001"
                          className="px-4 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 inline-flex items-center gap-1.5"
                        >
                          <span>3001번 포트로 이동</span>
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
                        카카오 지도 외부 보기
                      </button>
                    </div>
                  </div>
                )}

                {/* [실거래가 모드] 지도 좌측 하단 활성 매물 요약 플로팅 카드 */}
                {viewMode === "transaction" && mapStatus === "ready" && selectedMapTarget && (
                  <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs z-10 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-[#E5E8EB] shadow-xs space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[#E8F3FF] text-[#1e3a8a]">
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
                  <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-10 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-xl border border-[#E5E8EB] shadow-xs space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[#E8F3FF] text-[#1e3a8a]">
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
                      <span className="text-[11px] text-[#8B95A1] truncate max-w-[170px]">중개사: {selectedListing.agency_name}</span>
                      <a
                        href={`tel:${selectedListing.contact}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast(`[중개사 문의] ${selectedListing.agency_name} (${selectedListing.contact})`);
                        }}
                        className="px-3 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white text-[11px] font-black rounded-lg transition-all shadow-xs flex items-center gap-1 active:scale-95"
                      >
                        <span>문의하기</span>
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
              <section className="bg-white rounded-xl sm:rounded-xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-4 animate-in fade-in duration-200 w-full max-w-full box-border min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300">RAW DATA</span>
                      <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                        {currentRegionLabel} 국토교통부 실거래 계약 상세 내역 ({totalCount.toLocaleString()}건)
                      </h3>
                    </div>
                    <p className="text-xs text-[#8B95A1] font-medium mt-1">
                      국토교통부 실거래가 공개시스템 및 클라우드 원장 DB 기준 정합성 검증 완료 데이터입니다.
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
                      className="w-full bg-[#F2F4F6] text-xs px-3.5 py-2 pl-9 pr-7 rounded-full border border-transparent outline-none focus:border-[#0f172a] focus:bg-white transition-all font-medium"
                    />

                    {searchKeyword && (
                      <button
                        onClick={() => setSearchKeyword("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        <span className="text-[11px] font-bold">x</span>
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
                        className={`px-3.5 py-2 min-h-[40px] rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 ${propertyTypeFilter === p.id
                            ? "bg-[#0f172a] text-white shadow-xs font-black"
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
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${tradeTypeFilter === t.id
                            ? "bg-[#191F28] text-white"
                            : "bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]"
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* [스켈레톤 및 에러 렌더링] */}
                {fetchError ? (
                  <div className="py-14 px-6 flex flex-col items-center justify-center text-center bg-red-50/40 rounded-xl border border-red-200">
                    <svg className="w-8 h-8 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">
                      실거래가 원장 조회 지연
                    </h3>
                    <p className="text-xs text-slate-600 mb-4 max-w-md">
                      {fetchError}
                    </p>
                    <button
                      onClick={() => fetchData()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors shadow-xs"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : isLoading ? (
                  <TableSkeleton regionLabel={currentRegionLabel} />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#F2F4F6]">
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
                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-slate-800">
                                    {searchKeyword.trim() ? `"${searchKeyword}" 검색 조건과 일치하는 실거래 내역이 없습니다` : "조회된 실거래 내역이 없습니다"}
                                  </h4>
                                  <p className="text-xs text-slate-500">
                                    {searchKeyword.trim()
                                      ? "단지명이나 법정동 표기를 확인하시거나 검색어를 초기화해 주십시오."
                                      : "상단 지역 필터 또는 거래 구분을 조정해 주십시오."}
                                  </p>
                                </div>
                                {searchKeyword.trim() && (
                                  <button
                                    onClick={() => setSearchKeyword("")}
                                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-all cursor-pointer active:scale-95"
                                  >
                                    전체 원장 내역 조회
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
                                  showToast(`[위치 이동] ${title}`);
                                }}
                                className={`hover:bg-[#F9FAFB] cursor-pointer transition-colors ${selectedMapTarget?.id === item.id ? "bg-[#E8F3FF]/40 border-l-4 border-l-[#3182F6]" : ""
                                  }`}
                              >
                                <td className="py-3 px-3.5 text-[#4E5968] font-medium whitespace-nowrap">
                                  {item.deal_date || `${item.deal_year}.${String(item.deal_month).padStart(2, "0")}.${String(item.deal_day || 1).padStart(2, "0")}`}
                                </td>
                                <td className="py-3 px-3.5 whitespace-nowrap">
                                  <span
                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${item.property_type === "아파트"
                                        ? "bg-[#E8F3FF] text-[#1e3a8a]"
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
                                    className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${isTrade
                                        ? "bg-[#FEECEE] text-[#F04452]"
                                        : isJeonse
                                          ? "bg-[#E8F3FF] text-[#1e3a8a]"
                                          : "bg-[#E6F9F5] text-[#00B493]"
                                      }`}
                                  >
                                    {item.trade_type}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 font-black text-[#191F28] text-sm whitespace-nowrap">
                                  <span className={isTrade ? "text-[#F04452]" : isJeonse ? "text-[#1e3a8a]" : "text-[#191F28]"}>
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
                      <span className="text-[#1e3a8a] font-bold">
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
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${tablePage === pageNum
                                ? "bg-[#0f172a] text-white shadow-xs font-extrabold scale-105"
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
              <section className="bg-white rounded-xl sm:rounded-xl border border-[#E5E8EB] p-4 sm:p-7 shadow-xs space-y-5 sm:space-y-6 animate-in fade-in duration-300 w-full max-w-full box-border min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-[#F2F4F6]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#0f172a] text-white text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                        <span>B2B 제휴 검증 매물</span>
                      </span>
                      <h3 className="text-lg font-black text-[#191F28] tracking-tight">
                        {currentRegionLabel} 제휴 공인중개사 실시간 매물 ({filteredRealListings.length}건)
                      </h3>
                    </div>
                    <p className="text-xs text-[#8B95A1] font-medium mt-1">
                      공인중개사 네트워크를 통해 실시간 등록된 현장 검증 호가 매물 데이터입니다.
                    </p>
                  </div>

                  {/* 매물 등록 제휴 문의 버튼 */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => {
                        window.location.href = "mailto:partners@zipview.co.kr?subject=[ZipView] B2B 제휴 매물 등록 문의";
                        showToast("[제휴 등록 접수] partners@zipview.co.kr 제휴 문의로 연결합니다.");
                      }}
                      className="px-3.5 py-2 rounded-full text-xs font-bold bg-[#E8F3FF] hover:bg-[#D5E8FF] text-[#1e3a8a] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span>제휴 매물 등록 안내</span>
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
                        className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${listingPropertyFilter === p.id
                            ? "bg-[#0f172a] text-white shadow-xs font-black"
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
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95 ${listingTradeFilter === t.id
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
                {filteredRealListings.length === 0 ? (
                  <div className="py-16 text-center space-y-3 bg-white rounded-xl border border-[#E5E8EB]">

                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-[#191F28]">
                        {searchKeyword.trim() ? `"${searchKeyword}" 조건에 맞는 제휴 매물이 없습니다` : "조회된 제휴 매물이 없습니다"}
                      </h4>
                      <p className="text-xs text-[#8B95A1]">
                        {searchKeyword.trim()
                          ? "단지명이나 동 이름을 확인하시거나, 다른 검색어로 검색해 보세요."
                          : "해당 조건의 실거래 데이터가 없습니다. 해당 지역의 실거래 검증 매물이 아직 없거나 필터 조건에 부합하는 매물이 없습니다."}
                      </p>
                    </div>
                    {(searchKeyword.trim() || listingPropertyFilter !== "all" || listingTradeFilter !== "all") && (
                      <button
                        onClick={() => {
                          setSearchKeyword("");
                          setListingPropertyFilter("all");
                          setListingTradeFilter("all");
                        }}
                        className="px-4 py-2 bg-[#E8F3FF] hover:bg-[#D4E8FF] text-[#1e3a8a] text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                      >
                        전체 매물 보기 (필터 및 검색 초기화)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4.5">
                    {filteredRealListings.map((item) => {
                      const isSelected = selectedListing?.id === item.id;
                      const priceColor = item.deal_type === "매매" ? "text-[#F04452]" : item.deal_type === "전세" ? "text-[#1e3a8a]" : "text-[#00B493]";

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectListing(item)}
                          className={`bg-white rounded-xl border p-4 sm:p-5 transition-all cursor-pointer space-y-2.5 sm:space-y-3 relative overflow-hidden flex flex-col justify-between ${isSelected
                              ? "border-[#0f172a] ring-2 ring-[#3182F6]/30 shadow-xs bg-[#F8FAFF]"
                              : "border-[#E5E8EB] hover:border-[#0f172a]/50 hover:shadow-xs hover:-translate-y-0.5"
                            }`}
                        >
                          {/* 상단 뱃지 & 관리비 */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-[#E8F3FF] text-[#1e3a8a]">
                                  {item.property_type}
                                </span>
                                <span
                                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${item.deal_type === "매매"
                                      ? "bg-[#FFF0F0] text-[#F04452]"
                                      : item.deal_type === "전세"
                                        ? "bg-[#E8F3FF] text-[#1e3a8a]"
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
                              <div className="font-extrabold text-[#191F28] truncate">중개사: {item.agency_name}</div>
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
                                위치 확인
                              </button>
                              <a
                                href={`tel:${item.contact}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showToast(`[중개사 문의] ${item.agency_name} (${item.contact})`);
                                }}
                                className="px-3 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                              >
                                <span>문의하기</span>
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
          </>
        )}
      </main>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 3. [요구사항 1] 부모-자식 컴포넌트 Props 체인 복구: GeminiChatModal 렌더링 */}
      {/* ========================================================================= */}
      <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 max-w-[calc(100vw-24px)] box-border">
        {!isAiOpen && (
          <button
            data-testid="chat-trigger-btn"
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 sm:px-5 py-3 sm:py-3.5 rounded-full shadow-xs font-extrabold text-xs sm:text-sm transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>AI 어시스턴트</span>
          </button>
        )}
      </div>

      {isAiOpen && (
        (ResolvedGeminiChatModal || GeminiChatModal) ? (
          React.createElement(ResolvedGeminiChatModal || GeminiChatModal, {
            isOpen: isAiOpen,
            onClose: () => setIsAiOpen(false),
            lawdCd: lawdCd,
            currentRegionLabel: currentRegionLabel,
            onDashboardSync: onDashboardSync,
            onRegionSync: onDashboardSync
          })
        ) : null
      )}

      {/* ========================================================================= */}
      {/* 4. 하단 플로팅 토스트 메시지                                              */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-32px)] bg-[#191F28]/95 backdrop-blur-sm text-white text-xs font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-sm flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-bottom-3 duration-200 text-center">

          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
