/**
 * dashboard/services/mobileSpecService.js
 * Catalog of native test specs and app builds for the Mobile App view.
 * Specs in tests/native/shared run on both platforms; tests/native/<platform> holds platform-only ones (S-01/S-02).
 */
const fs = require('fs');
const path = require('path');
const { listProfiles } = require('./mobileAppProfiles');

const SHARED_DIR = 'tests/native/shared';
const PLATFORMS = {
  android: { specDirs: [SHARED_DIR, 'tests/native/android'], config: 'wdio.android.conf.js', appExt: ['.apk'] },
  ios: { specDirs: [SHARED_DIR, 'tests/native/ios'], config: 'wdio.ios.conf.js', appExt: ['.ipa', '.app.zip'] },
};
const TITLE_PATTERN = /\b(describe|it)(?:\.only|\.skip)?\(\s*(['"`])((?:\.|(?!\2).)*)\2/g;
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

/** Spec files the platform runs, each with `scope`: 'shared' or the platform name. */
function listNativeSpecs(root, platform = 'android') {
  const cfg = PLATFORMS[platform];
  if (!cfg) return [];
  return cfg.specDirs.flatMap((dir) => {
    const scope = dir === SHARED_DIR ? 'shared' : platform;
    const files = walk(path.join(root, dir), (name) => name.endsWith('.native.js'));
    return files.sort().map((full) => {
      const info = extractTests(fs.readFileSync(full, 'utf8'));
      return { path: toPosix(path.relative(root, full)), name: path.basename(full), scope, ...info };
    });
  });
}

function hasAppExt(name, exts) {
  const lower = name.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
}

function listApps(root, platform = 'android') {
  const cfg = PLATFORMS[platform];
  const dir = path.join(root, 'apps');
  if (!cfg || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && hasAppExt(e.name, cfg.appExt))
    .map((e) => {
      const stat = fs.statSync(path.join(dir, e.name));
      return { path: `apps/${e.name}`, name: e.name, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function defaultsFor(platform) {
  if (platform === 'ios') return { bundleId: process.env.IOS_BUNDLE_ID || '', app: process.env.IOS_APP || '' };
  return {
    appPackage: process.env.ANDROID_APP_PACKAGE || '',
    appActivity: process.env.ANDROID_APP_ACTIVITY || '',
    udid: process.env.ANDROID_UDID || '',
  };
}

function getCatalog(root, platform = 'android') {
  const cfg = PLATFORMS[platform];
  const specs = listNativeSpecs(root, platform);
  const tags = [...new Set(specs.flatMap((s) => s.tags))].sort();
  return {
    platform,
    configFile: cfg.config,
    configReady: fs.existsSync(path.join(root, cfg.config)),
    specDirs: cfg.specDirs,
    specs,
    tags,
    apps: listApps(root, platform),
    profiles: listProfiles(root, platform),
    defaults: defaultsFor(platform),
  };
}

module.exports = { PLATFORMS, SHARED_DIR, extractTests, listNativeSpecs, listApps, hasAppExt, getCatalog };
