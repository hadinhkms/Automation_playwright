'use strict';

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
function stripAnsi(str) {
  return String(str || '').replace(ANSI_REGEX, '');
}

const VALUE_FLAG_MAP = {
  '--project-dir': 'projectDir',
  '--project': 'project',
  '--domain': 'domain',
  '--req': 'req',
  '--tag': 'tag',
  '--output': 'output',
  '--since': 'since',
  '--review': 'review',
};

function parseArgs(argv) {
  const flags = {
    json: false,
    strict: false,
    project: null,
    projectDir: null,
    checkBoundaryRules: null,
    domain: null,
    req: null,
    tag: null,
    output: null,
    dryRun: false,
    apply: false,
    since: null,
    review: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--apply') flags.apply = true;
    else if (arg === '--no-boundary-rules') flags.checkBoundaryRules = false;
    else if (arg === '--boundary-rules') flags.checkBoundaryRules = true;
    else if (arg.startsWith('--') && arg.includes('=')) {
      const eqIdx = arg.indexOf('=');
      const rawName = arg.slice(0, eqIdx);
      const rawVal = arg.slice(eqIdx + 1);
      const prop = VALUE_FLAG_MAP[rawName];
      if (!prop) throw new Error(`Cờ không hợp lệ: ${arg}`);
      if (!rawVal || !rawVal.trim()) throw new Error(`Cờ ${rawName} thiếu giá trị.`);
      flags[prop] = rawVal.trim();
    } else if (Object.prototype.hasOwnProperty.call(VALUE_FLAG_MAP, arg)) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-') || !next.trim()) {
        throw new Error(`Cờ ${arg} thiếu giá trị.`);
      }
      flags[VALUE_FLAG_MAP[arg]] = next.trim();
      i += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`Cờ không hợp lệ: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function validateCommandFlags(command, flags, positional) {
  if (command === 'learn') {
    if (positional.length > 1) {
      throw new Error(`Tham số không hợp lệ cho lệnh learn: ${positional.slice(1).join(' ')}`);
    }
    if (flags.apply && !flags.review) throw new Error('Cờ --apply bắt buộc đi kèm --review=<path>.');
    if (flags.review && !flags.apply) throw new Error('Cờ --review chỉ được dùng kèm --apply.');
    if (flags.apply && flags.since !== null) {
      throw new Error('Không dùng --since cùng lúc với --apply (apply lấy scope từ review artifact).');
    }
    if (flags.apply && flags.output !== null) throw new Error('Không dùng --output cùng lúc với --apply.');
    if (flags.dryRun && flags.output !== null) {
      throw new Error('Không dùng --dry-run cùng lúc với --output để tránh mơ hồ side effect.');
    }
    if (flags.req !== null) throw new Error('Cờ --req không hỗ trợ cho lệnh learn.');
    if (flags.domain !== null) throw new Error('Cờ --domain không hỗ trợ cho lệnh learn.');
    if (flags.tag !== null) throw new Error('Cờ --tag không hỗ trợ cho lệnh learn.');
    if (flags.strict) throw new Error('Cờ --strict không hỗ trợ cho lệnh learn.');
    if (flags.checkBoundaryRules !== null) {
      throw new Error('Cờ --boundary-rules / --no-boundary-rules không hỗ trợ cho lệnh learn.');
    }
  } else if (flags.apply || flags.since !== null || flags.review !== null) {
    throw new Error('Các cờ --apply, --since, --review chỉ dùng cho lệnh learn.');
  }
}

function severityLabel(s) {
  if (s === 'blocker') return red('BLOCKER');
  if (s === 'major') return yellow('MAJOR  ');
  return dim('MINOR  ');
}

function emitCliError(message, jsonMode) {
  const cleanMsg = stripAnsi(message).trim();
  if (jsonMode) {
    console.log(JSON.stringify({ ok: false, error: cleanMsg }, null, 2));
    console.error(cleanMsg);
  } else {
    console.error(red(cleanMsg));
  }
  process.exitCode = 2;
  return 2;
}

module.exports = {
  c,
  red,
  yellow,
  green,
  dim,
  bold,
  stripAnsi,
  parseArgs,
  validateCommandFlags,
  severityLabel,
  emitCliError,
};

