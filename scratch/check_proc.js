const { execSync } = require('child_process');
try {
  const stdout = execSync('powershell "Get-Process -Name node | Where-Object { $_.Path } | Select-Object Id, ProcessName, SessionId, MainWindowTitle | Format-Table -AutoSize"').toString();
  console.log(stdout);
} catch (e) {
  console.error(e.message);
}
