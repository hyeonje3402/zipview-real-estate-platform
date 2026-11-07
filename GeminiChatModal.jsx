import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

/**
 * ZipView AI 시장 분석 어시스턴트 모달 (B2B Enterprise)
 * - 국토교통부 실거래 원장 데이터 및 시장 분석 LLM 연동
 * - 간결하고 정제된 실무 인터페이스 및 타이포그래피 정보 위계 적용
 */
export default function GeminiChatModal({ isOpen, onClose, lawdCd, currentRegionLabel, onRegionOverride }) {
  const activeRegion = currentRegionLabel || "현재 지역";

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "ai",
      text: `집뷰(ZipView) 부동산 시장 분석 어시스턴트입니다.\n현재 선택된 [${activeRegion}]의 국토교통부 실거래 원장 데이터 및 시장 지표를 기반으로 단지별 거래가 추이, 전세가율, 신고가 내역 등을 분석하여 제공합니다.`,
      timestamp: "시스템 초기화"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelChoice, setModelChoice] = useState("gpt");
  const [pendingDisambiguation, setPendingDisambiguation] = useState(null);
  const messagesEndRef = useRef(null);
  const chatSessionIdRef = useRef(`zipview-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const promptChips = [
    `${activeRegion} 최근 전세 실거래 추이`,
    `${activeRegion} 30평형대 실거래가 분석`,
    "최근 매매 대비 전세가율 현황",
    "신고가 거래 단지 분석"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const sendMessage = async (userText, selectedOption = null) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userText) {
      setInput("");
    }
    setLoading(true);

    try {
      const payload = {
        lawdCd: lawdCd || undefined,
        regional_code: lawdCd || undefined,
        regionLabel: activeRegion,
        prompt: userMsg.text,
        query: userMsg.text,
        model_choice: modelChoice,
        session_id: chatSessionIdRef.current,
        history: messages.slice(-6).map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        })),
        context: pendingDisambiguation || undefined,
        selected_option: selectedOption || undefined
      };

      const res = await axios.post("https://zipview-real-estate-platform.onrender.com/api/chat", payload);

      const status = res.data?.status;
      const disambiguation = res.data?.disambiguation;
      const rawText = res.data.reply || res.data.answer || res.data.message || "데이터를 조회할 수 없습니다.";
      const cleanText = String(rawText)
        .replace(/만원\s*만원/g, "만원")
        .replace(/억\s*만원만원/g, "억 만원");

      if (status === "needs_clarification" && disambiguation) {
        setPendingDisambiguation(disambiguation);
      } else {
        setPendingDisambiguation(null);
      }

      if (res.data?.override_region && res.data?.new_regional_code && typeof onRegionOverride === "function") {
        onRegionOverride(res.data.new_regional_code, res.data.new_region_label);
      }

      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: cleanText,
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        options: disambiguation?.options || null
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Gemini Chat API 호출 오류:", err);
      const errorMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: "데이터 서버와의 통신 중 지연이 발생했습니다. 잠시 후 다시 시도해 주십시오.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        width: "540px",
        height: "680px",
        maxWidth: "94vw",
        maxHeight: "92vh",
        background: "#ffffff",
        borderRadius: "10px",
        border: "1px solid #cbd5e1",
        boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* 1. 모달 헤더 (Dark Navy Flat) */}
        <div style={{
          padding: "16px 20px",
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                background: "#1e293b",
                color: "#94a3b8",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #334155"
              }}>
                Enterprise AI
              </span>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.01em" }}>
                부동산 시장 분석 어시스턴트
              </h3>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>
              국토교통부 실거래 원장 데이터 실시간 질의
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value)}
              style={{
                background: "#1e293b",
                color: "#f8fafc",
                border: "1px solid #334155",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="gpt">GPT-4o</option>
              <option value="gemini">Gemini 1.5</option>
            </select>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #334155",
                color: "#94a3b8",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s"
              }}
              title="닫기"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* 2. 실무 추천 분석 칩 */}
        <div style={{
          padding: "8px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          overflowX: "auto",
          whiteSpace: "nowrap"
        }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", shrink: 0 }}>
            추천 분석:
          </span>
          {promptChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(chip)}
              disabled={loading}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                fontSize: "11px",
                color: "#334155",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* 3. 대화 스크롤 영역 */}
        <div style={{
          flex: 1,
          padding: "16px 20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          background: "#f8fafc"
        }}>
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start"
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  flexDirection: isUser ? "row-reverse" : "row"
                }}>
                  {!isUser && (
                    <div style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      background: "#0f172a",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 800,
                      flexShrink: 0
                    }}>
                      AI
                    </div>
                  )}
                  <div style={{
                    maxWidth: "400px",
                    padding: "12px 14px",
                    borderRadius: isUser ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                    background: isUser ? "#1e3a8a" : "#ffffff",
                    color: isUser ? "#ffffff" : "#0f172a",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-line",
                    border: isUser ? "none" : "1px solid #e2e8f0"
                  }}>
                    {msg.text}
                  </div>
                </div>
                {/* 되묻기(Disambiguation) 선택지 UI 버튼 목록 */}
                {msg.options && msg.options.length > 0 && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginTop: "8px",
                    marginLeft: isUser ? "0" : "34px",
                    maxWidth: "400px",
                    width: "100%"
                  }}>
                    {msg.options.map((opt) => (
                      <button
                        key={opt.index}
                        onClick={() => sendMessage(`${opt.index}번 ${opt.label}`, opt)}
                        disabled={loading}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#0f172a",
                          cursor: loading ? "not-allowed" : "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "all 0.15s ease",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                        }}
                      >
                        <span>{opt.index}. {opt.label}</span>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>선택 →</span>
                      </button>
                    ))}
                  </div>
                )}
                <span style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  marginTop: "4px",
                  padding: "0 4px"
                }}>
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px" }}>
              <div style={{
                width: "26px", height: "26px", borderRadius: "6px",
                background: "#0f172a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: 800
              }}>
                AI
              </div>
              <div style={{
                background: "#ffffff", padding: "8px 12px", borderRadius: "6px",
                border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "8px"
              }}>
                <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #0f172a", borderTopColor: "transparent" }}></span>
                국토교통부 실거래 원장 데이터를 집계하고 있습니다...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 4. 하단 입력창 */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "12px 16px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: "8px"
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문 내용을 입력하십시오 (예: 강남구 최근 1년 전세 시세 및 최고 거래가 분석)"
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              color: "#0f172a",
              outline: "none"
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "0 18px",
              borderRadius: "6px",
              border: "none",
              background: loading || !input.trim() ? "#cbd5e1" : "#0f172a",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "13px",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "background 0.15s ease"
            }}
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
