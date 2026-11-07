import React from "react";
import TossStyleRealEstateDashboard from "./TossStyleRealEstateDashboard";

/**
 * =========================================================================
 * 집뷰(ZipView) React 메인 애플리케이션 진입점 (App.jsx)
 * =========================================================================
 *
 * [수정 및 Error #130 완벽 방어]
 * 1. 번들러/Babel interop에 의해 default 객체가 중첩({ default: Component })되는 현상 방어
 * 2. TossStyleRealEstateDashboard가 유효한 함수형 컴포넌트인지 검증 후 렌더링
 * 3. 미로딩 상태일 경우 폴백 로딩 UI 표출
 */
export default function App() {
  const ComponentToRender = (TossStyleRealEstateDashboard && TossStyleRealEstateDashboard.default)
    ? TossStyleRealEstateDashboard.default
    : TossStyleRealEstateDashboard;

  if (!ComponentToRender || typeof ComponentToRender !== "function") {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-10 h-10 border-4 border-[#3182F6] border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-sm font-extrabold text-[#191F28]">UI 컴포넌트 로딩중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden box-border bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-[#E2E8F0] selection:text-[#0F172A]">
      <ComponentToRender />
    </main>
  );
}
