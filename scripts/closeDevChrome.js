const { spawnSync } = require('child_process');

// Chrome forwards a second launch to the existing profile process. That process
// keeps its installed manifest even when --load-extension is passed again.
module.exports = function closeDevChrome(chrome, profileDir) {
  if (process.platform !== 'win32') return;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $profilePattern = '(?:^|\\s)"?--user-data-dir="?' + [regex]::Escape($env:AA_DEV_CHROME_PROFILE) + '"?(?=\\s|$)'
    $browsers = @(Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object {
      $_.ExecutablePath -eq $env:AA_DEV_CHROME_EXE -and
      $_.CommandLine -notmatch '--type=' -and $_.CommandLine -match $profilePattern
    })
    foreach ($browser in $browsers) {
      Write-Output '[start] Перезапускаю Chrome с профилем .chromeDevProfile, чтобы загрузить свежий manifest.'
      $deadline = [DateTime]::UtcNow.AddSeconds(10)
      do {
        $chromeProcess = Get-Process -Id $browser.ProcessId -ErrorAction SilentlyContinue
        if (-not $chromeProcess) { break }
        $null = $chromeProcess.CloseMainWindow()
        Start-Sleep -Milliseconds 250
      } while ([DateTime]::UtcNow -lt $deadline)
      if (Get-Process -Id $browser.ProcessId -ErrorAction SilentlyContinue) {
        throw 'Не удалось закрыть Chrome с профилем .chromeDevProfile. Закройте его окно и повторите npm start.'
      }
    }
  `], {
    env: { ...process.env, AA_DEV_CHROME_EXE: chrome, AA_DEV_CHROME_PROFILE: profileDir },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr.trim());
  }
};
