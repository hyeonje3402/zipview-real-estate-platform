import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

/**
 * 아실(ASIL) 스타일 좌측 실거래가 패널 컴포넌트
 * - 백엔드 FastAPI (GET http://localhost:8000/api/trades/{regional_code}) 연동
 * - 매매가(파란선) / 전세가(초록선) 꺾은선 추이 그래프 (Recharts)
 * - 하단 일자별 실거래 내역 테이블 (계약일, 거래유형, 가격, 층수 등)
 */
export default function AsilRealEstatePanel({
  regionalCode = "11680", // 기본값: 서울시 강남구
  aptName = "은마",        // 기본값: 은마아파트
  onClose
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    summary: { latest_trade_price: "-", latest_jeonse_price: "-" },
    chart_data: [],
    trades: []
  });

  // 단지 및 거래유형 필터 상태
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // 1. Render FastAPI 백엔드에서 특정 지역 및 단지의 실거래 데이터 호출
    axios
      .get(`https://zipview-real-estate-platform.onrender.com/api/trades/${regionalCode}`, {
        params: {
          apt_name: aptName,
          limit: 100
        }
      })
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("실거래가 API 호출 실패:", err);
          setError("실거래가 데이터를 불러오지 못했습니다. 백엔드 서버(포트 8000)를 확인해 주세요.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [regionalCode, aptName]);

  // 필터링된 거래 목록 (전체 / 매매 / 전세 / 월세)
  const filteredTrades = data.trades.filter((t) => {
    if (selectedTypeFilter === "all") return true;
    return t.trade_type === selectedTypeFilter;
  });

  // Y축 억 단위 레이블 포맷터
  const formatYAxis = (val) => {
    if (!val) return "";
    return val >= 10000 ? `${Math.round(val / 10000)}억` : `${Math.round(val / 1000)}천`;
  };

  // Recharts 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "rgba(15, 23, 42, 0.92)",
          color: "#fff",
          padding: "10px 14px",
          borderRadius: "8px",
          fontSize: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        }}>
          <p style={{ fontWeight: 800, marginBottom: "6px" }}>{label}월 평균 실거래가</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color, margin: "2px 0", fontWeight: 700 }}>
              {entry.name}: {entry.value >= 10000 ? `${(entry.value / 10000).toFixed(1)}억원` : `${entry.value.toLocaleString()}만원`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      width: "360px",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#ffffff",
      borderRight: "1px solid #e2e8f0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif"
    }}>
      {/* 1. 상단 단지 헤더 요약 */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {aptName}
          </h2>
          {onClose && (
            <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px" }}>
              ✕
            </button>
          )}
        </div>
        <div style={{ marginTop: "8px", display: "flex", gap: "12px", fontSize: "13px" }}>
          <div>
            <span style={{ color: "#64748b" }}>최신 매매: </span>
            <strong style={{ color: "#0038ff" }}>{data.summary.latest_trade_price}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b" }}>최신 전세: </span>
            <strong style={{ color: "#10b981" }}>{data.summary.latest_jeonse_price}</strong>
          </div>
        </div>
      </div>

      {/* 2. 매매가/전세가 실거래 추이 꺾은선 차트 (Recharts) */}
      <div style={{ padding: "16px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
          <span>📈 실거래가 변동 추이</span>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>국토교통부 실거래 기준</span>
        </div>

        {loading ? (
          <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
            데이터 불러오는 중...
          </div>
        ) : error ? (
          <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: "12px", textAlign: "center", padding: "0 10px" }}>
            {error}
          </div>
        ) : data.chart_data.length === 0 ? (
          <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
            해당 단지의 실거래 차트 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.chart_data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
              {/* 매매가: 파란선 */}
              <Line
                type="monotone"
                dataKey="tradeAvgPrice"
                name="매매평균"
                stroke="#0038ff"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#0038ff" }}
                connectNulls
              />
              {/* 전세가: 초록선 */}
              <Line
                type="monotone"
                dataKey="jeonseAvgPrice"
                name="전세평균"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 3, fill: "#10b981" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 3. 하단 실거래 계약 내역 테이블 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 거래유형 필터 칩 */}
        <div style={{ padding: "10px 16px", display: "flex", gap: "6px", borderBottom: "1px solid #f1f5f9" }}>
          {["all", "매매", "전세", "월세"].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTypeFilter(t)}
              style={{
                padding: "4px 10px",
                borderRadius: "14px",
                border: "1px solid",
                borderColor: selectedTypeFilter === t ? "#0038ff" : "#e2e8f0",
                background: selectedTypeFilter === t ? "#eff6ff" : "#ffffff",
                color: selectedTypeFilter === t ? "#0038ff" : "#64748b",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              {t === "all" ? "전체" : t}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "#94a3b8", alignSelf: "center" }}>
            총 {filteredTrades.length}건
          </span>
        </div>

        {/* 거래 리스트 스크롤 테이블 */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc", color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>
              <tr>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>계약일</th>
                <th style={{ padding: "8px 6px", textAlign: "center" }}>유형</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>가격</th>
                <th style={{ padding: "8px 6px", textAlign: "center" }}>전용</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>층수</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                    거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((tx) => {
                  const isTrade = tx.trade_type === "매매";
                  const isJeonse = tx.trade_type === "전세";
                  const badgeColor = isTrade ? "#0038ff" : isJeonse ? "#10b981" : "#f59e0b";
                  const badgeBg = isTrade ? "#eff6ff" : isJeonse ? "#ecfdf5" : "#fffbeb";

                  return (
                    <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", color: "#334155" }}>
                        {tx.deal_date ? tx.deal_date.slice(2) : "-"}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 800,
                          color: badgeColor,
                          background: badgeBg
                        }}>
                          {tx.trade_type}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: isTrade ? "#0f172a" : "#047857" }}>
                        {tx.price_formatted}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#64748b" }}>
                        {Math.round(tx.exclu_use_ar)}㎡
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b" }}>
                        {tx.floor ? `${tx.floor}층` : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

