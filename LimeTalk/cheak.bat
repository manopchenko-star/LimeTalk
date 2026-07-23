@echo off
title LimeTalk Server
echo Запуск LimeTalk...
echo.

:: Проверка наличия Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Убедитесь, что Node.js установлен и добавлен в PATH.
    echo Скачать: https://nodejs.org
    pause
    exit /b 1
)

echo Установка зависимостей...
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm install не удался.
    pause
    exit /b 1
)

echo Запуск сервера...
node server.js

pause