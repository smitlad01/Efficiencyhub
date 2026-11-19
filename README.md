# EfficiencyHub

<div align="center">

![EfficiencyHub Logo](https://raw.githubusercontent.com/smitlad01/Efficiencyhub/main/public/favicon.ico)

### The Intelligent Windows Process Governor & True Exit Daemon
**Automatically throttle background power hogs, eliminate ghost tray apps, and reclaim CPU & RAM without breaking your system.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows 10 | 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-0078D6.svg?logo=windows)](SAFETY.md)
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20(100%25%20Local)-brightgreen.svg)](PRIVACY.md)
[![Security Policy](https://img.shields.io/badge/Security-Protected%20Core-emerald.svg)](SECURITY.md)
[![Tests Passing](https://img.shields.io/badge/Tests-82%20Passing-success.svg)](tests/)
[![GitHub Stars](https://img.shields.io/github/stars/smitlad01/Efficiencyhub?style=social)](https://github.com/smitlad01/Efficiencyhub.git)

<p align="center">
  <a href="https://github.com/smitlad01/Efficiencyhub/raw/main/installer/Output/EfficiencyHub_Setup_v2.4.0.exe">
    <img src="https://img.shields.io/badge/Download_Setup_.EXE-EfficiencyHub_v2.4.0-2ea44f?style=for-the-badge&logo=windows&logoColor=white" height="42" alt="Download EfficiencyHub Setup .exe" />
  </a>
</p>
<p align="center">
  <b><a href="https://github.com/smitlad01/Efficiencyhub/raw/main/installer/Output/EfficiencyHub_Setup_v2.4.0.exe">⚡ Click Here to Download EfficiencyHub_Setup_v2.4.0.exe (Standalone Windows Installer)</a></b><br>
  <sub>Standard Windows Setup • Pre-flight Permission Checks • Zero Telemetry • 1-Click Install</sub>
</p>

[Features](#features) • [Download Installer](#installation) • [How It Works](#how-it-works) • [Security & Safety](#security--system-safety) • [API](#api) • [Documentation](#documentation)

</div>

---

## The Problem EfficiencyHub Solves

Have you ever clicked the `X` button on Discord, Spotify, Steam, or heavy productivity tools, only to discover later in Task Manager that **6 to 12 background helper processes are still running**, eating 800+ MB of RAM and draining your laptop battery?

- ❌ Most modern desktop apps (Electron, Chromium, Game Launchers) refuse to quit when closed, hiding silently in the system tray.
- ❌ Windows Task Manager forces you to manually find and "End Task" every single time.
- ❌ Background background updaters and telemetry workers frequently wake up CPU cores, causing micro-stutter in games.

**EfficiencyHub fixes this permanently.** It runs quietly as an ultra-lightweight background daemon (<0.1% CPU) and gives you full control over your machine's hardware scheduling and application lifecycles.

---

## Features

- ⚡ **Instant Auto-Kill on Window Close**: When you close a configured application by clicking its `X`, its entire lingering process tree is terminated in under **350ms**. No more ghost tray apps running in the background.
- 🍃 **Hardware EcoQoS Throttling**: Automatically clamps designated background processes to Microsoft Windows EcoQoS (Efficiency Mode) and idle CPU scheduling, down-clocking execution to low-power efficiency cores.
- 🛡️ **Immutable Protected Core**: Built-in, hardcoded guardrails prevent terminating or throttling essential OS components: **Windows Defender (`MsMpEng.exe`)**, **Explorer**, **Task Manager**, and active web browsers can never be harmed.
- 🚀 **Zero-Restart Real-Time Policy Sync**: Add, toggle, or remove process rules from the dashboard; changes take effect in milliseconds via a high-performance Windows Named Pipe IPC (`\\.\pipe\EfficiencyHubSync`) without restarting the app or daemon.
- 📊 **Unified Process Ledger**: Persistent visibility over all active and stopped applications. Configure rules even when the target app is closed, with live status indicators and instant toggles.
- 🔑 **One-Click UAC Elevation**: Smart permission verification detects whether administrative privileges are present and provides a single-click button to elevate via native Windows UAC.
- 🔄 **In-App Background Updates**: Seamlessly check for official releases on GitHub, download updates in the background, and apply them with one click.
- 🔒 **100% Offline & Zero Telemetry**: Operates strictly on `127.0.0.1`. No tracking SDKs, no diagnostic pings, no cloud telemetry. Your data stays entirely in local RAM.

---

## Comparison: Windows Task Manager vs EfficiencyHub

| Capability | Windows Task Manager | Third-Party "Boosters" | EfficiencyHub |
| :--- | :---: | :---: | :---: |
| **EcoQoS Efficiency Mode** | Manual per process | ❌ No | **✅ Automatic & Persistent** |
| **Auto-Kill on Window Close** | ❌ No | ❌ No | **✅ Instant (<350ms)** |
| **Background Quarantine** | ❌ No | Aggressive / Unsafe | **✅ Rule-based & Targeted** |
| **System Process Safety** | Basic warnings | Risky registry edits | **✅ Immutable Protected Core** |
| **Privacy & Telemetry** | Microsoft telemetry | Often bundled with adware | **✅ Zero Telemetry / 100% Local** |
| **Kernel Drivers Required** | Built-in | Often unsafe `.sys` drivers | **✅ 100% Userland (No BSODs)** |
| **License** | Proprietary | Commercial / Closed | **✅ 100% Open Source (MIT)** |

---

## How It Works

EfficiencyHub is built on an elegant, decoupled dual-process architecture:

1. **AutoEfficiencyWatcher (C# / Win32 Daemon)**:
   - Connects to Windows `WinSta0\Default` desktop station to monitor true window visibility.
   - Enforces process priorities via documented Win32 APIs (`SetPriorityClass`, `IDLE_PRIORITY_CLASS`).
   - Listens on `\\.\pipe\EfficiencyHubSync` for microsecond policy synchronization.
2. **EfficiencyHub Server & Web Console (Node.js)**:
   - Hosts the localhost management console on `http://127.0.0.1:5252`.
   - Exposes clean REST endpoints for process inspection and rule management.
   - Handles background update verification directly with the GitHub Releases API.

---

## Prerequisites

- **Operating System**: Windows 10 or Windows 11 (64-bit recommended)
- **Runtime**: Microsoft .NET Framework 4.5 or higher (included by default on Windows 10/11)
- **Node.js**: v16.0.0 or higher (required for server and web console)

---

## Installation

### 🚀 Direct Standalone Installer Download (.exe) — Recommended
> ### [⬇️ **Download EfficiencyHub_Setup_v2.4.0.exe**](https://github.com/smitlad01/Efficiencyhub/raw/main/installer/Output/EfficiencyHub_Setup_v2.4.0.exe)
> *(Direct download of compiled Windows installer executable • 2.1 MB)*
>
> 1. Download **[`EfficiencyHub_Setup_v2.4.0.exe`](https://github.com/smitlad01/Efficiencyhub/raw/main/installer/Output/EfficiencyHub_Setup_v2.4.0.exe)**.
> 2. Right-click and choose **Run as administrator** (pre-flight checks ensure required Windows permissions, .NET 4.5+, and Node.js are present before proceeding).
> 3. Finish the wizard: EfficiencyHub will automatically configure the background daemon and launch the dashboard.
>
> > **Note on Windows SmartScreen**: If Windows displays *"Windows protected your PC"*, simply click **More info** ➔ **Run anyway**. This standard prompt appears for newly-published open-source software that does not use commercial enterprise code-signing certificates.

---

### Option 2: Run Directly from Source
```cmd
git clone https://github.com/smitlad01/Efficiencyhub.git
cd Efficiencyhub
npm install
node server.js
```

---

## Usage

### 🎯 1-Click Unified Gateway (`EfficiencyHub.exe`)
Simply double-click the **EfficiencyHub** shortcut on your Desktop or `EfficiencyHub.exe` in the installed directory:
- **Zero Configuration**: Automatically verifies and launches `AutoEfficiencyWatcher.exe` and `server.js` silently in the background (no persistent terminal windows).
- **100% Working Mode**: Ensures all backend hooks, named pipe IPC, and real-time process synchronizations are live before opening `http://127.0.0.1:5252`.
- **Filesystem Resilient**: Double-clicking `index.html` directly from Explorer automatically connects to the local gateway or informs you of daemon status, so opening any file will never disrupt your workflow.

### Alternative: CLI / Source Launch
```cmd
node server.js
```
Then navigate to `http://127.0.0.1:5252`.

### Managing Policies & Processes:
1. **Registering a Rule**:
   - Type an application name (e.g. `discord`, `spotify`, `steam`, `notion`) into the **Register Policy** dock.
   - Click **+ Auto-Kill on Close** to terminate the app whenever its window is closed.
   - Click **+ Enforce EcoQoS** to lock its priority to idle efficiency mode.
   - Click **+ Quarantine Spawn** to terminate unwanted background updaters on sight.
2. **Elevation**:
   - If started unprivileged, a banner will appear at the top. Click **Relaunch as Administrator** to grant full process management privileges in one click.

---

## Building

### Compiling the C# Watcher Daemon
```cmd
csc /target:winexe /optimize+ /out:AutoEfficiencyWatcher.exe AutoEfficiencyWatcher.cs
```

### Packaging the Standalone Installer
Make sure [Inno Setup 6](https://jrsoftware.org/isdl.php) is installed, then run:
```powershell
powershell -ExecutionPolicy Bypass -File build_installer.ps1
```

---

## API

EfficiencyHub provides a fast, localhost-only REST API bound to `127.0.0.1:5252`:

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/status` | `GET` | Returns OS privilege level (`elevated: true/false`), daemon state, and version. |
| `/api/elevate` | `POST` | Dispatches sanitized one-click UAC elevation and gracefully hands off port 5252. |
| `/api/rules` | `GET` | Returns active efficiency, normal, auto-kill, and quarantine rule arrays. |
| `/api/rules/toggle` | `POST` | Toggles or registers a policy rule with zero-latency daemon IPC sync. |
| `/api/processes` | `GET` | Returns live running processes, RAM working set (MB), CPU time, and priority class. |
| `/api/process/kill` | `POST` | Terminates a specific PID or entire process tree (`closeAll: true`). |
| `/api/system` | `GET` | Returns system-wide memory telemetry (Total, Free, Used GB). |
| `/api/updates/check` | `GET` | Queries GitHub Releases API for newer version tags. |
| `/api/updates/download`| `POST`| Downloads official update executable in the background. |
| `/api/updates/apply` | `POST` | Stages and verifies downloaded release assets for installation. |

---

## Documentation

- 🛡️ **[Security Policy & Protected Core (SECURITY.md)](SECURITY.md)**: Threat model, zero kernel driver guarantees, and protected process lists.
- 🔒 **[Privacy Policy & Zero-Telemetry Guarantee (PRIVACY.md)](PRIVACY.md)**: Details on localhost isolation, no tracking SDKs, and local JSON storage.
- 📖 **[Antivirus, Transparency & Safety Guide (SAFETY.md)](SAFETY.md)**: Explanation of Win32 APIs, heuristic false positive prevention, and audit steps.

---

## Contributing

Contributions, bug reports, and feature requests are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Run the automated test suite to verify all checks pass:
   ```cmd
   npm test
   ```
4. Commit your changes (`git commit -m 'feat: add amazing feature'`).
5. Push to the branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

<div align="center">

**[EfficiencyHub on GitHub](https://github.com/smitlad01/Efficiencyhub.git)** • Developed with care for peak PC performance.

</div>
