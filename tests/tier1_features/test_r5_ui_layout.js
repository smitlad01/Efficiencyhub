/**
 * Tier 1 Feature Tests: R5 - UI Simplification & Layout Optimization
 * Derived from ORIGINAL_REQUEST.md §R5, PROJECT.md, and Explorer 3 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');
const DomHelper = require('../helpers/dom_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(WORKSPACE_ROOT, 'public', 'index.html');

harness.describe('Tier 1: Feature R5 - UI Simplification & Layout Optimization', () => {
    let indexHtml = '';

    harness.beforeAll(() => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH), 'public/index.html must exist');
        indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    });

    harness.test('T1-R5-01: Complete Removal of Top 4 KPI Stat Cards from DOM', async () => {
        // Assert absence of redundant top KPI row in the dashboard body
        const hasKpiRow = /<div[^>]*class=["'][^"']*\bkpi-row\b[^"']*["']/i.test(indexHtml);
        harness.assertFalse(hasKpiRow, 'Top KPI container (.kpi-row) must be removed from dashboard DOM');

        // Check that KPI stat block IDs are removed from body layout
        const hasKpiTotal = DomHelper.hasElementWithId(indexHtml, 'kpiTotal');
        const hasKpiEff = DomHelper.hasElementWithId(indexHtml, 'kpiEff');
        const hasKpiAutoKill = DomHelper.hasElementWithId(indexHtml, 'kpiAutoKill');
        const hasKpiBanned = DomHelper.hasElementWithId(indexHtml, 'kpiBanned');

        harness.assertFalse(hasKpiTotal, 'Element #kpiTotal must be removed from DOM');
        harness.assertFalse(hasKpiEff, 'Element #kpiEff must be removed from DOM');
        harness.assertFalse(hasKpiAutoKill, 'Element #kpiAutoKill must be removed from DOM');
        harness.assertFalse(hasKpiBanned, 'Element #kpiBanned must be removed from DOM');
    }, { tier: 1, feature: 'r5', id: 'T1-R5-01' });

    harness.test('T1-R5-02: Vertical Table Scroll Space Reclamation in CSS', async () => {
        // Legacy constraint was max-height: calc(100vh - 380px)
        const oldConstraint = /max-height\s*:\s*calc\s*\(\s*100vh\s*-\s*380px\s*\)/i.test(indexHtml);
        harness.assertFalse(oldConstraint, 'CSS must not restrict table-scroll to legacy calc(100vh - 380px)');

        // Modernized reclaimed height should be calc(100vh - 280px) or larger
        const modernizedHeight = /max-height\s*:\s*calc\s*\(\s*100vh\s*-\s*(2[0-9]{2}|1[0-9]{2})px\s*\)/i.test(indexHtml) ||
                                 /flex\s*:\s*1/i.test(indexHtml);
        harness.assertTrue(modernizedHeight, 'table-scroll must expand vertical height, reclaiming >= 80px of vertical space');
    }, { tier: 1, feature: 'r5', id: 'T1-R5-02' });

    harness.test('T1-R5-03: Filter Tab Counter Badges Presence & Telemetry Integration', async () => {
        // Tab counters in filter matrix must exist
        harness.assertTrue(DomHelper.hasElementWithId(indexHtml, 'cntAll'), 'Badge #cntAll must exist in filter matrix');
        harness.assertTrue(DomHelper.hasElementWithId(indexHtml, 'cntEff'), 'Badge #cntEff must exist in filter matrix');
        harness.assertTrue(DomHelper.hasElementWithId(indexHtml, 'cntServices'), 'Badge #cntServices must exist in filter matrix');
        harness.assertTrue(DomHelper.hasElementWithId(indexHtml, 'cntAutoKill'), 'Badge #cntAutoKill must exist in filter matrix');
        harness.assertTrue(DomHelper.hasElementWithId(indexHtml, 'cntBanned'), 'Badge #cntBanned must exist in filter matrix');

        // Test telemetry update script does not attempt to write to missing KPI elements
        const script = DomHelper.extractScriptContent(indexHtml);
        // If script has updateKPIs or updateFilterCounters, verify it handles cntAll
        harness.assertMatches(script, /cntAll/i, 'Script must update filter tab badge #cntAll');
    }, { tier: 1, feature: 'r5', id: 'T1-R5-03' });

    harness.test('T1-R5-04: Responsive Layout Styles Without Orphaned KPI Rules', async () => {
        // Verify media queries do not contain dead .kpi-row declarations
        const mediaMatch = indexHtml.match(/@media[^{]+\{([\s\S]+?\}\s*\})/gi);
        if (mediaMatch) {
            for (const query of mediaMatch) {
                harness.assertNotMatches(query, /\.kpi-row\s*\{[^}]*grid-template-columns/i, 'Media queries must not contain dead .kpi-row selectors');
            }
        }
    }, { tier: 1, feature: 'r5', id: 'T1-R5-04' });

    harness.test('T1-R5-05: Process Ledger Visibility Above the Fold', async () => {
        // Table vault container and header must be positioned directly beneath filter matrix
        const filterMatrixPos = indexHtml.indexOf('filter-matrix');
        const tableVaultPos = indexHtml.indexOf('table-vault');
        harness.assertTrue(filterMatrixPos > 0, 'filter-matrix must be present');
        harness.assertTrue(tableVaultPos > filterMatrixPos, 'table-vault must be rendered immediately following the filter matrix');
    }, { tier: 1, feature: 'r5', id: 'T1-R5-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r5' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
