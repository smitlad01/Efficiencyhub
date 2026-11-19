using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class EcoTest5 {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetPriorityClass(IntPtr hProcess, uint dwPriorityClass);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetProcessInformation(
        IntPtr hProcess,
        int ProcessInformationClass,
        ref PROCESS_POWER_THROTTLING_STATE ProcessInformation,
        uint ProcessInformationSize
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    const uint PROCESS_SET_INFORMATION = 0x0200;
    const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const uint IDLE_PRIORITY_CLASS = 0x00000040;
    const int ProcessPowerThrottling = 4;
    const uint PROCESS_POWER_THROTTLING_CURRENT_VERSION = 1;
    const uint PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1;
    const uint PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION = 0x4;

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_POWER_THROTTLING_STATE {
        public uint Version;
        public uint ControlMask;
        public uint StateMask;
    }

    public static void Main(string[] args) {
        uint flags = PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION;
        var procs = Process.GetProcessesByName("Discord");
        Console.WriteLine("Found Discord processes: " + procs.Length);
        foreach (var p in procs) {
            IntPtr h = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, false, p.Id);
            if (h == IntPtr.Zero) {
                Console.WriteLine("PID " + p.Id + " open failed: " + Marshal.GetLastWin32Error());
                continue;
            }
            bool pOk = SetPriorityClass(h, IDLE_PRIORITY_CLASS);
            var state = new PROCESS_POWER_THROTTLING_STATE {
                Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION,
                ControlMask = flags,
                StateMask = flags
            };
            bool sOk = SetProcessInformation(h, ProcessPowerThrottling, ref state, (uint)Marshal.SizeOf(typeof(PROCESS_POWER_THROTTLING_STATE)));
            int err = Marshal.GetLastWin32Error();
            CloseHandle(h);
            Console.WriteLine("PID " + p.Id + " applied: SetPriority=" + pOk + ", SetProcInfo=" + sOk + " (err " + err + ")");
        }
    }
}

