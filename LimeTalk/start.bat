@echo off
title LimeTalk Server
echo Запуск LimeTalk...
echo.
echo Убедитесь, что зависимости установлены (npm install)
echo Если нет, выполните npm install вручную.
echo.
npm install
echo.
echo Сервер запускается...
node server.js
pause