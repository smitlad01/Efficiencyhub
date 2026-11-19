using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text.RegularExpressions;
using System.Threading;

namespace AutoEfficiency {
    static class Program {
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetPriorityClass(IntPtr hProcess, uint dwPriorityClass);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetProcessInformation(
            IntPtr hProcess,
            int ProcessInformationClass,
            ref PROCESS_POWER_THROTTLING_STATE ProcessInformation,
            uint ProcessInformationSize
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool CloseHandle(IntPtr hObject);

        [DllImport("user32.dll")]
        static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetThreadDesktop(IntPtr hDesktop);

        const uint DESKTOP_ALL = 0x01FF;

        static void EnsureDefaultDesktopAttached() {
            try {
                IntPtr hDesktop = OpenDesktop("Default", 0, false, DESKTOP_ALL);
                if (hDesktop != IntPtr.Zero) {
                    SetThreadDesktop(hDesktop);
                }
            } catch {}
        }

        const uint PROCESS_SET_INFORMATION = 0x0200;
        const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
        const uint IDLE_PRIORITY_CLASS = 0x00000040;
        const uint NORMAL_PRIORITY_CLASS = 0x00000020;
        const int ProcessPowerThrottling = 4;
        const uint PROCESS_POWER_THROTTLING_CURRENT_VERSION = 1;
        const uint PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1;
        const uint PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION = 0x4;

        [StructLayout(LayoutKind.Sequential)]
        struct PROCESS_POWER_THROTTLING_STATE {
            public uint Version;
            public uint ControlMask;
            public uint StateMask;
        }

        static void Log(string msg) {
            try {
                string logFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "watcher.log");
                File.AppendAllText(logFile, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}\r\n", DateTime.Now, msg));
            } catch {}
        }

        static bool ApplyEfficiencyMode(int pid) {
            IntPtr h = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (h == IntPtr.Zero) return false;
            try {
                SetPriorityClass(h, IDLE_PRIORITY_CLASS);

                uint flags = PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION;
                var state = new PROCESS_POWER_THROTTLING_STATE {
                    Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION,
                    ControlMask = flags,
                    StateMask = flags
                };
                return SetProcessInformation(h, ProcessPowerThrottling, ref state, (uint)Marshal.SizeOf(typeof(PROCESS_POWER_THROTTLING_STATE)));
            } catch {
                return false;
            } finally {
                CloseHandle(h);
            }
        }

        static bool ApplyNormalMode(int pid) {
            IntPtr h = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (h == IntPtr.Zero) return false;
            try {
                SetPriorityClass(h, NORMAL_PRIORITY_CLASS);

                uint flags = PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION;
                var state = new PROCESS_POWER_THROTTLING_STATE {
                    Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION,
                    ControlMask = flags,
                    StateMask = 0
                };
                return SetProcessInformation(h, ProcessPowerThrottling, ref state, (uint)Marshal.SizeOf(typeof(PROCESS_POWER_THROTTLING_STATE)));
            } catch {
                return false;
            } finally {
                CloseHandle(h);
            }
        }

        static void EnsureOmenServicesStarted() {
            string[] omenServices = new string[] { "HPOmenCap", "HPSysInfoCap", "HPAppHelperCap", "HPNetworkCap" };
            foreach (var svcName in omenServices) {
                try {
                    // Set startup to Automatic via sc.exe
                    try {
                        var psi = new ProcessStartInfo("sc.exe", "config " + svcName + " start= auto") {
                            CreateNoWindow = true,
                            UseShellExecute = false
                        };
                        using (var p = Process.Start(psi)) {
                            p.WaitForExit(1000);
                        }
                    } catch {}

                    using (var sc = new ServiceController(svcName)) {
                        if (sc.Status == ServiceControllerStatus.Stopped || sc.Status == ServiceControllerStatus.Paused) {
                            sc.Start();
                            Log("Self-healed Omen hardware service: " + svcName);
                        }
                    }
                } catch (Exception ex) {
                    Log("Service " + svcName + " check error: " + ex.Message);
                }
            }
        }

