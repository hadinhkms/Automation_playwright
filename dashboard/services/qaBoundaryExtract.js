/**
 * qaBoundaryExtract.js - Trích xuất ràng buộc giá trị biên từ văn bản đặc tả yêu cầu.
 * Thuần thuật toán xác định (0 token AI), tuân thủ quy chuẩn Master Process PLAN-19b.
 */

const BLOCKED_PATTERNS = [
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, // ngày dd/mm/yyyy
  /\b\d{1,2}:\d{2}\b/, // giờ hh:mm
  /\b\d+,\d+\b/, // số thập phân (0,5)
  /\b\d+\.\d{1,2}\b(?!\d)/, // số thập phân (2.5)
  /(?:^|[^\p{L}\p{N}])(?:triệu|nghìn|ngàn|tỷ|đồng|vnđ|vnd|usd|\$)(?:[^\p{L}\p{N}]|$)/iu,
  /(?:^|[^\p{L}\p{N}])(?:ngày|tháng|năm|quý|tuần|phiên\s+bản|version|v)\s*\d+/iu
];

const REVIEW_KEYWORDS = /(?:^|[^\p{L}\p{N}])(?:báo\s+lỗi|bị\s+chặn|không\s+hợp\s+lệ|không\s+cho\s+phép|từ\s+chối|error|reject|invalid)(?:[^\p{L}\p{N}]|$)/iu;

function cleanField(raw) {
  let f = (raw || '').trim().replace(/^[-*•\d.)\s]+/, '').replace(/^[,;:\s]+/, '').replace(/[,;:\s]+$/, '');
  const tailWords = /\s+(?:phải|có|là|có\s+độ\s+dài|độ\s+dài|dài|được|chỉ|cho\s+phép\s+chọn|cho\s+phép|chọn|(?<!đăng\s)(?<!lần\s)nhập|gồm|không\s+được|must\s+be|must|should\s+be|should|be|is)\b/gi;
  let prev;
  do {
    prev = f;
    f = f.replace(tailWords, '').replace(/[,;:\s]+$/, '');
  } while (f !== prev);
  f = f.trim();
  return f.length > 0 ? (f.charAt(0).toUpperCase() + f.slice(1)) : f;
}

function detectKindAndUnit(afterText, fullText) {
  const combined = afterText || fullText || '';
  if (/(?:^|[^\p{L}\p{N}])(?:chữ\s+số|digits?)(?:[^\p{L}\p{N}]|$)/iu.test(combined)) {
    return { kind: 'length', unit: 'chữ số' };
  }
  if (/(?:^|[^\p{L}\p{N}])(?:ký\s+tự|characters?)(?:[^\p{L}\p{N}]|$)/iu.test(combined)) {
    const m = combined.match(/(characters?|ký\s+tự)/iu);
    return { kind: 'length', unit: m ? m[0].toLowerCase() : 'ký tự' };
  }
  const numMatch = (afterText || '').match(/(?:^|[^\p{L}\p{N}])(tuổi|mục|ảnh|file|tệp|lần|người|giây|phút|giờ|ngày|sản\s+phẩm|items?)(?:[^\p{L}\p{N}]|$)/iu);
  return numMatch ? { kind: 'number', unit: numMatch[1].toLowerCase() } : { kind: 'number', unit: null };
}

