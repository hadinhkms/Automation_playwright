/**
 * dashboard/services/jiraAdfParser.js
 * Atlassian Document Format (ADF) to Markdown parser and AC extractor for Jira Cloud.
 * Modularity ceiling <= 150 lines.
 */
'use strict';

const { parseJiraMarkupToMarkdown } = require('../../core/ai/tasks/jiraStoryParser');

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

module.exports = {
  adfToMarkdown,
  parseJiraDescription,
  extractAcceptanceCriteria,
};
