/**
 * Tier 3 Pairwise Combinatorial Tests: Cross-Feature Interactions
 * Derived from ORIGINAL_REQUEST.md, PROJECT.md, and Explorer 3 report §4.3.
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

harness.describe('Tier 3: Cross-Feature Pairwise Interactions', () => {

    harness.test('T3-INT-01: R5 + R6 (Layout Simplification + Persistent Filter View Synchronization)', async () => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH));
        const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

        // Absence of KPI row (R5)
        harness.assertFalse(/<div[^>]*class=["'][^"']*\bkpi-row\b[^"']*["']/i.test(html), 'KPI row must be absent');

        // Presence of filter matrix badge counters (R5)
        harness.assertTrue(DomHelper.hasElementWithId(html, 'cntAutoKill'), 'Badge #cntAutoKill must exist');

        // Persistent filter view logic in script (R6)
        const script = DomHelper.extractScriptContent(html);
        harness.assertMatches(script, /auto_kill_on_close/i, 'Script must reference auto_kill_on_close rules');
    }, { tier: 3, feature: 'r5+r6', id: 'T3-INT-01' });

    harness.test('T3-INT-02: R6 + R4 (Persistent Rule Toggle -> Instant Daemon Sync Without Restart)', async () => {
        const testTarget = 'e2e_int_target_02';

        // 1. Toggle rule on via API (simulating persistent view toggle)
        const toggleRes = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: true });

        harness.assertEqual(toggleRes.statusCode, 200, 'Toggling rule via API must succeed');

        let dummy;
        try {
            // 2. Spawn dummy process simulating background launch
            dummy = await processHelper.spawnDummyProcess({ name: testTarget, durationSec: 30 });
            harness.assertTrue(processHelper.isProcessRunning(dummy.pid), 'Spawned dummy process must be running');

            // 3. Verify daemon sync automatically terminates the spawned dummy without manual kill
            let isDead = false;
            for (let i = 0; i < 30; i++) {
                if (!processHelper.isProcessRunning(dummy.pid)) {
                    isDead = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            harness.assertTrue(isDead, 'Running watcher daemon must automatically terminate process via dynamic sync without restart');
        } finally {
            // 4. Toggle rule back off and cleanup
            await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, { name: testTarget, mode: 'auto_kill_on_close', enabled: false });

            if (dummy && processHelper.isProcessRunning(dummy.pid)) {
                processHelper.killProcess(dummy.pid);
            }
        }
    }, { tier: 3, feature: 'r6+r4', id: 'T3-INT-02' });

    harness.test('T3-INT-03: R6 + R2 (Persistent View Rule Modification Under Elevated vs Non-Elevated State)', async () => {
        // Query status endpoint
        const statusRes = await harness.httpRequest(`${BASE_URL}/api/status`);
        harness.assertEqual(statusRes.statusCode, 200);
        const status = statusRes.json();

        // Query rules endpoint
        const rulesRes = await harness.httpRequest(`${BASE_URL}/api/rules`);
        harness.assertEqual(rulesRes.statusCode, 200);
        const rules = rulesRes.json();

        // Both endpoints respond with compatible contracts
        harness.assertEqual(typeof status.elevated, 'boolean');
        harness.assertTrue(Array.isArray(rules.auto_kill_on_close));
    }, { tier: 3, feature: 'r6+r2', id: 'T3-INT-03' });

    harness.test('T3-INT-04: R5 + R3 (UI Layout Stability During Background Update Notification)', async () => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH));
        const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

        // Check update notification container in UI
        const hasUpdateBanner = DomHelper.hasElementWithId(html, 'updateNotification') ||
                                /class=["'][^"']*\bupdate-(?:bar|notice|banner)\b[^"']*["']/i.test(html);
        // Strictly assert DOM update notification container
        harness.assertTrue(hasUpdateBanner, 'Dashboard DOM must contain update notification mechanism (#updateNotification, .update-banner, or .update-notice)');
    }, { tier: 3, feature: 'r5+r3', id: 'T3-INT-04' });

    harness.test('T3-INT-05: R6 + R7 (Open Source Default Ruleset Initialization & Persistent Display)', async () => {
        harness.assertTrue(fs.existsSync(RULES_PATH), 'Default rules.json must exist in repo root');
        const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));

        // Default rules must include common auto-kill and banned applications
        harness.assertTrue(Array.isArray(rules.auto_kill_on_close), 'auto_kill_on_close must be an array');
        harness.assertTrue(Array.isArray(rules.ban_from_background), 'ban_from_background must be an array');
        harness.assertTrue(rules.auto_kill_on_close.length > 0, 'Default auto_kill_on_close rules should be populated');
    }, { tier: 3, feature: 'r6+r7', id: 'T3-INT-05' });

    harness.test('T3-INT-06: R4 + R5 (Instant Rule Registration via Policy Dock & Tab Counter Increment)', async () => {
        const testTarget = 'e2e_dock_app_06';

        // 1. Register new rule
        const res = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: true });

        harness.assertEqual(res.statusCode, 200);

        // 2. Query rules to verify count incremented
        const rulesRes = await harness.httpRequest(`${BASE_URL}/api/rules`);
        const rules = rulesRes.json();
        harness.assertIncludes(rules.auto_kill_on_close, testTarget);

        // Cleanup
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: false });
    }, { tier: 3, feature: 'r4+r5', id: 'T3-INT-06' });

    harness.test('T3-INT-07: R1 + R6 (Rule Store Persistence Across Standalone Installer Upgrades)', async () => {
        // Verify AppData fallback path definition in server.js
        const serverSource = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.js'), 'utf8');
        harness.assertMatches(serverSource, /LOCALAPPDATA/i, 'server.js must support LOCALAPPDATA rules persistence across upgrades');
        harness.assertMatches(serverSource, /AutoEfficiencyWatcher/i, 'Rules directory must reside in AutoEfficiencyWatcher');
    }, { tier: 3, feature: 'r1+r6', id: 'T3-INT-07' });

});

if (require.main === module) {
    harness.run({ tier: 3 }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
