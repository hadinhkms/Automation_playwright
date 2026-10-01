/**
 * qaBoundaryMatrix.js - Xây dựng ma trận phân vùng tương đương (EP) và điểm biên (BVA).
 * Thuần thuật toán xác định (0 token AI), tuân thủ quy chuẩn Master Process PLAN-19b.
 */

function buildMatrix(constraint) {
  if (!constraint || typeof constraint !== 'object') {
    return { partitions: [], values: [], invalidTypes: [] };
  }

  const { kind = 'number', min = null, max = null, implicitMin = false } = constraint;
  const isLength = kind === 'length';
  let rawPoints = [];
  let partitions = [];

  if (min !== null && max !== null) {
    if (min === max) {
      // Đúng N
      rawPoints = [
        { value: min - 1, valid: false, label: 'Dưới cận' },
        { value: min, valid: true, label: 'Đúng giá trị' },
        { value: min + 1, valid: false, label: 'Trên cận' }
      ];
      partitions = [
        { label: '≠ ' + min, valid: false },
        { label: '= ' + min, valid: true }
      ];
    } else {
      // Khoảng 2 phía [a, b]
      const nominal = min + Math.floor((max - min) / 2);
      rawPoints = [
        { value: min - 1, valid: false, label: 'Dưới min' },
        { value: min, valid: true, label: 'Tại min' },
        { value: min + 1, valid: true, label: 'Trên min' },
        { value: nominal, valid: true, label: 'Điểm giữa (nominal)' },
        { value: max - 1, valid: true, label: 'Dưới max' },
        { value: max, valid: true, label: 'Tại max' },
        { value: max + 1, valid: false, label: 'Trên max' }
      ];
      partitions = [
        { label: '< ' + min, valid: false },
        { label: min + ' … ' + max, valid: true },
        { label: '> ' + max, valid: false }
      ];
    }
  } else if (min !== null) {
    // Chỉ min a
    rawPoints = [
      { value: min - 1, valid: false, label: 'Dưới min' },
      { value: min, valid: true, label: 'Tại min' },
      { value: min + 1, valid: true, label: 'Trên min' }
    ];
    partitions = [
      { label: '< ' + min, valid: false },
      { label: '≥ ' + min, valid: true }
    ];
  } else if (max !== null) {
    // Chỉ max b
    rawPoints = [
      { value: max - 1, valid: true, label: 'Dưới max' },
      { value: max, valid: true, label: 'Tại max' },
      { value: max + 1, valid: false, label: 'Trên max' }
    ];
    if (isLength) {
      rawPoints.unshift({ value: 0, valid: true, label: 'Độ dài tối thiểu (implicit)', implicit: true });
    }
    partitions = [
      { label: '≤ ' + max, valid: true },
      { label: '> ' + max, valid: false }
    ];
  }

  // Khử trùng lặp và lọc giá trị âm cho length
  const seen = new Set();
  const values = [];

  rawPoints
    .filter((pt) => !isLength || pt.value >= 0)
    .sort((a, b) => a.value - b.value)
    .forEach((pt) => {
      if (!seen.has(pt.value)) {
        seen.add(pt.value);
        const item = {
          value: pt.value,
          valid: pt.valid,
          label: pt.label
        };
        if (pt.implicit) item.implicit = true;
        if (isLength && pt.value >= 0 && pt.value <= 1024) {
          item.sample = 'x'.repeat(pt.value);
        }
        values.push(item);
      }
    });

  // Invalid types
  let invalidTypes = [];
  if (kind === 'number') {
    invalidTypes = ['', 'abc', '1.5', ' '];
  } else if (isLength) {
    invalidTypes = ['   '];
    if (min !== null && min >= 1) {
      invalidTypes.unshift('');
    }
  }

  return { partitions, values, invalidTypes };
}

module.exports = {
  buildMatrix
};
