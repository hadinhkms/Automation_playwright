/**
 * tests/dashboard/support/dashboardHarness.js
 * Manages an isolated dashboard server instance on an ephemeral port.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const net = require('net');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForHealth(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for dashboard health at port ${port}`));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      });
      req.on('error', () => {
        // server not ready yet, continue polling
      });
      req.setTimeout(1000, () => req.destroy());
    }, 200);
  });
}

async function startDashboardHarness(fixtureRoot) {
  const port = await getFreePort();
  const serverScript = path.resolve(__dirname, '../../../dashboard/server.js');

  const child = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      DASHBOARD_PORT: String(port),
      QA_PROJECT_ROOT: fixtureRoot,
      NODE_ENV: 'test'
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  child.stdout.on('data', (d) => { serverOutput += d.toString(); });
  child.stderr.on('data', (d) => { serverOutput += d.toString(); });

  try {
    await waitForHealth(port);
  } catch (err) {
    child.kill('SIGKILL');
    throw new Error(`Failed to start dashboard: ${err.message}\nOutput: ${serverOutput}`);
  }

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    stop: () => {
      return new Promise((resolve) => {
        if (!child.killed) {
          child.kill('SIGTERM');
          const forceKillTimeout = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (_) {}
            resolve();
          }, 3000);
          child.on('exit', () => {
            clearTimeout(forceKillTimeout);
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  };
}

module.exports = { startDashboardHarness };
