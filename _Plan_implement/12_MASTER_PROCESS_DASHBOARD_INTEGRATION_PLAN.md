# Káº¿ Hoáº¡ch Hiá»‡n Thá»±c HÃ³a: TÃ­ch Há»£p Master Process Hub VÃ o Dashboard DÃ¹ng Chung Cho Má»i Dá»± Ãn

## 1. Bá»‘i Cáº£nh & Má»¥c TiÃªu

### 1.1. Bá»‘i Cáº£nh
Hiá»‡n táº¡i, dá»± Ã¡n Automation Hub (`D:\_Automation-Project`) vÃ  cÃ¡c dá»± Ã¡n vá»‡ tinh (`D:\_SieuVietGroup`, `D:\_CarThings\Automation_Carthings`) káº¿t ná»‘i vá»›i **Master Process Hub** (`D:\_Master_Process`) chá»§ yáº¿u qua dÃ²ng lá»‡nh thá»§ cÃ´ng (`master.py`, PowerShell scripts). Viá»‡c ghim phiÃªn báº£n (Process Lock), kiá»ƒm tra Ä‘á»™ lá»‡ch (Drift Detection), quÃ©t cháº¥t lÆ°á»£ng module & secret (Modularity & Secret Audit), cÅ©ng nhÆ° quáº£n trá»‹ Git Hooks Ä‘ang phá»¥ thuá»™c vÃ o thao tÃ¡c gÃµ terminal cá»§a tá»«ng ká»¹ sÆ°, chÆ°a cÃ³ giao diá»‡n trá»±c quan vÃ  cÆ¡ cháº¿ kiá»ƒm soÃ¡t táº­p trung trÃªn Dashboard.

### 1.2. Má»¥c TiÃªu
XÃ¢y dá»±ng module **Master Process Integration** trá»±c tiáº¿p vÃ o **Dashboard Core** (`dashboard/`):
1. **DÃ¹ng chung cho toÃ n bá»™ dá»± Ã¡n**: Khi cáº­p nháº­t táº¡i Hub, cÆ¡ cháº¿ `sync-satellites.js` sáº½ tá»± Ä‘á»™ng phÃ¢n phá»‘i tÃ­nh nÄƒng nÃ y sang táº¥t cáº£ cÃ¡c dá»± Ã¡n con (`_SieuVietGroup`, `_CarThings`, v.v.).
2. **Quáº£n trá»‹ 1-Click trÃªn Web UI**: 
   - GiÃ¡m sÃ¡t tráº¡ng thÃ¡i Anti-Drift: hiá»ƒn thá»‹ commit SHA, phiÃªn báº£n Hub, tráº¡ng thÃ¡i `IN_SYNC` vs `DRIFT_DETECTED` vs `UNPINNED`.
   - NÃºt hÃ nh Ä‘á»™ng 1-click: Ghim phiÃªn báº£n (`Init`), Äá»“ng bá»™ template (`Sync`), CÃ i Ä‘áº·t / Báº£o trÃ¬ Git Hook (`Install Hooks`), QuÃ©t mÃ£ nguá»“n & bÃ­ máº­t (`Audit`).
   - Báº£ng hiá»ƒn thá»‹ káº¿t quáº£ kiá»ƒm Ä‘á»‹nh trá»±c tiáº¿p (Logs, Violations, Exemptions).
3. **Chuáº©n hÃ³a CLI trong `package.json`**: Cung cáº¥p Ä‘áº§y Ä‘á»§ bá»™ phÃ­m táº¯t `mp:*` Ä‘á»“ng bá»™ giá»¯a Dashboard UI vÃ  CLI terminal.
4. **Báº£o vá»‡ toÃ n diá»‡n (Fail-Safe)**: Pre-commit hook cháº·n Ä‘á»©ng má»i hÃ nh vi commit file vÆ°á»£t giá»›i háº¡n sá»‘ dÃ²ng hoáº·c chá»©a Secret (API Key / AWS Token).

---

## 2. Kiáº¿n TrÃºc Giáº£i PhÃ¡p

