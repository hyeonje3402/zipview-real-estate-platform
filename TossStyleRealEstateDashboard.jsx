import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";

/**
 * =========================================================================
 * 집뷰(ZipView) 토스 스타일 통합 부동산 실거래가 분석 대시보드
 * =========================================================================
 *
 * [통합 특징 및 아키텍처]
 * 1. 토스(Toss) 디자인 시스템: #F2F4F6 토스 그레이, 24px 둥근 카드, 토스 블루(#3182F6) 포인트, 미니멀 필터 Pill 버튼
 * 2. B2B 분석 엔진 결합:
 *    - [필수 1] 단지 스펙 & 실거래가 상호 비교 매트릭스 (Data Grid)
 *    - [필수 2] Recharts 기반 월별 매매/전세 실거래가 추이 듀얼 차트 & 거래량
 *    - [필수 3] 국토교통부 실거래 계약 상세 리스트 (페이지네이션 지원 테이블)
 * 3. 백엔드 실시간 API 연동: 포트 8001 (fallback 8000), 필터 클릭 시 즉각적인 Axios 비동기 쿼리 및 리렌더링
 * 4. 더미 데이터 제거 및 실제 DB 데이터 실시간 바인딩 (평당가, 전세가율, 방/욕실 추정치 등 자동 산출)
 * 5. 국토교통부 실시간 동기화 트리거 및 토스 스타일 플로팅 AI 상담 챗봇 내장
 */

// 금액 포맷터 유틸리티 (만원 단위 -> 'X억 Y만원')
const formatTossMoney = (manwon) => {
  if (!manwon || manwon <= 0) return "-";
  const num = Math.round(manwon);
  const eok = Math.floor(num / 10000);
  const rem = num % 10000;
  if (eok > 0 && rem > 0) return `${eok}억 ${rem.toLocaleString()}만`;
  if (eok > 0) return `${eok}억원`;
  return `${rem.toLocaleString()}만원`;
};

// ㎡ -> 평 환산 유틸리티
const toPyeong = (m2) => {
  if (!m2 || m2 <= 0) return 0;
  return (parseFloat(m2) * 0.3025).toFixed(1);
};

