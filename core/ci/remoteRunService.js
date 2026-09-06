const crypto = require('crypto');
const https = require('https');

const REMOTE_RUN_STATES = ['queued', 'running', 'completed', 'failed', 'cancelled'];

function createCorrelationId() {
  return `remote_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

function validateRemoteRun(input = {}, config = {}, { allowProd = false } = {}) {
  const environments = Object.keys(config.environments || {});
  const suites = config.suites || {};
  const environment = String(input.environment || 'qc');
  const suite = String(input.suite || '').trim();
  const project = String(input.project || 'all');
  const workers = Number(input.workers || 2);
  const spec = input.spec ? String(input.spec).trim() : '';
  const errors = [];
  if (!suite || (!suites[suite] && !/^@[a-zA-Z][\w-]*$/.test(suite) && suite !== 'smoke')) errors.push('Suite hoặc tag không được whitelist.');
  if (!environments.includes(environment)) errors.push('Environment không hợp lệ.');
  if (environment === 'prod' && !(allowProd && input.confirmProd === true)) errors.push('Remote run trên Prod cần policy và confirmProd=true.');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) errors.push('Workers phải từ 1 đến 8.');
  if (project.length > 80 || /[\r\n\0]/.test(project)) errors.push('Project không hợp lệ.');
  if (spec.length > 200 || /[\r\n\0]/.test(spec) || spec.includes('..')) errors.push('Spec không hợp lệ.');
  return { valid: errors.length === 0, errors, request: { suite, environment, project, workers, spec } };
}

function postGithubDispatch({ owner, repo, workflow, ref, token, inputs, timeoutMs = 10000 }) {
  if (!token) throw new Error('Thiếu GitHub token.');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo) || !/^[A-Za-z0-9_.-]+\.ya?ml$/.test(workflow) || !/^[A-Za-z0-9_.\/-]+$/.test(ref)) throw new Error('GitHub dispatch target không hợp lệ.');
  const body = JSON.stringify({ ref, inputs });
  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: 'api.github.com', path: `/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, method: 'POST', timeout: timeoutMs, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'qa-automation-dashboard', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => response.statusCode >= 200 && response.statusCode < 300 ? resolve({ status: response.statusCode }) : reject(new Error(`GitHub phản hồi ${response.statusCode}.`)));
    });
    request.on('timeout', () => request.destroy(new Error('GitHub dispatch timeout.')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function createRemoteRunService({ config, dispatch = postGithubDispatch, allowProd = false, now = () => Date.now() } = {}) {
  const idempotency = new Map();
  return {
    async dispatch(input = {}) {
      const checked = validateRemoteRun(input, config, { allowProd });
      if (!checked.valid) throw new Error(checked.errors.join(' '));
      const key = String(input.idempotencyKey || '').trim() || createCorrelationId();
      const existing = idempotency.get(key);
      if (existing && existing.createdAtMs > now() - 15 * 60 * 1000) return { ...existing.result, idempotent: true };
      const correlationId = createCorrelationId();
      const github = config.github || {};
      const owner = input.owner || github.owner;
      const repo = input.repo || github.repo;
      const workflow = input.workflow || github.workflow || 'discord-run-playwright.yml';
      const ref = input.ref || github.ref || 'main';
      await dispatch({ owner, repo, workflow, ref, token: github.token, inputs: { suite: checked.request.suite, env: checked.request.environment, spec: checked.request.spec, correlation_id: correlationId } });
      const result = { runId: correlationId, correlationId, state: 'queued', createdAt: new Date(now()).toISOString(), idempotencyKey: key, runUrl: `https://github.com/${owner}/${repo}/actions/workflows/${workflow}` };
      idempotency.set(key, { result, createdAtMs: now() });
      return result;
    },
  };
}

module.exports = { REMOTE_RUN_STATES, validateRemoteRun, postGithubDispatch, createRemoteRunService };
