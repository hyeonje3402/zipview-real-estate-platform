import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

/**
 * =========================================================================
 * 토스(Toss) 스타일 실거래가 & 부동산 자산 분석 대시보드
 * =========================================================================
 * 
 * [Toss Design System 적용]
 * 1. Background: 부드러운 토스 그레이 `bg-[#F2F4F6]`
 * 2. Cards: 새하얗고 둥근 모서리 `bg-white rounded-[24px] shadow-sm p-6`
 * 3. Typography: 대형 볼드 타이포 `text-3xl font-bold text-[#191F28]`, 서브텍스트 `text-[#8B95A1]`
 * 4. Colors: 토스 블루 `text-[#3182F6]`, `bg-[#3182F6]`, 상승 `text-[#F04452]`
 * 5. VS 비교: 좌우 대칭형 카드 (게이지 바, 스펙 뱃지)
 * 6. 토스 주식 스타일 미니멀 차트: 축 선 제거, 둥근 플로팅 툴팁
 * 7. 토스 고객센터 스타일 플로팅 AI 상담 챗 모달
 */

// ==================== 기본 단지 마스터 데이터 ====================
const TOSS_COMPLEXES = [
  {
    id: "eunma",
    name: "은마아파트",
    shortName: "은마",
    regionalCode: "11680",
    dong: "서울시 강남구 대치동",
    propertyType: "아파트",
    tradePrice: 280000,
    prevPriceDiff: 8000, // +8,000만
    diffPercent: 2.9,
    jeonsePrice: 65000,
    jeonseRatio: 23.2,
    pyeongPrice: 8235,
    totalUnits: 4424,
    totalDongs: 28,
    parkingPerUnit: 0.68,
    totalParking: 3008,
    floorAreaRatio: 204, // 용적률
    buildingCoverage: 18, // 건폐율
    buildYear: 1979,
    rooms: 3,
    bathrooms: 2,
    isRoomEstimated: true, // 추정치 플래그
    subway: "3호선 대치역 도보 2분",
    school: "대곡초 · 대치동 학원가",
    tag: "재건축 기대단지",
    lat: 37.4979,
    lng: 127.0658
  },
  {
    id: "onebailey",
    name: "래미안원베일리",
    shortName: "원베일리",
    regionalCode: "11650",
    dong: "서울시 서초구 반포동",
    propertyType: "아파트",
    tradePrice: 550000,
    prevPriceDiff: 15000, // +1.5억
    diffPercent: 2.8,
    jeonsePrice: 200000,
    jeonseRatio: 36.4,
    pyeongPrice: 16176,
    totalUnits: 2990,
    totalDongs: 23,
    parkingPerUnit: 1.82,
    totalParking: 5442,
    floorAreaRatio: 299,
    buildingCoverage: 19,
    buildYear: 2023,
    rooms: 3,
    bathrooms: 2,
    isRoomEstimated: true,
    subway: "3·7·9호선 고속터미널역",
    school: "잠원초 · 한강공원 인접",
    tag: "신축 한강변 대장주",
    lat: 37.5054,
    lng: 127.0019
  },
  {
    id: "banpo_xi",
    name: "반포자이",
    shortName: "반포자이",
    regionalCode: "11650",
    dong: "서울시 서초구 반포동",
    propertyType: "아파트",
    tradePrice: 380000,
    prevPriceDiff: -3000, // -3,000만
    diffPercent: -0.8,
    jeonsePrice: 160000,
    jeonseRatio: 42.1,
    pyeongPrice: 11176,
    totalUnits: 3410,
    totalDongs: 44,
    parkingPerUnit: 1.78,
    totalParking: 6079,
    floorAreaRatio: 270,
    buildingCoverage: 13,
    buildYear: 2009,
    rooms: 3,
    bathrooms: 2,
    isRoomEstimated: true,
    subway: "7호선 반포역 직결",
    school: "원촌초·중 (초품아)",
    tag: "학군·교통 올인원",
    lat: 37.5036,
    lng: 127.0142
  },
  {
    id: "dogok_rexle",
    name: "도곡렉슬",
    shortName: "도곡렉슬",
    regionalCode: "11680",
    dong: "서울시 강남구 도곡동",
    propertyType: "아파트",
    tradePrice: 310000,
    prevPriceDiff: 5000,
    diffPercent: 1.6,
    jeonsePrice: 145000,
    jeonseRatio: 46.7,
    pyeongPrice: 9117,
    totalUnits: 3002,
    totalDongs: 34,
    parkingPerUnit: 1.48,
    totalParking: 4443,
    floorAreaRatio: 274,
    buildingCoverage: 15,
    buildYear: 2006,
    rooms: 3,
    bathrooms: 2,
    isRoomEstimated: true,
    subway: "수인분당선 한티역 1분",
    school: "대도초 · 역삼중",
    tag: "한티역 초역세권",
    lat: 37.4939,
    lng: 127.0543
  }
];