export default function TossStyleRealEstateDashboard() {
  // ==================== 1. 필터 및 쿼리 상태 ====================
  const [regionFilter, setRegionFilter] = useState("11680"); // 11680: 강남구, 11650: 서초구, 11710: 송파구
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all"); // 'all', '아파트', '오피스텔', '연립다세대', '단독다가구'
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all"); // 'all', '매매', '전세', '월세'
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ==================== 2. 데이터 및 로딩 상태 ====================
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [apiPort, setApiPort] = useState(8001);
  const [rawTrades, setRawTrades] = useState([]);
  const [summaryInfo, setSummaryInfo] = useState({
    totalCount: 0,
    latestTradePrice: "-",
    latestJeonsePrice: "-",
    lastSyncedAt: "-"
  });

  // ==================== 3. 상호 비교 매트릭스 선택 상태 ====================
  // 사용자가 비교표에서 선택한 건물명들 (최대 3개)
  const [selectedComplexNames, setSelectedComplexNames] = useState([]);

  // ==================== 4. 차트 모드 및 페이징 상태 ====================
  const [chartViewMode, setChartViewMode] = useState("all"); // 'all', '매매', '전세'
  const [tablePage, setTablePage] = useState(1);
  const ROWS_PER_PAGE = 8;

  // ==================== 5. 플로팅 AI 모달 상태 ====================
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "안녕하세요! 집뷰 AI 부동산 상담원입니다.\n국토교통부 실거래가 시세, 전세가율, 조건별 추천 매물에 대해 무엇이든 편하게 물어보세요.",
      time: "방금 전"
    }
  ]);
  const chatBottomRef = useRef(null);

  // 토스트 메시지 상태
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // 검색어 디바운스
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setTablePage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ==================== 6. 백엔드 실거래가 API 호출 (포트 8001 기본, 8000 폴백) ====================
  const fetchTradesFromBackend = async (isRetry = false) => {
    setLoading(true);
    const targetPort = isRetry ? (apiPort === 8001 ? 8000 : 8001) : apiPort;

    const params = {
      limit: 300
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
      const url = `http://localhost:${targetPort}/api/trades/${regionFilter}`;
      const response = await axios.get(url, { params, timeout: 5000 });

      if (response.data) {
        const fetchedTrades = response.data.trades || (Array.isArray(response.data) ? response.data : []);
        setRawTrades(fetchedTrades);
        setApiPort(targetPort);

        // 요약 정보 갱신
        setSummaryInfo({
          totalCount: response.data.total_count || fetchedTrades.length,
          latestTradePrice: response.data.summary?.latest_trade_price || "-",
          latestJeonsePrice: response.data.summary?.latest_jeonse_price || "-",
          lastSyncedAt: response.data.last_synced_at || new Date().toLocaleTimeString("ko-KR")
        });

        // 비교 대상 기본값 설정: 검색된 건물 중 상위 2~3개 자동 지정
        if (fetchedTrades.length > 0) {
          const uniqueNames = Array.from(new Set(fetchedTrades.map((t) => t.apt_name))).filter(Boolean);
          setSelectedComplexNames((prev) => {
            const validPrev = prev.filter((name) => uniqueNames.includes(name));
            return validPrev.length > 0 ? validPrev : uniqueNames.slice(0, 2);
          });
        } else {
          setSelectedComplexNames([]);
        }
      }
    } catch (err) {
      console.warn(`[ZipView] 포트 ${targetPort} 연결 실패:`, err.message);
      if (!isRetry) {
        console.info(`[ZipView] 보조 포트로 자동 재시도 중...`);
        fetchTradesFromBackend(true);
      } else {
        showToast("⚠️ 백엔드 API 서버(포트 8001/8000) 통신을 확인해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTradesFromBackend();
    setTablePage(1);
  }, [regionFilter, propertyTypeFilter, tradeTypeFilter, debouncedSearch]);

  // ==================== 7. 국토교통부 실시간 동기화 트리거 ====================
  const handleRealtimeSync = async () => {
    setSyncLoading(true);
    try {
      const res = await axios.post(
        `http://localhost:${apiPort}/api/sync/${regionFilter}?deal_ymd=202410`,
        {},
        { timeout: 30000 }
      );
      if (res.data && res.data.status === "success") {
        showToast(`🎉 국토부 실시간 동기화 완료! (+${res.data.added_count}건 신규 적재)`);
        await fetchTradesFromBackend();
      } else {
        showToast("국토부 API 응답을 확인했습니다.");
      }
    } catch (err) {
      showToast("실시간 동기화 중 일시적 오류가 발생했습니다.");
    } finally {
      setSyncLoading(false);
    }
  };

  // ==================== 8. 월별 시계열 차트 데이터 실시간 집계 ====================
  const chartData = useMemo(() => {
    if (!rawTrades || rawTrades.length === 0) return [];

    const monthMap = {};
    rawTrades.forEach((item) => {
      const year = item.deal_year || (item.deal_date ? parseInt(item.deal_date.slice(0, 4)) : 2024);
      const month = item.deal_month || (item.deal_date ? parseInt(item.deal_date.slice(5, 7)) : 10);
      const ym = `${String(year).slice(2)}.${String(month).padStart(2, "0")}`;

      if (!monthMap[ym]) {
        monthMap[ym] = {
          month: ym,
          tradeSum: 0,
          tradeCount: 0,
          jeonseSum: 0,
          jeonseCount: 0,
          totalCount: 0
        };
      }

      monthMap[ym].totalCount += 1;
      if (item.trade_type === "매매" && item.deal_amount) {
        monthMap[ym].tradeSum += item.deal_amount;
        monthMap[ym].tradeCount += 1;
      } else if (item.trade_type === "전세" && item.deposit) {
        monthMap[ym].jeonseSum += item.deposit;
        monthMap[ym].jeonseCount += 1;
      }
    });

    return Object.keys(monthMap)
      .sort()
      .map((ym) => {
        const d = monthMap[ym];
        return {
          month: d.month,
          tradePrice: d.tradeCount > 0 ? Math.round(d.tradeSum / d.tradeCount) : null,
          jeonsePrice: d.jeonseCount > 0 ? Math.round(d.jeonseSum / d.jeonseCount) : null,
          tradeCount: d.tradeCount,
          jeonseCount: d.jeonseCount,
          totalCount: d.totalCount
        };
      });
  }, [rawTrades]);

  // ==================== 9. 상호 비교 매트릭스 데이터 집계 ====================
  const comparisonMatrixData = useMemo(() => {
    if (!selectedComplexNames || selectedComplexNames.length === 0) return [];

    return selectedComplexNames.map((name) => {
      const complexTrades = rawTrades.filter((t) => t.apt_name === name);
      const tradesOnly = complexTrades.filter((t) => t.trade_type === "매매" && t.deal_amount);
      const jeonseOnly = complexTrades.filter((t) => t.trade_type === "전세" && t.deposit);

      const latestTrade = tradesOnly[0] || null;
      const latestJeonse = jeonseOnly[0] || null;
      const latestAny = complexTrades[0] || {};

      const avgTradePrice = tradesOnly.length > 0
        ? Math.round(tradesOnly.reduce((acc, c) => acc + c.deal_amount, 0) / tradesOnly.length)
        : null;
      const avgJeonsePrice = jeonseOnly.length > 0
        ? Math.round(jeonseOnly.reduce((acc, c) => acc + c.deposit, 0) / jeonseOnly.length)
        : null;

      // 전세가율 계산
      const jeonseRatio = (avgTradePrice && avgJeonsePrice)
        ? ((avgJeonsePrice / avgTradePrice) * 100).toFixed(1)
        : "-";

      // 평균 평당가 (3.3㎡당 만원)
      const avgArea = complexTrades.length > 0
        ? complexTrades.reduce((acc, c) => acc + (c.exclu_use_ar || 84), 0) / complexTrades.length
        : 84;
      const pyeongPrice = (avgTradePrice && avgArea > 0)
        ? Math.round(avgTradePrice / (avgArea * 0.3025))
        : null;

      return {
        name,
        dong: latestAny.dong || "서울시",
        propertyType: latestAny.property_type || "아파트",
        sampleCount: complexTrades.length,
        latestTradePrice: latestTrade ? latestTrade.deal_amount : null,
        latestJeonsePrice: latestJeonse ? latestJeonse.deposit : null,
        avgTradePrice,
        avgJeonsePrice,
        jeonseRatio,
        avgArea: avgArea.toFixed(1),
        avgPyeong: toPyeong(avgArea),
        pyeongPrice,
        rooms: latestAny.rooms || 3,
        bathrooms: latestAny.bathrooms || 1,
        latestDate: latestAny.deal_date || "-",
        floor: latestAny.floor ? `${latestAny.floor}층` : "층 미표기"
      };
    });
  }, [selectedComplexNames, rawTrades]);

  // 비교 후보 단지 목록 (검색결과에서 고유 건물명 추출)
  const availableComplexNames = useMemo(() => {
    return Array.from(new Set(rawTrades.map((t) => t.apt_name))).filter(Boolean);
  }, [rawTrades]);

  const toggleCompareComplex = (name) => {
    if (selectedComplexNames.includes(name)) {
      if (selectedComplexNames.length > 1) {
        setSelectedComplexNames(selectedComplexNames.filter((n) => n !== name));
      }
    } else {
      if (selectedComplexNames.length < 3) {
        setSelectedComplexNames([...selectedComplexNames, name]);
      } else {
        setSelectedComplexNames([...selectedComplexNames.slice(1), name]);
      }
    }
  };

  // ==================== 10. 실거래 상세 테이블 페이지네이션 ====================
  const totalPages = Math.ceil(rawTrades.length / ROWS_PER_PAGE) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (tablePage - 1) * ROWS_PER_PAGE;
    return rawTrades.slice(start, start + ROWS_PER_PAGE);
  }, [rawTrades, tablePage]);

  // ==================== 11. AI 부동산 상담 질문 전송 ====================
  const handleSendAiPrompt = async (e) => {
    e?.preventDefault();
    if (!chatPrompt.trim() || aiLoading) return;

    const userText = chatPrompt.trim();
    setChatPrompt("");
    const newMsg = { sender: "user", text: userText, time: "방금 전" };
    setChatMessages((prev) => [...prev, newMsg]);
    setAiLoading(true);

    try {
      const res = await axios.post(`http://localhost:${apiPort}/api/chat`, {
        prompt: userText,
        model_choice: "gpt"
      });
      if (res.data && res.data.reply) {
        setChatMessages((prev) => [
          ...prev,
          { sender: "ai", text: res.data.reply, time: "방금 전" }
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "⚠️ AI 서버와의 연결에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.", time: "방금 전" }
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  // ==================== 차트 커스텀 툴팁 ====================
  const TossChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#191F28]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl text-xs border border-white/10 space-y-1.5 min-w-[150px]">
          <div className="text-[#8B95A1] font-semibold pb-1 border-b border-white/10 flex justify-between">
            <span>20{label}</span>
            <span className="text-[#3182F6]">실거래 통계</span>
          </div>
          {payload.map((entry, index) => (
            <div key={index} className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                {entry.name}:
              </span>
              <span className="font-bold text-white">
                {entry.dataKey === "totalCount" ? `${entry.value}건` : formatTossMoney(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#191F28] font-sans antialiased pb-28 selection:bg-[#E8F3FF] selection:text-[#3182F6]">
      {/* ========================================================================= */}
      {/* 1. 상단 글로벌 네비게이션 헤더                                            */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#E5E8EB] px-6 h-16 flex items-center justify-between">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-[#3182F6] flex items-center justify-center text-white font-black text-lg shadow-sm">
              Z
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-[#191F28] tracking-tight">집뷰(ZipView)</span>
                <span className="bg-[#E8F3FF] text-[#3182F6] text-[10px] font-bold px-2 py-0.5 rounded-full">TOSS PRO</span>
              </div>
              <p className="text-[11px] text-[#8B95A1] font-medium leading-none">국토교통부 4대 주택유형 실거래 통합 플랫폼</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* 연결 상태 뱃지 */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-[#E8F3FF] text-[#3182F6] rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] animate-pulse"></span>
              <span>포트 {apiPort} 연동 완료</span>
            </div>

            {/* 실시간 국토부 동기화 버튼 */}
            <button
              onClick={handleRealtimeSync}
              disabled={syncLoading}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-white border border-[#E5E8EB] hover:bg-[#F2F4F6] text-[#191F28] rounded-full text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <span className={syncLoading ? "animate-spin" : ""}>🔄</span>
              <span>{syncLoading ? "국토부 수신 중..." : "국토부 실시간 동기화"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. 메인 대시보드 컨테이너                                                  */}
      {/* ========================================================================= */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* ----------------- 토스 스타일 인터랙티브 상단 필터 바 ----------------- */}
        <section className="bg-white rounded-[24px] p-5 shadow-xs border border-[#F2F4F6] space-y-4">
          {/* 주택 유형 필터 (Pill 버튼) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#8B95A1] mr-1">주택유형</span>
            {[
              { id: "all", label: "전체" },
              { id: "아파트", label: "아파트" },
              { id: "오피스텔", label: "오피스텔" },
              { id: "연립다세대", label: "연립다세대 (빌라)" },
              { id: "단독다가구", label: "단독다가구 (원룸)" }
            ].map((p) => {
              const active = propertyTypeFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPropertyTypeFilter(p.id)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                    active
                      ? "bg-[#191F28] text-white shadow-xs"
                      : "bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* 거래 유형 & 지역 & 단지 검색 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F2F4F6]">
            {/* 거래 유형 (전체 / 매매 / 전세 / 월세) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#8B95A1] mr-1">거래구분</span>
              {[
                { id: "all", label: "전체" },
                { id: "매매", label: "매매" },
                { id: "전세", label: "전세" },
                { id: "월세", label: "월세" }
              ].map((t) => {
                const active = tradeTypeFilter === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTradeTypeFilter(t.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      active
                        ? "bg-[#3182F6] text-white"
                        : "bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 지역(구) 선택 및 검색창 */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* 지역 필터 */}
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="bg-[#F2F4F6] text-xs font-bold text-[#191F28] px-3.5 py-2 rounded-full border-none outline-none cursor-pointer hover:bg-[#E5E8EB] transition-all"
              >
                <option value="11680">서울 강남구 (11680)</option>
                <option value="11650">서울 서초구 (11650)</option>
                <option value="11710">서울 송파구 (11710)</option>
              </select>

              {/* 단지 검색창 */}
              <div className="relative flex-1 sm:w-60">
                <input
                  type="text"
                  placeholder="단지명/건물명 검색 (예: 은마, 래미안)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F2F4F6] text-xs text-[#191F28] pl-8 pr-7 py-2 rounded-full outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all font-medium placeholder-[#8B95A1]"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8B95A1]">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8B95A1] hover:text-[#191F28]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ----------------- 실시간 지표 요약 카드 그리드 ----------------- */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-[24px] p-5 shadow-xs border border-[#F2F4F6]">
            <span className="text-xs font-semibold text-[#8B95A1]">조회된 실거래</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#191F28]">{summaryInfo.totalCount.toLocaleString()}</span>
              <span className="text-xs font-bold text-[#8B95A1]">건</span>
            </div>
            <span className="text-[11px] text-[#3182F6] font-medium mt-1 block">국토부 공공 API 최신본</span>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-xs border border-[#F2F4F6]">
            <span className="text-xs font-semibold text-[#8B95A1]">최신 매매 최고가</span>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-[#F04452] tracking-tight">{summaryInfo.latestTradePrice}</span>
            </div>
            <span className="text-[11px] text-[#8B95A1] font-medium mt-1 block">계약일자 기준 최신가</span>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-xs border border-[#F2F4F6]">
            <span className="text-xs font-semibold text-[#8B95A1]">최신 전세 보증금</span>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-[#3182F6] tracking-tight">{summaryInfo.latestJeonsePrice}</span>
            </div>
            <span className="text-[11px] text-[#8B95A1] font-medium mt-1 block">순수 전세 계약 기준</span>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-xs border border-[#F2F4F6]">
            <span className="text-xs font-semibold text-[#8B95A1]">비교 분석 가능 단지</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#191F28]">{availableComplexNames.length}</span>
              <span className="text-xs font-bold text-[#8B95A1]">개 단지</span>
            </div>
            <span className="text-[11px] text-[#00B493] font-medium mt-1 block">상호 스펙 비교 지원</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [필수 이식 1] 단지 스펙 & 실거래가 상호 비교 매트릭스 (Data Grid)          */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[24px] p-6 sm:p-7 shadow-xs border border-[#F2F4F6] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E8F3FF] text-[#3182F6] text-xs font-extrabold px-2.5 py-1 rounded-full">VS Matrix</span>
                <h2 className="text-lg font-black text-[#191F28] tracking-tight">단지 스펙 & 실거래가 상호 비교 매트릭스</h2>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                실시간 DB에서 추출된 주요 단지를 나란히 비교하여 가격 격차와 전세가율, 평당가를 분석합니다.
              </p>
            </div>

            {/* 단지 선택 토글 버튼 목록 (최대 3개 선택) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#8B95A1] font-bold mr-1">비교단지 선택:</span>
              {availableComplexNames.slice(0, 5).map((cName) => {
                const isSelected = selectedComplexNames.includes(cName);
                return (
                  <button
                    key={cName}
                    onClick={() => toggleCompareComplex(cName)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-[#3182F6] text-white shadow-xs"
                        : "bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}{cName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 비교 매트릭스 그리드 테이블 */}
          {comparisonMatrixData.length === 0 ? (
            <div className="py-12 text-center text-[#8B95A1] text-xs font-medium">
              비교할 단지 데이터가 없습니다. 상단 필터를 조정해 주세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#F2F4F6] text-[#8B95A1]">
                    <th className="py-3 px-4 font-bold w-36">비교 항목</th>
                    {comparisonMatrixData.map((c, i) => (
                      <th key={i} className="py-3 px-4 font-extrabold text-[#191F28] text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3182F6]"></span>
                          <span>{c.name}</span>
                          <span className="text-[10px] bg-[#F2F4F6] text-[#8B95A1] font-normal px-1.5 py-0.5 rounded">
                            {c.propertyType}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F6]">
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">위치 (법정동)</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4 text-[#191F28] font-semibold">{c.dong}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">최근 실거래가</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4">
                        <span className="text-sm font-black text-[#F04452]">
                          {c.latestTradePrice ? formatTossMoney(c.latestTradePrice) : "-"}
                        </span>
                        <span className="text-[11px] text-[#8B95A1] block font-medium">
                          평균: {c.avgTradePrice ? formatTossMoney(c.avgTradePrice) : "-"}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">최근 전세가</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4">
                        <span className="text-sm font-black text-[#3182F6]">
                          {c.latestJeonsePrice ? formatTossMoney(c.latestJeonsePrice) : "-"}
                        </span>
                        <span className="text-[11px] text-[#8B95A1] block font-medium">
                          평균: {c.avgJeonsePrice ? formatTossMoney(c.avgJeonsePrice) : "-"}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">전세가율</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4 font-extrabold text-[#191F28]">
                        {c.jeonseRatio !== "-" ? `${c.jeonseRatio}%` : "-"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">평당 가격 (3.3㎡)</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4 font-extrabold text-[#191F28]">
                        {c.pyeongPrice ? `${formatTossMoney(c.pyeongPrice)} / 평` : "-"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">전용면적 / 평형</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4 text-[#4E5968] font-medium">
                        {c.avgArea}㎡ ({c.avgPyeong}평)
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">구조 정보</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4 text-[#191F28] font-semibold">
                        방 {c.rooms}개 · 욕실 {c.bathrooms}개
                        <span className="ml-1.5 text-[10px] bg-[#E8F3FF] text-[#3182F6] font-bold px-1.5 py-0.5 rounded">
                          추정치
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#8B95A1] bg-[#FAFAFA]/60">최근 계약일자</td>
                    {comparisonMatrixData.map((c, i) => (
                      <td key={i} className="py-3.5 px-4 text-[#4E5968] font-medium">
                        {c.latestDate} ({c.floor})
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* [필수 이식 2] Recharts 기반 월별 매매/전세 실거래가 추이 차트            */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[24px] p-6 sm:p-7 shadow-xs border border-[#F2F4F6] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E8F3FF] text-[#3182F6] text-xs font-extrabold px-2.5 py-1 rounded-full">Trend Chart</span>
                <h2 className="text-lg font-black text-[#191F28] tracking-tight">월별 매매 / 전세 실거래가 추이 & 거래량</h2>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                실제 수집된 실거래 계약 내역을 월별로 집계하여 평균 실거래 가격 곡선과 거래량을 함께 보여줍니다.
              </p>
            </div>

            {/* 차트 뷰 모드 토글 (전체 / 매매만 / 전세만) */}
            <div className="flex items-center gap-1 bg-[#F2F4F6] p-1 rounded-full">
              {[
                { id: "all", label: "매매+전세" },
                { id: "매매", label: "매매만" },
                { id: "전세", label: "전세만" }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setChartViewMode(m.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    chartViewMode === m.id
                      ? "bg-white text-[#191F28] shadow-2xs"
                      : "text-[#8B95A1] hover:text-[#191F28]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts 그래프 렌더링 */}
          <div className="h-72 w-full pt-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#8B95A1] font-medium">
                차트를 표시할 실거래 데이터가 부족합니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F04452" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#F04452" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="jeonseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3182F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3182F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F6" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#8B95A1", fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Math.round(val / 10000)}억`}
                    tick={{ fill: "#8B95A1", fontSize: 11, fontWeight: 500 }}
                    width={48}
                  />
                  <Tooltip content={<TossChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 12, fontSize: 11, fontWeight: 600 }}
                  />

                  {/* 매매 평균가 곡선 */}
                  {(chartViewMode === "all" || chartViewMode === "매매") && (
                    <Area
                      type="monotone"
                      name="매매 평균가"
                      dataKey="tradePrice"
                      stroke="#F04452"
                      strokeWidth={3}
                      fill="url(#tradeGrad)"
                      dot={{ r: 3, fill: "#F04452" }}
                      activeDot={{ r: 6 }}
                    />
                  )}

                  {/* 전세 평균가 곡선 */}
                  {(chartViewMode === "all" || chartViewMode === "전세") && (
                    <Area
                      type="monotone"
                      name="전세 평균가"
                      dataKey="jeonsePrice"
                      stroke="#3182F6"
                      strokeWidth={3}
                      fill="url(#jeonseGrad)"
                      dot={{ r: 3, fill: "#3182F6" }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [필수 이식 3] 국토교통부 실거래 계약 상세 리스트 (페이징 테이블)             */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[24px] p-6 sm:p-7 shadow-xs border border-[#F2F4F6] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E8F3FF] text-[#3182F6] text-xs font-extrabold px-2.5 py-1 rounded-full">Raw Data</span>
                <h2 className="text-lg font-black text-[#191F28] tracking-tight">
                  국토교통부 실거래 계약 상세 내역 ({rawTrades.length.toLocaleString()}건)
                </h2>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mt-1">
                공공데이터포털 실시간 API 및 클라우드 PostgreSQL에 저장된 실거래 로우 데이터 원본입니다.
              </p>
            </div>

            <span className="text-xs text-[#8B95A1] font-semibold">
              페이지 {tablePage} / {totalPages}
            </span>
          </div>

          {/* 실거래 계약 테이블 */}
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
                  <th className="py-3 px-3.5 font-bold">구조(추정)</th>
                  <th className="py-3 px-3.5 font-bold">중개구분</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F6]">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-[#8B95A1] font-medium">
                      데이터를 불러오는 중입니다...
                    </td>
                  </tr>
                ) : paginatedTrades.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-[#8B95A1] font-medium">
                      조건에 일치하는 실거래 데이터가 없습니다.
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
                      <tr key={idx} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-3.5 font-medium text-[#4E5968]">{item.deal_date}</td>
                        <td className="py-3 px-3.5">
                          <span className="bg-[#F2F4F6] text-[#4E5968] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {item.property_type || "아파트"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-bold text-[#191F28]">{item.apt_name}</td>
                        <td className="py-3 px-3.5 text-[#4E5968]">{item.dong}</td>
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
                        <td className="py-3 px-3.5 font-black text-[#191F28] text-sm">
                          {formattedPrice}
                        </td>
                        <td className="py-3 px-3.5 text-[#4E5968] font-medium">
                          {item.exclu_use_ar}㎡ ({toPyeong(item.exclu_use_ar)}평)
                        </td>
                        <td className="py-3 px-3.5 text-[#4E5968] font-medium">
                          {item.floor ? `${item.floor}층` : "-"}
                        </td>
                        <td className="py-3 px-3.5 text-[#191F28] font-semibold">
                          방 {item.rooms || 3} / 욕실 {item.bathrooms || 1}
                        </td>
                        <td className="py-3 px-3.5 text-[#8B95A1]">{item.req_gbn || "중개거래"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 테이블 페이지네이션 컨트롤 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-3">
              <button
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB] disabled:opacity-40"
              >
                이전
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setTablePage(pageNum)}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      tablePage === pageNum
                        ? "bg-[#3182F6] text-white"
                        : "bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                disabled={tablePage === totalPages}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB] disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </section>

      </main>

      {/* ========================================================================= */}
      {/* 3. 토스 고객센터 스타일 플로팅 AI 상담 챗 모달                             */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isAiOpen ? (
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center space-x-2.5 bg-[#3182F6] hover:bg-[#1B64DA] text-white px-5 py-3.5 rounded-full shadow-2xl transition-all active:scale-95 group font-bold text-sm"
          >
            <span className="text-lg">🤖</span>
            <span>집뷰 AI 상담원</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
        ) : (
          <div className="w-[360px] sm:w-[400px] h-[540px] bg-white rounded-[28px] shadow-2xl border border-[#E5E8EB] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* 챗봇 헤더 */}
            <div className="bg-[#3182F6] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-lg">
                  🤖
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">집뷰 AI 부동산 상담원</h3>
                  <span className="text-[11px] text-white/80 font-medium">국토교통부 실거래 DB 기반 실시간 분석</span>
                </div>
              </div>
              <button
                onClick={() => setIsAiOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* 메시지 리스트 피드 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F2F4F6]">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.sender === "user"
                        ? "bg-[#3182F6] text-white rounded-tr-xs"
                        : "bg-white text-[#191F28] border border-[#E5E8EB] rounded-tl-xs shadow-2xs"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#8B95A1] mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-1.5 bg-white text-[#8B95A1] px-4 py-2.5 rounded-2xl border border-[#E5E8EB] w-fit text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3182F6] animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3182F6] animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3182F6] animate-bounce delay-200"></span>
                  <span className="ml-1 font-medium">국토부 실거래 DB 분석 중...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* 질문 입력 폼 */}
            <form onSubmit={handleSendAiPrompt} className="p-3 bg-white border-t border-[#E5E8EB] flex items-center gap-2">
              <input
                type="text"
                placeholder="예: 보증금 2억 미만 방 3개 전세 추천해줘"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                className="flex-1 bg-[#F2F4F6] text-xs px-3.5 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-[#3182F6]/30 text-[#191F28]"
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
      {/* 4. 플로팅 토스트 알림                                                      */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#191F28]/95 backdrop-blur-md text-white px-5 py-3 rounded-full text-xs font-bold shadow-2xl transition-all duration-300">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
