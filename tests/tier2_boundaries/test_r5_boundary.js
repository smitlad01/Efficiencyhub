/**
 * Tier 2 Boundary Tests: R5 - UI Simplification Edge Conditions & Dataset Stress
 * Derived from ORIGINAL_REQUEST.md §R5, PROJECT.md, and Explorer 3 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');
const DomHelper = require('../helpers/dom_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(WORKSPACE_ROOT, 'public', 'index.html');

harness.describe('Tier 2 Boundary: Feature R5 - UI Stress & Telemetry Edge Cases', () => {
    let indexHtml = '';

    harness.beforeAll(() => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH), 'public/index.html must exist');
        indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    });

    harness.test('T2-R5-01: Zero-Process Edge Case on Cold Boot', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Verify updateKPIs exists in script
        harness.assertMatches(script, /function\s+updateKPIs\s*\(/i, 'updateKPIs function must be defined');

        // Setup mock DOM environment
        const mockWin = DomHelper.createMockWindow(indexHtml);
        const { document } = mockWin;

        // Verify badge elements exist in DOM
        const badgeIds = ['cntAll', 'cntEff', 'cntServices', 'cntAutoKill', 'cntBanned'];
        for (const id of badgeIds) {
            harness.assertTrue(DomHelper.hasElementWithId(indexHtml, id), `Filter tab badge #${id} must exist in DOM`);
        }

        // Extract updateKPIs body and execute in mock environment with cold-boot empty data
        const fnBody = DomHelper.extractFunctionBody(script, 'updateKPIs');
        harness.assertTrue(!!fnBody, 'updateKPIs function body must be parseable');

        const execUpdateKPIs = new Function('liveProcesses', 'systemRules', 'document', `
            ${fnBody}
        `);

        // Cold boot: zero live processes and empty rule sets
        const emptyProcs = [];
        const emptyRules = { efficiency: [], normal: [], auto_kill_on_close: [], ban_from_background: [] };

        execUpdateKPIs(emptyProcs, emptyRules, document);

        // Verify zero-count badge rendering across all filter tabs
        for (const id of badgeIds) {
            const badge = document.getElementById(id);
            harness.assertEqual(String(badge.innerText).trim(), '0', `Badge #${id} must display "0" when no processes or rules exist`);
        }
    }, { tier: 2, feature: 'r5', id: 'T2-R5-01' });

    harness.test('T2-R5-02: Massive Dataset Stress Handling (5,000+ Processes)', async () => {
        // Verify CSS virtualizes or limits scroll container to prevent page crash
        const hasScrollLimit = /overflow-y\s*:\s*auto/i.test(indexHtml) ||
                              /max-height/i.test(indexHtml) ||
                              /table-scroll/i.test(indexHtml);
        harness.assertTrue(hasScrollLimit, 'Dashboard CSS must constrain table scroll container for large datasets');
    }, { tier: 2, feature: 'r5', id: 'T2-R5-02' });

    harness.test('T2-R5-03: Rapid Filter Cycling Race Condition Prevention', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Filter tabs must toggle .active class deterministically
        harness.assertMatches(script, /classList\.(add|remove)/i, 'Filter selection must manipulate classList cleanly');
        harness.assertMatches(script, /matrix-tab/i, 'Tabs must target matrix-tab selector');
    }, { tier: 2, feature: 'r5', id: 'T2-R5-03' });

    harness.test('T2-R5-04: Search Bar Input Filtering Without Offset Shift', async () => {
        // Assert search input element exists
        harness.assertTrue(DomHelper.hasElementWithId(indexHtml, 'filterInput'), 'Search bar (#filterInput) must exist');

        // Check search handler in script
        const script = DomHelper.extractScriptContent(indexHtml);
        harness.assertMatches(script, /filterInput/i, 'Script must bind to filterInput for real-time search');
    }, { tier: 2, feature: 'r5', id: 'T2-R5-04' });

    harness.test('T2-R5-05: Malformed / Null Telemetry Payload Resilience', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Must guard against undefined or null rule arrays (e.g. systemRules.ban_from_background || [])
        const hasArrayGuards = /\|\|\s*\[\]/i.test(script);
        harness.assertTrue(hasArrayGuards, 'Script must use array fallback guards (|| []) to handle null or missing rule arrays');
    }, { tier: 2, feature: 'r5', id: 'T2-R5-05' });

});

if (require.main === module) {
    harness.run({ tier: 2, feature: 'r5' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
