const { execSync } = require('child_process');
const res = execSync('powershell "Get-Process -Name chrome, node | Select-Object Id, ProcessName, MainWindowTitle | Format-Table -AutoSize"').toString();
console.log(res);
