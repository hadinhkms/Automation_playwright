const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  CONFIG_PATH,
  getDashboardConfig,
  publicDashboardConfig,
  saveDashboardConfig,
} = require('../core/config/dashboardConfig');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORT_DIR = path.join(ROOT, 'playwright-report');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const BACKUP_DIR = path.join(ROOT, '.dashboard-backups');
const TOOLS_DIR = path.join(ROOT, 'tools');
const TRACE_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];
const SCREENSHOT_OPTIONS = ['off', 'on', 'only-on-failure'];
const VIDEO_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];

const DISCORD_BOT_DIR = path.resolve(ROOT, '../discord-qa-bot');
const DISCORD_BOT_ENV_PATH = path.join(DISCORD_BOT_DIR, '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  });
  return env;
}

function writeEnvFile(filePath, envObj) {
  const lines = Object.entries(envObj).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}
const CODE_ROOTS = ['tests', 'pages', 'core'];
const PORT = Number.parseInt(process.env.DASHBOARD_PORT || '4174', 10);
const APP_NAME = process.env.DASHBOARD_APP_NAME || 'carthings';
const PROJECTS = [
  'all', 
  'Desktop Chrome',
  'Company Site Desktop Full HD',
  'Company Site Desktop 2K'
];
const DOCUMENT_RESOURCES = ['AI_PROMPTS.md', 'QA_AI_RULES.md', 'README.md'];

let activeRun = null;
let lastRun = null;
const clients = new Set();
const logBuffer = [];

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function safeChildPath(base, requestedPath) {
  const resolved = path.resolve(base, `.${requestedPath}`);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

function listSpecs(directory = path.join(ROOT, 'tests')) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSpecs(absolutePath);
    if (!entry.name.endsWith('.spec.js')) return [];
    return [path.relative(ROOT, absolutePath).split(path.sep).join('/')];
  }).sort();
}

function listSpecDetails() {
  const specs = listSpecs();
  const specTags = {};
  const allTags = new Set();

  for (const specPath of specs) {
    const fullPath = path.join(ROOT, specPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/@([a-zA-Z0-9_-]+)/g) || [];
      const tags = Array.from(new Set(
        matches.filter((t) => !t.startsWith('@playwright') && !t.includes('@email') && !t.includes('@mail'))
      ));
      specTags[specPath] = tags;
      tags.forEach((t) => allTags.add(t));
    } catch (e) {
      specTags[specPath] = [];
    }
  }

  return {
    specTags,
    availableTags: Array.from(allTags).sort(),
  };
}

function projectsForSpec(spec) {
  const content = fs.readFileSync(path.join(ROOT, spec), 'utf8');
  if (!spec.startsWith('tests/e2e/')) return [];
  const projects = ['Desktop Chrome'];
  if (/@CompanySite\b/.test(content)) {
    projects.push('Company Site Desktop Full HD', 'Company Site Desktop 2K');
  }
  return projects;
}

function specProjects() {
  return Object.fromEntries(listSpecs().map((spec) => [spec, projectsForSpec(spec)]));
}

function listCodeFiles() {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      if (entry.isFile() && /\.(js|cjs|mjs|json)$/i.test(entry.name)) {
        files.push(path.relative(ROOT, absolutePath).split(path.sep).join('/'));
      }
    }
  };
  CODE_ROOTS.forEach((root) => visit(path.join(ROOT, root)));
  return files.sort();
}

function resolveCodeFile(filePath) {
  if (!listCodeFiles().includes(filePath)) return null;
  const absolutePath = path.resolve(ROOT, filePath);
  const validRoot = CODE_ROOTS.some((root) => absolutePath.startsWith(`${path.join(ROOT, root)}${path.sep}`));
  return validRoot ? absolutePath : null;
}

function listResources() {
  cleanupArtifacts();
  const documents = DOCUMENT_RESOURCES.filter((file) => fs.existsSync(path.join(ROOT, file)));
  const dataDirectory = path.join(ROOT, 'data');
  const data = fs.existsSync(dataDirectory)
    ? fs.readdirSync(dataDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => `data/${entry.name}`)
      .sort()
    : [];
  const evidence = [];
  const collectEvidence = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectEvidence(absolutePath);
      if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
        evidence.push({
          path: path.relative(EVIDENCE_DIR, absolutePath).split(path.sep).join('/'),
          modifiedAt: fs.statSync(absolutePath).mtimeMs,
        });
      }
    }
  };
  collectEvidence(EVIDENCE_DIR);
  evidence.sort((a, b) => b.modifiedAt - a.modifiedAt);

  const reports = [];
  const collectReports = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectReports(absolutePath);
      if (entry.isFile() && entry.name === 'index.html' && !absolutePath.includes(`${path.sep}workers${path.sep}`)) {
        reports.push({
          path: path.relative(REPORT_DIR, absolutePath).split(path.sep).join('/'),
          modifiedAt: fs.statSync(absolutePath).mtimeMs,
        });
      }
    }
  };
  collectReports(REPORT_DIR);
  reports.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return {
    documents,
    data,
    evidence: evidence.map((item) => item.path),
    evidenceDetails: evidence.map((item) => ({ path: item.path, modifiedAt: new Date(item.modifiedAt).toISOString() })),
    reports: reports.map((item) => item.path),
    reportDetails: reports.map((item) => ({ path: item.path, modifiedAt: new Date(item.modifiedAt).toISOString() })),
  };
}

