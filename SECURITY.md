# Security Policy & System Safety Architecture

EfficiencyHub is designed with a defense-in-depth security architecture. Because process management utilities interact with operating system execution states, EfficiencyHub implements strict safeguards to protect your computer against system instability, unauthorized remote access, and privilege misuse.

---

## 1. Vulnerability Reporting

If you identify a security vulnerability or potential privilege escalation vector in EfficiencyHub, please report it responsibly:

- **Security Advisory**: Submit a private advisory via GitHub Security Advisories at [https://github.com/smitlad01/Efficiencyhub/security/advisories](https://github.com/smitlad01/Efficiencyhub/security/advisories).
- **Maintainer Email**: Contact the security maintainer directly via GitHub profile [smitlad01](https://github.com/smitlad01).
- **Response Timeline**:
  - Initial acknowledgement: within 48 hours.
  - Triage and mitigation assessment: within 5 business days.
  - Public patch and release: coordinated disclosure upon fix validation.

Please do **not** open public issues for zero-day vulnerabilities.

---

## 2. Security Threat Model & Guarantees

EfficiencyHub operates under a documented threat model providing four guarantees:

### A. 100% Userland Execution (Zero Kernel Drivers)
- **No Third-Party Kernel Drivers**: EfficiencyHub does not install, package, or execute any Windows kernel drivers (`.sys` files), filter drivers, or hook drivers.
- **Ring-3 Safety**: All operations run strictly in standard Windows User Mode (Ring 3). The software cannot cause kernel-level blue screen errors (BSODs) or driver corruption.
- **Documented Win32 APIs**: Process priority adjustments and lifecycle management utilize only standard, documented Microsoft Win32 APIs (`SetPriorityClass`, `PROCESS_POWER_THROTTLING_EXECUTION_SPEED`, `Process.Kill()`).

### B. Localhost-Only Network Isolation
- **127.0.0.1 Binding**: The EfficiencyHub API and static dashboard bind strictly to IPv4 Loopback (`127.0.0.1`).
- **Zero LAN/WAN Exposure**: The server rejects external network adapters, Wi-Fi, Ethernet, and public internet routing. No ports are opened to external devices or the local network.
- **Local IPC Communication**: All control signals between the dashboard and background daemon communicate through local loopback HTTP and local named OS primitives.

### C. Hardcoded Protected Application Lockdown
To prevent system lockups, boot failures, or user productivity loss, EfficiencyHub enforces an immutable hardcoded blacklist/whitelist filter. The daemon and server reject auto-kill or quarantine rules targeted at:

- **Critical Operating System Subsystems**:
  - `explorer.exe` (Windows Shell)
  - `taskmgr.exe` (Windows Task Manager)
  - `csrss.exe`, `lsass.exe`, `winlogon.exe`, `dwm.exe`, `smss.exe`, `services.exe`, `wininit.exe`
  - `svchost.exe`, `trustedinstaller.exe`, `tiworker.exe`, `wuauserv.exe`, `usosvc.exe`
- **Security & Antivirus Services**:
  - `MsMpEng.exe` (Windows Defender Antimalware Service)
  - `SecurityHealthService.exe`
- **Web Browsers & Developer Workspaces**:
  - `chrome.exe`, `msedge.exe`, `brave.exe`, `firefox.exe`
  - `code.exe` (VS Code), `antigravity.exe`
- **Hardware & OEM Power Daemons**:
  - `hpomencap.exe`, `hpsysinfocap.exe`, `hpapphelpercap.exe`, `hp.omen.omencommandcenter`

Any attempt to register or execute a kill or quarantine policy against a protected binary is rejected with HTTP 400 Bad Request and ignored by the daemon.

### D. Input Sanitization & Injection Defense
- Process target names are strictly sanitized against shell injection characters (`&`, `|`, `;`, `>`, `<`, `` ` ``, `$`).
- Elevation commands dispatched via Windows User Account Control (UAC) are hard-coded to explicit binary paths and do not interpolate untrusted client parameters.

---

## 3. Supported Versions

| Version | Supported          | Security Updates |
| ------- | ------------------ | ---------------- |
| 2.4.x   | :white_check_mark: | Active           |
| < 2.4.0 | :x:                | Deprecated       |

---

## 4. Verification and Source Auditing

EfficiencyHub is fully open-source under the MIT License. Every line of C# daemon code (`AutoEfficiencyWatcher.cs`) and Node.js server code (`server.js`) is human-readable and can be inspected, built, and verified independently without proprietary pre-compiled binaries.