        static readonly string[] SystemExcludes = new string[] {
            "wuauserv", "usosvc", "tiworker", "trustedinstaller", "svchost",
            "system", "idle", "registry", "explorer", "taskmgr", "csrss",
            "lsass", "winlogon", "dwm", "antigravity", "agy", "code",
            "node", "powershell", "cmd", "hpomencap", "hpsysinfocap", "hpapphelpercap"
        };

        // These UI executables must run at full Normal speed so their DirectX / WebView2 GUI renders immediately
        static readonly string[] GuiAppsNormalPriority = new string[] {
            "hp.omen.omencommandcenter", "chrome", "brave", "msedge", "antigravity", "code", "taskmgr", "explorer"
        };

        static readonly string[] ProtectedCoreApps = new string[] {
            "chrome", "brave", "msedge", "antigravity", "agy", "code", "explorer", "taskmgr",
            "hpomencap", "hpsysinfocap", "hpapphelpercap", "omen", "hp.omen.omencommandcenter"
        };

        static bool IsProtected(string name) {
            string lower = name.ToLowerInvariant();
            foreach (var app in ProtectedCoreApps) {
                if (lower.IndexOf(app, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            }
            return false;
        }

        static bool IsGuiAppNormal(string name) {
            string lower = name.ToLowerInvariant();
            foreach (var app in GuiAppsNormalPriority) {
                if (lower.IndexOf(app, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            }
            return false;
        }

        static AutoResetEvent wakeSignal = new AutoResetEvent(false);
        static List<string> EfficiencyRules = new List<string>();
        static List<string> NormalRules = new List<string>();
        static List<string> AutoKillOnCloseRules = new List<string>();
        static List<string> BanFromBackgroundRules = new List<string>();
        static DateTime LastRulesModTime = DateTime.MinValue;
        static string CurrentRulesPath = "";

        // Tracks app window state
        static Dictionary<string, bool> WindowWasActive = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        static Dictionary<string, DateTime> WindowClosedTime = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        static Dictionary<string, DateTime> AppFirstSeen = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);

        static void StartNamedPipeServer() {
            Thread pipeThread = new Thread(new ThreadStart(NamedPipeServerLoop));
            pipeThread.IsBackground = true;
            pipeThread.Start();
        }

        static void NamedPipeServerLoop() {
            Log("NamedPipeServerLoop started");
            while (true) {
                try {
                    PipeSecurity pipeSecurity = new PipeSecurity();
                    SecurityIdentifier worldSid = new SecurityIdentifier(WellKnownSidType.WorldSid, null);
                    pipeSecurity.AddAccessRule(new PipeAccessRule(worldSid, PipeAccessRights.ReadWrite, AccessControlType.Allow));

                    using (NamedPipeServerStream pipeServer = new NamedPipeServerStream(
                        "EfficiencyHubSync",
                        PipeDirection.InOut,
                        NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Byte,
                        PipeOptions.None,
                        1024,
                        1024,
                        pipeSecurity)) {

                        Log("NamedPipeServerStream listening on EfficiencyHubSync");
                        pipeServer.WaitForConnection();
                        try {
                            using (StreamReader reader = new StreamReader(pipeServer)) {
                                string cmd = reader.ReadLine();
                                Log("Named pipe command received: " + cmd);
                                wakeSignal.Set();
                            }
                        } catch (Exception ex) {
                            Log("Pipe read error: " + ex.Message);
                        }
                    }
                } catch (Exception ex) {
                    Log("Named pipe server error: " + ex.Message);
                    Thread.Sleep(500);
                }
            }
        }

        static void SetupFileSystemWatchers() {
            try {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                SetupWatcherForDir(baseDir);

                string appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AutoEfficiencyWatcher");
                if (!Directory.Exists(appDataDir)) {
                    try { Directory.CreateDirectory(appDataDir); } catch {}
                }
                if (Directory.Exists(appDataDir) && !string.Equals(baseDir.TrimEnd('\\', '/'), appDataDir.TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase)) {
                    SetupWatcherForDir(appDataDir);
                }
            } catch (Exception ex) {
                Log("SetupFileSystemWatchers error: " + ex.Message);
            }
        }

        static void SetupWatcherForDir(string dir) {
            try {
                FileSystemWatcher fsw = new FileSystemWatcher(dir, "rules.json");
                fsw.NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size;
                FileSystemEventHandler changeHandler = new FileSystemEventHandler(OnRulesFileChanged);
                fsw.Changed += changeHandler;
                fsw.Created += changeHandler;
                fsw.Renamed += new RenamedEventHandler(OnRulesFileRenamed);
                fsw.EnableRaisingEvents = true;
            } catch (Exception ex) {
                Log("Watcher error for " + dir + ": " + ex.Message);
            }
        }

        static void OnRulesFileChanged(object sender, FileSystemEventArgs e) {
            Log("FileSystemWatcher detected rules change: " + e.FullPath);
            wakeSignal.Set();
        }

        static void OnRulesFileRenamed(object sender, RenamedEventArgs e) {
            Log("FileSystemWatcher detected rules rename: " + e.FullPath);
            wakeSignal.Set();
        }

        static string GetEffectiveRulesPath() {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string baseRules = Path.Combine(baseDir, "rules.json");
            string appDataRules = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AutoEfficiencyWatcher\\rules.json");

            bool baseExists = File.Exists(baseRules);
            bool appDataExists = File.Exists(appDataRules);

            if (baseExists && appDataExists) {
                DateTime baseTime = File.GetLastWriteTimeUtc(baseRules);
                DateTime appDataTime = File.GetLastWriteTimeUtc(appDataRules);
                return (appDataTime > baseTime) ? appDataRules : baseRules;
            } else if (appDataExists) {
                return appDataRules;
            } else if (baseExists) {
                return baseRules;
            }
            return baseRules;
        }

        static List<string> ParseJsonArray(string json, string key) {
            var list = new List<string>();
            var match = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\\[([^\\]]*)\\]", RegexOptions.IgnoreCase);
            if (match.Success) {
                var items = Regex.Matches(match.Groups[1].Value, "\"([^\"]+)\"");
                foreach (Match m in items) {
                    string val = m.Groups[1].Value.Trim().ToLowerInvariant();
                    if (!string.IsNullOrEmpty(val)) list.Add(val);
                }
            }
            return list;
        }

        static bool LoadRules(string rulesPath) {
            try {
                if (!File.Exists(rulesPath)) return false;
                var fi = new FileInfo(rulesPath);
                if (fi.LastWriteTimeUtc == LastRulesModTime && string.Equals(rulesPath, CurrentRulesPath, StringComparison.OrdinalIgnoreCase)) {
                    return false;
                }

                LastRulesModTime = fi.LastWriteTimeUtc;
                CurrentRulesPath = rulesPath;
                string json = File.ReadAllText(rulesPath);

                EfficiencyRules = ParseJsonArray(json, "efficiency");
                NormalRules = ParseJsonArray(json, "normal");
                AutoKillOnCloseRules = ParseJsonArray(json, "auto_kill_on_close");
                BanFromBackgroundRules = ParseJsonArray(json, "ban_from_background");
                Log(string.Format("Rules reloaded from {0}. Efficiency={1}, Normal={2}, AutoKill={3}, Ban={4}",
                    rulesPath, EfficiencyRules.Count, NormalRules.Count, AutoKillOnCloseRules.Count, BanFromBackgroundRules.Count));
                return true;
            } catch (Exception ex) {
                Log("LoadRules error: " + ex.Message);
                return false;
            }
        }

        static bool MatchesList(string procName, List<string> list) {
            string lower = procName.ToLowerInvariant();
            foreach (var item in list) {
                if (lower.IndexOf(item, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            }
            return false;
        }

        static bool IsSystemExcluded(string name) {
            string lower = name.ToLowerInvariant();
            foreach (var exc in SystemExcludes) {
                if (lower.Equals(exc, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        static HashSet<int> GetPidsWithVisibleWindows() {
            var pids = new HashSet<int>();
            try {
                EnsureDefaultDesktopAttached();
                EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
                    if (IsWindowVisible(hWnd) && GetWindowTextLength(hWnd) > 0) {
                        uint pid;
                        GetWindowThreadProcessId(hWnd, out pid);
                        pids.Add((int)pid);
                    }
                    return true;
                }, IntPtr.Zero);
            } catch {}
            return pids;
        }

        [STAThread]
        static void Main(string[] args) {
            AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) {
                Log("FATAL CRASH: " + (e.ExceptionObject != null ? e.ExceptionObject.ToString() : "unknown"));
            };

            Process current = Process.GetCurrentProcess();
            foreach (Process oldProc in Process.GetProcessesByName(current.ProcessName)) {
                if (oldProc.Id != current.Id) {
                    try { oldProc.Kill(); } catch {}
                }
            }

            EnsureDefaultDesktopAttached();
            StartNamedPipeServer();
            SetupFileSystemWatchers();

            string rulesPath = GetEffectiveRulesPath();
            Log(string.Format("AutoEfficiencyWatcher started (PID {0}). Rules path: {1}", current.Id, rulesPath));
            LoadRules(rulesPath);

            // Initial self-heal of essential hardware services
            EnsureOmenServicesStarted();

            var processedEffPids = new HashSet<int>();
            var processedNormPids = new HashSet<int>();
            int loopIteration = 0;

            while (true) {
                try {
                    string effectivePath = GetEffectiveRulesPath();
                    bool rulesReloaded = LoadRules(effectivePath);
                    if (rulesReloaded) {
                        // Rules changed on disk: immediately clear tracking state to re-apply updated policies
                        processedEffPids.Clear();
                        processedNormPids.Clear();
                        WindowWasActive.Clear();
                        WindowClosedTime.Clear();
                        AppFirstSeen.Clear();
                    }

                    loopIteration++;
                    // Periodically verify hardware services every 30 iterations (45 sec)
                    if (loopIteration % 30 == 0) {
                        EnsureOmenServicesStarted();
                    }

                    Process[] procs = Process.GetProcesses();
                    var livePids = new HashSet<int>();
                    var pidsWithWindows = GetPidsWithVisibleWindows();

                    var procsByName = new Dictionary<string, List<Process>>(StringComparer.OrdinalIgnoreCase);

                    foreach (var p in procs) {
                        int pid = p.Id;
                        livePids.Add(pid);
                        string name = p.ProcessName;
                        if (IsSystemExcluded(name)) continue;

                        // 1. BAN FROM BACKGROUND check (quarantined bloatware)
                        if (!IsProtected(name) && MatchesList(name, BanFromBackgroundRules)) {
                            try {
                                var psi = new ProcessStartInfo("taskkill.exe", string.Format("/F /T /PID {0}", pid)) {
                                    CreateNoWindow = true,
                                    UseShellExecute = false
                                };
                                using (var tp = Process.Start(psi)) {
                                    tp.WaitForExit(1000);
                                }
                            } catch {}
                            try {
                                if (!p.HasExited) p.Kill();
                            } catch {}
                            continue;
                        }

                        if (!procsByName.ContainsKey(name)) {
                            procsByName[name] = new List<Process>();
                        }
                        procsByName[name].Add(p);

                        // 2. Efficiency Mode configuration (EcoQoS + Idle Priority)
                        // Normal rules and GUI apps take strict precedence over generic efficiency rules
                        if (IsGuiAppNormal(name) || MatchesList(name, NormalRules)) {
                            if (!processedNormPids.Contains(pid)) {
                                if (ApplyNormalMode(pid)) {
                                    processedNormPids.Add(pid);
                                    processedEffPids.Remove(pid);
                                    Log(string.Format("Enforced Normal Mode: {0} (PID {1})", name, pid));
                                }
                            }
                        } else if (MatchesList(name, EfficiencyRules)) {
                            if (!processedEffPids.Contains(pid)) {
                                if (ApplyEfficiencyMode(pid)) {
                                    processedEffPids.Add(pid);
                                    processedNormPids.Remove(pid);
                                    Log(string.Format("Applied Efficiency Mode (EcoQoS + Idle) to {0} (PID {1})", name, pid));
                                }
                            }
                        }
                    }

                    DateTime now = DateTime.UtcNow;

                    // 3. AUTO-KILL ON CLOSE & BACKGROUND QUARANTINE
                    var terminationTargets = new HashSet<string>(AutoKillOnCloseRules, StringComparer.OrdinalIgnoreCase);
                    foreach (var b in BanFromBackgroundRules) terminationTargets.Add(b);

                    foreach (var targetKey in terminationTargets) {
                        if (IsProtected(targetKey)) continue;

                        List<Process> matchingProcs = new List<Process>();
                        foreach (var kvp in procsByName) {
                            if (kvp.Key.IndexOf(targetKey, StringComparison.OrdinalIgnoreCase) >= 0) {
                                matchingProcs.AddRange(kvp.Value);
                            }
                        }

                        if (matchingProcs.Count == 0) {
                            WindowWasActive.Remove(targetKey);
                            WindowClosedTime.Remove(targetKey);
                            AppFirstSeen.Remove(targetKey);
                            continue;
                        }

                        if (!AppFirstSeen.ContainsKey(targetKey)) {
                            AppFirstSeen[targetKey] = now;
                        }

                        bool hasVisibleWindow = false;
                        foreach (var p in matchingProcs) {
                            if (pidsWithWindows.Contains(p.Id)) {
                                hasVisibleWindow = true;
                                break;
                            }
                        }

                        // If window is visible, user is actively using the app
                        if (hasVisibleWindow) {
                            WindowWasActive[targetKey] = true;
                            WindowClosedTime.Remove(targetKey);
                            continue;
                        }

                        // App is running in background with NO visible window
                        double lifetimeSec = (now - AppFirstSeen[targetKey]).TotalSeconds;
                        bool wasActive = WindowWasActive.ContainsKey(targetKey) && WindowWasActive[targetKey];
                        bool isBanned = MatchesList(targetKey, BanFromBackgroundRules);

                        bool shouldKill = false;
                        if (isBanned) {
                            // Quarantined background app: kill immediately
                            shouldKill = true;
                        } else if (wasActive) {
                            // User closed an active window: grace threshold <= 0.8s
                            if (!WindowClosedTime.ContainsKey(targetKey)) {
                                WindowClosedTime[targetKey] = now;
                            } else if ((now - WindowClosedTime[targetKey]).TotalSeconds >= 0.8) {
                                shouldKill = true;
                            }
                        } else {
                            // App never had a visible window (running strictly in background with no GUI)
                            // Under zero-latency auto-kill rule, terminate background process immediately
                            shouldKill = true;
                        }

                        if (shouldKill) {
                            Log(string.Format("Terminating lingering background process tree for: {0}", targetKey));
                            foreach (var p in matchingProcs) {
                                try {
                                    Log(string.Format("Executing taskkill /F /T /PID {0} for {1}", p.Id, targetKey));
                                    var psi = new ProcessStartInfo("taskkill.exe", string.Format("/F /T /PID {0}", p.Id)) {
                                        CreateNoWindow = true,
                                        UseShellExecute = false
                                    };
                                    using (var tp = Process.Start(psi)) {
                                        tp.WaitForExit(1000);
                                    }
                                } catch (Exception ex) {
                                    Log(string.Format("taskkill error on PID {0}: {1}", p.Id, ex.Message));
                                }

                                try {
                                    if (!p.HasExited) p.Kill();
                                } catch {}
                            }

                            WindowWasActive.Remove(targetKey);
                            WindowClosedTime.Remove(targetKey);
                            AppFirstSeen.Remove(targetKey);
                        }
                    }

                    // Clean up dead PIDs
                    processedEffPids.RemoveWhere(delegate(int pid) { return !livePids.Contains(pid); });
                    processedNormPids.RemoveWhere(delegate(int pid) { return !livePids.Contains(pid); });
                } catch (Exception ex) {
                    Log("Loop error: " + ex.Message);
                }

                // Wait for wake signal (IPC reload or FileSystemWatcher) or timeout (300ms for sub-second response)
                int waitTimeout = 300;
                wakeSignal.WaitOne(waitTimeout);
                Log("Woke from WaitOne");
            }
        }
    }
}
