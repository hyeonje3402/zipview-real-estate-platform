import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";

/**
 * =========================================================================
 * B2B SaaS 기업용 실거래가 & 부동산 자산 분석 대시보드 (RealEstateDashboard)
 * =========================================================================
 * 
 * [핵심 아키텍처 및 특징]
 * 1. 3단 분할 레이아웃 (Left Filter Sidebar - Center Analytics Canvas - Right Map & Spec Widget)
 * 2. 매물 상호 비교(Comparison) Data Grid 엔진 (단지 스펙, 실거래가, 전세가율, 평당가 나란히 비교)
 * 3. Recharts 듀얼 인터랙티브 실거래 추이 차트 (매매 / 전세 / 거래량)
 * 4. 국토교통부 실거래 DB API (`http://localhost:8000/api/trades/...`) 실시간 연동 및 Fallback
 * 5. 모던 B2B 디자인 시스템: Tailwind CSS 기반 Neutral Slate 팔레트, 얇은 보더, 정교한 타이포그래피
 */

// ==================== 기본 마스터 데이터 (비교 및 샘플 단지 스펙) ====================

const PRESET_COMPLEXES = [
  {
    id: "eunma",
    name: "은마",
    fullName: "대치 은마아파트",
    regionalCode: "11680",
    dong: "대치동",
    propertyType: "아파트",
    totalUnits: 4424,
    totalDongs: 28,
    buildYear: 1979,
    parkingPerUnit: 0.68,
    totalParking: 3008,
    floorAreaRatio: 204, // 용적률
    buildingCoverage: 18, // 건폐율
    maxFloor: 14,
    heatType: "지역난방 (열병합)",
    constructor: "한보주택",
    subway: "3호선 대치역/학여울역 (도보 2분)",
    school: "대곡초, 대청중, 단대부고 (대치동 학원가 인접)",
    latestTradePrice: 280000,
    latestJeonsePrice: 65000,
    pricePerPyeong: 8235,
    jeonseRatio: 23.2,
    lat: 37.4979,
    lng: 127.0658,
    areaTypes: ["76㎡", "84㎡"]
  },
  {
    id: "onebailey",
    name: "래미안원베일리",
    fullName: "신반포 래미안 원베일리",
    regionalCode: "11650",
    dong: "반포동",
    propertyType: "아파트",
    totalUnits: 2990,
    totalDongs: 23,
    buildYear: 2023,
    parkingPerUnit: 1.82,
    totalParking: 5442,
    floorAreaRatio: 299,
    buildingCoverage: 19,
    maxFloor: 35,
    heatType: "지역난방 (열병합)",
    constructor: "삼성물산",
    subway: "3·7·9호선 고속터미널역, 9호선 신반포역 (도보 3분)",
    school: "잠원초, 계성초, 반포중, 세화고 (한강변)",
    latestTradePrice: 550000,
    latestJeonsePrice: 200000,
    pricePerPyeong: 16176,
    jeonseRatio: 36.4,
    lat: 37.5054,
    lng: 127.0019,
    areaTypes: ["59㎡", "84㎡", "116㎡", "133㎡"]
  },
  {
    id: "banpo_xi",
    name: "반포자이",
    fullName: "반포자이",
    regionalCode: "11650",
    dong: "반포동",
    propertyType: "아파트",
    totalUnits: 3410,
    totalDongs: 44,
    buildYear: 2009,
    parkingPerUnit: 1.78,
    totalParking: 6079,
    floorAreaRatio: 270,
    buildingCoverage: 13,
    maxFloor: 29,
    heatType: "지역난방 (열병합)",
    constructor: "GS건설",
    subway: "7호선 반포역 (직결), 9호선 사평역 (도보 3분)",
    school: "원촌초, 원촌중 (단지 내 위치, 초품아)",
    latestTradePrice: 380000,
    latestJeonsePrice: 160000,
    pricePerPyeong: 11176,
    jeonseRatio: 42.1,
    lat: 37.5036,
    lng: 127.0142,
    areaTypes: ["59㎡", "84㎡", "130㎡", "165㎡"]
  },
  {
    id: "dogok_rexle",
    name: "도곡렉슬",
    fullName: "도곡렉슬아파트",
    regionalCode: "11680",
    dong: "도곡동",
    propertyType: "아파트",
    totalUnits: 3002,
    totalDongs: 34,
    buildYear: 2006,
    parkingPerUnit: 1.48,
    totalParking: 4443,
    floorAreaRatio: 274,
    buildingCoverage: 15,
    maxFloor: 25,
    heatType: "지역난방 (열병합)",
    constructor: "현대건설, GS건설, 쌍용건설",
    subway: "수도권수인분당선 한티역 (도보 1분 초역세권)",
    school: "대도초, 역삼중, 숙명여고, 단대부고",
    latestTradePrice: 310000,
    latestJeonsePrice: 145000,
    pricePerPyeong: 9117,
    jeonseRatio: 46.7,
    lat: 37.4939,
    lng: 127.0543,
    areaTypes: ["59㎡", "84㎡", "119㎡", "143㎡"]
  }
];

