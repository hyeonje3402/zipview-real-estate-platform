import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

/**
 * Gemini AI 자연어 부동산 데이터 분석 챗봇 모달 컴포넌트
 * - 백엔드 FastAPI (POST http://localhost:8000/api/chat) 연동
 * - Function Calling을 통해 국토부 실거래 DB 실시간 질의
 * - 사용자/AI 말풍선 히스토리, 추천 프롬프트 칩, 로딩 스피너 제공
 */
export default function GeminiChatModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "ai",
      text: "안녕하세요! 집뷰(ZipView) **AI 부동산 데이터 컨설턴트**입니다.\nOpenAI GPT 및 Google Gemini와 국토교통부 실거래 DB가 실시간 연동되어 있습니다. 단지별 최근 실거래가나 예산별 아파트를 편하게 물어보세요!",
      timestamp: "방금 전"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelChoice, setModelChoice] = useState("gpt"); // "gpt" (OpenAI GPT-4o) | "gemini" (Google Gemini 1.5)
  const messagesEndRef = useRef(null);

  // 추천 질의 칩 목록
  const promptChips = [
    "은마아파트 최근 전세가 어떻게 돼?",
    "은마아파트 최근 매매 시세 분석해줘",
    "20억 이하로 살 수 있는 강남 아파트 있어?",
    "최근 매매와 전세 갭 차이가 얼마나 나?"
  ];

  // 메시지 추가 시 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const sendMessage = async (userText) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // 백엔드 FastAPI /api/chat 호출 (LangChain Multi-LLM 팩토리 연동)
      const res = await axios.post("http://localhost:8000/api/chat", {
        prompt: userMsg.text,
        model_choice: modelChoice
      });

      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: res.data.reply || "답변을 수신하지 못했습니다.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Gemini Chat API 호출 오류:", err);
      const errorMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: "서버 통신 중 오류가 발생했습니다. 백엔드(포트 8000)가 실행 중인지 확인해 주세요.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
      backgroundColor: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif"
    }}>
      <div style={{
        width: "520px",
        height: "680px",
        maxWidth: "92vw",
        maxHeight: "90vh",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* 1. 모달 헤더 */}
        <div style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, #0038ff 0%, #1e40af 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>🤖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>AI 부동산 데이터 컨설턴트</h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", opacity: 0.85 }}>
                OpenAI GPT-4o & Gemini 실시간 DB 연동
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value)}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.4)",
                borderRadius: "14px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 700,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="gpt" style={{ color: "#000" }}>🟢 OpenAI GPT-4o</option>
              <option value="gemini" style={{ color: "#000" }}>🔵 Google Gemini 1.5</option>
            </select>
            <button
              onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#fff",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* 2. 빠른 추천 질문 칩 바 */}
        <div style={{
          padding: "10px 14px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          whiteSpace: "nowrap"
        }}>
          {promptChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(chip)}
              disabled={loading}
              style={{
                padding: "5px 11px",
                borderRadius: "16px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "11px",
                color: "#334155",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease"
              }}
            >
              💡 {chip}
            </button>
          ))}
        </div>

        {/* 3. 대화 말풍선 스크롤 영역 */}
        <div style={{
          flex: 1,
          padding: "18px",
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
                  alignItems: "flex-end",
                  gap: "6px",
                  flexDirection: isUser ? "row-reverse" : "row"
                }}>
                  {!isUser && (
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#eff6ff",
                      color: "#0038ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      flexShrink: 0
                    }}>
                      🤖
                    </div>
                  )}
                  <div style={{
                    maxWidth: "380px",
                    padding: "12px 16px",
                    borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                    background: isUser ? "#0038ff" : "#ffffff",
                    color: isUser ? "#ffffff" : "#0f172a",
                    fontSize: "13.5px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-line",
                    boxShadow: isUser ? "0 2px 6px rgba(0, 56, 255, 0.25)" : "0 2px 6px rgba(0, 0, 0, 0.04)",
                    border: isUser ? "none" : "1px solid #e2e8f0"
                  }}>
                    {msg.text}
                  </div>
                </div>
                <span style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  marginTop: "4px",
                  padding: "0 6px"
                }}>
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {/* AI 응답 대기 로딩 애니메이션 */}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px" }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "50%",
                background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                🤖
              </div>
              <div style={{
                background: "#ffffff", padding: "10px 14px", borderRadius: "14px",
                border: "1px solid #e2e8f0", fontSize: "12.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px"
              }}>
                <span className="spinner-dot">⚡</span> Gemini가 국토부 실거래 DB를 조회하고 있습니다...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 4. 하단 입력 폼 */}
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
            placeholder="예: 은마아파트 최근 전세 시세와 최고 거래가 알려줘"
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "24px",
              border: "1.5px solid #cbd5e1",
              fontSize: "13px",
              outline: "none"
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "0 18px",
              borderRadius: "24px",
              border: "none",
              background: loading || !input.trim() ? "#94a3b8" : "#0038ff",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "background 0.15s ease"
            }}
          >
            질문
          </button>
        </form>
      </div>
    </div>
  );
}

