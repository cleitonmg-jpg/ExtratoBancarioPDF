@echo off
chcp 65001 >nul

:: ── Caminhos diretos ──
set NPM="C:\Program Files\nodejs\npm.cmd"
set GIT="C:\Program Files\Git\cmd\git.exe"

echo.
echo ========================================
echo   BUILD E DEPLOY - ExtratoAI
echo ========================================
echo.

:: ── 1. Build ──
echo [1/4] Executando build...
echo.
%NPM% run build
if %errorlevel% neq 0 (
    echo.
    echo ERRO: Build falhou!
    pause
    exit /b 1
)
echo.
echo Build OK!
echo.

:: ── 2. Mensagem do commit ──
set COMMIT_MSG=update
set /p COMMIT_MSG=[2/4] Mensagem do commit (Enter = 'update'):
echo.

:: ── 3. Git add ──
echo [3/4] Adicionando arquivos...
%GIT% add .
if %errorlevel% neq 0 (
    echo ERRO: git add falhou!
    pause
    exit /b 1
)

:: ── 4. Commit ──
%GIT% commit -m "%COMMIT_MSG%"

:: ── 5. Push ──
echo.
echo [4/4] Enviando para GitHub...
%GIT% push origin main
if %errorlevel% neq 0 (
    echo.
    echo ERRO: git push falhou!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   PRONTO! Va ao Coolify e clique em
echo   Redeploy para atualizar o servidor.
echo ========================================
echo.
pause
