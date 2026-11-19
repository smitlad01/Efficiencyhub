using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace EfficiencyHub
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;

                // 1. Guard against running from inside an unextracted ZIP (e.g. 7-Zip, WinRAR temp extraction)
                string serverScript = FindFile(baseDir, "server.js");
                if (string.IsNullOrEmpty(serverScript))
                {
                    MessageBox.Show(
                        "Please EXTRACT the ZIP folder before launching EfficiencyHub!\n\n" +
                        "You opened EfficiencyHub directly from inside 7-Zip, WinRAR, or Windows ZIP preview.\n" +
                        "In preview mode, required server and background components are not extracted.\n\n" +
                        "How to fix this in 10 seconds:\n" +
                        "1. Click the 'Extract' button at the top of 7-Zip / WinRAR (or right-click the .zip file and select 'Extract All').\n" +
                        "2. Open the extracted folder.\n" +
                        "3. Double-click 'EfficiencyHub.exe' or '1-CLICK-START-HERE.bat'.",
                        "EfficiencyHub — Extraction Required",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                    return;
                }

                string effectiveDir = Path.GetDirectoryName(serverScript);

                // 2. Ensure AutoEfficiencyWatcher daemon is running
                EnsureDaemonRunning(effectiveDir);

                // 3. Ensure Node.js server.js is running and responding on port 5252
                bool serverStarted = EnsureServerRunning(effectiveDir, serverScript);
                if (!serverStarted)
                {
                    MessageBox.Show(
                        "Could not connect to the local EfficiencyHub server.\n\n" +
                        "Please verify that Node.js (v18+) is installed and available in PATH (https://nodejs.org).\n" +
                        "If you prefer an automated setup with all dependencies verified, run 'EfficiencyHub_Setup_v2.4.0.exe'.",
                        "EfficiencyHub — Startup Notice",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                // 4. Open Web UI in default browser
                Process.Start(new ProcessStartInfo("http://127.0.0.1:5252") { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "EfficiencyHub Gateway encountered an unexpected issue:\n" + ex.Message,
                    "EfficiencyHub",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            }
        }

        static string FindFile(string startDir, string fileName)
        {
            // Check current directory
            string direct = Path.Combine(startDir, fileName);
            if (File.Exists(direct)) return direct;

            // Check parent directory
            string parent = Path.Combine(startDir, "..", fileName);
            if (File.Exists(parent)) return Path.GetFullPath(parent);

            // Check core or bin subfolders
            string core = Path.Combine(startDir, "core", fileName);
            if (File.Exists(core)) return core;

            string bin = Path.Combine(startDir, "bin", fileName);
            if (File.Exists(bin)) return bin;

            return null;
        }

        static void EnsureDaemonRunning(string baseDir)
        {
            try
            {
                Process[] existing = Process.GetProcessesByName("AutoEfficiencyWatcher");
                if (existing != null && existing.Length > 0)
                {
                    return; // Already active
                }

                string daemonPath = FindFile(baseDir, "AutoEfficiencyWatcher.exe");
                if (!string.IsNullOrEmpty(daemonPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = daemonPath;
                    psi.WorkingDirectory = Path.GetDirectoryName(daemonPath);
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    Process.Start(psi);
                }
            }
            catch { }
        }

        static bool EnsureServerRunning(string baseDir, string serverScript)
        {
            if (IsServerResponding())
            {
                return true; // Already responsive
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "node.exe";
                psi.Arguments = "\"" + serverScript + "\"";
                psi.WorkingDirectory = baseDir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process.Start(psi);
            }
            catch
            {
                try
                {
                    ProcessStartInfo psi2 = new ProcessStartInfo();
                    psi2.FileName = "node";
                    psi2.Arguments = "\"" + serverScript + "\"";
                    psi2.WorkingDirectory = baseDir;
                    psi2.UseShellExecute = false;
                    psi2.CreateNoWindow = true;
                    psi2.WindowStyle = ProcessWindowStyle.Hidden;
                    Process.Start(psi2);
                }
                catch { }
            }

            // Poll for server readiness (up to 4.5 seconds)
            for (int i = 0; i < 18; i++)
            {
                Thread.Sleep(250);
                if (IsServerResponding())
                {
                    return true;
                }
            }

            return IsServerResponding();
        }

        static bool IsServerResponding()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5252/api/status");
                req.Timeout = 500;
                req.Method = "GET";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
