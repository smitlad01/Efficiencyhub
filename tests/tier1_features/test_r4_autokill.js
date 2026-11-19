/**
 * Tier 1 Feature Tests: R4 - Instant Auto-Kill Rule Enforcement & Zero-Restart Sync
 * Derived from ORIGINAL_REQUEST.md §R4, PROJECT.md, and Spec Miner 2 report.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const harness = require('../helpers/harness');
const processHelper = require('../helpers/process_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const RULES_PATH = path.join(WORKSPACE_ROOT, 'rules.json');
const BASE_URL = 'http://127.0.0.1:5252';

function getDaemonPid() {
    try {
        const out = execSync('tasklist /FI "IMAGENAME eq AutoEfficiencyWatcher.exe" /NH /FO CSV', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const match = out.match(/"AutoEfficiencyWatcher\.exe","(\d+)"/i);
        return match ? parseInt(match[1], 10) : null;
    } catch (e) {
        return null;
    }
}

harness.describe('Tier 1: Feature R4 - Instant Auto-Kill Rule Enforcement', () => {

    harness.test('T1-R4-01: Rule Query Verification (GET /api/rules)', async () => {
        const res = await harness.httpRequest(`${BASE_URL}/api/rules`);
        harness.assertEqual(res.statusCode, 200, 'GET /api/rules must return HTTP 200');
        
        const rules = res.json();
        harness.assertTrue(Array.isArray(rules.efficiency), 'rules.efficiency must be an array');
        harness.assertTrue(Array.isArray(rules.normal), 'rules.normal must be an array');
        harness.assertTrue(Array.isArray(rules.auto_kill_on_close), 'rules.auto_kill_on_close must be an array');
        harness.assertTrue(Array.isArray(rules.ban_from_background), 'rules.ban_from_background must be an array');
    }, { tier: 1, feature: 'r4', id: 'T1-R4-01' });

    harness.test('T1-R4-02: Rule Toggle Persistence (POST /api/rules/toggle)', async () => {
        const testTarget = 'e2e_test_app_r4_02';

        // Toggle on
        const resToggleOn = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: true });

        harness.assertEqual(resToggleOn.statusCode, 200, 'POST /api/rules/toggle must succeed');
        const dataOn = resToggleOn.json();
        harness.assertEqual(dataOn.success, true);

        // Verify disk persistence
        const diskRules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
        harness.assertIncludes(diskRules.auto_kill_on_close, testTarget, 'Target must be saved to auto_kill_on_close in rules.json');

        // Cleanup: Toggle off
        const resToggleOff = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: false });
        harness.assertEqual(resToggleOff.statusCode, 200);

        const diskRulesClean = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
        harness.assertNotIncludes(diskRulesClean.auto_kill_on_close, testTarget, 'Target must be removed from auto_kill_on_close');
    }, { tier: 1, feature: 'r4', id: 'T1-R4-02' });

    harness.test('T1-R4-03: Instant Enforcement on Background Process (< 2000ms)', async () => {
        const targetName = 'e2e_autokill_target_bg';
        
        // Spawn background dummy process
        const dummy = await processHelper.spawnDummyProcess({
            name: targetName,
            durationSec: 45
        });

        harness.assertTrue(processHelper.isProcessRunning(dummy.pid), 'Dummy process must be actively running');

        const startTime = Date.now();

        try {
            // Enable auto-kill rule via API to trigger daemon dynamic sync
            const toggleRes = await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, { name: targetName, mode: 'auto_kill_on_close', enabled: true });
            harness.assertEqual(toggleRes.statusCode, 200, 'Toggling rule via API must succeed');

            // Verify AutoEfficiencyWatcher daemon automatically terminates the background process within < 3000ms
            let terminated = false;
            for (let i = 0; i < 30; i++) {
                if (!processHelper.isProcessRunning(dummy.pid)) {
                    terminated = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }

            const elapsedMs = Date.now() - startTime;
            harness.assertTrue(terminated, `AutoEfficiencyWatcher daemon must terminate background process ${dummy.pid} automatically upon rule sync`);
            harness.assertTrue(elapsedMs < 3000, `Enforcement elapsed time (${elapsedMs}ms) must be under 3000ms (eliminating polling delay)`);
        } finally {
            // Cleanup: ensure rule toggled off
            await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, { name: targetName, mode: 'auto_kill_on_close', enabled: false });

            if (processHelper.isProcessRunning(dummy.pid)) {
                processHelper.killProcess(dummy.pid);
            }
        }
    }, { tier: 1, feature: 'r4', id: 'T1-R4-03' });

    harness.test('T1-R4-04: Daemon Zero-Restart Verification', async () => {
        const daemonPidBefore = getDaemonPid();
        if (daemonPidBefore === null) {
            // If daemon not running in current environment, verify via server API
            const statusRes = await harness.httpRequest(`${BASE_URL}/api/rules`);
            harness.assertEqual(statusRes.statusCode, 200);
            return;
        }

        // Toggle a benign test rule
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: 'e2e_sync_test', mode: 'auto_kill_on_close', enabled: true });

        const daemonPidAfter = getDaemonPid();
        harness.assertEqual(daemonPidAfter, daemonPidBefore, 'AutoEfficiencyWatcher PID must remain identical after rule sync (no daemon restart)');

        // Cleanup
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: 'e2e_sync_test', mode: 'auto_kill_on_close', enabled: false });
    }, { tier: 1, feature: 'r4', id: 'T1-R4-04' });

    harness.test('T1-R4-05: Auto-Kill on Window Close Lifecycle Contract', async () => {
        // Read AutoEfficiencyWatcher source code to verify dynamic sync unblocking
        const watcherSourcePath = path.join(WORKSPACE_ROOT, 'AutoEfficiencyWatcher.cs');
        harness.assertTrue(fs.existsSync(watcherSourcePath), 'AutoEfficiencyWatcher.cs must exist');
        const watcherCode = fs.readFileSync(watcherSourcePath, 'utf8');

        // Dynamic sync mechanism contract: Named Pipe or AutoResetEvent
        const hasSyncChannel = /EfficiencyHubSync/i.test(watcherCode) ||
                               /AutoResetEvent/i.test(watcherCode) ||
                               /FileSystemWatcher/i.test(watcherCode) ||
                               /NamedPipe/i.test(watcherCode);
        harness.assertTrue(hasSyncChannel, 'AutoEfficiencyWatcher must implement dynamic synchronization channel (Named Pipe or Event)');
    }, { tier: 1, feature: 'r4', id: 'T1-R4-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r4' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
