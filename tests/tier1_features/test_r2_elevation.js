/**
 * Tier 1 Feature Tests: R2 - Pre-launch Permission Verification & One-Click Elevation
 * Derived from ORIGINAL_REQUEST.md §R2, PROJECT.md, and Spec Miner 1 report.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const harness = require('../helpers/harness');
const DomHelper = require('../helpers/dom_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(WORKSPACE_ROOT, 'public', 'index.html');
const BASE_URL = 'http://127.0.0.1:5252';

function isCurrentProcessAdmin() {
    try {
        execSync('net session', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

harness.describe('Tier 1: Feature R2 - Pre-launch Permission Verification & Elevation', () => {

    harness.test('T1-R2-01: Status API Response Contract (GET /api/status)', async () => {
        const res = await harness.httpRequest(`${BASE_URL}/api/status`);
        harness.assertEqual(res.statusCode, 200, 'GET /api/status must return HTTP 200 OK');
        
        const data = res.json();
        harness.assertEqual(typeof data.elevated, 'boolean', 'status.elevated must be a boolean');
        harness.assertEqual(typeof data.daemonRunning, 'boolean', 'status.daemonRunning must be a boolean');
        harness.assertEqual(typeof data.version, 'string', 'status.version must be a string');
    }, { tier: 1, feature: 'r2', id: 'T1-R2-01' });

    harness.test('T1-R2-02: Accurate OS Privilege Verification', async () => {
        const res = await harness.httpRequest(`${BASE_URL}/api/status`);
        harness.assertEqual(res.statusCode, 200);
        const data = res.json();

        const expectedAdmin = isCurrentProcessAdmin();
        harness.assertEqual(data.elevated, expectedAdmin, `status.elevated (${data.elevated}) must accurately reflect OS token privilege (${expectedAdmin})`);
    }, { tier: 1, feature: 'r2', id: 'T1-R2-02' });

    harness.test('T1-R2-03: One-Click UAC Elevation API Contract (POST /api/elevate)', async () => {
        const res = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/elevate',
            method: 'POST'
        }, { dryRun: true });

        harness.assertEqual(res.statusCode, 200, 'POST /api/elevate with dryRun must return HTTP 200');
        const data = res.json();
        harness.assertEqual(data.success, true, 'Response must indicate success: true');
        harness.assertTrue(typeof data.command === 'string' || typeof data.message === 'string', 'Response must return elevation command details');
        if (data.command) {
            harness.assertMatches(data.command, /Start-Process/i, 'Elevation command must use Start-Process');
            harness.assertMatches(data.command, /-Verb\s+RunAs/i, 'Elevation command must request UAC elevation via -Verb RunAs');
        }
    }, { tier: 1, feature: 'r2', id: 'T1-R2-03' });

    harness.test('T1-R2-04: Non-Elevated Warning Prompt & Relaunch Button in DOM', async () => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH), 'public/index.html must exist');
        const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

        // Check for elevation prompt container and trigger button
        const hasPrompt = DomHelper.hasElementWithId(html, 'elevationPrompt') || DomHelper.hasElementWithClass(html, 'admin-warning-banner');
        harness.assertTrue(hasPrompt, 'Dashboard DOM must contain elevation alert container (#elevationPrompt or .admin-warning-banner)');

        const hasBtn = DomHelper.hasElementWithId(html, 'btnElevate') || /onclick=["'][^"']*elevat[^"']*["']/i.test(html);
        harness.assertTrue(hasBtn, 'Dashboard DOM must contain one-click elevation trigger button (#btnElevate)');
    }, { tier: 1, feature: 'r2', id: 'T1-R2-04' });

    harness.test('T1-R2-05: Elevated State Dismissal & Daemon Badge Update', async () => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH), 'public/index.html must exist');
        const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

        // Must support DAEMON ELEVATED badge representation
        harness.assertMatches(html, /DAEMON\s+ELEVATED/i, 'Dashboard must render DAEMON ELEVATED badge when elevated');
        // Must contain logic to check /api/status and update UI accordingly
        harness.assertMatches(html, /\/api\/status/i, 'Client script must query /api/status');
    }, { tier: 1, feature: 'r2', id: 'T1-R2-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r2' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
