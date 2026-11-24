'use strict';

/**
 * core/generator/objectRepository/classDeclaration.js
 * Tìm khai báo `class X extends Y` THẬT của một file Page Object.
 * Bỏ comment trước khi quét (JSDoc kiểu "Base class for ..." từng bị bắt thành class "for"),
 * giữ nguyên nội dung chuỗi/template để `//` trong URL không bị coi là comment.
 */

function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i += 1;
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      out += ' ';
    } else if (ch === '\'' || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < n && source[j] !== ch) {
        if (source[j] === '\\') j += 1;
        else if (ch !== '`' && source[j] === '\n') break;
        j += 1;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

const DECLARATION = /(?:^|[\n;{}=])\s*(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?/;

/** @returns {{ className: string, baseClass: string|null } | null} */
function findClassDeclaration(source) {
  const match = stripComments(String(source || '')).match(DECLARATION);
  return match ? { className: match[1], baseClass: match[2] || null } : null;
}

module.exports = { findClassDeclaration, stripComments };