```mermaid
graph TD
    subgraph MasterProcessHub [D:/_Master_Process]
        MP_CLI[master.py CLI]
        MP_SCRIPTS[scripts/ modularity_audit.py, project_manager.py, audit-probes.ps1]
        MP_TEMPLATES[templates/ .ai, hooks/pre-commit]
    end

    subgraph DashboardEngine [Dashboard Core - D:/_Automation-Project/dashboard]
        MP_Service[services/masterProcessService.js]
        MP_Routes[routes/masterProcessRoutes.js]
        MP_UI[templates/settings.html - Subtab Master Process]
        MP_Slice[public/js/views/settings/settingsSlice.js]
    end

    subgraph Satellites [CÃ¡c Dá»± Ãn Con]
        SVG[D:/_SieuVietGroup]
        CT[D:/_CarThings/Automation_Carthings]
    end

    MP_CLI --> MP_Service
    MP_Service --> MP_Routes
    MP_Routes --> MP_Slice
    MP_Slice --> MP_UI
    DashboardEngine -->|sync-satellites.js| SVG
    DashboardEngine -->|sync-satellites.js| CT
```

---

## 3. Thiáº¿t Káº¿ Chi Tiáº¿t

### 3.1. Backend API & Services

#### File Má»›i: `dashboard/services/masterProcessService.js`
Äáº£m nhiá»‡m giao tiáº¿p vá»›i Master Process Engine qua Python subprocess an toÃ n:
- **NguyÃªn táº¯c an toÃ n (Security & Reliability):**
  - **Chá»‘ng Command Injection:** Báº¯t buá»™c sá»­ dá»¥ng `child_process.execFile` hoáº·c `child_process.spawn` vá»›i máº£ng tham sá»‘ rá»i (`args`), tuyá»‡t Ä‘á»‘i khÃ´ng dÃ¹ng `exec(string)`. Há»— trá»£ Ä‘Æ°á»ng dáº«n Windows cÃ³ khoáº£ng tráº¯ng.
  - **Kiá»ƒm soÃ¡t Path Traversal:** HÃ m `validateProjectPath(projectRoot)` chá»‰ cho phÃ©p thá»±c thi trÃªn cÃ¡c thÆ° má»¥c thuá»™c danh sÃ¡ch dá»± Ã¡n há»£p lá»‡ (nhÆ° `D:\_Automation-Project`, `D:\_SieuVietGroup`, `D:\_CarThings...`), tá»« chá»‘i cÃ¡c Ä‘Æ°á»ng dáº«n ngoÃ i pháº¡m vi.
  - **Timeout chá»‘ng treo:** Cáº¥u hÃ¬nh `timeout: 60000` (60 giÃ¢y) cho cÃ¡c lá»‡nh quÃ©t sÃ¢u (`doctor`, `audit`, `probes`).
- `detectMasterProcessPath(projectRoot)`: TÃ¬m Ä‘Æ°á»ng dáº«n Master Process Hub (qua biáº¿n mÃ´i trÆ°á»ng `MASTER_PROCESS_ROOT`, cáº¥u hÃ¬nh `.ai/process-lock.json`, hoáº·c Ä‘Æ°á»ng dáº«n máº·c Ä‘á»‹nh chuáº©n `D:/_Master_Process`).
- `getProjectStatus(projectRoot)`:
  - Äá»c `.ai/process-lock.json` -> TrÃ­ch xuáº¥t `version`, `hub_commit`, `installed_at`.
  - Gá»i `python master.py check-drift <target>` -> Láº¥y tráº¡ng thÃ¡i Ä‘á»“ng bá»™ (`IN_SYNC` / `DRIFT_DETECTED` / `UNPINNED`).
  - Kiá»ƒm tra tráº¡ng thÃ¡i Git Hook táº¡i `.git/hooks/pre-commit` (ÄÃ£ cÃ i Managed V2 hay chÆ°a).
  - Tráº£ vá» tá»•ng quan JSON cho Dashboard.
- `initProject(projectRoot)`: Cháº¡y `python master.py init <target>`.
- `syncProject(projectRoot, options)`: Cháº¡y `python master.py sync <target>` (há»— trá»£ cá» `--dry-run` xem trÆ°á»›c vÃ  `--update-templates` Ä‘á»ƒ ghi Ä‘Ã¨ an toÃ n cÃ³ sao lÆ°u `.bak`).
- `installHooks(projectRoot)`: Cháº¡y `python master.py install-hooks <target>`.
- `runAudit(projectRoot, staged)`: Cháº¡y `python master.py audit <target>` (phÃ¢n tÃ­ch sá»‘ file quÃ©t, violations, exemptions, secret leaks).
- `runDoctor(projectRoot)`: Cháº¡y `python master.py doctor <target>`.
- `runProbes(projectRoot, probeId)`: Cháº¡y PowerShell audit-probes náº¿u cáº§n.

