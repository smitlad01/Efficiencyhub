# Changelog

All notable changes to **EfficiencyHub** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2026-11-19

### Added
- **True Exit Auto-Kill**: Instant (<350ms) background termination for configured applications when their primary window is closed.
- **Named Pipe IPC (`\\.\pipe\EfficiencyHubSync`)**: Zero-restart real-time synchronization between Node.js API and the C# background watcher daemon.
- **One-Click UAC Elevation**: Smart pre-launch permission checks with graceful port release and UAC relaunch.
- **Persistent Rule Matrix**: Full visibility over configured auto-kill and quarantine rules even when target processes are not running.
- **Background Auto-Updater**: In-app GitHub release verification, background downloading, and staging.
- **Pre-Flight Gated Installer**: Inno Setup installer script enforcing Administrator privileges, .NET 4.5+, and Node.js runtime.
- **Security & Trust Documentation**: Comprehensive `SECURITY.md`, `PRIVACY.md`, and `SAFETY.md` detailing 100% userland isolation, zero telemetry, and protected system components.
- **Comprehensive E2E Test Suite**: 82 automated test specifications across feature contracts, error boundaries, interactions, and operational lifecycles.

### Changed
- Streamlined dashboard UI by removing redundant top stat cards to reclaim vertical space for the process ledger.
- Hardcoded protected application lockdown for Windows Defender, Explorer, Task Manager, and active web browsers.

### Fixed
- Fixed port `EADDRINUSE` conflict on administrative elevation relaunch.
- Fixed 15-second background polling delay by migrating watcher to an event-driven loop.
