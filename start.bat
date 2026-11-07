@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务器（端口 8000）...
echo 浏览器会自动打开，关闭本窗口即停止。
start "" http://localhost:8000/index.html
python -m http.server 8000
if errorlevel 1 (
  echo.
  echo 没有找到 python。请安装 Python 3 后重试，或用其它静态服务器打开本目录。
  pause
)
