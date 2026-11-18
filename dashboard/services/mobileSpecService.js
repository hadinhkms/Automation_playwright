/**
 * dashboard/services/mobileSpecService.js
 * Catalog of native test specs and app builds for the Mobile App view.
 */
const fs = require('fs');
const path = require('path');

const PLATFORMS = {
  android: { specDir: 'tests/native/android', config: 'wdio.android.conf.js', appExt: '.apk' },
};
const TITLE_PATTERN = /\b(describe|it)(?:\.only|\.skip)?\(\s*(['"`])((?:\\.|(?!\2).)*)\2/g;
const TAG_PATTERN = /@[\w-]+/g;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

/** Extracts describe/it titles and @tags from Mocha source without executing it. */
function extractTests(source) {
  const suites = [];
  const tests = [];
  const tags = new Set();
  let match = TITLE_PATTERN.exec(source);
  while (match) {
    const title = match[3];
    (match[1] === 'it' ? tests : suites).push(title);
    (title.match(TAG_PATTERN) || []).forEach((tag) => tags.add(tag));
    match = TITLE_PATTERN.exec(source);
  }
  TITLE_PATTERN.lastIndex = 0;
  return { suites, tests, tags: [...tags].sort() };
}

function listNativeSpecs(root, platform = 'android') {
  const cfg = PLATFORMS[platform];
  if (!cfg) return [];
  const files = walk(path.join(root, cfg.specDir), (name) => name.endsWith('.native.js'));
  return files.sort().map((full) => {
    const info = extractTests(fs.readFileSync(full, 'utf8'));
    return { path: toPosix(path.relative(root, full)), name: path.basename(full), ...info };
  });
}

function listApps(root, platform = 'android') {
  const cfg = PLATFORMS[platform];
  const dir = path.join(root, 'apps');
  if (!cfg || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === cfg.appExt)
    .map((e) => {
      const stat = fs.statSync(path.join(dir, e.name));
      return { path: `apps/${e.name}`, name: e.name, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function getCatalog(root, platform = 'android') {
  const cfg = PLATFORMS[platform];
  const specs = listNativeSpecs(root, platform);
  const tags = [...new Set(specs.flatMap((s) => s.tags))].sort();
  return {
    platform,
    configFile: cfg.config,
    configReady: fs.existsSync(path.join(root, cfg.config)),
    specs,
    tags,
    apps: listApps(root, platform),
    defaults: {
      appPackage: process.env.ANDROID_APP_PACKAGE || '',
      appActivity: process.env.ANDROID_APP_ACTIVITY || '',
      udid: process.env.ANDROID_UDID || '',
    },
  };
}

module.exports = { PLATFORMS, extractTests, listNativeSpecs, listApps, getCatalog };
