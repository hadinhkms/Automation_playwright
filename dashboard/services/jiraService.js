/**
 * dashboard/services/jiraService.js
 * Jira Cloud Integration Service. Handles credentials, connection testing, and issue fetching.
 * Modularity ceiling <= 200 lines.
 */
const https = require('node:https');
const http = require('node:http');
const path = require('node:path');
const { parseEnvFile, writeEnvFile } = require('../routes/aiRoutes');
const { extractJiraKey, parseJiraMarkupToMarkdown } = require('../../core/ai/tasks/jiraStoryParser');

function adfToMarkdown(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  const type = node.type || '';
  const content = Array.isArray(node.content) ? node.content.map(adfToMarkdown).join('') : '';

  if (type === 'text') {
    let text = node.text || '';
    if (Array.isArray(node.marks)) {
      for (const m of node.marks) {
        if (m.type === 'strong') text = `**${text}**`;
        else if (m.type === 'em') text = `*${text}*`;
        else if (m.type === 'code') text = `\`${text}\``;
        else if (m.type === 'strike') text = `~~${text}~~`;
        else if (m.type === 'link') text = `[${text}](${m.attrs?.href || ''})`;
      }
    }
    return text;
  }
  if (type === 'paragraph') return `${content}\n\n`;
  if (type === 'heading') return `${'#'.repeat(node.attrs?.level || 2)} ${content}\n\n`;
  if (type === 'bulletList' || type === 'orderedList') return `${content}\n`;
  if (type === 'listItem') return `- ${content.trim()}\n`;
  if (type === 'codeBlock') return `\`\`\`${node.attrs?.language || ''}\n${content}\n\`\`\`\n\n`;
  if (type === 'blockquote') return `> ${content.trim()}\n\n`;
  if (type === 'table') return `\n${content}\n`;
  if (type === 'tableRow') return `| ${content.trim()} |\n`;
  if (type === 'tableHeader' || type === 'tableCell') return `${content.trim()} | `;
  return content;
}

function parseJiraDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'object' && desc.type === 'doc') return adfToMarkdown(desc).trim();
  return parseJiraMarkupToMarkdown(String(desc)).trim();
}

function extractAcceptanceCriteria(markdownText) {
  if (!markdownText) return [];
  const lines = markdownText.split('\n');
  const acs = [];
  let inAcSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:#+\s*)?(?:Acceptance Criteria|Tiêu chí nghiệm thu|AC|Điều kiện nghiệm thu)/i.test(trimmed)) {
      inAcSection = true;
      continue;
    }
    if (inAcSection && /^#+\s+/.test(trimmed)) inAcSection = false;
    if (inAcSection && /^[-*]\s+|\d+\.\s+/.test(trimmed)) {
      const cleanAc = trimmed.replace(/^[-*]\s+|\d+\.\s+/, '').trim();
      if (cleanAc) acs.push(cleanAc);
    }
  }
  return acs;
}

function getJiraConfig(root) {
  const env = parseEnvFile(path.join(root, '.env'));
  const baseUrl = env.JIRA_BASE_URL || process.env.JIRA_BASE_URL || 'https://sieuviet.atlassian.net';
  const email = env.JIRA_EMAIL || process.env.JIRA_EMAIL || '';
  const token = env.JIRA_API_TOKEN || process.env.JIRA_API_TOKEN || '';
  return { baseUrl, email, hasToken: Boolean(token), maskedToken: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '' };
}

function saveJiraConfig(root, { baseUrl, email, apiToken }) {
  const envPath = path.join(root, '.env');
  const current = parseEnvFile(envPath);
  if (baseUrl) current.JIRA_BASE_URL = baseUrl.trim().replace(/\/$/, '');
  if (email !== undefined) current.JIRA_EMAIL = email.trim();
  if (apiToken && !apiToken.includes('...')) current.JIRA_API_TOKEN = apiToken.trim();
  writeEnvFile(envPath, current);
  ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].forEach((k) => { if (current[k]) process.env[k] = current[k]; });
  return getJiraConfig(root);
}

function resolveCredentials({ baseUrl, email, apiToken, root }) {
  let u = baseUrl, e = email, t = apiToken;
  if (root) {
    const conf = parseEnvFile(path.join(root, '.env'));
    if (u === undefined) u = conf.JIRA_BASE_URL || process.env.JIRA_BASE_URL || 'https://sieuviet.atlassian.net';
    if (e === undefined) e = conf.JIRA_EMAIL || process.env.JIRA_EMAIL;
    if (t === undefined) t = conf.JIRA_API_TOKEN || process.env.JIRA_API_TOKEN;
  }
  return { u, e, t };
}

