param([string]$PyramidIP = '192.168.1.100', [string]$UserName = 'root')
$ErrorActionPreference = 'Continue'
$installLog = Join-Path $PSScriptRoot 'pyramid-install-log.txt'
$installBytes = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'pyramid-install.py'))
$installEncoded = [Convert]::ToBase64String($installBytes)
$installCommand = "echo $installEncoded | base64 -d | python3 -u -"
Write-Host "AI Pyramid Laya setup: ${UserName}@${PyramidIP}"
Write-Host 'Enter your SSH password. This installs into /root/sky-blaster-pyramid only.'
Write-Host 'System Python dependencies are preserved. Model download may take several minutes.'
& ssh.exe -o ConnectTimeout=10 "${UserName}@${PyramidIP}" $installCommand | Tee-Object -FilePath $installLog
Write-Host "SSH exit code: $LASTEXITCODE"
Write-Host "Log saved: $installLog"