function resolveResource(resourcePath) {
  const resources = listResources();
  const allowed = [...resources.documents, ...resources.data];
  if (!allowed.includes(resourcePath)) return null;
  const absolutePath = path.resolve(ROOT, resourcePath);
  return absolutePath.startsWith(`${ROOT}${path.sep}`) ? absolutePath : null;
}

function createBackup(resourcePath, absolutePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, timestamp, resourcePath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(absolutePath, backupPath);
  return path.relative(ROOT, backupPath).split(path.sep).join('/');
}

function removeInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget === resolvedBase || !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error('Cleanup target is outside the allowed artifact directory.');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: false });
}

function collectReportFolders() {
  if (!fs.existsSync(REPORT_DIR)) return [];
  const reports = [];
  const visit = (directory, depth = 0) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, depth + 1);
      if (entry.isFile() && entry.name === 'index.html' && !absolutePath.includes(`${path.sep}workers${path.sep}`)) {
        const reportFolder = path.dirname(absolutePath);
        const relativeParts = path.relative(REPORT_DIR, reportFolder).split(path.sep);
        const dateFolder = relativeParts.length >= 4 
          ? relativeParts.slice(0, 3).join('/')
          : relativeParts.slice(0, Math.max(1, relativeParts.length - 1)).join('/');
        reports.push({
          folder: reportFolder,
          dateFolder,
          modifiedAt: fs.statSync(absolutePath).mtimeMs,
        });
      }
    }
  };
  visit(REPORT_DIR);
  return reports;
}

function cleanupArtifacts() {
  const settings = getDashboardConfig().artifacts;
  const cutoff = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;

  if (settings.autoCleanupEvidence && fs.existsSync(EVIDENCE_DIR)) {
    const evidenceFolders = new Set();
    const visitEvidence = (directory, depth = 0) => {
      if (depth > 10) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) visitEvidence(absolutePath, depth + 1);
        if (entry.isFile() && /\.(png|jpe?g|webp|webm)$/i.test(entry.name)) {
          evidenceFolders.add(directory);
        }
      }
    };
    visitEvidence(EVIDENCE_DIR);
    
    Array.from(evidenceFolders).forEach((target) => {
      if (fs.existsSync(target) && fs.statSync(target).mtimeMs < cutoff) {
        removeInside(EVIDENCE_DIR, target);
      }
    });

    for (const depth of [3, 2, 1, 0]) {
      const getParentDirs = (dir, currentDepth) => {
        if (!fs.existsSync(dir)) return [];
        if (currentDepth === depth) return [dir];
        let dirs = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) dirs = dirs.concat(getParentDirs(path.join(dir, entry.name), currentDepth + 1));
        }
        return dirs;
      };
      
      const parentDirs = getParentDirs(EVIDENCE_DIR, 0);
      parentDirs.forEach(parent => {
        if (!fs.existsSync(parent)) return;
        for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const targetDir = path.join(parent, entry.name);
          if (fs.readdirSync(targetDir).length === 0) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        }
      });
    }
  }

  if (settings.autoCleanupReports && fs.existsSync(REPORT_DIR)) {
    const reports = collectReportFolders();
    reports
      .filter((report) => report.modifiedAt < cutoff)
      .forEach((report) => removeInside(REPORT_DIR, report.folder));

    const remaining = collectReportFolders()
      .reduce((groups, report) => {
        groups[report.dateFolder] = groups[report.dateFolder] || [];
        groups[report.dateFolder].push(report);
        return groups;
      }, {});

    for (const reportsByDate of Object.values(remaining)) {
      reportsByDate
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .slice(settings.maxReportsPerDay)
        .forEach((report) => removeInside(REPORT_DIR, report.folder));
    }

    for (const entry of fs.readdirSync(REPORT_DIR, { withFileTypes: true })) {
      const dateFolder = path.join(REPORT_DIR, entry.name);
      if (entry.isDirectory() && fs.readdirSync(dateFolder).length === 0) fs.rmdirSync(dateFolder);
    }
  }
}

function countFolderArtifacts(directory) {
  const result = { files: 0, traceAndVideo: 0 };
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      if (entry.isFile()) {
        result.files += 1;
        if (/\.(zip|trace|webm)$/i.test(entry.name)) result.traceAndVideo += 1;
      }
    }
  };
  visit(directory);
  return result;
}