#### File Má»›i: `dashboard/routes/masterProcessRoutes.js`
ÄÄƒng kÃ½ cÃ¡c RESTful endpoints:
- `GET  /api/mp/status`: Tráº£ vá» thÃ´ng tin káº¿t ná»‘i, lock info, drift status, hook status.
- `POST /api/mp/init`: Thá»±c hiá»‡n ghim phiÃªn báº£n.
- `POST /api/mp/sync`: Äá»“ng bá»™ templates vÃ  refresh lock.
- `POST /api/mp/install-hooks`: CÃ i Ä‘áº·t / cáº­p nháº­t Git pre-commit hook.
- `POST /api/mp/audit`: Cháº¡y quÃ©t modularity vÃ  secret scanning.
- `POST /api/mp/doctor`: Kiá»ƒm tra sá»©c khá»e toÃ n diá»‡n dá»± Ã¡n.
- `POST /api/mp/probes`: Cháº¡y kiá»ƒm tra cÃ¡c probes P1-P6.

#### Cáº­p nháº­t: `dashboard/routes.js`
ÄÄƒng kÃ½ `handleMasterProcessRoutes(request, response, url, root)` vÃ o router chÃ­nh cá»§a Dashboard.

---

### 3.2. Frontend Dashboard UI/UX

#### Cáº­p nháº­t Template: `dashboard/public/templates/settings.html`
ThÃªm subtab má»›i vÃ o thanh Ä‘iá»u hÆ°á»›ng Settings:
```html
<button class="settings-subtab" type="button" role="tab" data-subtab="master-process">
  <i class="ph-bold ph-shield-check"></i> Quy trÃ¬nh Master Process
</button>
```
ThÃªm panel ná»™i dung `#settings-master-process`:
1. **Tháº» Anti-Drift & Process Lock**:
   - Hiá»ƒn thá»‹: Master Path, Hub Version, Hub Commit SHA, Tráº¡ng thÃ¡i (`IN_SYNC` ðŸŸ¢ / `DRIFT_DETECTED` ðŸ”´ / `UNPINNED` âšª).
   - NÃºt báº¥m: `[ ðŸ“Œ Ghim phiÃªn báº£n (Init) ]`, `[ ðŸ” Kiá»ƒm tra Drift ]`.
   - **Luá»“ng Äá»“ng Bá»™ An ToÃ n (Sync 2 Náº¥c):**
     - Máº·c Ä‘á»‹nh báº¥m `[ ðŸ”„ Xem trÆ°á»›c Äá»“ng bá»™ (--dry-run) ]`: Cháº¡y cháº¿ Ä‘á»™ xem trÆ°á»›c, in danh sÃ¡ch file sáº½ thay Ä‘á»•i mÃ  khÃ´ng ghi Ä‘Ã¨.
     - Checkbox xÃ¡c nháº­n: `[ ] Cho phÃ©p ghi Ä‘Ã¨ templates cÃ³ sao lÆ°u (.bak) (--update-templates)`. Khi tÃ­ch chá»n, nÃºt Ä‘á»•i sang mÃ u cam `[ âš ï¸ XÃ¡c nháº­n Äá»“ng bá»™ & Ghi Ä‘Ã¨ ]`.
2. **Tháº» Git Pre-commit Hook**:
   - Hiá»ƒn thá»‹: Tráº¡ng thÃ¡i cÃ i Ä‘áº·t (`ÄÃ£ kÃ­ch hoáº¡t Managed V2` ðŸŸ¢ / `ChÆ°a cÃ i Ä‘áº·t` ðŸ”´ / `Trá» Hub há»£p lá»‡`).
   - NÃºt báº¥m: `[ ðŸ›¡ï¸ CÃ i Ä‘áº·t / Kháº¯c phá»¥c Hook ]`.
