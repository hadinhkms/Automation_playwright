const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ng__i_d_ng_mobile_vi_t_l_i_gi_i_thi_u_v__t_o_m__t__kinh_nghi_attempt0_on_failure_2026-09-05T04-54-14-117Z.html';
const html = fs.readFileSync(file, 'utf8');

const p = html.indexOf('Cho phép Nhà tuyển dụng');
console.log('Cho phép Nhà tuyển dụng index:', p);
if (p !== -1) {
  console.log(html.substring(p - 150, p + 500));
}
