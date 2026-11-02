/**
 * dashboard/services/jiraAdfParser.js
 * Atlassian Document Format (ADF) to Markdown parser and AC extractor for Jira Cloud.
 * Modularity ceiling <= 150 lines.
 */
'use strict';

const { parseJiraMarkupToMarkdown } = require('../../core/ai/tasks/jiraStoryParser');

function renderTable(node) {
  const rows = Array.isArray(node.content) ? node.content.filter((r) => r && r.type === 'tableRow') : [];
  if (!rows.length) return '';
  const mdRows = [];
  rows.forEach((row, rIdx) => {
    const cells = Array.isArray(row.content) ? row.content : [];
    const values = cells.map((cell) => adfToMarkdown(cell).replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|').trim());
    mdRows.push(`| ${values.join(' | ')} |`);
    if (rIdx === 0) {
      mdRows.push(`| ${values.map(() => '---').join(' | ')} |`);
    }
  });
  return `\n${mdRows.join('\n')}\n\n`;
}

function adfToMarkdown(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  const type = node.type || '';

  if (type === 'hardBreak') return '\n';
  if (type === 'rule') return '\n---\n\n';
  if (type === 'inlineCard' || type === 'blockCard') {
    const url = node.attrs?.url || '';
    return url ? `[${url}](${url})` : '';
  }
  if (type === 'mention') return node.attrs?.text || `@${node.attrs?.id || 'user'}`;
  if (type === 'status') return `[${node.attrs?.text || ''}]`;
  if (type === 'emoji') return node.attrs?.text || node.attrs?.shortName || '';
  if (type === 'table') return renderTable(node);

  if (type === 'orderedList') {
    const items = Array.isArray(node.content) ? node.content : [];
    const start = Number(node.attrs?.order) || 1;
    return `${items.map((item, idx) => `${start + idx}. ${adfToMarkdown(item).replace(/^- /, '').trim()}`).join('\n')}\n\n`;
  }

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
  if (type === 'bulletList') return `${content}\n`;
  if (type === 'listItem') return `- ${content.trim()}\n`;
  if (type === 'codeBlock') return `\`\`\`${node.attrs?.language || ''}\n${content}\n\`\`\`\n\n`;
  if (type === 'blockquote' || type === 'panel') {
    const lines = content.trim().split('\n').map((l) => `> ${l}`).join('\n');
    return `${lines}\n\n`;
  }
  if (type === 'tableHeader' || type === 'tableCell') return content.trim();
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
    if (/^(?:#+\s*)?(?:Acceptance Criteria|Tiêu chí nghiệm thu|AC|Điều kiện nghiệm thu)\b/i.test(trimmed)) {
      inAcSection = true;
      continue;
    }
    if (inAcSection && /^#+\s+/.test(trimmed)) inAcSection = false;
    if (inAcSection && /^(?:[-*]|\d+\.)\s+/.test(trimmed)) {
      const cleanAc = trimmed.replace(/^(?:[-*]|\d+\.)\s+/, '').trim();
      if (cleanAc) acs.push(cleanAc);
    }
  }
  return acs;
}

module.exports = {
  adfToMarkdown,
  parseJiraDescription,
  extractAcceptanceCriteria,
};