function extractSingleClause(text, lineNo, needsReview, originalSentence) {
  let m = text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:từ|trong\s+khoảng|between)\s+(\d+)\s*(?:đến|tới|and|-)\s*(\d+)(.*)/iu) ||
          text.match(/(.*?)(?:^|[^\p{L}\p{N}])(\d+)\s*-\s*(\d+)(.*)/) ||
          text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:tối\s+thiểu|ít\s+nhất|>=\s*)\s*(\d+).*?và\s*(?:tối\s+đa|<=\s*)\s*(\d+)(.*)/iu);

  if (!m) {
    const mExact = text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:gồm\s+đúng|đúng|gồm)\s+(\d+)(.*)/iu);
    if (mExact) {
      const field = cleanField(mExact[1]);
      const ku = detectKindAndUnit(mExact[3] || '', text);
      const val = parseInt(mExact[2], 10);
      return {
        constraint: {
          field, kind: ku.kind, unit: ku.unit, min: val, max: val,
          implicitMin: false, needsReview, source: { line: lineNo, text: originalSentence }
        }
      };
    }
  }

  if (m && m[2] !== undefined && m[3] !== undefined) {
    const field = cleanField(m[1]);
    const ku = detectKindAndUnit(m[4] || '', text);
    return {
      constraint: {
        field, kind: ku.kind, unit: ku.unit, min: parseInt(m[2], 10), max: parseInt(m[3], 10),
        implicitMin: false, needsReview, source: { line: lineNo, text: originalSentence }
      }
    };
  }

  m = text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:lớn\s+hơn|phải\s+lớn\s+hơn|greater\s+than|trên)\s+(\d+)(.*)/iu);
  if (m) {
    const ku = detectKindAndUnit(m[3] || '', text);
    return {
      constraint: {
        field: cleanField(m[1]), kind: ku.kind, unit: ku.unit, min: parseInt(m[2], 10) + 1, max: null,
        implicitMin: false, needsReview, source: { line: lineNo, text: originalSentence }
      }
    };
  }

  m = text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:nhỏ\s+hơn|phải\s+nhỏ\s+hơn|less\s+than|dưới)\s+(\d+)(.*)/iu);
  if (m) {
    const ku = detectKindAndUnit(m[3] || '', text);
    return {
      constraint: {
        field: cleanField(m[1]), kind: ku.kind, unit: ku.unit, min: null, max: parseInt(m[2], 10) - 1,
        implicitMin: ku.kind === 'length', needsReview, source: { line: lineNo, text: originalSentence }
      }
    };
  }

  m = text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:tối\s+thiểu|ít\s+nhất|at\s+least|>=\s*)\s*:?\s*(\d+)(.*)/iu) ||
      text.match(/(.*?)(?:^|[^\p{L}\p{N}])từ\s+(\d+)\s*(.*?)\s*trở\s+lên(.*)/iu);
  if (m) {
    const after = (m[4] !== undefined ? (m[3] + ' ' + m[4]) : (m[3] || ''));
    const ku = detectKindAndUnit(after, text);
    return {
      constraint: {
        field: cleanField(m[1]), kind: ku.kind, unit: ku.unit, min: parseInt(m[2], 10), max: null,
        implicitMin: false, needsReview, source: { line: lineNo, text: originalSentence }
      }
    };
  }

  m = text.match(/(.*?)(?:^|[^\p{L}\p{N}])(?:tối\s+đa|không\s+vượt\s+quá|không\s+quá|không\s+nhiều\s+hơn|không\s+được\s+dài\s+hơn|at\s+most|<=\s*)\s*:?\s*(\d+)(.*)/iu) ||
      text.match(/(.*?)(?:^|[^\p{L}\p{N}])từ\s+(\d+)\s*(.*?)\s*trở\s+xuống(.*)/iu);
  if (m) {
    const after = (m[4] !== undefined ? (m[3] + ' ' + m[4]) : (m[3] || ''));
    const ku = detectKindAndUnit(after, text);
    return {
      constraint: {
        field: cleanField(m[1]), kind: ku.kind, unit: ku.unit, min: null, max: parseInt(m[2], 10),
        implicitMin: ku.kind === 'length', needsReview, source: { line: lineNo, text: originalSentence }
      }
    };
  }

  return { unrecognized: /\d/.test(text) };
}

function extractConstraints(text) {
  if (!text || typeof text !== 'string') return { constraints: [], unrecognized: [] };
  const rawLines = text.normalize('NFC').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[–—]/g, '-').split(/\r?\n/);
  const constraints = [];
  const unrecognized = [];

  rawLines.forEach((rawLine, lineIdx) => {
    const lineNo = lineIdx + 1;
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) return;

    const sentences = trimmedLine.split(/(?<=[;!?]|(?<!\d)\.(?!\d))(?:\s+|$)/).filter(Boolean);
    for (const rawSent of sentences) {
      const sentence = rawSent.trim();
      if (!sentence) continue;

      if (BLOCKED_PATTERNS.some((pat) => pat.test(sentence))) {
        if (/\d/.test(sentence)) unrecognized.push({ line: lineNo, text: sentence });
        continue;
      }

      const normalizedS = sentence.replace(/\b(\d{1,3})[.,](\d{3})\b/g, (match, a, b) => a + b);
      const needsReview = REVIEW_KEYWORDS.test(normalizedS);
      const clauses = normalizedS.split(/,\s*(?=[A-ZÀ-Ỹa-zà-ỹ].*?\d)/);
      let matchedAny = false;

      for (const clause of clauses) {
        const res = extractSingleClause(clause, lineNo, needsReview, sentence);
        if (res.constraint) {
          constraints.push(res.constraint);
          matchedAny = true;
        }
      }

      if (!matchedAny && /\d/.test(sentence)) {
        unrecognized.push({ line: lineNo, text: sentence });
      }
    }
  });

  constraints.forEach((c, idx) => {
    c.id = 'B-' + String(idx + 1).padStart(2, '0');
  });

  return { constraints, unrecognized };
}

module.exports = {
  extractConstraints,
  cleanField,
  detectKindAndUnit
};
