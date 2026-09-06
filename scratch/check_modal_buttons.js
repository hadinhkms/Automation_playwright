const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-43-03-045Z.html';
const html = fs.readFileSync(file, 'utf8');

const modalIdx = html.indexOf('data-test-id="select__modal-menu__container"');
const sub = html.substring(modalIdx);

// Find all buttons in sub
const btnRegex = /<button[\s\S]*?<\/button>/gi;
const btns = sub.match(btnRegex) || [];
console.log('Buttons inside container count:', btns.length);
btns.forEach((b, i) => console.log(`Button ${i}:`, b));

// Check any link or div with role="button" or cursor-pointer
const cursorRegex = /<[^>]*cursor-pointer[^>]*>[\s\S]*?<\/[^>]+>/gi;
// Just find all data-test-id
const testIds = sub.match(/data-test-id="[^"]*"/g) || [];
console.log('Unique data-test-ids:', Array.from(new Set(testIds)));
