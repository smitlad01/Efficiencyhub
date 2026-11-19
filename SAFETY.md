# Safety, Transparency & Antivirus Guide

When installing third-party utilities that manage system performance, safety and trust are paramount. This document provides complete transparency regarding how EfficiencyHub operates, how it interacts with the Windows operating system, and how false positive antivirus detections are prevented.

---

## 1. How EfficiencyHub Works Under the Hood

EfficiencyHub is an automated resource optimization tool for Windows 10 and 11. It reduces background CPU and battery drain by managing process priorities and terminating configured background bloatware.

### A. Documented Microsoft Windows APIs
EfficiencyHub does **not** inject DLLs, patch system binaries, hook kernel tables, or bypass OS security boundaries. It relies entirely on official, documented Microsoft Win32 APIs:

1. **Efficiency Mode / EcoQoS**:
   - Uses Microsoft's documented Quality of Service (QoS) scheduling APIs.
   - Sets process priority to `IDLE_PRIORITY_CLASS` (`0x00000040`) via `SetPriorityClass`.
   - Signals the Windows scheduler to assign low-priority CPU cores (Efficient E-cores on modern Intel/AMD CPUs) and down-clock power consumption for background tasks.
2. **Foreground Focus Recovery**:
   - Restores prioritized processes back to `NORMAL_PRIORITY_CLASS` (`0x00000020`) when brought into user focus.
3. **Lifecycle Termination (Auto-Kill & Quarantine)**:
   - Uses standard .NET `Process.Kill()` and Win32 `TerminateProcess` primitives to terminate designated background processes (e.g. game launchers, tray bloatware) only after their primary application window is closed.

---

## 2. Antivirus Scanners & False Positive Prevention

### Why System Utilities Can Trigger Heuristic Warnings
Antivirus software (such as Windows Defender, SmartScreen, or VirusTotal engines) uses heuristics to flag unfamiliar executables that interact with other running processes:
- **Process Enumeration**: Scanning active process handles (`GetProcesses()`) to read CPU and memory consumption.
- **Process Priority Management**: Invoking `SetPriorityClass` to throttle heavy background apps.
- **Elevation Prompts (UAC)**: Requesting Administrator elevation (`Start-Process -Verb RunAs`) to permit managing processes spawned by other user accounts or elevated services.
- **Unsigned Executables**: Newly compiled open-source binaries that do not possess expensive commercial Extended Validation (EV) code-signing certificates may trigger initial Windows SmartScreen warnings ("Windows protected your PC").

### How EfficiencyHub Prevents False Positives
- **Zero Binary Obfuscation**: The source code is compiled without obfuscators, crypters, or packers (like UPX) which are frequently associated with malware.
- **Deterministic Clean Builds**: The daemon (`AutoEfficiencyWatcher.exe`) is compiled cleanly using Microsoft's standard C# compiler (`csc.exe`).
- **Open Inspection**: Anyone can audit every line of source code before building or running.

---

## 3. How to Verify and Self-Compile from Source

You do not need to trust pre-built binaries. You can compile the daemon directly on your own PC using the built-in Microsoft .NET Framework compiler:

```cmd
cd C:\Users\HP\.gemini\antigravity\scratch\EfficiencyHub
csc /target:winexe /optimize+ /out:AutoEfficiencyWatcher.exe AutoEfficiencyWatcher.cs
```

To run the local server and dashboard:

```cmd
npm install
node server.js
```

---

## 4. System Stability & Safety Guarantees

EfficiencyHub is engineered with failure-safe design principles:

1. **Non-Destructive Execution**:
   - EcoQoS throttling only deprioritizes CPU cycles; it never terminates processes or alters application files on disk.
2. **Immutable Protected System Whitelist**:
   - Hardcoded protections prevent essential Windows OS processes (`explorer.exe`, `taskmgr.exe`, `csrss.exe`, `lsass.exe`, `svchost.exe`, `MsMpEng.exe`) and web browsers from being quarantined or killed.
3. **Graceful Degradation**:
   - If an operation fails due to insufficient permissions or access denied errors (e.g., protected anti-cheat game services), EfficiencyHub gracefully logs the exception without crashing or disrupting the running application.
4. **Clean Removal**:
   - EfficiencyHub makes no permanent registry modifications, installs no lingering system services, and leaves no filter drivers. Deleting the application directory or running the Inno Setup uninstaller completely restores your machine to its pristine state.
