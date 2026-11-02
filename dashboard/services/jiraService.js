/**
 * dashboard/services/jiraService.js
 * Jira Cloud Integration Facade: kiểm tra kết nối và đọc ticket / trích xuất Acceptance Criteria.
 * Modularity ceiling <= 150 lines.
 */
'use strict';

const { extractJiraKey } = require('../../core/ai/tasks/jiraStoryParser');
const { adfToMarkdown, parseJiraDescription, extractAcceptanceCriteria } = require('./jiraAdfParser');
const {
  normalizeJiraBaseUrl,
  getJiraConfig,
  saveJiraConfig,
  resolveCredentials,
  requestJiraApi,
} = require('./jiraHttpClient');

async function testJiraConnection({ baseUrl, email, apiToken, root }) {
  const { u, e, t } = resolveCredentials({ baseUrl, email, apiToken, root });
  if (!u || !e || !t) return { success: false, status: 400, error: 'Thiếu thông tin URL, Email hoặc API Token của Jira.' };
  const normalizedUrl = normalizeJiraBaseUrl(u);
  if (!normalizedUrl) return { success: false, status: 400, error: 'Địa chỉ Jira Base URL không hợp lệ (chỉ chấp nhận http:// hoặc https://).' };
  const res = await requestJiraApi(`${normalizedUrl}/rest/api/3/myself`, { email: e, apiToken: t });
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
  const normalizedUrl = normalizeJiraBaseUrl(u);
  if (!normalizedUrl) return { success: false, status: 400, error: 'Địa chỉ Jira Base URL không hợp lệ.' };
  const q = 'summary,description,issuetype,status,priority,assignee,reporter,components,subtasks';
  const res = await requestJiraApi(`${normalizedUrl}/rest/api/3/issue/${issueKey}?fields=${q}`, { email: e, apiToken: t });
  if (!res.ok) {
    if (res.status === 404) return { success: false, status: 404, error: `Không tìm thấy ticket "${issueKey}" trên Jira (404).` };
    if (res.status === 401) return { success: false, status: 401, error: 'Token Jira không hợp lệ hoặc đã hết hạn (401).' };
    return { success: false, status: res.status, error: res.error || 'Lỗi khi đọc ticket từ Jira.' };
  }
  const f = res.data.fields || {};
  const descriptionMarkdown = parseJiraDescription(f.description);
  const acs = extractAcceptanceCriteria(descriptionMarkdown);
  const jiraUrl = `${normalizedUrl}/browse/${issueKey}`;
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