3. **Tháº» Kiá»ƒm Äá»‹nh Modularity & Secret Audit**:
   - Hiá»ƒn thá»‹ chá»‰ sá»‘: Tá»•ng sá»‘ file mÃ£ nguá»“n, Sá»‘ lá»—i vi pháº¡m kÃ­ch thÆ°á»›c (Violations), Sá»‘ file miá»…n trá»« (Exemptions).
   - NÃºt báº¥m: `[ âš¡ QuÃ©t toÃ n bá»™ mÃ£ nguá»“n ]`, `[ âš¡ QuÃ©t Staged Git Files ]`, `[ ðŸ©º Doctor Kiá»ƒm tra ToÃ n diá»‡n ]`.
4. **Báº£ng Äiá»u Khiá»ƒn Console / Output**:
   - VÃ¹ng terminal hiá»ƒn thá»‹ log chi tiáº¿t khi cháº¡y Audit / Probes / Sync vá»›i font `JetBrains Mono`.

#### Cáº­p nháº­t Logic: `dashboard/public/js/views/settings/settingsSlice.js`
- Xá»­ lÃ½ náº¡p dá»¯ liá»‡u tráº¡ng thÃ¡i `/api/mp/status` khi chuyá»ƒn sang tab `master-process`.
- **Quáº£n lÃ½ tráº¡ng thÃ¡i thá»±c thi (Execution Lock & Loading State):**
  - Khi má»™t tiáº¿n trÃ¬nh Ä‘ang cháº¡y: VÃ´ hiá»‡u hÃ³a (disable) toÃ n bá»™ cÃ¡c nÃºt báº¥m trong panel, hiá»ƒn thá»‹ spinner xoay vÃ  nhÃ£n tráº¡ng thÃ¡i "Äang thá»±c thi...".
  - NgÄƒn cháº·n ngÆ°á»i dÃ¹ng báº¥m nhiá»u láº§n gÃ¢y ngháº½n tiáº¿n trÃ¬nh ná»n.
- Cáº­p nháº­t badge tráº¡ng thÃ¡i vÃ  in output ra console panel trá»±c quan.
- TuÃ¢n thá»§ quy táº¯c báº¥t biáº¿n: **100% DOM APIs, khÃ´ng dÃ¹ng `innerHTML` cho dá»¯ liá»‡u server**.

#### Cáº­p nháº­t CSS: `dashboard/public/styles/views/settings.css`
- Thiáº¿t káº¿ badge tráº¡ng thÃ¡i Ä‘á»“ng bá»™, card hiá»ƒn thá»‹ thÃ´ng sá»‘ vÃ  output viewer chuáº©n Dark/Light mode.

---

### 3.3. TÃ­ch Há»£p CLI VÃ o `package.json`

Cáº­p nháº­t `package.json` cá»§a Hub (`D:\_Automation-Project`) Ä‘á»ƒ khi cháº¡y `sync-satellites.js`, má»i vá»‡ tinh Ä‘á»u cÃ³ sáºµn bá»™ lá»‡nh:
```json
"scripts": {
  "mp:doctor": "python D:/_Master_Process/master.py doctor .",
  "mp:audit": "python D:/_Master_Process/master.py audit .",
  "mp:optimize": "python D:/_Master_Process/master.py optimize .",
  "mp:candidates": "python D:/_Master_Process/master.py candidates .",
  "mp:audit-deps": "python D:/_Master_Process/master.py audit-deps .",
  "mp:probes": "powershell -NoProfile -ExecutionPolicy Bypass -File D:/_Master_Process/scripts/audit-probes.ps1 -ProbeId ALL .",
  "mp:drift": "python D:/_Master_Process/master.py check-drift .",
  "mp:sync": "python D:/_Master_Process/master.py sync .",
  "mp:gate": "python D:/_Master_Process/master.py gate .",
  "mp:evidence": "python D:/_Master_Process/master.py generate-evidence"
}
```

---

## 4. Káº¿ Hoáº¡ch Thá»±c Hiá»‡n (Phases)

