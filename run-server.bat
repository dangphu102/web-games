@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

if not exist "node_modules\" (
    echo Chua thay dependencies. Dang cai dat packages...
    call npm install
    if errorlevel 1 goto install_failed
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object { $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)' } ^| Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { Write-Output $ip }"`) do set "LAN_IP=%%I"

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess; if ($p) { Write-Output $p }"`) do set "SERVER_PID=%%P"
if defined SERVER_PID goto port_in_use

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = (Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess; if ($p) { Write-Output $p }"`) do set "CLIENT_PID=%%P"
if defined CLIENT_PID goto client_in_use

echo.
echo Dang khoi dong client + server...
echo URL tren may nay: http://localhost:5180
if defined LAN_IP echo URL tren dien thoai cung Wi-Fi: http://%LAN_IP%:5180
if not defined LAN_IP echo Khong tim thay IP Wi-Fi/LAN; dung localhost tren may nay.
echo TV/laptop: tao phong. Dien thoai: mo URL Wi-Fi o tren, quet QR hoac nhap ma phong.
echo Nhan Ctrl+C de dung.
echo.
call npm run dev
echo.
echo Server da dung hoac gap loi. Nhan phim bat ky de dong cua so.
pause >nul
exit /b

:port_in_use
echo Port 3001 dang duoc su dung boi tien trinh PID %SERVER_PID%.
echo May chu co the dang chay san. Hay dung cua so cu bang Ctrl+C truoc khi chay lai.
pause
exit /b 1

:client_in_use
echo Port 5180 dang duoc su dung boi tien trinh PID %CLIENT_PID%.
echo Giao dien web co the dang mo san tai http://127.0.0.1:5180
echo Hay dung cua so cu bang Ctrl+C truoc khi chay lai.
pause
exit /b 1

:npm_missing
echo Khong tim thay npm. Hay cai Node.js roi thu lai.
pause
exit /b 1

:install_failed
echo Cai dat dependencies that bai.
pause
exit /b 1
