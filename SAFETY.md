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

## 2. Antivirus Scanners, False Positives & Smart App Control

### Understanding Windows 11 Smart App Control & Heuristic Flags
When running or analyzing `EfficiencyHub_Setup_v2.4.0.exe`, users may encounter alerts from **Windows 11 Smart App Control** or generic static machine-learning models (such as *CrowdStrike ML / Hybrid Analysis* flagging with "bottom confidence"):

1. **Windows 11 Smart App Control (SAC)**:
   - Smart App Control is a strict cloud-reputation gate in Windows 11.
   - Any executable downloaded from a web browser automatically receives the Windows **Mark of the Web** (`Zone.Identifier` stream).
   - If an open-source project does not purchase an expensive commercial Extended Validation (EV) certificate ($400+/year), SAC blocks execution with: *"Smart App Control blocked an app that may be unsafe because we could not verify its publisher"*.
   
2. **CrowdStrike ML / Hybrid Analysis Heuristic (1/26 Detection, 25/26 Clean)**:
   - In automated sandbox reports (e.g. Hybrid Analysis), 25 out of 26 antivirus engines (Microsoft Defender, Kaspersky, Bitdefender, Sophos, ESET, etc.) score EfficiencyHub **100% Clean**.
   - A single engine (*CrowdStrike Falcon ML On-Sensor*) flags unfamiliar Inno Setup installer stubs with "bottom confidence" (labeled heuristically as `TrojanDldr.OffLoader.gen`).
   - This occurs purely because the installer decompresses and stages local utility files (`EfficiencyHub.exe`, `server.js`, `AutoEfficiencyWatcher.exe`) without a commercial EV signature.

---

## 3. How to Resolve Smart App Control & Run EfficiencyHub

### Option A: Unblock Mark of the Web (Fastest)
1. In Windows Explorer, navigate to your `Downloads` folder.
2. Right-click **`EfficiencyHub_Setup_v2.4.0.exe`** and select **Properties**.
3. At the bottom of the **General** tab, check the **Unblock** box.
4. Click **Apply** and **OK**.
5. Run the installer normally.

### Option B: Automated 1-Click PowerShell Install
Run this single command in PowerShell to automatically download, unblock, and launch the installer:
```powershell
irm https://raw.githubusercontent.com/smitlad01/Efficiencyhub/main/install.ps1 | iex
```

### Option C: Download Portable Zero-Install ZIP
If you prefer not to run an installer `.exe`:
1. Download **`EfficiencyHub-v2.4.0-portable.zip`**.
2. Extract the folder anywhere on your PC.
3. Double-click **`EfficiencyHub.exe`** to launch the gateway in 100% working mode.

---

## 4. How to Verify and Self-Compile from Source

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
