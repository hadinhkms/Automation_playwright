'use strict';

const SENSITIVE_HEADER_NAME = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/i;
const SENSITIVE_KEY_PART = /(token|secret|password|passwd|api[-_]?key|session|sid)/i;
const SENSITIVE_QUERY_PARAM =
  /([?&](?:token|access_token|refresh_token|api_key|apikey|password|secret|auth|key|session|sid)=)([^&#\s]+)/gi;
const SENSITIVE_AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;

function redactSensitiveText(input) {
  if (!input) return input;
  return String(input)
    .replace(SENSITIVE_QUERY_PARAM, '$1[REDACTED]')
    .replace(SENSITIVE_AUTH_SCHEME, '$1 [REDACTED]');
}

function redactHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAME.test(key) || SENSITIVE_KEY_PART.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSensitiveText(value);
    }
  }
  return out;
}

function matchesAllowRule(record, rule) {
  if (rule.source !== '*' && rule.source !== record.source) return false;
  if (rule.status !== undefined && rule.status !== record.status) return false;
  const haystacks = [record.message, record.url ?? ''];
  const { pattern } = rule;
  return typeof pattern === 'string'
    ? haystacks.some((h) => h.includes(pattern))
    : haystacks.some((h) => pattern.test(h));
}

function isBenignAbortedSubresource(url, resourceType, errorText) {
  if (resourceType === 'document' || resourceType === 'xhr' || resourceType === 'fetch') {
    return false;
  }
  if (url.endsWith('/favicon.ico')) return true;
  return /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(errorText);
}

module.exports = {
  redactSensitiveText,
  redactHeaders,
  matchesAllowRule,
  isBenignAbortedSubresource,
};

