const { defineQaConfig } = require('./core/config/defineConfig');

const config = defineQaConfig();

// Bộ smoke là tập con của regression: project "* Regression Tests" chạy cả spec gắn @smoke,
// để các suite theo tính năng (@applyjob, @profile, @auth...) không mất luồng happy path P0.
// Sửa ở đây vì core/ bị đồng bộ framework ghi đè.
for (const project of config.projects || []) {
  if (/Regression Tests$/.test(project.name)) delete project.grepInvert;
}

module.exports = config;
