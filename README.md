# EfficiencyHub

[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20Telemetry-brightgreen.svg)](PRIVACY.md)
[![100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-blue.svg)](PRIVACY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Protected Core](https://img.shields.io/badge/Safety-Protected%20Core-success.svg)](SECURITY.md)
[![Platform: Windows 10/11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-lightgrey.svg)](SAFETY.md)

EfficiencyHub is an open-source Windows utility for automated EcoQoS efficiency management, background bloatware quarantine, and zero-latency process lifecycle control.

Repository: https://github.com/smitlad01/Efficiencyhub.git

---

## Features
- **EcoQoS Throttling**: Automatically leverages Windows EcoQoS QoS scheduling APIs to down-clock background CPU cycles on modern Intel and AMD architectures.
- **Zero-Latency Auto-Kill**: Terminates stubborn background companion and helper processes immediately after their primary application window is closed.
- **Background Quarantine**: Prevents designated bloatware and background agents from consuming system resources when not actively in use.
- **Persistent Filter Matrix**: Filter, inspect, and toggle optimization policies dynamically across all active and stopped processes.
- **One-Click UAC Elevation**: Elevation handoff mechanism allowing unprivileged sessions to seamlessly elevate and control protected system tasks.

---

## Security & System Safety

EfficiencyHub is engineered with user trust and machine stability as core priorities:

- **[Security Policy & Protected System Application Guarantees (SECURITY.md)](SECURITY.md)**: Details the threat model, vulnerability reporting channels, and hardcoded protections preventing termination or throttling of Windows Defender (`MsMpEng.exe`), `explorer.exe`, `taskmgr.exe`, web browsers, and core operating system processes.
- **[Zero-Telemetry & Local Privacy Guarantee (PRIVACY.md)](PRIVACY.md)**: Guarantees zero tracking SDKs, zero data exfiltration, localhost network binding (`127.0.0.1`), and 100% offline local memory execution.
- **[Antivirus, Transparency & API Safety Guide (SAFETY.md)](SAFETY.md)**: Explains the documented Win32 APIs used (`SetPriorityClass`, `Process.Kill`), why heuristic false positives can occur on system utilities, and how to independently audit and compile the software.

---

## Prerequisites
- Windows 10 or 11 (64-bit recommended)
- .NET Framework 4.5+
- Node.js runtime (v16.0.0 or newer)

---

## Installation
Run the installer executable as Administrator, or launch directly from source:

```cmd
git clone https://github.com/smitlad01/Efficiencyhub.git
cd Efficiencyhub
npm install
```

---

## Usage
Start the EfficiencyHub local dashboard and API daemon:

```cmd
node server.js
```

Open your browser and navigate to `http://127.0.0.1:5252` to access the process ledger and management console.

---

## Building
To compile the background watcher daemon binary cleanly from C# source:

```cmd
csc /target:winexe /optimize+ /out:AutoEfficiencyWatcher.exe AutoEfficiencyWatcher.cs
```

To build the full standalone Windows installer:

```powershell
powershell -ExecutionPolicy Bypass -File build_installer.ps1
```

---

## API
EfficiencyHub provides a localhost-isolated HTTP JSON API:

- `GET /api/status` — Pre-launch privilege verification, daemon health, and application version.
- `POST /api/elevate` — One-click UAC Administrator elevation handoff.
- `GET /api/rules` — Query currently configured EcoQoS and auto-kill policies.
- `POST /api/rules/toggle` — Add, remove, or modify process rules with real-time daemon synchronization.
- `GET /api/updates/check` — Optional check against GitHub Releases API for newer versions.
- `POST /api/updates/download` — Background download of official release assets.
- `POST /api/updates/apply` — Stage downloaded release assets for installation.
