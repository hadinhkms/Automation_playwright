/**
 * dashboard/services/jiraHttpClient.js
 * Cấu hình .env an toàn, chuẩn hoá URL cùng origin và HTTP/HTTPS client cho Jira Cloud REST API v3.
 * Modularity ceiling <= 150 lines.
 */
'use strict';

const https = require('node:https');
const http = require('node:http');
const path = require('node:path');
const { parseEnvFile, writeEnvFile } = require('../routes/aiRoutes');

const DEFAULT_JIRA_URL = 'https://sieuviet.atlassian.net';
const MAX_JIRA_RESPONSE_BYTES = 5 * 1024 * 1024;

function assertSafeEnvValue(value, label) {
  if (/[\r\n\0]/.test(String(value || ''))) {
    throw new Error(`${label} chứa ký tự điều khiển không hợp lệ.`);
  }
}

function normalizeJiraBaseUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  assertSafeEnvValue(trimmed, 'JIRA_BASE_URL');
  let parsed;
  try { parsed = new URL(trimmed); } catch { return null; }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${cleanPath}`;
}

function sameHttpOrigin(urlA, urlB) {
  try {
    return new URL(String(urlA || '').trim()).origin.toLowerCase() === new URL(String(urlB || '').trim()).origin.toLowerCase();
  } catch { return false; }
}

function getJiraConfig(root) {
  const env = root ? parseEnvFile(path.join(root, '.env')) : {};
  const baseUrl = env.JIRA_BASE_URL || process.env.JIRA_BASE_URL || DEFAULT_JIRA_URL;
  const email = env.JIRA_EMAIL || process.env.JIRA_EMAIL || '';
  const token = env.JIRA_API_TOKEN || process.env.JIRA_API_TOKEN || '';
  const maskedToken = token ? (token.length > 10 ? `${token.slice(0, 6)}...${token.slice(-4)}` : '******') : '';
  return { baseUrl, email, hasToken: Boolean(token), maskedToken };
}

function saveJiraConfig(root, { baseUrl, email, apiToken }) {
  const envPath = path.join(root, '.env');
  const current = parseEnvFile(envPath);
  if (baseUrl !== undefined && String(baseUrl).trim() !== '') {
    const normalized = normalizeJiraBaseUrl(baseUrl);
    if (!normalized) throw new Error('Địa chỉ Jira Base URL không hợp lệ (chỉ chấp nhận http:// hoặc https:// không kèm query/hash/credentials).');
    current.JIRA_BASE_URL = normalized;
  }
  if (email !== undefined) {
    assertSafeEnvValue(email, 'JIRA_EMAIL');
    current.JIRA_EMAIL = String(email).trim();
  }
  if (apiToken && !String(apiToken).includes('...')) {
    assertSafeEnvValue(apiToken, 'JIRA_API_TOKEN');
    current.JIRA_API_TOKEN = String(apiToken).trim();
  }
  writeEnvFile(envPath, current);
  return getJiraConfig(root);
}

function resolveCredentials({ baseUrl, email, apiToken, root }) {
  const conf = root ? parseEnvFile(path.join(root, '.env')) : {};
  const savedUrl = conf.JIRA_BASE_URL || process.env.JIRA_BASE_URL || DEFAULT_JIRA_URL;
  const savedEmail = conf.JIRA_EMAIL || process.env.JIRA_EMAIL || '';
  const savedToken = conf.JIRA_API_TOKEN || process.env.JIRA_API_TOKEN || '';

  const u = baseUrl === undefined ? savedUrl : String(baseUrl || '').trim();
  const e = email === undefined ? savedEmail : String(email || '').trim();
  let t = apiToken === undefined ? savedToken : String(apiToken || '').trim();
  if ((!t || t.includes('...')) && u && e && savedToken && sameHttpOrigin(u, savedUrl)) t = savedToken;
  return { u, e, t };
}

function requestJiraApi(urlStr, { email, apiToken, timeout = 10000 }) {
  return new Promise((resolve) => {
    let urlObj;
    try { urlObj = new URL(urlStr); } catch {
      resolve({ ok: false, status: 400, error: 'Địa chỉ Jira Base URL không hợp lệ.' });
      return;
    }
    const client = urlObj.protocol === 'https:' ? https : http;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const req = client.request(urlObj, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'User-Agent': 'Automation-Dashboard-Jira-Service/1.0',
      },
      timeout,
    }, (res) => {
      let raw = '';
      let bytes = 0;
      let aborted = false;
      res.on('data', (chunk) => {
        if (aborted) return;
        bytes += Buffer.byteLength(chunk);
        if (bytes > MAX_JIRA_RESPONSE_BYTES) {
          aborted = true;
          req.destroy();
          resolve({ ok: false, status: 413, error: 'Phản hồi từ Jira vượt quá giới hạn 5 MB.' });
          return;
        }
        raw += chunk;
      });
      res.on('end', () => {
        if (aborted) return;
        try {
          const json = raw ? JSON.parse(raw) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, data: json });
          } else {
            const errMsg = json.errorMessages?.join(', ') || json.message || `HTTP ${res.statusCode} ${res.statusMessage}`;
            resolve({ ok: false, status: res.statusCode, error: errMsg });
          }
        } catch (err) {
          resolve({ ok: false, status: res.statusCode || 502, error: `Lỗi parse response: ${err.message}` });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 502, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 408, error: 'Kết nối tới Jira bị timeout (10s).' }); });
    req.end();
  });
}

module.exports = {
  normalizeJiraBaseUrl,
  getJiraConfig,
  saveJiraConfig,
  resolveCredentials,
  requestJiraApi,
};
