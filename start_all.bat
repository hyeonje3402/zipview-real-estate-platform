@echo off
chcp 65001 > nul
echo ===================================================
echo 🏠 집뷰(ZipView) 풀스택 서버를 실행합니다...
echo ===================================================

echo [1/2] 백엔드 FastAPI 서버(포트 8001) 실행 중...
start "ZipView Backend (FastAPI :8001)" cmd /k "python -m uvicorn main:app --port 8001 --reload"

timeout /t 2 > nul

echo [2/2] 프론트엔드 웹 서버(포트 3001) 실행 중...
start "ZipView Frontend (Node.js :3001)" cmd /k "node server.js"

timeout /t 2 > nul

echo.
echo 🎉 모든 서버가 실행되었습니다!
echo 👉 브라우저 접속: http://localhost:3001
echo ===================================================
start http://localhost:3001