function readResourceBody(resourcePath, reveal = false) {
  const absolutePath = resolveResource(resourcePath);
  if (!absolutePath) return null;
  if (fs.statSync(absolutePath).size > 1_048_576) return { error: 'Resource lớn hơn giới hạn 1 MB.', status: 413 };
  const extension = path.extname(absolutePath).toLowerCase();
  const rawContent = fs.readFileSync(absolutePath, 'utf8');
  if (extension === '.json') {
    try {
      const parsed = JSON.parse(rawContent);
      const content = reveal ? parsed : maskSensitiveData(parsed);
      return { path: resourcePath, type: 'json', content: JSON.stringify(content, null, 2), masked: !reveal, editable: true };
    } catch {
      return { error: 'File JSON không hợp lệ.', status: 422 };
    }
  }
  return { path: resourcePath, type: 'markdown', content: rawContent, masked: false, editable: resourcePath === 'AI_PROMPTS.md' };
}

function maskSensitiveData(value, key = '') {
  const sensitiveKey = /(password|passwd|secret|token|authorization|otp|pin|phone|email)/i.test(key);
  if (sensitiveKey && typeof value === 'string' && value) {
    if (value.length <= 4) return '••••';
    return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 2))}`;
  }
  if (Array.isArray(value)) return value.map((item) => maskSensitiveData(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, maskSensitiveData(childValue, childKey)]));
  }
  return value;
}

function newestReport() {
  if (!fs.existsSync(REPORT_DIR)) return null;
  const indexes = [];
  const visit = (directory, depth = 0) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, depth + 1);
      if (entry.isFile() && entry.name === 'index.html') {
        indexes.push({ absolutePath, mtime: fs.statSync(absolutePath).mtimeMs });
      }
    }
  };
  visit(REPORT_DIR);
  return indexes.sort((a, b) => b.mtime - a.mtime)[0]?.absolutePath || null;
}

function publish(type, payload) {
  const event = { type, payload, timestamp: new Date().toISOString() };
  if (type === 'log') {
    logBuffer.push(event);
    if (logBuffer.length > 1000) logBuffer.shift();
  }
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(message);
}

function publicRun(run) {
  if (!run) return null;
  const { child, ...serializable } = run;
  return serializable;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32_768) reject(new Error('Request body quá lớn.'));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('JSON không hợp lệ.')); }
    });
    request.on('error', reject);
  });
}

function validateOptions(input) {
  const settings = getDashboardConfig();
  const environments = Object.keys(settings.environments);
  const allSpecs = listSpecs();
  const project = String(input.project || 'all');
  const environment = String(input.environment || settings.runtime.defaultEnvironment);
  const grep = String(input.grep || '').trim();
  const workers = Number(input.workers || settings.runtime.workers);
  const suiteLabel = typeof input.suiteLabel === 'string' ? input.suiteLabel.slice(0, 80) : '';

  let viewport = null;
  if (input.viewport && typeof input.viewport === 'object') {
    const width = Number(input.viewport.width);
    const height = Number(input.viewport.height);
    if (Number.isInteger(width) && width >= 320 && width <= 7680 && Number.isInteger(height) && height >= 320 && height <= 4320) {
      viewport = { width, height };
    }
  }

  let specs = [];
  if (Array.isArray(input.specs)) {
    specs = input.specs.map(String).filter((s) => allSpecs.includes(s));
  } else if (input.spec && input.spec !== 'all') {
    if (allSpecs.includes(input.spec)) specs = [input.spec];
    else throw new Error('Spec không hợp lệ.');
  }

  if (!PROJECTS.includes(project)) throw new Error('Project không hợp lệ.');
  if (!environments.includes(environment)) throw new Error('Environment không hợp lệ.');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('Luồng chạy phải từ 1 đến 8.');
  if (grep.length > 80 || /[\r\n\0]/.test(grep)) throw new Error('Tag/grep không hợp lệ.');

  const spec = specs.length === 1 ? specs[0] : (specs.length > 1 ? specs.join(' ') : 'all');
  return { project, environment, spec, specs, grep, workers, headed: input.headed === true, viewport, suiteLabel };
}

function runtimeEnv(options) {
  const settings = getDashboardConfig();
  const runtime = settings.runtime;
  const api = settings.api;
  const retries = process.env.CI ? runtime.retriesCI : runtime.retriesLocal;
  const selectedSpec = String(options.spec || '');
  const selectedProject = String(options.project || '');
  const platform = selectedSpec.startsWith('tests/e2e/mobile-web/') || selectedSpec.startsWith('tests/e2e/mobile/') || /^Mobile (?:Chrome|Safari)/.test(selectedProject)
    ? 'mobile-web'
    : selectedSpec.startsWith('tests/e2e/mobile-app/')
      ? 'mobile-app'
      : 'desktop';

  const vpWidth = options.viewport?.width || runtime.viewport.width;
  const vpHeight = options.viewport?.height || runtime.viewport.height;

  return {
    NODE_ENV: options.environment,
    QA_PLATFORM: platform,
    PW_WORKERS: String(options.workers),
    PW_RETRIES: String(retries),
    PW_TEST_TIMEOUT: String(runtime.testTimeout),
    PW_NAVIGATION_TIMEOUT: String(runtime.navigationTimeout),
    PW_ACTION_TIMEOUT: String(runtime.actionTimeout),
    PW_TRACE: runtime.trace,
    PW_SCREENSHOT: runtime.screenshot,
    PW_VIDEO: runtime.video,
    PW_VIEWPORT_WIDTH: String(vpWidth),
    PW_VIEWPORT_HEIGHT: String(vpHeight),
    SHOW_ENV_BANNER: runtime.showEnvBanner ? '1' : '0',
    DEBUG_OPTIONAL_POPUPS: runtime.debugOptionalPopups ? '1' : '0',
    REGISTRATION_BEARER_TOKEN: api.registrationBearerToken || '',
    REGISTRATION_BRANCH: api.branch,
    REGISTRATION_LANG: api.lang,
  };
}

async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    throw new Error('Discord Webhook URL không hợp lệ.');
  }
  const body = JSON.stringify(payload);
  const parsedUrl = new URL(webhookUrl);
  return new Promise((resolve, reject) => {
    const req = https.request(parsedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          let errMsg = data;
          try {
            const parsed = JSON.parse(data);
            if (parsed.code === 50027 || parsed.message?.includes('Invalid Webhook Token')) {
              errMsg = 'Mã Webhook Token không hợp lệ. Vui lòng vào Discord (Edit Channel > Integrations > Webhooks) bấm "Copy Webhook URL" lại.';
            } else if (parsed.code === 10015 || parsed.message?.includes('Unknown Webhook')) {
              errMsg = 'Webhook này không tồn tại hoặc đã bị xóa trên Discord. Vui lòng tạo Webhook mới.';
            } else if (parsed.message) {
              errMsg = parsed.message;
            }
          } catch (e) {}
          reject(new Error(`Discord phản hồi (${res.statusCode}): ${errMsg}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendDiscordRunReport(runData) {
  const settings = getDashboardConfig();
  const discord = settings.discord;
  if (!discord?.webhookUrl || !discord.webhookUrl.startsWith('http')) return;
  if (!discord.notifyOnFinish) return;
  if (discord.notifyOnlyOnFailure && runData.status !== 'failed') return;

  const isPassed = runData.status === 'passed';
  const isFailed = runData.status === 'failed';

  const color = isPassed ? 0x22c55e : (isFailed ? 0xef4444 : 0xf59e0b);
  const statusEmoji = isPassed ? '🟢 PASSED' : (isFailed ? '🔴 FAILED' : '🟡 STOPPED');
  const durationSec = runData.finishedAt && runData.startedAt
    ? ((new Date(runData.finishedAt) - new Date(runData.startedAt)) / 1000).toFixed(1) + 's'
    : '—';

  const suiteName = runData.options?.suiteLabel || 'Tùy chỉnh (Thủ công)';
  const environment = runData.options?.environment || 'dev';
  const project = runData.options?.project || 'all';
  const vpWidth = runData.options?.viewport?.width || settings.runtime.viewport.width;
  const vpHeight = runData.options?.viewport?.height || settings.runtime.viewport.height;

  const embed = {
    title: `${isPassed ? '✅' : isFailed ? '❌' : '⚠️'} Automation Test Run: ${suiteName}`,
    color,
    description: `Kết quả thực thi tự động từ **CarThings Automation Dashboard**.`,
    fields: [
      { name: '📊 Kết quả', value: `\`${statusEmoji}\``, inline: true },
      { name: '⏱️ Thời lượng', value: `\`${durationSec}\``, inline: true },
      { name: '🌐 Môi trường', value: `\`${environment.toUpperCase()}\``, inline: true },
      { name: '📱 Màn hình / Viewport', value: `\`${project}\` • \`${vpWidth}x${vpHeight}\``, inline: true },
      { name: '⚡ Luồng chạy (Workers)', value: `\`${runData.options?.workers || 2} workers\``, inline: true },
      { name: '🏷️ Tag / Grep', value: `\`${runData.options?.grep || 'None'}\``, inline: true },
    ],
    footer: {
      text: `CarThings Automation • ${new Date().toLocaleString('vi-VN')}`,
    },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: 'CarThings QA Bot',
    avatar_url: settings.branding?.logoUrl || 'https://dev.carthings.vn/icon.svg',
    embeds: [embed],
  };

  try {
    await sendDiscordWebhook(discord.webhookUrl, payload);
  } catch (err) {
    console.error('Lỗi khi gửi Discord notification:', err.message);
  }
}

