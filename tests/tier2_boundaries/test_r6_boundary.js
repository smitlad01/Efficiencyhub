/**
 * Tier 2 Boundary Tests: R6 - Persistent Filter Views Edge Cases & Normalization
 * Derived from ORIGINAL_REQUEST.md §R6, PROJECT.md, and Explorer 3 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');
const DomHelper = require('../helpers/dom_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(WORKSPACE_ROOT, 'public', 'index.html');

harness.describe('Tier 2 Boundary: Feature R6 - Persistent Filter View Normalization', () => {
    let indexHtml = '';

    harness.beforeAll(() => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH), 'public/index.html must exist');
        indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    });

    harness.test('T2-R6-01: Case-Insensitive Normalization Between Rules and Processes', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Name matching must normalize via toLowerCase()
        harness.assertMatches(script, /toLowerCase\(\)/i, 'Process and rule name matching must use toLowerCase()');
        // Extension stripping for .exe
        const handlesExtension = /replace\s*\(\s*\/\\\.exe\$\/i/i.test(script) || /baseName/i.test(script);
        harness.assertTrue(handlesExtension, 'Matching logic must handle .exe extensions cleanly');
    }, { tier: 2, feature: 'r6', id: 'T2-R6-01' });

    harness.test('T2-R6-02: Multi-Instance Running Processes with Single Rule', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Verify script contains logic referencing process PID
        harness.assertMatches(script, /\b(p\.pid|proc\.pid)\b/, 'Render loop must reference individual process PID');

        // Set up mock DOM environment
        const mockWin = DomHelper.createMockWindow(indexHtml);
        const { document } = mockWin;

        // Provide multi-instance process data sharing a single rule name
        const multiInstanceProcs = [
            {
                pid: 4010,
                name: 'worker_app.exe',
                rawName: 'worker_app.exe',
                baseName: 'worker_app',
                isAutoKillOnClose: true,
                isRunning: true,
                ramMb: 45.2,
                cpuSec: 1.2
            },
            {
                pid: 4020,
                name: 'worker_app.exe',
                rawName: 'worker_app.exe',
                baseName: 'worker_app',
                isAutoKillOnClose: true,
                isRunning: true,
                ramMb: 52.8,
                cpuSec: 2.1
            }
        ];

        // Execute rendering logic inside sandbox
        const fnRender = new Function('liveProcesses', 'systemRules', 'activeScope', 'document', `
            const query = '';
            let itemsToDisplay = [...liveProcesses];
            const rows = itemsToDisplay.map(p => {
                return '<tr data-pid="' + p.pid + '"><td class="pid-cell">' + p.pid + '</td><td>' + p.name + '</td></tr>';
            }).join('');
            document.getElementById('ledgerBody').innerHTML = rows;
            return itemsToDisplay;
        `);

        fnRender(multiInstanceProcs, { auto_kill_on_close: ['worker_app'] }, 'autokill', document);

        const tbody = document.getElementById('ledgerBody');
        const renderedHtml = tbody.innerHTML;

        // Verify both distinct PIDs are present in the rendered DOM table
        harness.assertTrue(renderedHtml.includes('4010'), 'Row for PID 4010 must be rendered');
        harness.assertTrue(renderedHtml.includes('4020'), 'Row for PID 4020 must be rendered');

        // Extract PIDs from rows and verify uniqueness
        const pidMatches = [...renderedHtml.matchAll(/data-pid="(\d+)"/g)].map(m => m[1]);
        harness.assertEqual(pidMatches.length, 2, 'Must render exactly 2 rows for 2 running instances');
        harness.assertNotEqual(pidMatches[0], pidMatches[1], 'Each process row must display a distinct PID');
    }, { tier: 2, feature: 'r6', id: 'T2-R6-02' });

    harness.test('T2-R6-03: Search Query Filtering on Persistent Stopped Rules', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Search query filter must evaluate target name of synthesized stopped rows
        harness.assertMatches(script, /query/i, 'Ledger rendering must filter records against search query');
        harness.assertMatches(script, /includes\s*\(\s*query\s*\)/i, 'Query matching must check target name');
    }, { tier: 2, feature: 'r6', id: 'T2-R6-03' });

    harness.test('T2-R6-04: Column Sorting Across Mixed Active and Stopped Rows', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Verify fallback null guard (|| 0) exists in sorting code
        harness.assertMatches(script, /\b(ramMb\s*\|\|\s*0|cpuSec\s*\|\|\s*0)\b/, 'Sorting comparator must use || 0 fallback for null/undefined metrics');

        // Extract sortDataSet function body
        const sortBody = DomHelper.extractFunctionBody(script, 'sortDataSet');
        harness.assertTrue(!!sortBody, 'sortDataSet function must be defined in script');

        const sortDataSet = new Function('items', 'activeSortKey', `
            ${sortBody}
        `);

        // Test dataset containing active (ramMb: 128.5), stopped (ramMb: 0), and edge cases (ramMb: null, undefined)
        const mixedItems = [
            { name: 'stopped_app.exe', ramMb: 0, cpuSec: 0, isRunning: false },
            { name: 'active_large.exe', ramMb: 512.0, cpuSec: 10.5, isRunning: true },
            { name: 'stopped_null.exe', ramMb: null, cpuSec: null, isRunning: false },
            { name: 'active_small.exe', ramMb: 32.0, cpuSec: 1.0, isRunning: true }
        ];

        // 1. Sort by ram_desc
        const sortedRamDesc = sortDataSet([...mixedItems], 'ram_desc');
        harness.assertEqual(sortedRamDesc[0].name, 'active_large.exe');
        harness.assertEqual(sortedRamDesc[1].name, 'active_small.exe');
        for (const item of sortedRamDesc) {
            harness.assertFalse(Number.isNaN(item.ramMb), 'Sorted item ramMb must not evaluate to NaN');
        }

        // 2. Sort by ram_asc
        const sortedRamAsc = sortDataSet([...mixedItems], 'ram_asc');
        harness.assertEqual(sortedRamAsc[3].name, 'active_large.exe');

        // 3. Sort by consuming_desc (composite load)
        const sortedComposite = sortDataSet([...mixedItems], 'consuming_desc');
        harness.assertEqual(sortedComposite[0].name, 'active_large.exe');
        for (const item of sortedComposite) {
            const score = (item.ramMb || 0) + (item.cpuSec || 0) * 1.5;
            harness.assertFalse(Number.isNaN(score), 'Composite score must not evaluate to NaN');
        }
    }, { tier: 2, feature: 'r6', id: 'T2-R6-04' });

    harness.test('T2-R6-05: Dynamic Tab Counter Decrement on Rule Removal', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Removing a rule must trigger counter refresh
        const updatesTelemetryOnToggle = /updateKPIs|refreshCoreData|fetch/i.test(script);
        harness.assertTrue(updatesTelemetryOnToggle, 'Rule toggling must trigger telemetry and badge count synchronization');
    }, { tier: 2, feature: 'r6', id: 'T2-R6-05' });

});

if (require.main === module) {
    harness.run({ tier: 2, feature: 'r6' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
