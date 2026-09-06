const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-45-51-655Z.html';
const html = fs.readFileSync(file, 'utf8');

// Find occupations or step2
const idx = html.indexOf('name="occupations"');
if (idx !== -1) {
  console.log('Occupations section:');
  console.log(html.substring(idx - 200, idx + 1500));
} else {
  console.log('occupations not found');
}

// Find "Tiếp theo" button
const btnIdx = html.indexOf('Tiếp theo');
if (btnIdx !== -1) {
  console.log('Button section:');
  console.log(html.substring(btnIdx - 200, btnIdx + 200));
}
