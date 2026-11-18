/**
 * dashboard/services/mobileApkInfo.js
 * Reads package name / version of an APK with `aapt2 dump badging` (TECH-202).
 * Optional: without Android build-tools the catalog shows only the file name.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const cache = new Map();
let aapt2Path;

/** Newest aapt2 under $ANDROID_HOME/build-tools, or '' when none is installed. */
function findAapt2() {
  if (aapt2Path !== undefined) return aapt2Path;
  aapt2Path = '';
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const toolsDir = sdk && path.join(sdk, 'build-tools');
  if (!toolsDir || !fs.existsSync(toolsDir)) return aapt2Path;
  const exe = process.platform === 'win32' ? 'aapt2.exe' : 'aapt2';
  const versions = fs.readdirSync(toolsDir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const hit = versions.map((v) => path.join(toolsDir, v, exe)).find((p) => fs.existsSync(p));
  aapt2Path = hit || '';
  return aapt2Path;
}

function parseBadging(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((l) => l.startsWith('package:')) || '';
  const pick = (key) => (new RegExp(`${key}='([^']*)'`).exec(line) || [])[1] || '';
  const label = (/^application-label:'([^']*)'/m.exec(String(stdout || '')) || [])[1] || '';
  return { packageName: pick('name'), versionName: pick('versionName'), versionCode: pick('versionCode'), label };
}

function readBadging(tool, apkPath) {
  return new Promise((resolve) => {
    execFile(tool, ['dump', 'badging', apkPath], { timeout: 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      resolve(error && !stdout ? null : parseBadging(stdout));
    });
  });
}

/** Adds packageName / versionName to catalog entries; results are cached per file size + mtime. */
async function enrichApps(root, apps) {
  const tool = findAapt2();
  if (!tool) return apps;
  return Promise.all(apps.map(async (app) => {
    const key = `${app.path}:${app.sizeBytes}:${app.modifiedAt}`;
    if (!cache.has(key)) cache.set(key, await readBadging(tool, path.join(root, app.path)));
    const info = cache.get(key);
    return info && info.packageName ? { ...app, ...info } : app;
  }));
}

module.exports = { enrichApps, parseBadging, findAapt2 };