function startRun(options, uiMode = false) {
  const args = ['test'];
  if (Array.isArray(options.specs) && options.specs.length > 0) {
    args.push(...options.specs);
  } else if (options.spec && options.spec !== 'all') {
    args.push(options.spec);
  }
  if (options.project !== 'all') args.push(`--project=${options.project}`);
  if (options.grep) args.push('--grep', options.grep);
  if (uiMode) args.push('--ui');
  else if (options.headed) args.push('--headed');

  logBuffer.length = 0;
  const playwrightCli = require.resolve('@playwright/test/cli');
  const child = spawn(process.execPath, [playwrightCli, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...runtimeEnv(options) },
    shell: false,
  });
  activeRun = {
    id: Date.now().toString(36),
    status: 'running',
    startedAt: new Date().toISOString(),
    mode: uiMode ? 'ui' : 'test',
    options,
    command: `npx playwright ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
    child,
  };
  publish('status', publicRun(activeRun));

  const pipeOutput = (source, stream) => source.on('data', (chunk) => {
    publish('log', { stream, text: chunk.toString() });
  });
  pipeOutput(child.stdout, 'stdout');
  pipeOutput(child.stderr, 'stderr');

  child.on('error', (error) => publish('log', { stream: 'stderr', text: `${error.message}\n` }));
  child.on('close', (exitCode, signal) => {
    const report = newestReport();
    activeRun.status = signal ? 'stopped' : exitCode === 0 ? 'passed' : 'failed';
    activeRun.finishedAt = new Date().toISOString();
    activeRun.exitCode = exitCode;
    activeRun.reportAvailable = Boolean(report);
    lastRun = publicRun(activeRun);

    sendDiscordRunReport(activeRun).catch(() => {});

    activeRun = null;
    publish('status', lastRun);
  });
  return publicRun(activeRun);
}

function serveFile(response, filePath, cache = false) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: 'Không tìm thấy tài nguyên.' });
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.webm': 'video/webm', '.zip': 'application/zip', '.woff2': 'font/woff2',
  };
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/api/config') {
    const settings = getDashboardConfig();
    const details = listSpecDetails();
    return sendJson(response, 200, {
      projects: PROJECTS,
      environments: Object.keys(settings.environments),
      specs: details.specs || listSpecs(),
      specTags: details.specTags,
      availableTags: details.availableTags,
      specProjects: specProjects(),
      defaults: {
        environment: settings.runtime.defaultEnvironment,
        workers: settings.runtime.workers,
      },
      branding: publicDashboardConfig(settings).branding,
      suites: settings.suites || {},
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, {
      appName: APP_NAME,
      workspaceRoot: ROOT,
      port: PORT,
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/settings') {
    return sendJson(response, 200, publicDashboardConfig());
  }
  if (request.method === 'POST' && url.pathname === '/api/discord/test') {
    try {
      const body = await parseBody(request);
      const settings = getDashboardConfig();
      const webhookUrl = body.webhookUrl || settings.discord?.webhookUrl;
      if (!webhookUrl) throw new Error('Chưa cung cấp Discord Webhook URL.');

      const testEmbed = {
        title: '🧪 Kiểm Tra Kết Nối Discord Webhook Thành Công!',
        color: 0x3b82f6,
        description: 'CarThings Automation Dashboard đã kết nối thành công tới kênh Discord này.\nBạn sẽ nhận được thông báo tự động mỗi khi có lượt chạy test!',
        fields: [
          { name: '🖥️ Hệ thống', value: settings.branding?.projectName || 'CarThings Automation', inline: true },
          { name: '⏰ Thời gian', value: new Date().toLocaleString('vi-VN'), inline: true },
        ],
        footer: { text: 'CarThings QA Automation Bot' },
        timestamp: new Date().toISOString(),
      };

      await sendDiscordWebhook(webhookUrl, {
        username: 'CarThings QA Bot',
        avatar_url: settings.branding?.logoUrl || 'https://dev.carthings.vn/icon.svg',
        embeds: [testEmbed],
      });

      return sendJson(response, 200, { success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công tới Discord!' });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể gửi tin nhắn Discord: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/discord-bot/config') {
    const exists = fs.existsSync(DISCORD_BOT_ENV_PATH);
    const env = exists ? parseEnvFile(DISCORD_BOT_ENV_PATH) : {};
    let currentGitBranch = 'main';
    try {
      currentGitBranch = require('child_process').execSync('git branch --show-current', { cwd: ROOT, stdio: 'pipe' }).toString().trim() || 'main';
    } catch (e) {}

    return sendJson(response, 200, {
      exists,
      botDir: DISCORD_BOT_DIR,
      currentGitBranch,
      config: {
        discordToken: env.DISCORD_TOKEN ? `${env.DISCORD_TOKEN.slice(0, 10)}...${env.DISCORD_TOKEN.slice(-6)}` : '',
        hasDiscordToken: Boolean(env.DISCORD_TOKEN),
        allowedChannelId: env.ALLOWED_CHANNEL_ID || '',
        githubToken: env.GITHUB_TOKEN ? `${env.GITHUB_TOKEN.slice(0, 12)}...${env.GITHUB_TOKEN.slice(-4)}` : '',
        hasGithubToken: Boolean(env.GITHUB_TOKEN),
        githubOwner: env.GITHUB_OWNER || 'hadinhkms',
        githubRepo: env.GITHUB_REPO || 'Automation_Carthings',
        githubWorkflow: env.GITHUB_WORKFLOW || 'discord-run-playwright.yml',
        githubRef: env.GITHUB_REF || 'main',
      }
    });
  }
  if (request.method === 'PUT' && url.pathname === '/api/discord-bot/config') {
    try {
      const body = await parseBody(request);
      if (!fs.existsSync(DISCORD_BOT_DIR)) {
        throw new Error(`Thư mục Discord Bot không tồn tại: ${DISCORD_BOT_DIR}`);
      }
      const current = parseEnvFile(DISCORD_BOT_ENV_PATH);
      if (body.discordToken && !body.discordToken.includes('...')) current.DISCORD_TOKEN = body.discordToken.trim();
      if (body.githubToken && !body.githubToken.includes('...')) current.GITHUB_TOKEN = body.githubToken.trim();
      if (body.allowedChannelId !== undefined) current.ALLOWED_CHANNEL_ID = String(body.allowedChannelId).trim();
      if (body.githubOwner) current.GITHUB_OWNER = String(body.githubOwner).trim();
      if (body.githubRepo) current.GITHUB_REPO = String(body.githubRepo).trim();
      if (body.githubWorkflow) current.GITHUB_WORKFLOW = String(body.githubWorkflow).trim();
      if (body.githubRef) current.GITHUB_REF = String(body.githubRef).trim();

      writeEnvFile(DISCORD_BOT_ENV_PATH, current);
      return sendJson(response, 200, { message: 'Đã lưu cấu hình Discord QA Bot thành công!' });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu cấu hình Bot: ${error.message}` });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/discord/test') {
    try {
      const body = await parseBody(request);
      const webhookUrl = (body.webhookUrl || '').trim() || getDashboardConfig().discord?.webhookUrl;
      const channelName = (body.channelName || '').trim() || getDashboardConfig().discord?.channelName || '#qa-automation';
      if (!webhookUrl) {
        return sendJson(response, 400, { error: 'Vui lòng nhập Discord Webhook URL trước khi thử nghiệm.' });
      }

      const testEmbed = {
        username: 'CarThings QA Automation',
        avatar_url: 'https://dev.carthings.vn/icon.svg',
        embeds: [
          {
            title: '🔔 Thử Nghiệm Kết Nối Webhook Thành Công!',
            description: `Kênh nhận thông báo: **${channelName}**\nCarThings Automation Dashboard đã kết nối thành công tới Discord Webhook.`,
            color: 0x22c55e,
            fields: [
              { name: 'Thời gian', value: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), inline: true },
              { name: 'Trạng thái', value: '🟢 Sẵn sàng gửi báo cáo', inline: true },
              { name: 'Hệ thống', value: 'CarThings Playwright Automation', inline: false }
            ],
            footer: {
              text: 'CarThings QA Dashboard • Automated Notification'
            }
          }
        ]
      };

      await sendDiscordWebhook(webhookUrl, testEmbed);
      return sendJson(response, 200, { success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công về Discord!' });
    } catch (error) {
      return sendJson(response, 500, { error: `Không thể gửi tin nhắn Discord: ${error.message}` });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/git/sync') {
    try {
      const { execSync } = require('child_process');
      let currentBranch = 'main';
      try {
        currentBranch = execSync('git branch --show-current', { cwd: ROOT, stdio: 'pipe' }).toString().trim() || 'main';
      } catch (e) {}

      execSync('git add .', { cwd: ROOT, stdio: 'pipe' });
      try {
        execSync('git commit -m "chore(dashboard): sync test suites and configs"', { cwd: ROOT, stdio: 'pipe' });
      } catch (e) {
        // Không có thay đổi mới cũng không sao
      }
      const pushLog = execSync(`git push origin ${currentBranch}`, { cwd: ROOT, stdio: 'pipe' }).toString();
      return sendJson(response, 200, {
        success: true,
        currentBranch,
        message: `Đã đồng bộ hóa và Push Test Suites lên nhánh "${currentBranch}" (origin/${currentBranch}) thành công!`,
        output: pushLog.trim() || 'Everything up-to-date'
      });
    } catch (error) {
      return sendJson(response, 500, { error: `Không thể đồng bộ lên GitHub: ${error.message}` });
    }
  }
  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    try {
      const body = await parseBody(request);
      const backup = createBackup('core/config/dashboardConfig.json', CONFIG_PATH);
      const saved = saveDashboardConfig(body);
      return sendJson(response, 200, { message: 'Đã lưu cấu hình.', backup, settings: publicDashboardConfig(saved) });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu cấu hình: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/resources') {
    return sendJson(response, 200, listResources());
  }
  if (request.method === 'GET' && url.pathname === '/api/code-files') {
    return sendJson(response, 200, { files: listCodeFiles() });
  }
  if (request.method === 'GET' && url.pathname === '/api/code') {
    const filePath = url.searchParams.get('path') || '';
    const absolutePath = resolveCodeFile(filePath);
    if (!absolutePath) return sendJson(response, 404, { error: 'File mã nguồn không hợp lệ.' });
    if (fs.statSync(absolutePath).size > 1_048_576) return sendJson(response, 413, { error: 'File mã nguồn lớn hơn giới hạn 1 MB.' });
    return sendJson(response, 200, { path: filePath, content: fs.readFileSync(absolutePath, 'utf8'), editable: true });
  }
  if (request.method === 'PUT' && url.pathname === '/api/code') {
    try {
      const body = await parseBody(request);
      const filePath = String(body.path || '');
      const absolutePath = resolveCodeFile(filePath);
      if (!absolutePath) return sendJson(response, 403, { error: 'File mã nguồn này không được phép chỉnh sửa.' });
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' });
      if (filePath.endsWith('.json')) JSON.parse(content);
      else new Function(content);
      const backup = createBackup(filePath, absolutePath);
      fs.writeFileSync(absolutePath, content, 'utf8');
      return sendJson(response, 200, { message: 'Đã lưu source file.', backup });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/resource') {
    const resourcePath = url.searchParams.get('path') || '';
    const resource = readResourceBody(resourcePath, url.searchParams.get('reveal') === 'true');
    if (!resource) return sendJson(response, 404, { error: 'Resource không hợp lệ.' });
    if (resource.error) return sendJson(response, resource.status, { error: resource.error });
    return sendJson(response, 200, resource);
  }
  if (request.method === 'PUT' && url.pathname === '/api/resource') {
    try {
      const body = await parseBody(request);
      const resourcePath = String(body.path || '');
      const absolutePath = resolveResource(resourcePath);
      const editable = resourcePath === 'AI_PROMPTS.md' || resourcePath.startsWith('data/') && resourcePath.endsWith('.json');
      if (!absolutePath || !editable) return sendJson(response, 403, { error: 'Resource này không được phép chỉnh sửa.' });
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' });
      if (resourcePath.endsWith('.json')) JSON.parse(content);
      const backup = createBackup(resourcePath, absolutePath);
      fs.writeFileSync(absolutePath, content, 'utf8');
      return sendJson(response, 200, { message: 'Đã lưu thay đổi.', backup });
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message });
    }
  }
  if (request.method === 'DELETE' && url.pathname === '/api/artifact') {
    try {
      const body = await parseBody(request);
      const artifactPath = String(body.path || '');
      const type = String(body.type || '');
      const resources = listResources();
      if (type === 'evidence' && resources.evidence.includes(artifactPath)) {
        const target = safeChildPath(EVIDENCE_DIR, `/${artifactPath}`);
        if (!target || !fs.statSync(target).isFile()) throw new Error('Evidence không hợp lệ.');
        fs.unlinkSync(target);
        return sendJson(response, 200, { message: 'Đã xóa evidence.' });
      }
      if (type === 'evidence-folder') {
        const normalizedFolder = artifactPath.replace(/^\/+|\/+$/g, '');
        const containsEvidence = normalizedFolder && resources.evidence.some((item) => item.startsWith(`${normalizedFolder}/`));
        const target = containsEvidence ? safeChildPath(EVIDENCE_DIR, `/${normalizedFolder}`) : null;
        if (!target || target === EVIDENCE_DIR || !target.startsWith(`${EVIDENCE_DIR}${path.sep}`) || !fs.statSync(target).isDirectory()) throw new Error('Folder evidence không hợp lệ.');
        fs.rmSync(target, { recursive: true, force: false });
        return sendJson(response, 200, { message: 'Đã xóa folder evidence và toàn bộ ảnh bên trong.' });
      }
      if (type === 'report' && resources.reports.includes(artifactPath)) {
        const indexPath = safeChildPath(REPORT_DIR, `/${artifactPath}`);
        const reportFolder = indexPath ? path.dirname(indexPath) : null;
        const relativeFolder = reportFolder ? path.relative(REPORT_DIR, reportFolder) : '';
        if (!reportFolder || !reportFolder.startsWith(`${REPORT_DIR}${path.sep}`) || relativeFolder.split(path.sep).length < 2) throw new Error('Báo cáo không hợp lệ.');
        const deleted = countFolderArtifacts(reportFolder);
        const dateFolder = path.dirname(reportFolder);
        fs.rmSync(reportFolder, { recursive: true, force: false });
        if (dateFolder !== REPORT_DIR && fs.existsSync(dateFolder) && fs.readdirSync(dateFolder).length === 0) fs.rmdirSync(dateFolder);
        return sendJson(response, 200, { message: `Đã xóa toàn bộ folder báo cáo (${deleted.files} file, ${deleted.traceAndVideo} trace/video).` });
      }
      return sendJson(response, 404, { error: 'Artifact không tồn tại hoặc không hợp lệ.' });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, { activeRun: publicRun(activeRun), lastRun, logs: logBuffer });
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, {
      appName: APP_NAME,
      workspaceRoot: ROOT,
      port: currentPort,
      pid: process.pid,
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(': connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/run') {
    if (activeRun) return sendJson(response, 409, { error: 'Đang có một test run khác.' });
    try {
      const options = validateOptions(await parseBody(request));
      return sendJson(response, 202, startRun(options));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/ui') {
    if (activeRun) return sendJson(response, 409, { error: 'Đang có một test run hoặc UI Mode khác.' });
    try {
      const options = validateOptions(await parseBody(request));
      return sendJson(response, 202, startRun(options, true));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/stop') {
    if (!activeRun) return sendJson(response, 409, { error: 'Không có test run đang chạy.' });
    activeRun.child.kill('SIGTERM');
    return sendJson(response, 202, { message: 'Đã gửi yêu cầu dừng.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/shutdown') {
    sendJson(response, 200, { message: 'Đang tắt dashboard server...' });
    const stateFile = path.join(ROOT, '.dashboard-server.json');
    if (fs.existsSync(stateFile)) {
      try { fs.rmSync(stateFile, { force: true }); } catch (e) {}
    }
    setImmediate(shutdown);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/report/latest') {
    const report = newestReport();
    if (!report) return sendJson(response, 404, { error: 'Chưa có Playwright report.' });
    const relative = path.relative(REPORT_DIR, report).split(path.sep).map(encodeURIComponent).join('/');
    response.writeHead(302, { Location: `/reports/${relative}` });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
    const requested = decodeURIComponent(url.pathname.slice('/reports'.length));
    return serveFile(response, safeChildPath(REPORT_DIR, requested), true);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/evidence/')) {
    const requested = decodeURIComponent(url.pathname.slice('/evidence'.length));
    if (!/\.(png|jpe?g|webp)$/i.test(requested)) return sendJson(response, 404, { error: 'Evidence không hợp lệ.' });
    return serveFile(response, safeChildPath(EVIDENCE_DIR, requested), true);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/tools/')) {
    const requested = decodeURIComponent(url.pathname.slice('/tools'.length));
    return serveFile(response, safeChildPath(TOOLS_DIR, requested));
  }
  if (request.method === 'GET') {
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    return serveFile(response, safeChildPath(PUBLIC_DIR, requested));
  }
  sendJson(response, 404, { error: 'Endpoint không tồn tại.' });
});

let currentPort = Number.parseInt(process.env.DASHBOARD_PORT || '4174', 10);
const maxPortAttempts = 20;
let portAttempts = 0;
const STATE_PATH = path.join(ROOT, '.dashboard-server.json');

function tryListen(port) {
  server.listen(port, '127.0.0.1');
}

server.on('listening', () => {
  const actualPort = server.address().port;
  try {
    fs.writeFileSync(
      STATE_PATH,
      JSON.stringify({ appName: APP_NAME, workspaceRoot: ROOT, port: actualPort, pid: process.pid }, null, 2) + '\n',
      'utf8'
    );
  } catch (e) {}
  console.log(`Playwright Dashboard (${APP_NAME}): http://127.0.0.1:${actualPort}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    if (portAttempts < maxPortAttempts) {
      portAttempts += 1;
      currentPort += 1;
      console.log(`Port ${currentPort - 1} đang bận, tự động thử port tiếp theo: ${currentPort}...`);
      tryListen(currentPort);
      return;
    }
    console.error(`Không tìm được port trống sau ${maxPortAttempts} lần thử.`);
    process.exitCode = 1;
    return;
  }
  console.error(`Không thể khởi động dashboard: ${error.message}`);
  process.exitCode = 1;
});

tryListen(currentPort);

function shutdown() {
  if (activeRun?.child) activeRun.child.kill('SIGTERM');
  if (fs.existsSync(STATE_PATH)) {
    try { fs.rmSync(STATE_PATH, { force: true }); } catch (e) {}
  }
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
