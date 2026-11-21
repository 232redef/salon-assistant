$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root "mcp-server"
$webDir = Join-Path $root "web"
$python = Join-Path $serverDir ".venv\Scripts\python.exe"
$envFile = Join-Path $webDir ".env.local"

function Stop-WithError($message) {
    Write-Host $message -ForegroundColor Red
    exit 1
}

function Test-Port($port) {
    try {
        $client = New-Object Net.Sockets.TcpClient
        $client.Connect("localhost", $port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

# Новое окно PowerShell. Команда передаётся в кодировке base64, чтобы не мучиться с кавычками.
function Start-Window($command) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded
}

if (-not (Test-Path $python)) {
    Stop-WithError "Не найдено окружение mcp-server\.venv. Создайте его: cd mcp-server; py -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt"
}
if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Stop-WithError "Не найдена папка web\node_modules. Выполните: cd web; npm install"
}
if (-not (Test-Path $envFile)) {
    Stop-WithError "Не найден файл web\.env.local. Создайте его по образцу web\.env.example."
}

$line = Select-String -Path $envFile -Pattern '^MCP_TOKEN=(.+)$' | Select-Object -First 1
if (-not $line) {
    Stop-WithError "В web\.env.local не задана переменная MCP_TOKEN."
}
$token = $line.Matches[0].Groups[1].Value.Trim().Trim('"', "'")
$tokenEscaped = $token -replace "'", "''"

if (Test-Port 8000) {
    Write-Host "Порт 8000 занят: MCP-сервер, вероятно, уже запущен. Пропускаю." -ForegroundColor Yellow
} else {
    $serverCommand = "`$Host.UI.RawUI.WindowTitle = 'MCP-сервер'; Set-Location -LiteralPath '$serverDir'; `$env:MCP_TOKEN = '$tokenEscaped'; & '$python' server.py"
    Start-Window $serverCommand
    Write-Host "Запускаю MCP-сервер (порт 8000)..."
}

if (Test-Port 3000) {
    Write-Host "Порт 3000 занят: Next.js, вероятно, уже запущен. Пропускаю." -ForegroundColor Yellow
} else {
    $webCommand = "`$Host.UI.RawUI.WindowTitle = 'Next.js'; Set-Location -LiteralPath '$webDir'; npm.cmd run dev"
    Start-Window $webCommand
    Write-Host "Запускаю Next.js (порт 3000)..."
}

Write-Host "Жду, пока сайт станет доступен..."
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline -and -not (Test-Port 3000)) {
    Start-Sleep -Milliseconds 700
}

Start-Process "http://localhost:3000"
Write-Host ""
Write-Host "Готово. Чтобы остановить, закройте окна 'MCP-сервер' и 'Next.js' (или нажмите в них Ctrl+C)." -ForegroundColor Green
Write-Host "Ollama запускается отдельно; состояние модели видно на главной странице сайта."
