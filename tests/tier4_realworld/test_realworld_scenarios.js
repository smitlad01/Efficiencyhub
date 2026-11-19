/**
 * Tier 4 Real-World Application Scenario Tests: End-to-End Operational Lifecycles
 * Derived from ORIGINAL_REQUEST.md, PROJECT.md, and Explorer 3 report §4.4.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');
const DomHelper = require('../helpers/dom_helper');
const MockServer = require('../helpers/mock_server');
const processHelper = require('../helpers/process_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(WORKSPACE_ROOT, 'public', 'index.html');
const RULES_PATH = path.join(WORKSPACE_ROOT, 'rules.json');
const BASE_URL = 'http://127.0.0.1:5252';

harness.describe('Tier 4: Real-World Operational Workflows', () => {

    harness.test('T4-RW-01: Cold Start, Admin Elevation & Dashboard Initialization (R1, R2, R5, R6)', async () => {
        // Step 1: Query backend status on cold start
        const statusRes = await harness.httpRequest(`${BASE_URL}/api/status`);
        harness.assertEqual(statusRes.statusCode, 200, 'Backend /api/status must be responsive on cold start');
        const status = statusRes.json();
        harness.assertEqual(typeof status.elevated, 'boolean');

        // Step 2: Verify dry-run elevation API contract
        const elevateRes = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/elevate',
            method: 'POST'
        }, { dryRun: true });
        harness.assertEqual(elevateRes.statusCode, 200);

        // Step 3: Verify dashboard UI layout has reclaimed space (R5)
        const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
        harness.assertFalse(/<div[^>]*class=["'][^"']*\bkpi-row\b[^"']*["']/i.test(html), 'Dashboard must not have top KPI block');

        // Step 4: Verify persistent rules loaded
        const rulesRes = await harness.httpRequest(`${BASE_URL}/api/rules`);
        harness.assertEqual(rulesRes.statusCode, 200);
        const rules = rulesRes.json();
        harness.assertTrue(rules.auto_kill_on_close.length > 0);
    }, { tier: 4, feature: 'r1+r2+r5+r6', id: 'T4-RW-01' });

    harness.test('T4-RW-02: Zero-Latency Auto-Kill Policy Enforcement on Active Spawn (R4, R6)', async () => {
        const targetApp = 'e2e_rw_tray_app';

        // 1. Arm auto-kill policy via API
        const armRes = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: targetApp, mode: 'auto_kill_on_close', enabled: true });
        harness.assertEqual(armRes.statusCode, 200, 'Arming auto-kill policy must succeed');

        let dummy;
        try {
            // 2. Launch background dummy target (matching armed auto-kill rule)
            dummy = await processHelper.spawnDummyProcess({ name: targetApp, durationSec: 30 });
            harness.assertTrue(processHelper.isProcessRunning(dummy.pid), 'Spawned dummy process must initially be running');

            // 3. Verify running AutoEfficiencyWatcher daemon automatically terminates the background target
            let isDead = false;
            for (let i = 0; i < 30; i++) {
                if (!processHelper.isProcessRunning(dummy.pid)) {
                    isDead = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            harness.assertTrue(isDead, 'Active AutoEfficiencyWatcher daemon must automatically terminate target process');
        } finally {
            // 4. Cleanup rule & lingering process
            await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, { name: targetApp, mode: 'auto_kill_on_close', enabled: false });

            if (dummy && processHelper.isProcessRunning(dummy.pid)) {
                processHelper.killProcess(dummy.pid);
            }
        }
    }, { tier: 4, feature: 'r4+r6', id: 'T4-RW-02' });

    harness.test('T4-RW-03: Background Quarantine & Kill-on-Sight Enforcement (R4, R6)', async () => {
        const quarantineTarget = 'e2e_quarantine_daemon';

        // 1. Arm ban_from_background rule
        const armRes = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: quarantineTarget, mode: 'ban_from_background', enabled: true });
        harness.assertEqual(armRes.statusCode, 200, 'Arming quarantine rule must succeed');

        // 2. Verify rule stored
        const rulesRes = await harness.httpRequest(`${BASE_URL}/api/rules`);
        const rules = rulesRes.json();
        harness.assertIncludes(rules.ban_from_background, quarantineTarget);

        let dummy;
        try {
            // 3. Launch background dummy target under quarantined rule
            dummy = await processHelper.spawnDummyProcess({ name: quarantineTarget, durationSec: 30 });
            harness.assertTrue(processHelper.isProcessRunning(dummy.pid), 'Spawned quarantine target must initially be running');

            // 4. Verify AutoEfficiencyWatcher daemon executes kill-on-sight termination
            let isDead = false;
            for (let i = 0; i < 30; i++) {
                if (!processHelper.isProcessRunning(dummy.pid)) {
                    isDead = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            harness.assertTrue(isDead, 'AutoEfficiencyWatcher daemon must enforce kill-on-sight against quarantined process');
        } finally {
            // 5. Cleanup rule & process
            await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, { name: quarantineTarget, mode: 'ban_from_background', enabled: false });

            if (dummy && processHelper.isProcessRunning(dummy.pid)) {
                processHelper.killProcess(dummy.pid);
            }
        }
    }, { tier: 4, feature: 'r4+r6', id: 'T4-RW-03' });

    harness.test('T4-RW-04: In-App Background Update Detection, Download, and Staging Flow (R3, R5, R6, R7)', async () => {
        const mockServer = new MockServer();
        const mockBaseUrl = await mockServer.start();

        try {
            // Stage release v2.9.0 on mock server
            mockServer.mockGitHubRelease({
                tagName: 'v2.9.0',
                assetName: 'EfficiencyHub_Setup_v2.9.0.exe',
                assetSize: 1024 * 64,
                bodyText: 'E2E Full Lifecycle Release'
            });

            // 1. Check for updates
            const checkRes = await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: `/api/updates/check?updateUrl=${encodeURIComponent(`${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest`)}`,
                method: 'GET',
                headers: { 'x-update-url': `${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest` }
            });
            harness.assertEqual(checkRes.statusCode, 200);
            const checkData = checkRes.json();
            harness.assertEqual(checkData.updateAvailable, true);

            // 2. Download update in background
            const downloadRes = await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/updates/download',
                method: 'POST'
            }, { downloadUrl: checkData.downloadUrl });
            harness.assertTrue(downloadRes.statusCode === 200 || downloadRes.statusCode === 202);

            // 3. Staging apply in dryRun mode
            const applyRes = await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/updates/apply?dryRun=true',
                method: 'POST'
            }, { dryRun: true });
            harness.assertTrue(applyRes.statusCode === 200 || applyRes.statusCode === 400);
        } finally {
            await mockServer.stop();
        }
    }, { tier: 4, feature: 'r3+r5+r6+r7', id: 'T4-RW-04' });

    harness.test('T4-RW-05: Release Packaging Sanity & Zero-Regression Acceptance (R1, R5, R6, R7)', async () => {
        // Assert complete presence of open source release deliverables
        const requiredFiles = [
            'README.md',
            'LICENSE',
            'package.json',
            '.gitignore',
            'build_installer.ps1',
            'rules.json',
            'server.js',
            'AutoEfficiencyWatcher.cs',
            'public/index.html'
        ];

        for (const file of requiredFiles) {
            const fullPath = path.join(WORKSPACE_ROOT, file);
            harness.assertTrue(fs.existsSync(fullPath), `Required release artifact "${file}" must exist`);
        }
    }, { tier: 4, feature: 'r1+r5+r6+r7', id: 'T4-RW-05' });

});

if (require.main === module) {
    harness.run({ tier: 4 }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
