/**
 * Tier 1 Feature Tests: R3 - In-App Background Auto-Update System
 * Derived from ORIGINAL_REQUEST.md §R3, PROJECT.md, and Spec Miner 2 report.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const harness = require('../helpers/harness');
const MockServer = require('../helpers/mock_server');

const BASE_URL = 'http://127.0.0.1:5252';

harness.describe('Tier 1: Feature R3 - In-App Background Auto-Update System', () => {
    let mockServer;
    let mockBaseUrl;

    harness.beforeAll(async () => {
        mockServer = new MockServer();
        mockBaseUrl = await mockServer.start();
    });

    harness.afterAll(async () => {
        if (mockServer) await mockServer.stop();
    });

    harness.beforeEach(() => {
        mockServer.reset();
    });

    harness.test('T1-R3-01: Release Check — Newer Version Detection', async () => {
        const mockRelease = mockServer.mockGitHubRelease({
            tagName: 'v3.0.0',
            assetName: 'EfficiencyHub_Setup_v3.0.0.exe',
            assetSize: 1024 * 64,
            bodyText: 'Major version upgrade with enhanced governor'
        });

        const checkUrl = `${BASE_URL}/api/updates/check?updateUrl=${encodeURIComponent(`${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest`)}`;
        const res = await harness.httpRequest({
            path: `/api/updates/check?updateUrl=${encodeURIComponent(`${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest`)}`,
            hostname: '127.0.0.1',
            port: 5252,
            method: 'GET',
            headers: {
                'x-update-url': `${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest`
            }
        });

        harness.assertEqual(res.statusCode, 200, 'GET /api/updates/check must return HTTP 200');
        const data = res.json();
        harness.assertEqual(data.updateAvailable, true, 'updateAvailable must be true when remote tag is higher');
        harness.assertMatches(data.latestVersion, /3\.0\.0/, 'latestVersion must report 3.0.0');
        harness.assertTrue(Boolean(data.downloadUrl), 'downloadUrl must be provided');
        harness.assertTrue(typeof data.releaseNotes === 'string', 'releaseNotes must be returned');
    }, { tier: 1, feature: 'r3', id: 'T1-R3-01' });

    harness.test('T1-R3-02: Release Check — Up-to-Date / No Newer Version', async () => {
        mockServer.mockGitHubRelease({
            tagName: 'v1.0.0', // Lower than current 2.4.0
            assetName: 'EfficiencyHub_Setup_v1.0.0.exe'
        });

        const res = await harness.httpRequest({
            path: `/api/updates/check?updateUrl=${encodeURIComponent(`${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest`)}`,
            hostname: '127.0.0.1',
            port: 5252,
            method: 'GET',
            headers: {
                'x-update-url': `${mockBaseUrl}/repos/smitlad01/Efficiencyhub/releases/latest`
            }
        });

        harness.assertEqual(res.statusCode, 200, 'GET /api/updates/check must return HTTP 200');
        const data = res.json();
        harness.assertEqual(data.updateAvailable, false, 'updateAvailable must be false when remote tag is older or equal');
    }, { tier: 1, feature: 'r3', id: 'T1-R3-02' });

    harness.test('T1-R3-03: Background Update Download Execution (POST /api/updates/download)', async () => {
        mockServer.mockGitHubRelease({
            tagName: 'v2.5.0',
            assetName: 'EfficiencyHub_Setup_v2.5.0.exe',
            assetSize: 1024 * 32
        });

        const assetUrl = `${mockBaseUrl}/download/EfficiencyHub_Setup_v2.5.0.exe`;
        const res = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/updates/download',
            method: 'POST'
        }, { downloadUrl: assetUrl });

        harness.assertTrue(res.statusCode === 200 || res.statusCode === 202, 'POST /api/updates/download must return 200 or 202');
        const data = res.json();
        harness.assertTrue(data.status === 'downloading' || data.status === 'completed', 'Download status must be downloading or completed');
    }, { tier: 1, feature: 'r3', id: 'T1-R3-03' });

    harness.test('T1-R3-04: Download Progress Reporting', async () => {
        const res = await harness.httpRequest(`${BASE_URL}/api/updates/download`);
        harness.assertEqual(res.statusCode, 200, 'GET /api/updates/download must return status poll');
        const data = res.json();
        harness.assertTrue(typeof data.status === 'string', 'Download status must be reported');
        harness.assertTrue(typeof data.progress === 'number', 'Download progress must be a number');
        harness.assertTrue(data.progress >= 0 && data.progress <= 100, 'Progress must be between 0 and 100');
    }, { tier: 1, feature: 'r3', id: 'T1-R3-04' });

    harness.test('T1-R3-05: Apply Update Staging & Readiness (POST /api/updates/apply?dryRun=true)', async () => {
        const res = await harness.httpRequest({
            hostname: '127.0.0.1',
            port: 5252,
            path: '/api/updates/apply?dryRun=true',
            method: 'POST'
        }, { dryRun: true });

        harness.assertTrue(res.statusCode === 200 || res.statusCode === 400, 'POST /api/updates/apply must return structured response');
        const data = res.json();
        if (res.statusCode === 200) {
            harness.assertEqual(data.success, true, 'Dry-run apply must succeed when package staged');
        } else {
            // Expected 400 if package not yet fully staged
            harness.assertTrue(Boolean(data.error), 'Expected explanatory error if no package staged');
        }
    }, { tier: 1, feature: 'r3', id: 'T1-R3-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r3' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
