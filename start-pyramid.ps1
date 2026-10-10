param([switch]$NoBrowser, [string]$PyramidIP = '192.168.1.100', [string]$PythonExe = 'python')
$ErrorActionPreference = 'Stop'
$taskUrl = 'http://127.0.0.1:8854/?pyramid=1#race'
$taskTarget = "http://${PyramidIP}:8010"
$taskDist = Join-Path $PSScriptRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $taskDist 'index.html'))) { throw 'Run npm run build first.' }
function Test-PyramidBridge {
    try {
        $request = [System.Net.WebRequest]::Create('http://127.0.0.1:8854/api/bridge/status')
        $request.Proxy = $null
        $request.Timeout = 2500
        $response = $request.GetResponse()
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        try {
            $info = $reader.ReadToEnd() | ConvertFrom-Json
            return ($info.bridge -eq $true -and $info.target -eq $taskTarget)
        } finally { $reader.Dispose(); $response.Dispose() }
    } catch { return $false }
}
if (-not (Test-PyramidBridge)) {
    $taskPython = (Get-Command $PythonExe -ErrorAction Stop).Source
    Start-Process -FilePath $taskPython -ArgumentList @(('"' + (Join-Path $PSScriptRoot 'pyramid_bridge.py') + '"'), '--dist', ('"' + $taskDist + '"'), '--pyramid', $taskTarget) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'pyramid-bridge.log') -RedirectStandardError (Join-Path $PSScriptRoot 'pyramid-bridge-error.log') | Out-Null
    for ($taskTry = 0; $taskTry -lt 12; $taskTry++) {
        Start-Sleep -Milliseconds 300
        if (Test-PyramidBridge) { break }
    }
}
if (-not (Test-PyramidBridge)) { throw 'Bridge did not start. Check port 8854 and pyramid-bridge-error.log.' }
Write-Output $taskUrl
if (-not $NoBrowser) { Start-Process $taskUrl }
