@echo off
echo ============================================
echo  YOLO Real-Time AI Traffic Engine
echo  Starting on http://localhost:8000
echo ============================================
echo.

REM Try Python 3.14 first (installed path), then fallback to python/python3
set PY=C:\Users\rgnan\AppData\Local\Programs\Python\Python314\python.exe
if not exist "%PY%" set PY=python

echo Using Python: %PY%
echo.

cd /d "%~dp0"
"%PY%" yolo_server.py

pause
