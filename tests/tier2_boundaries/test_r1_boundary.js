/**
 * Tier 2 Boundary Tests: R1 - Installer & Pre-flight Error Boundaries
 * Derived from ORIGINAL_REQUEST.md §R1, PROJECT.md, and Spec Miner 1 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const ISS_PATH = path.join(WORKSPACE_ROOT, 'installer', 'EfficiencyHubSetup.iss');
const BUILD_SCRIPT_PATH = path.join(WORKSPACE_ROOT, 'build_installer.ps1');

function readSetupScript() {
    if (fs.existsSync(ISS_PATH)) {
        return fs.readFileSync(ISS_PATH, 'utf8');
    }
    const rootIss = path.join(WORKSPACE_ROOT, 'EfficiencyHubSetup.iss');
    if (fs.existsSync(rootIss)) {
        return fs.readFileSync(rootIss, 'utf8');
    }
    return null;
}

harness.describe('Tier 2 Boundary: Feature R1 - Installer & Pre-flight Errors', () => {

    harness.test('T2-R1-01: Non-Admin Pre-flight Abort Behavior', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist');

        // Check that non-admin branch halts installation with informative message
        harness.assertMatches(issContent, /if\s+not\s+IsAdminLoggedOn\s*\(\s*\)\s*then/i, 'Must check negative case of IsAdminLoggedOn');
        harness.assertMatches(issContent, /MsgBox\s*\([^)]*Administrator/i, 'Must show explanatory message box mentioning Administrator');
    }, { tier: 2, feature: 'r1', id: 'T2-R1-01' });

    harness.test('T2-R1-02: Outdated .NET Framework Pre-flight Abort Behavior', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist');

        // Check boundary comparison for .NET 4.5 release key (378389)
        harness.assertMatches(issContent, /<\s*378389/, 'Must check if registry release DWORD is strictly less than 378389');
        harness.assertMatches(issContent, /MsgBox\s*\([^)]*\.NET\s+Framework/i, 'Must display message requiring .NET Framework 4.5+ on failure');
    }, { tier: 2, feature: 'r1', id: 'T2-R1-02' });

    harness.test('T2-R1-03: Missing Node.js Runtime Pre-flight Abort Behavior', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist');

        // Check non-zero exit code check on node -v
        harness.assertMatches(issContent, /(ResultCode|NodeResult|Res)\s*(<>|!=)\s*0/i, 'Must test for non-zero exit code on node runtime check');
        harness.assertMatches(issContent, /MsgBox\s*\([^)]*Node\.js/i, 'Must show explanatory message requiring Node.js runtime');
    }, { tier: 2, feature: 'r1', id: 'T2-R1-03' });

    harness.test('T2-R1-04: Build Script Abort on Missing Required Source File', async () => {
        harness.assertTrue(fs.existsSync(BUILD_SCRIPT_PATH), 'build_installer.ps1 must exist');
        const scriptContent = fs.readFileSync(BUILD_SCRIPT_PATH, 'utf8');

        // Build script must guard against missing prerequisites
        harness.assertMatches(scriptContent, /Test-Path/i, 'build_installer.ps1 must validate required input paths via Test-Path');
        harness.assertMatches(scriptContent, /throw|exit\s+[1-9]/i, 'build_installer.ps1 must abort with non-zero exit code on missing inputs');
    }, { tier: 2, feature: 'r1', id: 'T2-R1-04' });

    harness.test('T2-R1-05: Inno Setup Path Whitespace & Quote Delimitation Integrity', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist');

        // Validate that default directory uses proper Inno Setup macros
        harness.assertMatches(issContent, /DefaultDirName\s*=\s*\{auto(pf|pf32|pf64)\}\\EfficiencyHub/i, 'DefaultDirName must target {autopf}\\EfficiencyHub');
    }, { tier: 2, feature: 'r1', id: 'T2-R1-05' });

});

if (require.main === module) {
    harness.run({ tier: 2, feature: 'r1' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