function requestJiraApi(urlStr, { email, apiToken, timeout = 10000 }) {
  return new Promise((resolve) => {
    const urlObj = new URL(urlStr);
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
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = raw ? JSON.parse(raw) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, data: json });
          } else {
            const errMsg = json.errorMessages?.join(', ') || json.message || `HTTP ${res.statusCode} ${res.statusMessage}`;
            resolve({ ok: false, status: res.statusCode, error: errMsg });
          }
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, error: `Lỗi parse response: ${e.message}` });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 500, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 408, error: 'Kết nối tới Jira bị timeout (10s).' });
    });
    req.end();
  });
}

async function testJiraConnection({ baseUrl, email, apiToken, root }) {
  const { u, e, t } = resolveCredentials({ baseUrl, email, apiToken, root });
  if (!u || !e || !t) return { success: false, status: 400, error: 'Thiếu thông tin URL, Email hoặc API Token của Jira.' };
  const res = await requestJiraApi(`${u.replace(/\/$/, '')}/rest/api/3/myself`, { email: e, apiToken: t });
  if (!res.ok) {
    const error = res.status === 401 ? 'Xác thực thất bại (401). Kiểm tra lại Email và API Token.' : (res.error || 'Lỗi kết nối.');
    return { success: false, status: res.status, error };
  }
  return {
    success: true,
    displayName: res.data.displayName,
    emailAddress: res.data.emailAddress,
    timeZone: res.data.timeZone,
    active: res.data.active,
  };
}

async function fetchJiraIssue(keyOrUrl, { baseUrl, email, apiToken, root } = {}) {
  const issueKey = extractJiraKey(keyOrUrl);
  if (!issueKey) {
    return { success: false, status: 400, error: `Không nhận diện được mã Jira hợp lệ từ "${keyOrUrl}". (Ví dụ hợp lệ: JS-8824)` };
  }
  const { u, e, t } = resolveCredentials({ baseUrl, email, apiToken, root });
  if (!u || !e || !t) return { success: false, status: 400, error: 'Chưa cấu hình Jira API Token hoặc Email trong Settings.' };
  const q = 'summary,description,issuetype,status,priority,assignee,reporter,components,subtasks';
  const res = await requestJiraApi(`${u.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}?fields=${q}`, { email: e, apiToken: t });
  if (!res.ok) {
    if (res.status === 404) return { success: false, status: 404, error: `Không tìm thấy ticket "${issueKey}" trên Jira (404).` };
    if (res.status === 401) return { success: false, status: 401, error: 'Token Jira không hợp lệ hoặc đã hết hạn (401).' };
    return { success: false, status: res.status, error: res.error || 'Lỗi khi đọc ticket từ Jira.' };
  }
  const f = res.data.fields || {};
  const descriptionMarkdown = parseJiraDescription(f.description);
  const acs = extractAcceptanceCriteria(descriptionMarkdown);
  const jiraUrl = `${u.replace(/\/$/, '')}/browse/${issueKey}`;
  const formattedForReq = [
    `# [${issueKey}] ${f.summary || ''}`,
    `Source: ${jiraUrl}`,
    `Type: ${f.issuetype?.name || 'Story'} | Status: ${f.status?.name || 'Open'} | Priority: ${f.priority?.name || 'Medium'}`,
    f.assignee ? `Assignee: ${f.assignee.displayName}` : null,
    '',
    '## Mô tả (Description)',
    descriptionMarkdown || '*(Không có mô tả)*',
  ].filter(Boolean).join('\n');

  return {
    success: true, key: issueKey, url: jiraUrl, summary: f.summary || '',
    issueType: f.issuetype?.name || 'Story', status: f.status?.name || 'Open',
    priority: f.priority?.name || 'Medium', assignee: f.assignee?.displayName || 'Unassigned',
    descriptionMarkdown, acs, formattedForReq,
  };
}

module.exports = {
  adfToMarkdown,
  parseJiraDescription,
  extractAcceptanceCriteria,
  getJiraConfig,
  saveJiraConfig,
  testJiraConnection,
  fetchJiraIssue,
};
