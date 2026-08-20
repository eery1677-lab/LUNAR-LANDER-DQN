@echo off
chcp 65001 > nul
echo ================================================================
echo 🚀 LunarLander-v3 DQN 간지나는 상륙 관제 대시보드 실행 중...
echo ================================================================

set PYTHON_EXE="C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe"

if exist %PYTHON_EXE% (
    %PYTHON_EXE% main.py
) else (
    python main.py
)

pause
