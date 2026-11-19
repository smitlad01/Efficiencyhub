/**
 * EfficiencyHub E2E Test Suite - Safe Process Helper & Lifecycle Registry
 * Manages test-isolated dummy processes, tracking, and guaranteed cleanup.
 * Zero external npm dependencies.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProcessHelper {
    constructor() {
        this.trackedProcesses = new Map(); // pid -> { child, name, exePath, startTime }
        this.createdFiles = new Set();
        this.fixturesDir = path.resolve(__dirname, '..', 'fixtures');
        this.templateExe = path.join(this.fixturesDir, 'dummy_worker.exe');

        this.protectedNames = new Set([
            'node', 'npm', 'code', 'explorer', 'antigravity', 'agy',
            'taskmgr', 'system', 'svchost', 'csrss', 'lsass', 'services',
            'smss', 'wininit', 'winlogon', 'hp.omen.omencommandcenter',
            'powershell', 'cmd'
        ]);

        // Auto-cleanup on process termination
        process.on('exit', () => this.cleanupAllSync());
        process.on('SIGINT', () => {
            this.cleanupAllSync();
            process.exit(1);
        });
        process.on('SIGTERM', () => {
            this.cleanupAllSync();
            process.exit(1);
        });
    }

    /**
     * Ensures the template executable exists or compiles it from dummy_worker.cs.
     */
    ensureTemplateExecutable() {
        if (!fs.existsSync(this.fixturesDir)) {
            fs.mkdirSync(this.fixturesDir, { recursive: true });
        }

        if (!fs.existsSync(this.templateExe)) {
            const csPath = path.join(this.fixturesDir, 'dummy_worker.cs');
            if (!fs.existsSync(csPath)) {
                fs.writeFileSync(csPath, [
                    'using System;',
                    'using System.Threading;',
                    'class Program {',
                    '    static void Main(string[] args) {',
                    '        int sec = 60;',
                    '        if (args.Length > 0) {',
                    '            int s;',
                    '            if (int.TryParse(args[0], out s)) sec = s;',
                    '        }',
                    '        Thread.Sleep(sec * 1000);',
                    '    }',
                    '}'
                ].join('\r\n'));
            }

            const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
            if (fs.existsSync(cscPath)) {
                execSync(`"${cscPath}" /nologo /target:winexe /out:"${this.templateExe}" "${csPath}"`, { stdio: 'ignore' });
            } else {
                // Fallback copy of cmd.exe
                fs.copyFileSync('C:\\Windows\\System32\\cmd.exe', this.templateExe);
            }
        }

        return this.templateExe;
    }

    /**
     * Resolves process name for a given PID via tasklist.
     */
    getProcessNameByPid(pid) {
        if (!pid || typeof pid !== 'number') return null;
        try {
            const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 2000
            });
            const match = output.match(/^"([^"]+)"/);
            return match ? match[1].toLowerCase().replace(/\.exe$/i, '').trim() : null;
        } catch {
            return null;
        }
    }

    /**
     * Verifies whether a PID belongs to a protected system process.
     */
    isProtectedPid(pid) {
        const procName = this.getProcessNameByPid(pid);
        if (!procName) return false;
        return this.protectedNames.has(procName);
    }

    /**
     * Spawns a harmless background dummy process with isolated PID.
     * Sanitizes durationSec to strictly positive integer preventing injection.
     * Generates a named executable so process table reflects the rule target name.
     */
    async spawnDummyProcess(options = {}) {
        const {
            durationSec = 60,
            name = 'ehub_dummy_app'
        } = options;

        // Sanitize duration to prevent command injection
        const safeDuration = Math.max(1, parseInt(durationSec, 10) || 60);
        // Normalize name: strip invalid filename chars
        const safeName = String(name).replace(/[^a-zA-Z0-9_\-]/g, '_') || 'ehub_dummy_app';

        this.ensureTemplateExecutable();

        const targetExe = path.join(this.fixturesDir, `${safeName}.exe`);
        if (!fs.existsSync(targetExe)) {
            try {
                fs.copyFileSync(this.templateExe, targetExe);
                this.createdFiles.add(targetExe);
            } catch (err) {
                // If in use or copy fails, fallback to templateExe
            }
        }

        const exeToRun = fs.existsSync(targetExe) ? targetExe : this.templateExe;

        return new Promise((resolve, reject) => {
            const child = spawn(exeToRun, [String(safeDuration)], {
                windowsHide: true,
                detached: false,
                stdio: 'ignore'
            });

            child.on('error', err => {
                reject(new Error(`Failed to spawn dummy process: ${err.message}`));
            });

            if (child.pid) {
                const pid = child.pid;
                this.trackedProcesses.set(pid, {
                    child,
                    name: safeName,
                    exePath: exeToRun,
                    startTime: Date.now()
                });

                // Short delay to ensure process initialized in OS process table
                setTimeout(() => {
                    resolve({
                        pid,
                        name: safeName,
                        child,
                        exePath: exeToRun
                    });
                }, 100);
            } else {
                reject(new Error('Spawned child process lacked a valid PID'));
            }
        });
    }

    /**
     * Checks if a process with specified PID is currently alive in Windows.
     */
    isProcessRunning(pid) {
        if (!pid || typeof pid !== 'number') return false;
        try {
            process.kill(pid, 0);
            return true;
        } catch (e) {
            if (e.code === 'EPERM') return true; // Exists but no permission to signal
            return false;
        }
    }

    /**
     * Safely terminates a process tree by PID.
     * Enforces guardrails so protected system processes cannot be terminated.
     */
    killProcess(pid, forceAllowUntracked = false) {
        if (!pid) return false;

        if (!forceAllowUntracked && !this.trackedProcesses.has(pid)) {
            throw new Error(`ProcessHelper guardrail violation: Refusing to kill untracked PID ${pid}`);
        }

        // Check protected system process guardrails
        if (this.isProtectedPid(pid)) {
            throw new Error(`ProcessHelper guardrail violation: Refusing to kill protected system process PID ${pid}`);
        }

        try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            this.trackedProcesses.delete(pid);
            return true;
        } catch (e) {
            this.trackedProcesses.delete(pid);
            return false;
        }
    }

    /**
     * Terminate all tracked processes created during the test run.
     */
    cleanupAll() {
        for (const [pid] of this.trackedProcesses.entries()) {
            try {
                if (!this.isProtectedPid(pid)) {
                    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
                }
            } catch (e) {}
        }
        this.trackedProcesses.clear();

        for (const file of this.createdFiles) {
            try {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (e) {}
        }
        this.createdFiles.clear();
    }

    cleanupAllSync() {
        for (const [pid] of this.trackedProcesses.entries()) {
            try {
                if (!this.isProtectedPid(pid)) {
                    execSync(`taskkill /F /T /PID ${pid} >nul 2>&1`);
                }
            } catch (e) {}
        }
        this.trackedProcesses.clear();

        for (const file of this.createdFiles) {
            try {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (e) {}
        }
        this.createdFiles.clear();
    }
}

module.exports = new ProcessHelper();