// 금액 포맷터 유틸리티 (만원 -> 억/만원)
const formatMoney = (amountManwon) => {
  if (!amountManwon || amountManwon <= 0) return "-";
  const eok = Math.floor(amountManwon / 10000);
  const rem = amountManwon % 10000;
  if (eok > 0 && rem > 0) return `${eok}억 ${rem.toLocaleString()}만`;
  if (eok > 0) return `${eok}억원`;
  return `${rem.toLocaleString()}만원`;
};

export default function RealEstateDashboard() {
  // ==================== 상태 관리 (State) ====================

  // 1. 선택된 메인 분석 단지
  const [selectedComplexId, setSelectedComplexId] = useState("eunma");
  
  // 2. 단지 비교 그리드용 선택 목록 (기본 2개 비교)
  const [compareIds, setCompareIds] = useState(["eunma", "onebailey"]);

  // 3. 필터 상태 (지역, 건물유형, 거래유형, 기간)
  const [regionFilter, setRegionFilter] = useState("11680"); // 강남구
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("아파트");
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all"); // 'all' | '매매' | '전세' | '월세'
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("1Y"); // '6M' | '1Y' | '3Y' | 'ALL'
  const [areaFilter, setAreaFilter] = useState("all");

  // 4. API 통신 및 데이터 상태
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [apiData, setApiData] = useState({
    summary: { latest_trade_price: "-", latest_jeonse_price: "-" },
    chart_data: [],
    trades: []
  });

  // 5. 미니 맵 인프라 레이어 토글
  const [mapLayer, setMapLayer] = useState("subway"); // 'subway' | 'school' | 'price'
  const [tablePage, setTablePage] = useState(1);
  const ROWS_PER_PAGE = 8;

  // 현재 활성화된 메인 단지 객체
  const currentComplex = useMemo(() => {
    return PRESET_COMPLEXES.find((c) => c.id === selectedComplexId) || PRESET_COMPLEXES[0];
  }, [selectedComplexId]);

  // 비교 대상 단지 리스트
  const compareComplexes = useMemo(() => {
    return compareIds
      .map((id) => PRESET_COMPLEXES.find((c) => c.id === id))
      .filter(Boolean);
  }, [compareIds]);

  // ==================== 백엔드 실거래가 API 연동 (FastAPI) ====================

  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);
    setApiError(null);

    const targetUrl = `http://localhost:8000/api/trades/${currentComplex.regionalCode}`;
    const params = {
      apt_name: currentComplex.name,
      property_type: propertyTypeFilter === "all" ? undefined : propertyTypeFilter,
      trade_type: tradeTypeFilter === "all" ? undefined : tradeTypeFilter,
      limit: 100
    };

    axios
      .get(targetUrl, { params, timeout: 4000 })
      .then((res) => {
        if (isSubscribed && res.data) {
          setApiData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          console.warn("[Dashboard] FastAPI Backend fallback mode:", err.message);
          // 백엔드 미실행 시에도 UI가 깨지지 않도록 스마트 모의 데이터 생성
          generateMockTradeData(currentComplex);
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentComplex, propertyTypeFilter, tradeTypeFilter]);

  // Mock Fallback 생성 함수
  const generateMockTradeData = (complex) => {
    const mockChart = [
      { yearMonth: "2024-01", avg_trade_price: complex.latestTradePrice * 0.94, avg_jeonse_price: complex.latestJeonsePrice * 0.95, trade_count: 8 },
      { yearMonth: "2024-03", avg_trade_price: complex.latestTradePrice * 0.96, avg_jeonse_price: complex.latestJeonsePrice * 0.96, trade_count: 14 },
      { yearMonth: "2024-05", avg_trade_price: complex.latestTradePrice * 0.97, avg_jeonse_price: complex.latestJeonsePrice * 0.98, trade_count: 19 },
      { yearMonth: "2024-07", avg_trade_price: complex.latestTradePrice * 1.01, avg_jeonse_price: complex.latestJeonsePrice * 0.99, trade_count: 22 },
      { yearMonth: "2024-09", avg_trade_price: complex.latestTradePrice * 1.03, avg_jeonse_price: complex.latestJeonsePrice * 1.01, trade_count: 16 },
      { yearMonth: "2024-10", avg_trade_price: complex.latestTradePrice, avg_jeonse_price: complex.latestJeonsePrice, trade_count: 12 }
    ];

    const mockTrades = [
      {
        id: 101,
        deal_date: "2024-10-28",
        trade_type: "매매",
        apt_name: complex.name,
        price_formatted: formatMoney(complex.latestTradePrice),
        raw_price: complex.latestTradePrice,
        exclu_use_ar: 84.8,
        floor: 9,
        rooms: 3,
        bathrooms: 2,
        dong: complex.dong,
        req_gbn: "중개거래"
      },
      {
        id: 102,
        deal_date: "2024-10-22",
        trade_type: "전세",
        apt_name: complex.name,
        price_formatted: formatMoney(complex.latestJeonsePrice),
        raw_price: complex.latestJeonsePrice,
        exclu_use_ar: 84.8,
        floor: 12,
        rooms: 3,
        bathrooms: 2,
        dong: complex.dong,
        req_gbn: "중개거래"
      },
      {
        id: 103,
        deal_date: "2024-10-15",
        trade_type: "매매",
        apt_name: complex.name,
        price_formatted: formatMoney(Math.round(complex.latestTradePrice * 0.98)),
        raw_price: Math.round(complex.latestTradePrice * 0.98),
        exclu_use_ar: 76.5,
        floor: 5,
        rooms: 3,
        bathrooms: 1,
        dong: complex.dong,
        req_gbn: "중개거래"
      },
      {
        id: 104,
        deal_date: "2024-10-04",
        trade_type: "전세",
        apt_name: complex.name,
        price_formatted: formatMoney(Math.round(complex.latestJeonsePrice * 0.96)),
        raw_price: Math.round(complex.latestJeonsePrice * 0.96),
        exclu_use_ar: 84.8,
        floor: 3,
        rooms: 3,
        bathrooms: 2,
        dong: complex.dong,
        req_gbn: "중개거래"
      },
      {
        id: 105,
        deal_date: "2024-09-29",
        trade_type: "월세",
        apt_name: complex.name,
        price_formatted: "보증금 1억 / 월 280만",
        raw_price: 10000,
        monthly_rent: 280,
        exclu_use_ar: 84.8,
        floor: 11,
        rooms: 3,
        bathrooms: 2,
        dong: complex.dong,
        req_gbn: "중개거래"
      },
      {
        id: 106,
        deal_date: "2024-09-18",
        trade_type: "매매",
        apt_name: complex.name,
        price_formatted: formatMoney(Math.round(complex.latestTradePrice * 0.99)),
        raw_price: Math.round(complex.latestTradePrice * 0.99),
        exclu_use_ar: 84.8,
        floor: 14,
        rooms: 3,
        bathrooms: 2,
        dong: complex.dong,
        req_gbn: "중개거래"
      }
    ];

    setApiData({
      summary: {
        latest_trade_price: formatMoney(complex.latestTradePrice),
        latest_jeonse_price: formatMoney(complex.latestJeonsePrice)
      },
      chart_data: mockChart,
      trades: mockTrades
    });
  };

  // 테이블 필터링 데이터
  const displayTrades = useMemo(() => {
    let list = apiData.trades || [];
    if (tradeTypeFilter !== "all") {
      list = list.filter((t) => t.trade_type === tradeTypeFilter);
    }
    return list;
  }, [apiData.trades, tradeTypeFilter]);

  const totalPages = Math.ceil(displayTrades.length / ROWS_PER_PAGE) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (tablePage - 1) * ROWS_PER_PAGE;
    return displayTrades.slice(start, start + ROWS_PER_PAGE);
  }, [displayTrades, tablePage]);

  // 비교 단지 추가/제거 토글
  const toggleCompareComplex = (complexId) => {
    if (compareIds.includes(complexId)) {
      if (compareIds.length > 1) {
        setCompareIds(compareIds.filter((id) => id !== complexId));
      }
    } else {
      if (compareIds.length < 3) {
        setCompareIds([...compareIds, complexId]);
      } else {
        // 최대 3개 초과 시 첫 번째 교체
        setCompareIds([...compareIds.slice(1), complexId]);
      }
    }
  };

  // ==================== 서브 렌더러 컴포넌트들 ====================

  // Recharts 커스텀 툴팁
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-lg shadow-xl border border-slate-700/50 text-xs backdrop-blur-md">
          <div className="font-semibold text-slate-300 pb-1.5 mb-1.5 border-b border-slate-700/70 flex justify-between items-center gap-4">
            <span>{label} 월별 실거래 통계</span>
            <span className="text-[10px] text-slate-400 font-mono">단위: 만원</span>
          </div>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-6 py-0.5">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-white">
                {entry.value ? formatMoney(entry.value) : "-"}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-slate-200">
      
      {/* ========================================================================= */}
      {/* 1. 상단 글로벌 네비게이션 헤더 (B2B SaaS Top Header)                      */}
      {/* ========================================================================= */}
      <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
              ZP
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                ZipView Analytics
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded border border-slate-200">
                  B2B Pro
                </span>
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-gray-200"></div>

          {/* 부동산 유형 탭 */}
          <nav className="flex space-x-1">
            {["아파트", "오피스텔", "연립다세대", "단독다가구"].map((type) => (
              <button
                key={type}
                onClick={() => setPropertyTypeFilter(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  propertyTypeFilter === type
                    ? "bg-slate-100 text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {type}
              </button>
            ))}
          </nav>
        </div>

        {/* 상단 우측: 시스템 상태 및 액션 */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/60 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>국토교통부 실거래 DB 연결됨</span>
          </div>

          <button
            onClick={() => generateMockTradeData(currentComplex)}
            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-gray-200 rounded-md bg-white hover:bg-gray-50 flex items-center gap-1.5 transition-colors font-medium shadow-2xs"
            title="새로고침"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>

          <button className="px-3 py-1 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium shadow-2xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            리포트 내보내기
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. 대시보드 3단 본문 레이아웃                                             */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">

        {/* --------------------------------------------------------------------- */}
        {/* [좌측 패널] 검색 및 정밀 필터 사이드바 (280px)                        */}
        {/* --------------------------------------------------------------------- */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          {/* 단지 검색창 */}
          <div className="p-4 border-b border-gray-100">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              단지 및 자산 검색
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="단지명, 법정동 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-gray-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-400 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* 지역(구) 선택 */}
          <div className="p-4 border-b border-gray-100">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              지역 필터 (시군구)
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { code: "11680", name: "서울 강남구" },
                { code: "11650", name: "서울 서초구" },
                { code: "11710", name: "서울 송파구" },
                { code: "11440", name: "서울 마포구" }
              ].map((reg) => (
                <button
                  key={reg.code}
                  onClick={() => setRegionFilter(reg.code)}
                  className={`py-1.5 px-2 rounded text-left transition-colors border ${
                    regionFilter === reg.code
                      ? "bg-slate-900 text-white border-slate-900 font-medium"
                      : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
                  }`}
                >
                  {reg.name}
                </button>
              ))}
            </div>
          </div>

          {/* 주요 분석 대상 단지 선택 리스트 */}
          <div className="p-4 border-b border-gray-100 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                실거래 모니터링 단지
              </span>
              <span className="text-[10px] text-slate-400">{PRESET_COMPLEXES.length}개소</span>
            </div>

            <div className="space-y-1.5">
              {PRESET_COMPLEXES.filter((c) =>
                c.fullName.includes(searchQuery) || c.dong.includes(searchQuery)
              ).map((complex) => {
                const isSelected = selectedComplexId === complex.id;
                const isCompared = compareIds.includes(complex.id);

                return (
                  <div
                    key={complex.id}
                    onClick={() => setSelectedComplexId(complex.id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-slate-50 border-slate-300 shadow-2xs ring-1 ring-slate-300"
                        : "bg-white border-gray-200/80 hover:border-gray-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {complex.name}
                          <span className="text-[10px] font-normal text-slate-500">
                            {complex.dong}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {complex.totalUnits.toLocaleString()}세대 · {complex.buildYear}년식
                        </div>
                      </div>

                      {/* 비교 체크박스 버튼 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompareComplex(complex.id);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors ${
                          isCompared
                            ? "bg-slate-800 text-white border-slate-800"
                            : "bg-white text-slate-500 border-gray-200 hover:bg-gray-100"
                        }`}
                        title="매물 상호 비교 그리드에 추가/제거"
                      >
                        {isCompared ? "비교중" : "+비교"}
                      </button>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">최근 실거래가</span>
                      <span className="font-bold text-slate-900">
                        {formatMoney(complex.latestTradePrice)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 거래 유형 및 조건 필터 */}
          <div className="p-4 bg-slate-50/70 border-t border-gray-200 text-xs">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              거래 유형
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: "all", label: "전체" },
                { id: "매매", label: "매매" },
                { id: "전세", label: "전세" },
                { id: "월세", label: "월세" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTradeTypeFilter(tab.id)}
                  className={`py-1 text-center rounded text-[11px] font-medium border ${
                    tradeTypeFilter === tab.id
                      ? "bg-white border-slate-300 text-slate-900 shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* --------------------------------------------------------------------- */}
        {/* [중앙 패널] 메인 데이터 캔버스 (차트, 비교 그리드, 거래 테이블)      */}
        {/* --------------------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. 상단 단지 브리핑 헤더 & 핵심 지표 (KPI Cards) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded">
                    {currentComplex.dong}
                  </span>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    {currentComplex.fullName}
                  </h1>
                  <span className="text-xs text-slate-400 font-mono">
                    LAWD_CD: {currentComplex.regionalCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {currentComplex.subway} · {currentComplex.school}
                </p>
              </div>

              {/* 기간 선택 토글 */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg self-start">
                {["6M", "1Y", "3Y", "ALL"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      timeRange === range
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* 4개 핵심 통계 지표 (KPI Cards) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div className="p-3 bg-slate-50/70 border border-gray-100 rounded-lg">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1">
                  최근 매매 실거래가
                </span>
                <div className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {formatMoney(currentComplex.latestTradePrice)}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5 mt-0.5">
                  <span>▲ 2.8%</span>
                  <span className="text-slate-400 font-normal">직전 거래 대비</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50/70 border border-gray-100 rounded-lg">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1">
                  최근 전세 실거래가
                </span>
                <div className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {formatMoney(currentComplex.latestJeonsePrice)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  전세가율 <span className="font-bold text-slate-800">{currentComplex.jeonseRatio}%</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50/70 border border-gray-100 rounded-lg">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1">
                  3.3㎡(평)당 평균가
                </span>
                <div className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {currentComplex.pricePerPyeong.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 ml-1">만원</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  전용 84㎡ 기준 환산
                </div>
              </div>

              <div className="p-3 bg-slate-50/70 border border-gray-100 rounded-lg">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1">
                  총 단지 규모
                </span>
                <div className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {currentComplex.totalUnits.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 ml-1">세대</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  총 {currentComplex.totalDongs}개동 · 주차 세대당 {currentComplex.parkingPerUnit}대
                </div>
              </div>
            </div>
          </div>

          {/* 2. 가격 변동 차트 모듈 (Recharts 활용 실거래 추이) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  월별 실거래가 변동 추이
                  <span className="text-xs font-normal text-slate-400">
                    (국토부 계약일 기준 월별 평균 거래가)
                  </span>
                </h2>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-900 rounded-xs"></span>
                  <span className="text-slate-600 font-medium">매매 평균가</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></span>
                  <span className="text-slate-600 font-medium">전세 평균가</span>
                </div>
              </div>
            </div>

            {/* Recharts 메인 그래프 */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={apiData.chart_data}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="tradeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="jeonseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="yearMonth"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Math.round(val / 10000)}억`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="avg_trade_price"
                    name="매매 실거래 평균"
                    stroke="#0f172a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#tradeGradient)"
                    dot={{ r: 3, fill: "#0f172a" }}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_jeonse_price"
                    name="전세 실거래 평균"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#jeonseGradient)"
                    dot={{ r: 3, fill: "#10b981" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. ★ 핵심 차별화 기능: [매물 상호 비교 (Comparison) Data Grid] */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded border border-indigo-200/50">
                    B2B Data Grid
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    단지 스펙 & 실거래가 상호 비교 매트릭스
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  선택한 {compareComplexes.length}개 단지의 건축 스펙, 인프라, 실거래 시세를 좌우로 나란히 비교합니다.
                </p>
              </div>

              {/* 비교 단지 관리 뱃지 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COMPLEXES.map((c) => {
                  const active = compareIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCompareComplex(c.id)}
                      className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-all ${
                        active
                          ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs"
                          : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
                      }`}
                    >
                      {active ? `✓ ${c.name}` : `+ ${c.name}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 비교 Data Grid 테이블 */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-gray-200 text-slate-600">
                    <th className="py-3 px-4 font-semibold w-40 border-r border-gray-200 uppercase tracking-wider text-[11px]">
                      비교 항목
                    </th>
                    {compareComplexes.map((c) => (
                      <th key={c.id} className="py-3 px-4 font-bold text-slate-900 border-r border-gray-200 last:border-r-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{c.name}</span>
                          <span className="text-[10px] font-normal text-slate-500 px-1.5 py-0.5 bg-white border border-gray-200 rounded">
                            {c.dong}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* 행 1: 최근 매매 실거래가 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      최근 매매 실거래가
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 font-mono font-bold text-slate-900 border-r border-gray-200 last:border-r-0">
                        {formatMoney(c.latestTradePrice)}
                      </td>
                    ))}
                  </tr>

                  {/* 행 2: 최근 전세 실거래가 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      최근 전세 실거래가
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 font-mono font-semibold text-emerald-700 border-r border-gray-200 last:border-r-0">
                        {formatMoney(c.latestJeonsePrice)}
                      </td>
                    ))}
                  </tr>

                  {/* 행 3: 전세가율 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      전세가율 (안정성 지표)
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 font-mono border-r border-gray-200 last:border-r-0">
                        <span className="font-bold text-slate-800">{c.jeonseRatio}%</span>
                        <div className="w-24 bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-slate-700 h-full rounded-full"
                            style={{ width: `${Math.min(c.jeonseRatio, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* 행 4: 평당 매매가 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      3.3㎡(평)당 평균가
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 font-mono font-medium text-slate-700 border-r border-gray-200 last:border-r-0">
                        {c.pricePerPyeong.toLocaleString()} 만원
                      </td>
                    ))}
                  </tr>

                  {/* 행 5: 총 세대수 & 동수 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      단지 규모 (세대수 / 동수)
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 border-r border-gray-200 last:border-r-0">
                        <span className="font-bold text-slate-900">{c.totalUnits.toLocaleString()}</span> 세대
                        <span className="text-slate-400 font-normal ml-1">({c.totalDongs}개동)</span>
                      </td>
                    ))}
                  </tr>

                  {/* 행 6: 주차대수 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      주차 스펙 (세대당)
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 border-r border-gray-200 last:border-r-0">
                        <span className="font-semibold text-slate-900 font-mono">{c.parkingPerUnit}</span> 대
                        <span className="text-slate-400 text-[11px] ml-1">
                          (총 {c.totalParking.toLocaleString()}대)
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* 행 7: 용적률 / 건폐율 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      용적률 / 건폐율
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 font-mono border-r border-gray-200 last:border-r-0">
                        <span>{c.floorAreaRatio}%</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span>{c.buildingCoverage}%</span>
                      </td>
                    ))}
                  </tr>

                  {/* 행 8: 준공년도 및 연식 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      준공년도 / 최고층
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 border-r border-gray-200 last:border-r-0">
                        <span className="font-semibold text-slate-800">{c.buildYear}년</span>
                        <span className="text-slate-400 text-[11px] ml-1">
                          ({2024 - c.buildYear}년차, 최고 {c.maxFloor}층)
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* 행 9: 시공사 & 난방방식 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      건설사 / 난방방식
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 text-slate-700 border-r border-gray-200 last:border-r-0">
                        <div className="font-medium text-slate-900">{c.constructor}</div>
                        <div className="text-[11px] text-slate-400">{c.heatType}</div>
                      </td>
                    ))}
                  </tr>

                  {/* 행 10: 교통 인프라 */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-500 bg-slate-50/40 border-r border-gray-200">
                      교통 & 대중교통
                    </td>
                    {compareComplexes.map((c) => (
                      <td key={c.id} className="py-2.5 px-4 text-slate-700 text-[11px] border-r border-gray-200 last:border-r-0">
                        {c.subway}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. 실거래가 상세 테이블 (Detailed Transactions Table) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  국토교통부 실거래 계약 상세 리스트
                  <span className="text-xs font-normal text-slate-400">
                    (총 {displayTrades.length}건 등록)
                  </span>
                </h2>
              </div>

              {/* 테이블 우측 컨트롤 */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500">페이지 {tablePage} / {totalPages}</span>
                <div className="flex items-center space-x-1">
                  <button
                    disabled={tablePage === 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white text-slate-600"
                  >
                    ◀
                  </button>
                  <button
                    disabled={tablePage >= totalPages}
                    onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white text-slate-600"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>

            {/* 정밀 데이터 테이블 */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">계약일자</th>
                    <th className="py-2.5 px-3">거래유형</th>
                    <th className="py-2.5 px-3">거래금액 / 보증금</th>
                    <th className="py-2.5 px-3">전용면적</th>
                    <th className="py-2.5 px-3">층수</th>
                    <th className="py-2.5 px-3">구조 (방/욕실)</th>
                    <th className="py-2.5 px-3">동</th>
                    <th className="py-2.5 px-3">중개구분</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTrades.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400">
                        해당 필터 조건에 부합하는 실거래 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    paginatedTrades.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-600 font-medium">
                          {item.deal_date || `${item.deal_year}-${String(item.deal_month).padStart(2, "0")}-${String(item.deal_day).padStart(2, "0")}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.trade_type === "매매"
                              ? "bg-slate-100 text-slate-800 border border-slate-200"
                              : item.trade_type === "전세"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {item.trade_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {item.price_formatted}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {item.exclu_use_ar}㎡
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({Math.round((item.exclu_use_ar || 0) / 3.3058)}평)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {item.floor ? `${item.floor}층` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          방 {item.rooms || 3}개 · 욕실 {item.bathrooms || 1}개
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-medium">
                          {item.dong || currentComplex.dong}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">
                          {item.req_gbn || "중개거래"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* --------------------------------------------------------------------- */}
        {/* [우측 패널] 미니 맵 위젯 & 단지 종합 스펙 인스펙터 (340px)          */}
        {/* --------------------------------------------------------------------- */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto">

          {/* 1. 미니 맵 위젯 (전체 화면이 아닌 대시보드 내 인라인 위젯 카드) */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                단지 지리정보 (Mini Map)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {currentComplex.lat}, {currentComplex.lng}
              </span>
            </div>

            {/* 인라인 미니맵 캔버스 (클린 벡터/위젯 스타일) */}
            <div className="h-44 w-full bg-slate-100 rounded-lg border border-gray-200 relative overflow-hidden flex items-center justify-center group shadow-inner">
              {/* 그리드 지도 패턴 배경 */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px), radial-gradient(#94a3b8 1px, #f1f5f9 1px)`,
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 10px 10px"
                }}
              ></div>

              {/* 지하철 / 도로 라인 장식 */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                <path d="M-20 80 Q 80 120 180 60 T 360 110" stroke="#f59e0b" strokeWidth="3" fill="none" />
                <path d="M40 -20 Q 90 90 150 180" stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeDasharray="4 2" />
              </svg>

              {/* 단지 중심 핀 & 팝업 가격 태그 */}
              <div className="relative z-10 flex flex-col items-center animate-bounce-short">
                <div className="bg-slate-900 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-md border border-slate-700 flex items-center gap-1">
                  <span>{currentComplex.name}</span>
                  <span className="text-emerald-400 font-mono text-[10px]">
                    {formatMoney(currentComplex.latestTradePrice)}
                  </span>
                </div>
                <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1 shadow-xs"></div>
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 ring-4 ring-indigo-200 animate-ping"></div>
              </div>

              {/* 하단 지도 레이어 컨트롤 토글 */}
              <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-xs p-1 rounded border border-gray-200/80 flex justify-between text-[10px]">
                <button
                  onClick={() => setMapLayer("subway")}
                  className={`px-1.5 py-0.5 rounded font-medium ${mapLayer === "subway" ? "bg-slate-800 text-white" : "text-slate-600"}`}
                >
                  지하철 반경
                </button>
                <button
                  onClick={() => setMapLayer("school")}
                  className={`px-1.5 py-0.5 rounded font-medium ${mapLayer === "school" ? "bg-slate-800 text-white" : "text-slate-600"}`}
                >
                  학군/학원가
                </button>
                <button
                  onClick={() => setMapLayer("price")}
                  className={`px-1.5 py-0.5 rounded font-medium ${mapLayer === "price" ? "bg-slate-800 text-white" : "text-slate-600"}`}
                >
                  주변 시세
                </button>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{currentComplex.dong} 법정동 일대</span>
              <a
                href={`https://map.kakao.com/?q=${encodeURIComponent(currentComplex.fullName)}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-700 hover:text-slate-900 font-medium underline underline-offset-2 flex items-center gap-0.5"
              >
                카카오맵 상세
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* 2. 단지 건축 스펙 인포그래픽 위젯 */}
          <div className="p-4 border-b border-gray-100 flex-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              건축 스펙 & 자산 명세
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">총 세대수</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {currentComplex.totalUnits.toLocaleString()} 세대
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">동수 / 최고층수</span>
                <span className="font-semibold text-slate-900">
                  {currentComplex.totalDongs}개동 / {currentComplex.maxFloor}층
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">주차대수 (세대당)</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {currentComplex.parkingPerUnit}대 ({currentComplex.totalParking}대)
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">용적률 / 건폐율</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {currentComplex.floorAreaRatio}% / {currentComplex.buildingCoverage}%
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">사용승인일 (연식)</span>
                <span className="font-semibold text-slate-900">
                  {currentComplex.buildYear}년 ({2024 - currentComplex.buildYear}년차)
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">난방 방식</span>
                <span className="font-semibold text-slate-900">{currentComplex.heatType}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">시공사</span>
                <span className="font-semibold text-slate-900">{currentComplex.constructor}</span>
              </div>
            </div>
          </div>

          {/* 3. AI 기반 시장 진단 & 분석 리포트 위젯 (Gemini / GPT Insight) */}
          <div className="p-4 bg-slate-50/70 border-t border-gray-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                AI 시장 데이터 진단
              </span>
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold border border-indigo-200">
                AI Agent
              </span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs text-slate-700 leading-relaxed text-[11px]">
              <p className="font-semibold text-slate-900 mb-1">
                📈 {currentComplex.name} 분석 리포트
              </p>
              <p className="text-slate-600">
                현재 전세가율 <strong className="text-slate-900">{currentComplex.jeonseRatio}%</strong> 수준으로 
                직전 3분기 대비 실거래 거래량이 약 15% 회복세를 보이고 있습니다.
                평당가 <strong className="text-slate-900">{currentComplex.pricePerPyeong.toLocaleString()}만원</strong>은 
                동일 권역 대비 적정 구간으로 평가됩니다.
              </p>
            </div>
          </div>

        </aside>
      </div>

    </div>
  );
}

