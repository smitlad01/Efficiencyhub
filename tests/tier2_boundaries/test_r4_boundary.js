/**
 * Tier 2 Boundary Tests: R4 - Auto-Kill Safety, Schema Variations & IPC Resilience
 * Derived from ORIGINAL_REQUEST.md §R4, PROJECT.md, and Spec Miner 2 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');
const processHelper = require('../helpers/process_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const RULES_PATH = path.join(WORKSPACE_ROOT, 'rules.json');
const BASE_URL = 'http://127.0.0.1:5252';

harness.describe('Tier 2 Boundary: Feature R4 - Auto-Kill Guardrails & Resilience', () => {

    harness.test('T2-R4-01: Protected Core Application Lockdown', async () => {
        const protectedApps = ['chrome', 'code', 'explorer', 'taskmgr', 'antigravity'];

        for (const app of protectedApps) {
            const res = await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, { name: app, mode: 'auto_kill_on_close', enabled: true });

            harness.assertEqual(res.statusCode, 400, `Toggling auto-kill for protected app "${app}" must return HTTP 400`);
            const data = res.json();
            harness.assertMatches(data.error, /protected/i, `Error must identify "${app}" as a protected application`);

            // Verify rules.json was NOT polluted
            const currentRules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
            harness.assertNotIncludes(currentRules.auto_kill_on_close, app, `Protected app "${app}" must not be added to auto_kill_on_close`);
        }
    }, { tier: 2, feature: 'r4', id: 'T2-R4-01' });

    harness.test('T2-R4-02: Payload Schema Flexibility ({target, type} vs {name, mode})', async () => {
        const testTargetA = 'e2e_compat_alpha';
        const testTargetB = 'e2e_compat_beta';

        // Format 1: name & mode
        const res1 = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTargetA, mode: 'auto_kill_on_close', enabled: true });

        harness.assertEqual(res1.statusCode, 200, 'Format {name, mode} must succeed');

        // Cleanup A
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTargetA, mode: 'auto_kill_on_close', enabled: false });

        // Format 2: target & type (PROJECT.md contract)
        const res2 = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { target: testTargetB, type: 'auto_kill_on_close', enabled: true });

        // Backend must support {target, type} schema and return HTTP 200
        harness.assertEqual(res2.statusCode, 200, 'Format {target, type} must return HTTP 200 OK per API contract');

        // Cleanup B
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { target: testTargetB, type: 'auto_kill_on_close', enabled: false });
    }, { tier: 2, feature: 'r4', id: 'T2-R4-02' });

    harness.test('T2-R4-03: Empty, Missing, or Whitespace-Only Target Name Validation', async () => {
        const invalidBodies = [
            {},
            { name: '' },
            { name: '    ' },
            { target: '' }
        ];

        for (const body of invalidBodies) {
            const res = await harness.httpRequest({
                hostname: '127.0.0.1',
                port: 5252,
                path: '/api/rules/toggle',
                method: 'POST'
            }, body);

            harness.assertEqual(res.statusCode, 400, 'Request with empty target name must return HTTP 400');
            const data = res.json();
            harness.assertTrue(Boolean(data.error), 'Response must specify missing name error');
        }
    }, { tier: 2, feature: 'r4', id: 'T2-R4-03' });

    harness.test('T2-R4-04: IPC Signaling Resilience When Daemon is Offline', async () => {
        // Toggle a benign test rule
        const res = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: 'e2e_resilience_test', mode: 'auto_kill_on_close', enabled: true });

        // Must succeed without crashing the server even if Named Pipe connection fails
        harness.assertEqual(res.statusCode, 200, 'Toggle must succeed and persist rule regardless of IPC pipe status');
        
        // Cleanup
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: 'e2e_resilience_test', mode: 'auto_kill_on_close', enabled: false });
    }, { tier: 2, feature: 'r4', id: 'T2-R4-04' });

    harness.test('T2-R4-05: Case Insensitivity & .exe Suffix Normalization', async () => {
        const testTarget = 'MyCustomTestApp.EXE';

        const res = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: true });

        harness.assertEqual(res.statusCode, 200);

        // Verify normalized to lowercase without .exe
        const currentRules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
        harness.assertIncludes(currentRules.auto_kill_on_close, 'mycustomtestapp', 'Target must be normalized to lowercase without .exe extension');

        // Cleanup
        await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/rules/toggle',
            method: 'POST'
        }, { name: testTarget, mode: 'auto_kill_on_close', enabled: false });
    }, { tier: 2, feature: 'r4', id: 'T2-R4-05' });

});

if (require.main === module) {
    harness.run({ tier: 2, feature: 'r4' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
