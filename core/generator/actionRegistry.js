const ACTION_TYPES = {
  GOTO: 'goto',
  CLICK: 'click',
  FILL: 'fill',
  SELECT: 'select',
  CHECK: 'check',
  UNCHECK: 'uncheck',
  UPLOAD: 'upload',
  ASSERTION: 'assertion',
  CUSTOM: 'custom',
};

const ASSERTION_TYPES = {
  TO_BE_VISIBLE: 'toBeVisible',
  TO_BE_HIDDEN: 'toBeHidden',
  TO_HAVE_TEXT: 'toHaveText',
  TO_CONTAIN_TEXT: 'toContainText',
  TO_HAVE_VALUE: 'toHaveValue',
  TO_HAVE_URL: 'toHaveURL',
  TO_BE_ENABLED: 'toBeEnabled',
  TO_BE_DISABLED: 'toBeDisabled',
};

const ASSERTION_DEFINITIONS = Object.freeze([
  { type: ASSERTION_TYPES.TO_BE_VISIBLE, label: 'Phần tử đang hiển thị', target: 'locator', requiresValue: false },
  { type: ASSERTION_TYPES.TO_BE_HIDDEN, label: 'Phần tử bị ẩn', target: 'locator', requiresValue: false },
  { type: ASSERTION_TYPES.TO_HAVE_TEXT, label: 'Khớp chính xác văn bản', target: 'locator', requiresValue: true },
  { type: ASSERTION_TYPES.TO_CONTAIN_TEXT, label: 'Chứa đoạn văn bản', target: 'locator', requiresValue: true },
  { type: ASSERTION_TYPES.TO_HAVE_VALUE, label: 'Ô nhập chứa giá trị', target: 'locator', requiresValue: true },
  { type: ASSERTION_TYPES.TO_HAVE_URL, label: 'URL khớp giá trị', target: 'page', requiresValue: true },
  { type: ASSERTION_TYPES.TO_BE_ENABLED, label: 'Đang kích hoạt', target: 'locator', requiresValue: false },
  { type: ASSERTION_TYPES.TO_BE_DISABLED, label: 'Bị vô hiệu hóa', target: 'locator', requiresValue: false },
]);

function getAssertionDefinition(type) {
  return ASSERTION_DEFINITIONS.find((definition) => definition.type === type) || null;
}

const ACTION_DEFINITIONS = [
  {
    type: 'goto',
    label: 'Điều hướng đến trang (Navigate)',
    category: 'navigation',
    icon: 'ph-globe',
    params: [{ name: 'url', label: 'URL / Đường dẫn', type: 'text', placeholder: 'https://vieclam24h.vn/...' }],
  },
  {
    type: 'click',
    label: 'Bấm chuột (Click)',
    category: 'interaction',
    icon: 'ph-cursor-click',
    params: [{ name: 'locator', label: 'Phần tử (Locator)', type: 'locator', required: true }],
  },
  {
    type: 'fill',
    label: 'Nhập văn bản (Type / Fill)',
    category: 'interaction',
    icon: 'ph-textbox',
    params: [
      { name: 'locator', label: 'Ô nhập liệu (Locator)', type: 'locator', required: true },
      { name: 'value', label: 'Nội dung nhập', type: 'text', placeholder: 'Dữ liệu hoặc {{biến}}' },
    ],
  },
  {
    type: 'select',
    label: 'Chọn mục danh sách (Select Option)',
    category: 'interaction',
    icon: 'ph-list-dashes',
    params: [
      { name: 'locator', label: 'Dropdown (Locator)', type: 'locator', required: true },
      { name: 'value', label: 'Giá trị / Nhãn chọn', type: 'text' },
    ],
  },
  {
    type: 'check',
    label: 'Đánh dấu chọn (Check box)',
    category: 'interaction',
    icon: 'ph-check-square',
    params: [{ name: 'locator', label: 'Hộp kiểm (Locator)', type: 'locator', required: true }],
  },
  {
    type: 'uncheck',
    label: 'Bỏ đánh dấu chọn (Uncheck box)',
    category: 'interaction',
    icon: 'ph-square',
    params: [{ name: 'locator', label: 'Hộp kiểm (Locator)', type: 'locator', required: true }],
  },
  {
    type: 'assertion',
    label: 'Kiểm tra kết quả (Verify / Assert)',
    category: 'assertion',
    icon: 'ph-shield-check',
    params: [
      { name: 'locator', label: 'Phần tử kiểm tra', type: 'locator', required: true },
      {
        name: 'assertionType',
        label: 'Loại kiểm tra',
        type: 'select',
        options: [
          { value: 'toBeVisible', label: 'Phần tử đang hiển thị (Visible)' },
          { value: 'toBeHidden', label: 'Phần tử bị ẩn / Biến mất (Hidden)' },
          { value: 'toHaveText', label: 'Khớp chính xác văn bản (Exact Text)' },
          { value: 'toContainText', label: 'Chứa đoạn văn bản (Contains Text)' },
          { value: 'toHaveValue', label: 'Ô nhập chứa giá trị (Has Value)' },
          { value: 'toBeEnabled', label: 'Nút/Ô ở trạng thái kích hoạt (Enabled)' },
          { value: 'toBeDisabled', label: 'Nút/Ô bị vô hiệu hoá (Disabled)' },
          { value: 'toHaveURL', label: 'URL khớp giá trị (URL)' },
        ],
      },
      { name: 'expectedVal', label: 'Giá trị mong đợi (Expected)', type: 'text' },
    ],
  },
];

module.exports = {
  ACTION_TYPES,
  ASSERTION_TYPES,
  ASSERTION_DEFINITIONS,
  getAssertionDefinition,
  ACTION_DEFINITIONS,
};
