const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ng__i_d_ng_mobile_c_p_nh_t_th_ng_tin_c__nh_n__ti_u_ch__t_m_v_attempt0_on_failure_2026-09-05T05-09-40-230Z.html';
const html = fs.readFileSync(file, 'utf8');

const p = html.indexOf('Bước tiếp theo');
console.log('Bước tiếp theo index:', p);
if (p !== -1) {
  console.log(html.substring(p - 200, p + 300));
}

const p2 = html.indexOf('Tải lên CV có sẵn');
console.log('Tải lên CV có sẵn index:', p2);
if (p2 !== -1) {
  console.log(html.substring(p2 - 200, p2 + 400));
}