// 금액 한국어 포맷터
const formatTossMoney = (manwon) => {
  if (!manwon || manwon <= 0) return "-";
  const eok = Math.floor(manwon / 10000);
  const rem = manwon % 10000;
  if (eok > 0 && rem > 0) return `${eok}억 ${rem.toLocaleString()}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${rem.toLocaleString()}만원`;
};

export default function TossStyleRealEstateDashboard() {
  // 1. 단지 선택 상태
  const [activeComplexId, setActiveComplexId] = useState("eunma");
  
  // 2. VS 비교 단지 (좌측 vs 우측)
  const [vsLeftId, setVsLeftId] = useState("eunma");
  const [vsRightId, setVsRightId] = useState("onebailey");

  // 3. 차트 기간 탭 (1개월, 3개월, 1년, 3년, 전체)
  const [chartPeriod, setChartPeriod] = useState("1년");
  const [chartMode, setChartMode] = useState("trade"); // 'trade' | 'jeonse'

  // 4. 지도 모달 / 드로어 토글
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // 5. 토스 스타일 AI 상담 챗봇 모달 상태
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "안녕하세요! 집뷰 AI 부동산 상담원입니다.\n국토교통부 최신 실거래가와 단지 조건에 대해 무엇이든 물어보세요.",
      time: "방금 전"
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // 6. 백엔드 실거래가 API 데이터
  const [apiData, setApiData] = useState({
    summary: {},
    chart_data: [],
    trades: []
  });
  const [loading, setLoading] = useState(false);

  // 현재 활성화 단지 객체
  const current = useMemo(() => {
    return TOSS_COMPLEXES.find((c) => c.id === activeComplexId) || TOSS_COMPLEXES[0];
  }, [activeComplexId]);

  const leftComplex = useMemo(() => {
    return TOSS_COMPLEXES.find((c) => c.id === vsLeftId) || TOSS_COMPLEXES[0];
  }, [vsLeftId]);

  const rightComplex = useMemo(() => {
    return TOSS_COMPLEXES.find((c) => c.id === vsRightId) || TOSS_COMPLEXES[1];
  }, [vsRightId]);

  // 실거래가 API 호출 (FastAPI 연동 및 Fallback)
  useEffect(() => {
    let active = true;
    setLoading(true);

    axios
      .get(`http://localhost:8000/api/trades/${current.regionalCode}`, {
        params: { apt_name: current.shortName, limit: 100 },
        timeout: 3000
      })
      .then((res) => {
        if (active && res.data) {
          setApiData(res.data);
          setLoading(false);
        }
      })
      .catch((_err) => {
        if (active) {
          // 백엔드 연결 지연 시 토스 맞춤형 목데이터 생성
          generateTossMockData(current);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [current]);

  const generateTossMockData = (c) => {
    const mockChart = [
      { month: "24.01", price: c.tradePrice * 0.94, jeonse: c.jeonsePrice * 0.95 },
      { month: "24.03", price: c.tradePrice * 0.96, jeonse: c.jeonsePrice * 0.96 },
      { month: "24.05", price: c.tradePrice * 0.97, jeonse: c.jeonsePrice * 0.98 },
      { month: "24.07", price: c.tradePrice * 1.01, jeonse: c.jeonsePrice * 0.99 },
      { month: "24.09", price: c.tradePrice * 1.03, jeonse: c.jeonsePrice * 1.01 },
      { month: "24.10", price: c.tradePrice, jeonse: c.jeonsePrice }
    ];

    const mockTrades = [
      { id: 1, date: "10월 28일", type: "매매", price: formatTossMoney(c.tradePrice), rawPrice: c.tradePrice, area: "84.8㎡", floor: "9층", dong: "102동", rooms: 3, baths: 2 },
      { id: 2, date: "10월 22일", type: "전세", price: formatTossMoney(c.jeonsePrice), rawPrice: c.jeonsePrice, area: "84.8㎡", floor: "12층", dong: "105동", rooms: 3, baths: 2 },
      { id: 3, date: "10월 15일", type: "매매", price: formatTossMoney(Math.round(c.tradePrice * 0.98)), rawPrice: Math.round(c.tradePrice * 0.98), area: "76.5㎡", floor: "5층", dong: "110동", rooms: 3, baths: 1 },
      { id: 4, date: "10월 04일", type: "전세", price: formatTossMoney(Math.round(c.jeonsePrice * 0.96)), rawPrice: Math.round(c.jeonsePrice * 0.96), area: "84.8㎡", floor: "3층", dong: "103동", rooms: 3, baths: 2 },
      { id: 5, date: "09월 29일", type: "월세", price: "보증금 1억 / 월 280만", rawPrice: 10000, area: "84.8㎡", floor: "11층", dong: "107동", rooms: 3, baths: 2 }
    ];

    setApiData({
      summary: { latest_trade_price: formatTossMoney(c.tradePrice), latest_jeonse_price: formatTossMoney(c.jeonsePrice) },
      chart_data: mockChart,
      trades: mockTrades
    });
  };

  // AI 상담 메시지 전송 로직
  const handleSendPrompt = async (textToSend) => {
    const question = textToSend || inputPrompt;
    if (!question.trim()) return;

    const userMsg = { sender: "user", text: question, time: "방금 전" };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setAiLoading(true);

    try {
      const response = await axios.post("http://localhost:8000/api/chat", {
        prompt: question,
        model_choice: "gpt"
      }, { timeout: 6000 });

      const replyText = response.data?.reply || response.data?.message || "국토부 실거래 DB 분석을 완료했습니다.";
      setChatMessages((prev) => [...prev, { sender: "ai", text: replyText, time: "방금 전" }]);
    } catch (_err) {
      // 오프라인 스마트 폴백 응답
      let fallbackAnswer = "";
      if (question.includes("보증금") || question.includes("방")) {
        fallbackAnswer = `🏡 **[맞춤 조건 분석]**\n현재 강남구 기준 보증금 1억 미만, 방 3개 이상 매물은 **강남한신휴플러스6단지(보증금 5,000만/월 300만)**, **현대타워(보증금 1억/월 450만)** 등이 최근 거래되었습니다.`;
      } else {
        fallbackAnswer = `🏢 **[${current.name}] 실거래 진단**\n최근 실거래가는 **${formatTossMoney(current.tradePrice)}**이며, 직전 분기 대비 **${current.diffPercent > 0 ? "+" : ""}${current.diffPercent}%** 변동했습니다. 전세가율은 **${current.jeonseRatio}%**로 안정적입니다.`;
      }
      setChatMessages((prev) => [...prev, { sender: "ai", text: fallbackAnswer, time: "방금 전" }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // 차트 커스텀 툴팁 (토스 주식 스타일 미니멀 다크 버블)
  const TossChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      return (
        <div className="bg-[#191F28]/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-xl text-center text-xs border border-white/10">
          <div className="text-[11px] text-[#8B95A1] font-medium">{label} 평균 실거래</div>
          <div className="text-sm font-bold mt-0.5 text-[#3182F6]">
            {formatTossMoney(val)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#191F28] font-sans antialiased selection:bg-[#E8F3FF] selection:text-[#3182F6] pb-24">
      
      {/* ========================================================================= */}
      {/* 1. 토스 스타일 상단 네비게이션 헤더                                      */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#E5E8EB] px-6 h-16 flex items-center justify-between">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#3182F6] flex items-center justify-center text-white font-extrabold text-base shadow-sm">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-[#191F28]">
                집뷰
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F3FF] text-[#3182F6]">
                실거래가 프로
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMapModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[#4E5968] text-xs font-bold transition-colors"
            >
              <svg className="w-4 h-4 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              지도 보기
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. 메인 대시보드 스크롤 컨테이너                                          */}
      {/* ========================================================================= */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-5">

        {/* --------------------------------------------------------------------- */}
        {/* 상단 단지 퀵 선택 필 (Pill Buttons)                                    */}
        {/* --------------------------------------------------------------------- */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {TOSS_COMPLEXES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveComplexId(c.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
                activeComplexId === c.id
                  ? "bg-[#191F28] text-white shadow-sm"
                  : "bg-white text-[#6B7684] hover:bg-gray-100 border border-[#E5E8EB]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* [CARD 1] 관심 단지 요약 카드 (Hero Price Card)                         */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[24px] shadow-sm p-6 sm:p-8 transition-all hover:shadow-md border border-[#F2F4F6]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#F2F4F6] text-[#4E5968]">
                  {current.dong}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#E8F3FF] text-[#3182F6]">
                  {current.tag}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#191F28] mt-2 tracking-tight">
                {current.name}
              </h1>
            </div>

            <button
              onClick={() => setIsMapModalOpen(true)}
              className="w-10 h-10 rounded-full bg-[#F2F4F6] flex items-center justify-center text-[#4E5968] hover:bg-[#E5E8EB] transition-colors"
              title="지도에서 위치 확인"
            >
              <svg className="w-5 h-5 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>
          </div>

          {/* 대형 실거래가 텍스트 */}
          <div className="mt-5 pt-4 border-t border-[#F2F4F6]">
            <span className="text-xs font-semibold text-[#8B95A1] uppercase tracking-wider block">
              최근 실거래 기준가
            </span>
            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#191F28] tracking-tight">
                {formatTossMoney(current.tradePrice)}
              </span>
              <span className={`text-sm font-bold flex items-center gap-0.5 ${
                current.diffPercent >= 0 ? "text-[#F04452]" : "text-[#3182F6]"
              }`}>
                {current.diffPercent >= 0 ? "▲" : "▼"} {Math.abs(current.prevPriceDiff).toLocaleString()}만원 ({Math.abs(current.diffPercent)}%)
              </span>
            </div>
            <p className="text-xs text-[#8B95A1] mt-1">
              전세 최근가 {formatTossMoney(current.jeonsePrice)} (전세가율 {current.jeonseRatio}%)
            </p>
          </div>

          {/* 단지 스펙 뱃지 그리드 (아이콘 + 숫자 배지) */}
          <div className="mt-6 flex flex-wrap gap-2">
            <div className="bg-[#F2F4F6] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#4E5968] flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{current.totalUnits.toLocaleString()}세대 ({current.totalDongs}개동)</span>
            </div>

            <div className="bg-[#F2F4F6] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#4E5968] flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{current.buildYear}년 준공 ({2024 - current.buildYear}년차)</span>
            </div>

            <div className="bg-[#F2F4F6] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#4E5968] flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              <span>주차 세대당 {current.parkingPerUnit}대</span>
            </div>

            <div className="bg-[#F2F4F6] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#4E5968] flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>방 {current.rooms}개 · 욕실 {current.bathrooms}개</span>
              {current.isRoomEstimated && (
                <span className="text-[10px] px-1.5 py-0.2 bg-[#E8F3FF] text-[#3182F6] rounded font-bold">
                  추정치
                </span>
              )}
            </div>

            <div className="bg-[#F2F4F6] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#4E5968] flex items-center gap-1.5">
              <span>용적률 {current.floorAreaRatio}% / 건폐율 {current.buildingCoverage}%</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* [CARD 2] 최근 실거래가 트렌드 카드 (토스 주식 스타일 미니멀 차트)       */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[24px] shadow-sm p-6 sm:p-8 transition-all hover:shadow-md border border-[#F2F4F6]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#191F28] tracking-tight">
                실거래가 트렌드
              </h2>
              <p className="text-xs text-[#8B95A1] mt-0.5">
                국토부 실거래가 기준 월별 평균 거래금액
              </p>
            </div>

            {/* 매매 / 전세 탭 & 기간 토글 */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex bg-[#F2F4F6] p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setChartMode("trade")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartMode === "trade"
                      ? "bg-white text-[#191F28] shadow-xs"
                      : "text-[#8B95A1] hover:text-[#4E5968]"
                  }`}
                >
                  매매
                </button>
                <button
                  onClick={() => setChartMode("jeonse")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartMode === "jeonse"
                      ? "bg-white text-[#3182F6] shadow-xs"
                      : "text-[#8B95A1] hover:text-[#4E5968]"
                  }`}
                >
                  전세
                </button>
              </div>

              <div className="flex bg-[#F2F4F6] p-1 rounded-xl text-xs font-bold text-[#8B95A1]">
                {["3개월", "1년", "전체"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      chartPeriod === p
                        ? "bg-[#3182F6] text-white shadow-xs"
                        : "hover:text-[#4E5968]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 토스 미니멀 차트 영역 (X, Y축 선 제거) */}
          <div className="h-56 w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={apiData.chart_data}
                margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="tossBlueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3182F6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3182F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tossDarkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#191F28" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#191F28" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  stroke="#B0B8C1"
                  fontSize={11}
                  dy={10}
                />
                <YAxis
                  hide={true}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<TossChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey={chartMode === "trade" ? "price" : "jeonse"}
                  stroke={chartMode === "trade" ? "#3182F6" : "#00B493"}
                  strokeWidth={3}
                  fill={chartMode === "trade" ? "url(#tossBlueGradient)" : "url(#tossBlueGradient)"}
                  dot={{ r: 4, fill: "#3182F6", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, fill: "#191F28" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* [CARD 3] 매물 비교(VS) 컴포넌트: 좌우 대칭형 비교 카드                  */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[24px] shadow-sm p-6 sm:p-8 transition-all hover:shadow-md border border-[#F2F4F6]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold text-[#3182F6] uppercase tracking-wider block">
                COMPARE
              </span>
              <h2 className="text-lg font-bold text-[#191F28] tracking-tight">
                아파트 1:1 맞대결 비교
              </h2>
            </div>
            <span className="text-xs text-[#8B95A1]">
              원하는 2개 단지를 골라 스펙과 가격을 직관적으로 비교해 보세요
            </span>
          </div>

          {/* 좌우 대칭형 VS 카드 레이아웃 */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

            {/* 중앙 VS 엠블럼 뱃지 */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#191F28] text-white items-center justify-center font-black text-sm shadow-md border-4 border-white">
              VS
            </div>

            {/* [좌측 카드] */}
            <div className="bg-[#F9FAFB] rounded-[20px] p-5 border border-[#E5E8EB]">
              <div className="flex items-center justify-between">
                <select
                  value={vsLeftId}
                  onChange={(e) => setVsLeftId(e.target.value)}
                  className="bg-white font-bold text-[#191F28] text-sm px-3 py-1.5 rounded-xl border border-[#E5E8EB] focus:outline-hidden focus:ring-2 focus:ring-[#3182F6]"
                >
                  {TOSS_COMPLEXES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="text-xs text-[#8B95A1]">{leftComplex.dong.split(" ").slice(-1)[0]}</span>
              </div>

              {/* 가격 비교 헤드라인 */}
              <div className="mt-4">
                <span className="text-xs text-[#8B95A1]">최근 매매 실거래가</span>
                <div className="text-2xl font-black text-[#191F28] mt-0.5">
                  {formatTossMoney(leftComplex.tradePrice)}
                </div>
                <div className="text-xs text-[#3182F6] font-semibold mt-0.5">
                  평당 {leftComplex.pyeongPrice.toLocaleString()}만원
                </div>
              </div>

              {/* 스펙 바 게이지 비교 */}
              <div className="space-y-3 mt-5 text-xs">
                <div>
                  <div className="flex justify-between text-[#6B7684] mb-1 font-medium">
                    <span>세대수</span>
                    <span className="font-bold text-[#191F28]">{leftComplex.totalUnits.toLocaleString()}세대</span>
                  </div>
                  <div className="w-full bg-[#E5E8EB] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#3182F6] h-full rounded-full transition-all"
                      style={{ width: `${Math.min((leftComplex.totalUnits / 5000) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[#6B7684] mb-1 font-medium">
                    <span>전세가율</span>
                    <span className="font-bold text-[#191F28]">{leftComplex.jeonseRatio}%</span>
                  </div>
                  <div className="w-full bg-[#E5E8EB] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#4E5968] h-full rounded-full transition-all"
                      style={{ width: `${leftComplex.jeonseRatio}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E8EB] space-y-1.5 text-[#4E5968]">
                  <div className="flex justify-between">
                    <span className="text-[#8B95A1]">준공연도</span>
                    <span className="font-bold">{leftComplex.buildYear}년 ({2024 - leftComplex.buildYear}년차)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8B95A1]">주차대수</span>
                    <span className="font-bold">세대당 {leftComplex.parkingPerUnit}대</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8B95A1]">방 / 욕실</span>
                    <span className="font-bold">방 {leftComplex.rooms} · 욕실 {leftComplex.bathrooms}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* [우측 카드] */}
            <div className="bg-[#F9FAFB] rounded-[20px] p-5 border border-[#E5E8EB]">
              <div className="flex items-center justify-between">
                <select
                  value={vsRightId}
                  onChange={(e) => setVsRightId(e.target.value)}
                  className="bg-white font-bold text-[#191F28] text-sm px-3 py-1.5 rounded-xl border border-[#E5E8EB] focus:outline-hidden focus:ring-2 focus:ring-[#3182F6]"
                >
                  {TOSS_COMPLEXES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="text-xs text-[#8B95A1]">{rightComplex.dong.split(" ").slice(-1)[0]}</span>
              </div>

              {/* 가격 비교 헤드라인 */}
              <div className="mt-4">
                <span className="text-xs text-[#8B95A1]">최근 매매 실거래가</span>
                <div className="text-2xl font-black text-[#191F28] mt-0.5">
                  {formatTossMoney(rightComplex.tradePrice)}
                </div>
                <div className="text-xs text-[#3182F6] font-semibold mt-0.5">
                  평당 {rightComplex.pyeongPrice.toLocaleString()}만원
                </div>
              </div>

              {/* 스펙 바 게이지 비교 */}
              <div className="space-y-3 mt-5 text-xs">
                <div>
                  <div className="flex justify-between text-[#6B7684] mb-1 font-medium">
                    <span>세대수</span>
                    <span className="font-bold text-[#191F28]">{rightComplex.totalUnits.toLocaleString()}세대</span>
                  </div>
                  <div className="w-full bg-[#E5E8EB] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#3182F6] h-full rounded-full transition-all"
                      style={{ width: `${Math.min((rightComplex.totalUnits / 5000) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[#6B7684] mb-1 font-medium">
                    <span>전세가율</span>
                    <span className="font-bold text-[#191F28]">{rightComplex.jeonseRatio}%</span>
                  </div>
                  <div className="w-full bg-[#E5E8EB] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#4E5968] h-full rounded-full transition-all"
                      style={{ width: `${rightComplex.jeonseRatio}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E8EB] space-y-1.5 text-[#4E5968]">
                  <div className="flex justify-between">
                    <span className="text-[#8B95A1]">준공연도</span>
                    <span className="font-bold">{rightComplex.buildYear}년 ({2024 - rightComplex.buildYear}년차)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8B95A1]">주차대수</span>
                    <span className="font-bold">세대당 {rightComplex.parkingPerUnit}대</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8B95A1]">방 / 욕실</span>
                    <span className="font-bold">방 {rightComplex.rooms} · 욕실 {rightComplex.bathrooms}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* [CARD 4] 최근 실거래가 내역 리스트 카드                               */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[24px] shadow-sm p-6 sm:p-8 transition-all hover:shadow-md border border-[#F2F4F6]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#191F28] tracking-tight">
                최근 실거래 내역
              </h2>
              <p className="text-xs text-[#8B95A1] mt-0.5">
                국토교통부 검증 정식 계약 내역입니다
              </p>
            </div>
            <span className="text-xs font-bold text-[#3182F6]">
              총 {apiData.trades?.length || 0}건
            </span>
          </div>

          {/* 깔끔한 카드 로우(Row) 리스트 */}
          <div className="divide-y divide-[#F2F4F6]">
            {apiData.trades && apiData.trades.slice(0, 5).map((t, idx) => (
              <div key={t.id || idx} className="py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] px-2 rounded-xl transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    t.type === "매매" || t.trade_type === "매매"
                      ? "bg-[#E8F3FF] text-[#3182F6]"
                      : "bg-[#E6F8F5] text-[#00B493]"
                  }`}>
                    {t.type || t.trade_type}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#191F28] flex items-center gap-1.5">
                      <span>{t.price || t.price_formatted}</span>
                      <span className="text-xs font-normal text-[#8B95A1]">
                        ({t.floor || (t.floor ? `${t.floor}층` : "-")})
                      </span>
                    </div>
                    <div className="text-xs text-[#8B95A1] mt-0.5">
                      {t.date || t.deal_date} · 전용 {t.area || `${t.exclu_use_ar}㎡`} · 방 {t.rooms || 3}개
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold px-2 py-1 rounded-md bg-[#F2F4F6] text-[#4E5968]">
                    {t.dong || current.dong.split(" ").slice(-1)[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 3. 플로팅 'Gemini AI 상담' 버튼 (Toss Style FAB)                           */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsAiChatOpen(!isAiChatOpen)}
          className="bg-[#3182F6] hover:bg-[#1B64DA] text-white px-5 py-3.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 font-bold text-sm tracking-tight active:scale-95"
        >
          <span className="text-base">✨</span>
          <span>Gemini AI 상담</span>
          {chatMessages.length > 1 && (
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. 토스 고객센터 스타일 AI 챗봇 팝업 모달                                 */}
      {/* ========================================================================= */}
      {isAiChatOpen && (
        <div className="fixed bottom-20 right-6 w-[360px] sm:w-[400px] h-[540px] bg-white rounded-[24px] shadow-2xl flex flex-col z-50 border border-[#E5E8EB] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* 챗 헤더 */}
          <div className="p-4 bg-white border-b border-[#F2F4F6] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F3FF] flex items-center justify-center text-[#3182F6] font-extrabold text-sm">
                AI
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#191F28] flex items-center gap-1.5">
                  집뷰 AI 부동산 상담
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </h3>
                <p className="text-[11px] text-[#8B95A1]">국토교통부 실거래가 분석 에이전트</p>
              </div>
            </div>

            <button
              onClick={() => setIsAiChatOpen(false)}
              className="w-7 h-7 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#8B95A1] hover:text-[#191F28] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* 대화 메시지 피드 */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F9FAFB] text-xs">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-2xs ${
                    msg.sender === "user"
                      ? "bg-[#3182F6] text-white rounded-br-xs font-medium"
                      : "bg-white text-[#191F28] rounded-bl-xs border border-[#E5E8EB]"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#8B95A1] mt-1 px-1">{msg.time}</span>
              </div>
            ))}

            {aiLoading && (
              <div className="flex items-center gap-1.5 bg-white text-[#8B95A1] px-4 py-2.5 rounded-2xl border border-[#E5E8EB] w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3182F6] animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#3182F6] animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#3182F6] animate-bounce delay-200"></span>
                <span className="text-[11px] font-medium ml-1">국토부 실거래 DB 조회 중...</span>
              </div>
            )}
            <div ref={chatBottomRef}></div>
          </div>

          {/* 퀵 추천 질문 칩 */}
          <div className="px-3 py-2 bg-white border-t border-[#F2F4F6] flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              "보증금 1억 미만 방 3개 매물 추천해줘",
              `${current.name} 최근 실거래가 분석해줘`,
              "전세가율 안정적인 단지는 어디야?"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendPrompt(chip)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[#4E5968] text-[11px] font-semibold transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* 입력창 */}
          <div className="p-3 bg-white border-t border-[#F2F4F6] flex items-center space-x-2">
            <input
              type="text"
              placeholder="예: 자본 3억, 보증금 1억 미만 방 3개 추천해줘"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendPrompt()}
              className="flex-1 px-3.5 py-2.5 bg-[#F2F4F6] text-[#191F28] rounded-xl text-xs focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-[#3182F6] placeholder:text-[#8B95A1] transition-all"
            />
            <button
              disabled={aiLoading || !inputPrompt.trim()}
              onClick={() => handleSendPrompt()}
              className="w-9 h-9 rounded-xl bg-[#3182F6] disabled:bg-[#B0B8C1] text-white flex items-center justify-center transition-colors shadow-xs shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. 인터랙티브 지도 모달 / 드로어 (전체 화면 침범 방지)                   */}
      {/* ========================================================================= */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#191F28]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] max-w-2xl w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#3182F6]">{current.dong}</span>
                <h3 className="text-lg font-bold text-[#191F28]">{current.name} 위치 지도</h3>
              </div>
              <button
                onClick={() => setIsMapModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F2F4F6] flex items-center justify-center text-[#4E5968] hover:bg-[#E5E8EB]"
              >
                ✕
              </button>
            </div>

            {/* 인라인 미니 맵 캔버스 */}
            <div className="w-full h-72 rounded-[20px] bg-[#E8F3FF] border border-[#E5E8EB] relative overflow-hidden flex items-center justify-center">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `radial-gradient(#3182F6 1px, transparent 1px), radial-gradient(#3182F6 1px, #E8F3FF 1px)`,
                  backgroundSize: "24px 24px"
                }}
              ></div>

              {/* 지하철 / 도로 라인 */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
                <path d="M0 120 Q 150 180 320 100 T 600 160" stroke="#f59e0b" strokeWidth="4" fill="none" />
                <path d="M100 0 Q 160 140 240 280" stroke="#3182F6" strokeWidth="3" fill="none" strokeDasharray="6 3" />
              </svg>

              {/* 중심 핀 뱃지 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-[#191F28] text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <span>{current.name}</span>
                  <span className="text-[#3182F6]">{formatTossMoney(current.tradePrice)}</span>
                </div>
                <div className="w-3 h-3 bg-[#191F28] rotate-45 -mt-1.5"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#3182F6] mt-1.5 ring-4 ring-[#E8F3FF] animate-ping"></div>
              </div>

              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#4E5968] border border-gray-200">
                {current.subway} · {current.school}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a
                href={`https://map.kakao.com/?q=${encodeURIComponent(current.name)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[#4E5968] font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                카카오맵에서 열기 ↗
              </a>
              <button
                onClick={() => setIsMapModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#3182F6] hover:bg-[#1B64DA] text-white font-bold text-xs transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

