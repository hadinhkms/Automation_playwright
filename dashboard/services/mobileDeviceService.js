/**
 * dashboard/services/mobileDeviceService.js
 * Android device discovery (adb) and native toolchain doctor for the Mobile App view.
 */
const { execFile } = require('child_process');

const SERIAL_PATTERN = /^[\w.:-]{1,64}$/;

/** Runs a fixed command. Windows npm shims (appium) are not executables, so they go through cmd. */
function runCommand(command, args = [], timeoutMs = 8000) {
  const viaCmd = process.platform === 'win32' && command === 'appium';
  const file = viaCmd ? 'cmd.exe' : command;
  const finalArgs = viaCmd ? ['/d', '/s', '/c', command, ...args] : args;
  return new Promise((resolve) => {
    execFile(file, finalArgs, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error ? (typeof error.code === 'number' ? error.code : -1) : 0,
        missing: Boolean(error && error.code === 'ENOENT'),
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });
}

/** Parses `adb devices -l` output into device records. */
function parseAdbDevices(stdout) {
  const devices = [];
  for (const rawLine of String(stdout || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('List of devices') || line.startsWith('*')) continue;
    const [serial, state, ...rest] = line.split(/\s+/);
    if (!serial || !state || !SERIAL_PATTERN.test(serial)) continue;
    const props = {};
    for (const pair of rest) {
      const idx = pair.indexOf(':');
      if (idx > 0) props[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    devices.push({
      serial,
      state,
      ready: state === 'device',
      model: (props.model || '').replace(/_/g, ' '),
      product: props.product || '',
      emulator: serial.startsWith('emulator-'),
    });
  }
  return devices;
}

const STATE_HINTS = {
  unauthorized: 'Mở khóa điện thoại và bấm "Allow" trên hộp thoại USB debugging.',
  offline: 'Rút cáp cắm lại hoặc chạy "adb kill-server" rồi làm mới.',
  'no permissions': 'Máy chưa cấp quyền USB cho adb. Kiểm tra driver hoặc udev rules.',
};

async function listAndroidDevices() {
  const res = await runCommand('adb', ['devices', '-l']);
  if (!res.ok) {
    return {
      available: false,
      error: res.missing ? 'Không tìm thấy adb. Cài Android SDK Platform Tools và thêm vào PATH.' : (res.stderr.trim() || 'adb devices lỗi.'),
      devices: [],
    };
  }
  const devices = parseAdbDevices(res.stdout);
  await Promise.all(devices.map(async (device) => {
    device.hint = STATE_HINTS[device.state] || '';
    if (!device.ready) return;
    const version = await runCommand('adb', ['-s', device.serial, 'shell', 'getprop', 'ro.build.version.release'], 4000);
    device.androidVersion = version.ok ? version.stdout.trim() : '';
  }));
  return { available: true, error: '', devices };
}

function firstLine(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
}

async function runDoctor() {
  const [adb, appium, drivers, java] = await Promise.all([
    runCommand('adb', ['version']),
    runCommand('appium', ['-v']),
    runCommand('appium', ['driver', 'list', '--installed', '--json'], 15000),
    runCommand('java', ['-version']),
  ]);
  let hasUiAutomator2 = false;
  try { hasUiAutomator2 = Boolean(JSON.parse(drivers.stdout || '{}').uiautomator2); } catch (_) { hasUiAutomator2 = /uiautomator2/i.test(drivers.stdout + drivers.stderr); }
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const checks = [
    { id: 'adb', label: 'Android Debug Bridge (adb)', ok: adb.ok, detail: firstLine(adb.stdout), hint: 'Cài Android SDK Platform Tools và thêm adb vào PATH.' },
    { id: 'android-home', label: 'Biến ANDROID_HOME', ok: Boolean(sdk), detail: sdk ? 'Đã đặt' : '', hint: 'Đặt ANDROID_HOME trỏ tới thư mục Android SDK.' },
    { id: 'java', label: 'Java (JDK 11+)', ok: java.ok, detail: firstLine(java.stderr || java.stdout), hint: 'Cài JDK 11 trở lên và đặt JAVA_HOME.' },
    { id: 'appium', label: 'Appium 2', ok: appium.ok, detail: appium.ok ? `v${firstLine(appium.stdout)}` : '', hint: 'Chạy: npm i -g appium' },
    { id: 'uiautomator2', label: 'Driver UiAutomator2', ok: hasUiAutomator2, detail: hasUiAutomator2 ? 'Đã cài' : '', hint: 'Chạy: appium driver install uiautomator2' },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}

module.exports = { parseAdbDevices, listAndroidDevices, runDoctor, runCommand, SERIAL_PATTERN };
