import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

/**
 * ZipView AI 시장 분석 어시스턴트 모달 (B2B Enterprise)
 * - 국토교통부 실거래 원장 데이터 및 시장 분석 LLM 연동
 * - 간결하고 정제된 실무 인터페이스 및 타이포그래피 정보 위계 적용
 */
export default function GeminiChatModal(props) {
  const { isOpen, onClose, lawdCd, currentRegionLabel, onDashboardSync } = props || {};
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
  const [modelChoice, setModelChoice] = useState("gemini");
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

      const apiBase = (typeof window !== "undefined" && window.ZIPVIEW_API_URL)
        ? window.ZIPVIEW_API_URL
        : "https://zipview-real-estate-platform.onrender.com";
      const res = await axios.post(`${apiBase}/api/chat`, payload, { timeout: 60000 });

      const status = res.data?.status;
      const disambiguation = res.data?.disambiguation;
      const rawText = res.data.reply || res.data.answer || res.data.message || "데이터를 조회할 수 없습니다.";
      const cleanText = String(rawText)
        .replace(/(?:만원|만\s*원)(?:\s*(?:만원|만\s*원))+/g, "만원")
        .replace(/억\s*만원+/g, "억");

      if (status === "needs_clarification" && disambiguation) {
        setPendingDisambiguation(disambiguation);
      } else {
        setPendingDisambiguation(null);
      }

      // [요구사항 3] 챗봇 자식 컴포넌트의 이벤트 트리거 확인:
      // 백엔드 응답을 수신했을 때 반드시 props.onDashboardSync(res.new_lawd_cd, res.target_view, res.trade_type, user_message, res.search_keyword, res.data) 100% 호출
      const newLawdCd = res.data?.new_lawd_cd || res.data?.new_regional_code;
      const targetView = res.data?.target_view;
      const tradeType = res.data?.trade_type;
      const searchKeyword = res.data?.search_keyword;
      const userMessage = pendingDisambiguation?.original_prompt || userMsg.text;

      const syncCallback = props?.onDashboardSync || onDashboardSync || props?.onRegionSync || props?.onRegionOverride;
      if (status !== "needs_clarification" && typeof syncCallback === "function") {
        syncCallback(newLawdCd, targetView, tradeType, userMessage, searchKeyword, res.data);
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
    <aside
      aria-label="AI 부동산 코파일럿"
      data-testid="ai-copilot-widget"
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        width: "390px",
        maxWidth: "calc(100vw - 32px)",
        height: "580px",
        maxHeight: "calc(100vh - 40px)",
        background: "#ffffff",
        borderRadius: "16px",
        border: "1px solid #cbd5e1",
        boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 9999,
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* 1. 플로팅 코파일럿 헤더 (Dark Navy) */}
      <div style={{
        padding: "14px 18px",
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
              fontWeight: 800,
              letterSpacing: "0.04em",
              background: "rgba(59, 130, 246, 0.18)",
              color: "#60a5fa",
              padding: "2px 7px",
              borderRadius: "4px",
              border: "1px solid rgba(59, 130, 246, 0.3)"
            }}>
              COPILOT
            </span>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.01em" }}>
              부동산 AI 코파일럿
            </h3>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            {activeRegion} 실시간 분석 & 화면 자동 제어
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <select
            value={modelChoice}
            onChange={(e) => setModelChoice(e.target.value)}
            style={{
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "3px 6px",
              fontSize: "10px",
              fontWeight: 600,
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="gemini">Gemini 3.8 Flash</option>
            <option value="gpt">GPT-4o mini (API 사용료 발생 가능)</option>
          </select>
          <button
            onClick={onClose}
            data-testid="chat-minimize-btn"
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#94a3b8",
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s"
            }}
            title="최소화"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            onClick={onClose}
            data-testid="chat-close-btn"
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#94a3b8",
              width: "26px",
              height: "26px",
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
        padding: "8px 14px",
        background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        overflowX: "auto",
        whiteSpace: "nowrap"
      }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
          추천:
        </span>
        {promptChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(chip)}
            disabled={loading}
            style={{
              padding: "3px 8px",
              borderRadius: "5px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              fontSize: "11px",
              color: "#334155",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* 3. 대화 스크롤 영역 */}
      <div style={{
        flex: 1,
        padding: "14px 16px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
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
                flexDirection: isUser ? "row-reverse" : "row",
                maxWidth: "100%"
              }}>
                {!isUser && (
                  <div style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: "#0f172a",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "9px",
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    AI
                  </div>
                )}
                <div style={{
                  maxWidth: "300px",
                  padding: "10px 12px",
                  borderRadius: isUser ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                  background: isUser ? "#0f172a" : "#ffffff",
                  color: isUser ? "#ffffff" : "#0f172a",
                  fontSize: "12px",
                  lineHeight: "1.55",
                  whiteSpace: "pre-line",
                  border: isUser ? "none" : "1px solid #e2e8f0",
                  wordBreak: "break-word"
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
                  marginTop: "6px",
                  marginLeft: isUser ? "0" : "32px",
                  maxWidth: "300px",
                  width: "100%"
                }}>
                  {msg.options.map((opt) => (
                    <button
                      key={opt.index}
                      onClick={() => sendMessage(`${opt.index}번 ${opt.label}`, opt)}
                      disabled={loading}
                      style={{
                        textAlign: "left",
                        padding: "7px 10px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontSize: "11px",
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
                marginTop: "3px",
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
              width: "24px", height: "24px", borderRadius: "6px",
              background: "#0f172a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "9px", fontWeight: 800, flexShrink: 0
            }}>
              AI
            </div>
            <div style={{
              background: "#ffffff", padding: "8px 12px", borderRadius: "6px",
              border: "1px solid #e2e8f0", fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "8px"
            }}>
              <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #0f172a", borderTopColor: "transparent", animation: "spin 1s linear infinite" }}></span>
              실시간 분석 브리핑 작성 중...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. 하단 입력창 */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "10px 14px",
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: "8px"
        }}
      >
        <input
          data-testid="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="단지명, 시세, 매물을 물어보세요..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "12px",
            color: "#0f172a",
            outline: "none"
          }}
        />
        <button
          data-testid="chat-submit-btn"
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "0 14px",
            borderRadius: "8px",
            border: "none",
            background: loading || !input.trim() ? "#cbd5e1" : "#0f172a",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "12px",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            transition: "background 0.15s ease"
          }}
        >
          전송
        </button>
      </form>
    </aside>
  );
}
