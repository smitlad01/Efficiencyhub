using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

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

                // 1. Ensure AutoEfficiencyWatcher daemon is running
                EnsureDaemonRunning(baseDir);

                // 2. Ensure Node.js server.js is running and responding on port 5252
                EnsureServerRunning(baseDir);

                // 3. Open Web UI in default browser
                Process.Start(new ProcessStartInfo("http://127.0.0.1:5252") { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                // In case of error, show a lightweight informative message box
                System.Windows.Forms.MessageBox.Show(
                    "EfficiencyHub Gateway encountered an issue while initializing:\n" + ex.Message,
                    "EfficiencyHub",
                    System.Windows.Forms.MessageBoxButtons.OK,
                    System.Windows.Forms.MessageBoxIcon.Warning
                );
            }
        }

        static void EnsureDaemonRunning(string baseDir)
        {
            try
            {
                Process[] existing = Process.GetProcessesByName("AutoEfficiencyWatcher");
                if (existing != null && existing.Length > 0)
                {
                    return; // Already running
                }

                string daemonPath = Path.Combine(baseDir, "AutoEfficiencyWatcher.exe");
                if (File.Exists(daemonPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = daemonPath;
                    psi.WorkingDirectory = baseDir;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    Process.Start(psi);
                }
            }
            catch { }
        }

        static void EnsureServerRunning(string baseDir)
        {
            if (IsServerResponding())
            {
                return; // Already responsive
            }

            string serverScript = Path.Combine(baseDir, "server.js");
            if (File.Exists(serverScript))
            {
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
                    // Fallback to "node" in case node.exe is invoked via PATH without extension
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
                        break;
                    }
                }
            }
        }

        static bool IsServerResponding()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5252/api/status");
                req.Timeout = 600;
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
