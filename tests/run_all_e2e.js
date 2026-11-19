#!/usr/bin/env node
/**
 * EfficiencyHub Master E2E Automated Test Runner
 * Executes all 4 tiers of requirement-driven E2E tests with zero external dependencies.
 *
 * Usage:
 *   node tests/run_all_e2e.js                   # Run full test suite
 *   node tests/run_all_e2e.js --tier 1          # Run specific tier (1, 2, 3, or 4)
 *   node tests/run_all_e2e.js --feature r4      # Run tests for specific feature
 *   node tests/run_all_e2e.js --validate        # Run self-validation mode
 *   node tests/run_all_e2e.js --json            # Output summary in JSON format
 */

const path = require('path');
const fs = require('fs');
const harness = require('./helpers/harness');
const MockServer = require('./helpers/mock_server');
const processHelper = require('./helpers/process_helper');
const DomHelper = require('./helpers/dom_helper');

// Parse CLI flags
const args = process.argv.slice(2);
let tierFilter = null;
let featureFilter = null;
let jsonOutput = false;
let validateMode = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    if (arg === '--tier' && args[i + 1]) {
        tierFilter = parseInt(args[++i], 10);
    } else if (arg === '--feature' && args[i + 1]) {
        featureFilter = args[++i].toLowerCase();
    } else if (arg === '--json') {
        jsonOutput = true;
    } else if (arg === '--validate' || arg === '--self-test') {
        validateMode = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
EfficiencyHub Automated E2E Test Suite Runner

Options:
  --tier <1-4>       Filter tests by test pyramid tier
  --feature <r1-r7>  Filter tests by requirement code (e.g. r1, r2, r3, r4, r5, r6, r7)
  --validate         Run self-validation suite testing harness and test integrity
  --json             Output results formatted as JSON
  --help, -h         Display this help message
`);
        process.exit(0);
    }
}

async function runValidation() {
    if (!jsonOutput) {
        console.log('===========================================================');
        console.log(' EfficiencyHub E2E Test Infrastructure Validation Mode');
        console.log('===========================================================');
    }

    const validationReport = {
        harnessSelfTest: null,
        mockServerVerified: false,
        processHelperVerified: false,
        domHelperVerified: false,
        testModulesLoaded: 0,
        totalTestsRegistered: 0,
        tierBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0 },
        timestamp: new Date().toISOString()
    };

    // 1. Harness self-test
    if (!jsonOutput) process.stdout.write('1. Validating TestHarness core matchers & async runner... ');
    const harnessResult = await harness.validateSelf();
    validationReport.harnessSelfTest = harnessResult;
    if (!jsonOutput) console.log(`OK (${harnessResult.sanityChecksVerified} sanity checks passed)`);

    // 2. MockServer validation
    if (!jsonOutput) process.stdout.write('2. Validating dynamic ephemeral MockServer... ');
    const mock = new MockServer();
    const mockUrl = await mock.start();
    mock.mockGitHubRelease({ tagName: 'v9.9.9' });
    const res = await harness.httpRequest(`${mockUrl}/repos/smitlad01/Efficiencyhub/releases/latest`);
    const releaseData = res.json();
    if (releaseData.tag_name !== 'v9.9.9') {
        throw new Error('MockServer failed to return staged release payload');
    }
    await mock.stop();
    validationReport.mockServerVerified = true;
    if (!jsonOutput) console.log(`OK (spawns on ephemeral port, routes cleanly)`);

    // 3. ProcessHelper validation
    if (!jsonOutput) process.stdout.write('3. Validating safe ProcessHelper lifecycle registry... ');
    const dummy = await processHelper.spawnDummyProcess({ durationSec: 10 });
    const isAlive = processHelper.isProcessRunning(dummy.pid);
    if (!isAlive) throw new Error('ProcessHelper failed to verify running dummy process');
    processHelper.killProcess(dummy.pid);
    const isDead = !processHelper.isProcessRunning(dummy.pid);
    if (!isDead) throw new Error('ProcessHelper failed to kill dummy process');
    validationReport.processHelperVerified = true;
    if (!jsonOutput) console.log('OK (safe spawn, tasklist query, guaranteed termination)');

    // 4. DomHelper validation
    if (!jsonOutput) process.stdout.write('4. Validating zero-dependency DomHelper & sandbox... ');
    const sampleHtml = '<div id="testBox" class="active-box"><tbody id="ledgerBody"><tr><td>Item 1</td></tr></tbody></div>';
    if (!DomHelper.hasElementWithId(sampleHtml, 'testBox')) throw new Error('DomHelper failed ID check');
    if (!DomHelper.hasElementWithClass(sampleHtml, 'active-box')) throw new Error('DomHelper failed class check');
    const rows = DomHelper.extractTableRows(sampleHtml, 'ledgerBody');
    if (rows.length !== 1) throw new Error('DomHelper failed table row extraction');
    validationReport.domHelperVerified = true;
    if (!jsonOutput) console.log('OK (regex parsing, table row extraction, mock sandbox)');

    // 5. Load and verify all 16 test modules
    if (!jsonOutput) process.stdout.write('5. Loading all E2E test suites (Tiers 1-4)... ');
    harness.clear();

    const testFiles = [
        // Tier 1
        './tier1_features/test_r1_installer',
        './tier1_features/test_r2_elevation',
        './tier1_features/test_r3_autoupdate',
        './tier1_features/test_r4_autokill',
        './tier1_features/test_r5_ui_layout',
        './tier1_features/test_r6_filter_view',
        './tier1_features/test_r7_opensource',
        // Tier 2
        './tier2_boundaries/test_r1_boundary',
        './tier2_boundaries/test_r2_boundary',
        './tier2_boundaries/test_r3_boundary',
        './tier2_boundaries/test_r4_boundary',
        './tier2_boundaries/test_r5_boundary',
        './tier2_boundaries/test_r6_boundary',
        './tier2_boundaries/test_r7_boundary',
        // Tier 3
        './tier3_combinations/test_pairwise_interactions',
        // Tier 4
        './tier4_realworld/test_realworld_scenarios'
    ];

    for (const file of testFiles) {
        require(file);
        validationReport.testModulesLoaded++;
    }

    validationReport.totalTestsRegistered = harness.tests.length;
    for (const t of harness.tests) {
        if (validationReport.tierBreakdown[t.tier] !== undefined) {
            validationReport.tierBreakdown[t.tier]++;
        }
    }

    if (!jsonOutput) {
        console.log(`OK (${validationReport.testModulesLoaded} files loaded, ${validationReport.totalTestsRegistered} tests registered)`);
        console.log(`   - Tier 1 (Features):     ${validationReport.tierBreakdown[1]} tests`);
        console.log(`   - Tier 2 (Boundaries):   ${validationReport.tierBreakdown[2]} tests`);
        console.log(`   - Tier 3 (Combinations): ${validationReport.tierBreakdown[3]} tests`);
        console.log(`   - Tier 4 (Real-World):   ${validationReport.tierBreakdown[4]} tests`);

        console.log('===========================================================');
        console.log(' Result: VALIDATION PASSED (Test infrastructure is 100% sound)');
        console.log('===========================================================');
    }

    if (jsonOutput) {
        console.log(JSON.stringify(validationReport, null, 2));
    }

    process.exit(0);
}

async function runTestSuite() {
    if (!jsonOutput) {
        console.log('===========================================================');
        console.log(' EfficiencyHub Automated E2E Test Suite');
        console.log(` Filters: Tier=${tierFilter || 'ALL'} | Feature=${featureFilter || 'ALL'}`);
        console.log('===========================================================');
    }

    // Load test suites
    const testFiles = [
        './tier1_features/test_r1_installer',
        './tier1_features/test_r2_elevation',
        './tier1_features/test_r3_autoupdate',
        './tier1_features/test_r4_autokill',
        './tier1_features/test_r5_ui_layout',
        './tier1_features/test_r6_filter_view',
        './tier1_features/test_r7_opensource',
        './tier2_boundaries/test_r1_boundary',
        './tier2_boundaries/test_r2_boundary',
        './tier2_boundaries/test_r3_boundary',
        './tier2_boundaries/test_r4_boundary',
        './tier2_boundaries/test_r5_boundary',
        './tier2_boundaries/test_r6_boundary',
        './tier2_boundaries/test_r7_boundary',
        './tier3_combinations/test_pairwise_interactions',
        './tier4_realworld/test_realworld_scenarios'
    ];

    for (const f of testFiles) {
        try {
            require(f);
        } catch (e) {
            console.error(`Failed to load test suite ${f}: ${e.message}`);
        }
    }

    const summary = await harness.run({
        tier: tierFilter,
        feature: featureFilter,
        silent: jsonOutput
    });

    if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
    } else {
        console.log('===========================================================');
        console.log(' Execution Summary:');
        console.log(`   Total Tests:    ${summary.total}`);
        console.log(`   Executed:       ${summary.executed}`);
        console.log(`   Passed:         ${summary.passed}`);
        console.log(`   Failed:         ${summary.failed}`);
        console.log(`   Skipped:        ${summary.skipped}`);
        console.log(`   Duration:       ${summary.totalDurationMs}ms`);
        console.log('===========================================================');
        if (summary.success) {
            console.log(' ALL EXECUTED TESTS PASSED');
        } else {
            console.log(` ${summary.failed} TEST(S) FAILED`);
        }
    }

    process.exit(summary.success ? 0 : 1);
}

if (validateMode) {
    runValidation().catch(err => {
        console.error('Validation failed:', err);
        process.exit(1);
    });
} else {
    runTestSuite().catch(err => {
        console.error('Runner error:', err);
        process.exit(1);
    });
}
