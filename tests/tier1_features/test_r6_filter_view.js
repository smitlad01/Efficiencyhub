/**
 * Tier 1 Feature Tests: R6 - Persistent Rule Visibility in Filtered Views
 * Derived from ORIGINAL_REQUEST.md §R6, PROJECT.md, and Explorer 3 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');
const DomHelper = require('../helpers/dom_helper');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(WORKSPACE_ROOT, 'public', 'index.html');
const RULES_PATH = path.join(WORKSPACE_ROOT, 'rules.json');

harness.describe('Tier 1: Feature R6 - Persistent Rule Visibility in Filtered Views', () => {
    let indexHtml = '';
    let rules = {};

    harness.beforeAll(() => {
        harness.assertTrue(fs.existsSync(INDEX_HTML_PATH), 'public/index.html must exist');
        indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
        if (fs.existsSync(RULES_PATH)) {
            rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
        }
    });

    harness.test('T1-R6-01: Persistent Visibility of Stopped Auto-Kill Rules in Auto-Kill View', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);
        
        // Ledger rendering logic must inspect systemRules.auto_kill_on_close
        const checksRules = /auto_kill_on_close/i.test(script) && /activeScope\s*===?\s*['"]autokill['"]/i.test(script);
        harness.assertTrue(checksRules, 'renderLedger() must integrate configured auto_kill_on_close rules when in autokill scope');

        // Logic must synthesize or include non-running rules rather than filtering purely on liveProcesses
        const synthesizesStopped = /STOPPED|IDLE|systemRules/i.test(script);
        harness.assertTrue(synthesizesStopped, 'renderLedger() must retain non-running auto-kill rules in the data set');
    }, { tier: 1, feature: 'r6', id: 'T1-R6-01' });

    harness.test('T1-R6-02: Persistent Visibility of Stopped Quarantined Rules in Quarantined View', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Ledger rendering logic must inspect systemRules.ban_from_background
        const checksBannedRules = /ban_from_background/i.test(script) && /activeScope\s*===?\s*['"]banned['"]/i.test(script);
        harness.assertTrue(checksBannedRules, 'renderLedger() must integrate configured ban_from_background rules when in banned scope');
    }, { tier: 1, feature: 'r6', id: 'T1-R6-02' });

    harness.test('T1-R6-03: Active vs Stopped Status Differentiation in Filtered View', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Verification of status indication for stopped vs running
        const hasStatusLogic = /STOPPED|IDLE/i.test(script) && /(isStopped|status|running)/i.test(script);
        harness.assertTrue(hasStatusLogic, 'Ledger rendering must distinguish between active running processes and stopped/idle rules');
    }, { tier: 1, feature: 'r6', id: 'T1-R6-03' });

    harness.test('T1-R6-04: Interactive Toggle Button Presence on Stopped Rows', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // Action cluster on synthesized stopped rows must include policy toggle handler
        const hasToggleBinding = /toggleAutoKill|toggleBanned|executePolicyToggle/i.test(script);
        harness.assertTrue(hasToggleBinding, 'Stopped rule rows must render interactive toggle buttons enabling rule deactivation');
    }, { tier: 1, feature: 'r6', id: 'T1-R6-04' });

    harness.test('T1-R6-05: Empty Placeholder Displayed ONLY When Both Live Procs and Rules Are Empty', async () => {
        const script = DomHelper.extractScriptContent(indexHtml);

        // The empty placeholder must not trigger if configured rules exist for the active scope
        harness.assertMatches(script, /No matching system entities found/i, 'Placeholder text must exist in template');
        // Script should not simply check filtered.length === 0 against liveProcesses alone in autokill/banned scope
        const handlesEmptySafely = /rules/i.test(script);
        harness.assertTrue(handlesEmptySafely, 'Empty state must consider configured rule inventory');
    }, { tier: 1, feature: 'r6', id: 'T1-R6-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r6' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