| Phase | Ná»™i dung thá»±c hiá»‡n | Báº±ng chá»©ng / Deliverables |
|---|---|---|
| **Phase 1** | XÃ¢y dá»±ng Backend Service & API Routes (`masterProcessService.js`, `masterProcessRoutes.js`, unit test). TÃ­ch há»£p Path Whitelist Validation & Timeout 60s. | Cháº¡y unit test backend passed 100%, API tráº£ vá» JSON Ä‘Ãºng chuáº©n, cháº·n an toÃ n path láº¡. |
| **Phase 2** | XÃ¢y dá»±ng Giao diá»‡n Dashboard (Template `settings.html`, Subtab Master Process, Sync 2 náº¥c, `settingsSlice.js`, CSS). | UI render mÆ°á»£t mÃ , báº¥m nÃºt gá»i API, hiá»ƒn thá»‹ loading state vÃ  káº¿t quáº£ Ä‘Ãºng chuáº©n. |
| **Phase 3** | Cáº­p nháº­t Whitelist trong `sync-satellites.js`, cáº­p nháº­t `package.json` & Äá»“ng bá»™ sang vá»‡ tinh `_SieuVietGroup`. | Vá»‡ tinh nháº­n Ä‘á»§ module Dashboard vÃ  scripts `mp:*` mÃ  khÃ´ng bá»‹ sÃ³t file. |
| **Phase 4** | Nghiá»‡m thu toÃ n diá»‡n trÃªn trÃ¬nh duyá»‡t vÃ  CLI vá»‡ tinh: Kiá»ƒm tra Drift, Audit 0 violations, Hook cháº·n Secret, Test Sync 2 náº¥c an toÃ n. | Chá»¥p áº£nh UI Dashboard, log terminal `IN_SYNC`, test leak cháº·n thÃ nh cÃ´ng. |

---

## 5. TiÃªu ChÃ­ Nghiá»‡m Thu (Acceptance Criteria)

1. **Dashboard UI:**
   - Má»Ÿ `http://127.0.0.1:4180/#/settings` -> Chuyá»ƒn sang subtab **Quy trÃ¬nh Master Process**.
   - Tháº» Anti-Drift hiá»ƒn thá»‹ tráº¡ng thÃ¡i `IN_SYNC` (mÃ u xanh lá»¥c).
   - Tháº» Git Hook hiá»ƒn thá»‹ `ÄÃ£ kÃ­ch hoáº¡t (Managed V2)`.
   - Báº¥m nÃºt **QuÃ©t Modularity & Secret**: QuÃ©t 200+ file, tráº£ vá» `violations=0`, hiá»ƒn thá»‹ danh sÃ¡ch file miá»…n trá»« rÃµ rÃ ng.
   - Thá»­ báº¥m **Xem trÆ°á»›c Äá»“ng bá»™ (--dry-run)** khi chÆ°a tÃ­ch checkbox: Hiá»ƒn thá»‹ preview cÃ¡c thay Ä‘á»•i trÃªn console mÃ  khÃ´ng Ä‘á»¥ng cháº¡m Ä‘áº¿n file nguá»“n cá»§a dá»± Ã¡n con.
   - Khi API Ä‘ang thá»±c thi: ToÃ n bá»™ nÃºt hÃ nh Ä‘á»™ng bá»‹ disable vÃ  hiá»ƒn thá»‹ spinner tráº¡ng thÃ¡i.
2. **CLI Terminal táº¡i `D:\_SieuVietGroup`:**
   - `npm run mp:drift` -> `Hub Sync Status: IN_SYNC` (exit code 0).
   - `npm run mp:audit` -> `violations=0` (exit code 0).
3. **Báº£o máº­t & PhÃ²ng vá»‡ An ToÃ n:**
   - Thá»­ gá»­i request API vá»›i Ä‘Æ°á»ng dáº«n má»¥c tiÃªu ngoÃ i whitelist (vÃ­ dá»¥ `C:\Windows`) -> API tráº£ vá» lá»—i 400/403 Bad Request, khÃ´ng thá»±c thi command.
   - **Pre-commit Hook cháº·n rÃ² rá»‰ bÃ­ máº­t:**
     - Táº¡o file `test_leak.py` chá»©a `AWS_KEY = "AKIA1234567890ABCDEF"`.
     - Thá»­ `git add test_leak.py` vÃ  `git commit` -> Hook láº­p tá»©c huá»· commit vÃ  in thÃ´ng Ä‘iá»‡p `SECRET VIOLATION: test_leak.py:1 contains possible secret (AWS Access Key)`.
     - Dá»n dáº¹p sáº¡ch file test sau khi xÃ¡c minh.
