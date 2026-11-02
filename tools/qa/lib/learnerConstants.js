'use strict';
/**
 * Hằng số cấu hình, enum danh mục, bảng ánh xạ rule tĩnh và lớp lỗi chuẩn cho Learner Engine.
 */

const SCHEMA_VERSION = '1.0.0';
const POLICY_VERSION = '1.2.0';
const STOPWORDS_VERSION = '1.0.0';
const STATIC_MAPPING_VERSION = '1.0.0';
const MAX_CATALOG_ENTRIES = 25;
const MAX_EFFECTIVE_BEFORE_DEDUP = 50;
const MAX_TITLE_LENGTH = 120;
const MAX_FIELD_LENGTH = 500;
const MAX_PROVENANCE_PER_ENTRY = 5;
const MAX_EXCERPT_LENGTH = 300;
const MAX_DIFF_BYTES = 8 * 1024 * 1024; // 8 MiB
const MAX_SIGNALS = 1000;
const GIT_TIMEOUT_MS = 15000;
const JACCARD_THRESHOLD = 0.65;

const SHARED_DEFECT_REL = '.agents/skills/qa-logic-gaps/references/defect-heuristics-catalog.md';
const SHARED_ANTIPATTERN_REL = '.agents/skills/qa-logic-gaps/references/playwright-antipatterns-catalog.md';
const SHARED_POLICY_REL = '.agents/skills/qa-logic-gaps/references/SELECTIVE-LEARNING-POLICY.md';

const VALID_CATEGORIES = {
  DH: new Set([
    'State & Concurrency',
    'Data & BVA',
    'Security & Access',
    'Resilience & Recovery',
  ]),
  PA: new Set([
    'Superficial Assertion',
    'Async & Timing',
    'Parallel Isolation',
    'Selector Fragility',
    'Negative Side Effects',
  ]),
};

const REQUIRED_FIELDS = ['Category', 'Trigger', 'Failure Mode', 'Actionable Check'];

const STATIC_RULE_MAPPING = [
  {
    findingKind: 'assertion-thieu-await',
    coverage: 'full',
    targetCatalog: 'antipattern',
    description: 'expect(...) trên matcher bất đồng bộ thiếu await/return',
  },
  {
    findingKind: 'spec-thieu-assertion',
    coverage: 'full',
    targetCatalog: 'antipattern',
    description: 'Test block có 0 lệnh expect(...)',
  },
  {
    findingKind: 'spec-chi-assert-url',
    relatedEntryId: 'PA-01',
    coverage: 'partial',
    targetCatalog: 'antipattern',
    description: 'Test chỉ assert toHaveURL/toHaveTitle, phần đối chiếu kết quả nghiệp vụ thuộc semantic audit',
  },
  {
    findingKind: 'weak-existence-assertion',
    relatedEntryId: 'PA-04',
    coverage: 'partial',
    targetCatalog: 'antipattern',
    description: 'Test chỉ dùng toBeDefined/toBeTruthy yếu, thiếu đối chiếu giá trị hoặc trạng thái cụ thể',
  },
  {
    findingKind: 'missing-idempotency-guard',
    relatedEntryId: 'DH-01',
    coverage: 'partial',
    targetCatalog: 'defect',
    description: 'Test kịch bản chống bấm đúp/idempotency nhưng thiếu expectIdempotentSubmit',
  },
];

const STOPWORDS_EN_VI = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'not', 'are',
  'was', 'were', 'will', 'would', 'should', 'could', 'can', 'may', 'into', 'when', 'where',
  'which', 'while', 'after', 'before', 'under', 'over', 'between', 'through', 'during',
  'without', 'within', 'only', 'also', 'than', 'then', 'there', 'their', 'they', 'them',
  'these', 'those', 'some', 'such', 'each', 'every', 'other', 'more', 'most', 'very',
  'just', 'about', 'above', 'below', 'does', 'did', 'done', 'make', 'made', 'using', 'used',
  'của', 'và', 'các', 'có', 'được', 'trong', 'cho', 'với', 'không', 'khi', 'này', 'đó',
  'để', 'những', 'một', 'như', 'là', 'thì', 'mà', 'ở', 'tại', 'về', 'theo', 'từ', 'đến',
  'hoặc', 'nhưng', 'nếu', 'vì', 'do', 'bị', 'đã', 'đang', 'sẽ', 'cần', 'phải', 'trên',
  'dưới', 'giữa', 'sau', 'trước', 'ngoài', 'ra', 'vào', 'lên', 'xuống', 'cùng', 'vẫn',
  'chỉ', 'cũng', 'rất', 'quá', 'hơn', 'nhất', 'mọi', 'mỗi', 'bất', 'kỳ', 'nào', 'việc',
]);

class LearnerError extends Error {
  constructor(message, code = 'LEARNER_ERROR', details = null) {
    super(message);
    this.name = 'LearnerError';
    this.code = code;
    if (details) this.details = details;
  }
}

function normalizeCatalogType(type) {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'DH' || t === 'DEFECT' || t === 'DEFECTS') return { prefix: 'DH', targetCatalog: 'defect' };
  if (t === 'PA' || t === 'ANTIPATTERN' || t === 'ANTIPATTERNS') {
    return { prefix: 'PA', targetCatalog: 'antipattern' };
  }
  throw new LearnerError(
    `Loại catalog không hợp lệ: "${type}" (chỉ nhận DH/defect hoặc PA/antipattern)`,
    'INVALID_CATALOG_TYPE',
  );
}

module.exports = {
  SCHEMA_VERSION,
  POLICY_VERSION,
  STOPWORDS_VERSION,
  STATIC_MAPPING_VERSION,
  MAX_CATALOG_ENTRIES,
  MAX_EFFECTIVE_BEFORE_DEDUP,
  MAX_TITLE_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_PROVENANCE_PER_ENTRY,
  MAX_EXCERPT_LENGTH,
  MAX_DIFF_BYTES,
  MAX_SIGNALS,
  GIT_TIMEOUT_MS,
  JACCARD_THRESHOLD,
  SHARED_DEFECT_REL,
  SHARED_ANTIPATTERN_REL,
  SHARED_POLICY_REL,
  VALID_CATEGORIES,
  REQUIRED_FIELDS,
  STATIC_RULE_MAPPING,
  STOPWORDS_EN_VI,
  LearnerError,
  normalizeCatalogType,
};

