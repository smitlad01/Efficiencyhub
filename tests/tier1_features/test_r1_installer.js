/**
 * Tier 1 Feature Tests: R1 - Windows Installation Executable & Pre-flight Checks
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

harness.describe('Tier 1: Feature R1 - Windows Installation Executable', () => {

    harness.test('T1-R1-01: Inno Setup Configuration File Existence & Valid Structure', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script (installer/EfficiencyHubSetup.iss) must exist');

        // Check required standard Inno Setup sections
        harness.assertMatches(issContent, /\[Setup\]/i, 'Setup script must contain [Setup] section');
        harness.assertMatches(issContent, /\[Files\]/i, 'Setup script must contain [Files] section');
        harness.assertMatches(issContent, /\[Code\]/i, 'Setup script must contain [Code] section for pre-flight checks');
        harness.assertMatches(issContent, /AppName\s*=\s*EfficiencyHub/i, 'AppName must be EfficiencyHub');
        harness.assertMatches(issContent, /PrivilegesRequired\s*=\s*admin/i, 'PrivilegesRequired must be admin');
    }, { tier: 1, feature: 'r1', id: 'T1-R1-01' });

    harness.test('T1-R1-02: Pre-flight Administrator Privilege Verification in InitializeSetup', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist for pre-flight admin verification');

        // Pre-flight admin check requires IsAdminLoggedOn check in InitializeSetup()
        harness.assertMatches(issContent, /function\s+InitializeSetup\s*\(\s*\)\s*:\s*Boolean/i, 'InitializeSetup function must be declared');
        harness.assertMatches(issContent, /IsAdminLoggedOn/i, 'Pre-flight check must query IsAdminLoggedOn()');
        harness.assertMatches(issContent, /Result\s*:=\s*False/i, 'Installer must set Result := False on missing privileges');
    }, { tier: 1, feature: 'r1', id: 'T1-R1-02' });

    harness.test('T1-R1-03: Pre-flight .NET Framework 4.5+ Dependency Check Definition', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist for .NET pre-flight check');

        // Must verify .NET Framework 4.5+ release DWORD >= 378389 in HKLM registry
        harness.assertMatches(issContent, /RegQueryDWordValue/i, 'Must use RegQueryDWordValue to inspect .NET registry');
        harness.assertMatches(issContent, /SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full/i, 'Must query .NET v4 Full registry path');
        harness.assertMatches(issContent, /378389/, 'Must verify .NET release DWORD is >= 378389 (.NET 4.5 release key)');
    }, { tier: 1, feature: 'r1', id: 'T1-R1-03' });

    harness.test('T1-R1-04: Pre-flight Node.js Runtime Dependency Check Definition', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist for Node.js pre-flight check');

        // Must test Node.js runtime availability via command execution
        harness.assertMatches(issContent, /Exec\s*\(/i, 'Must invoke Exec() to test node runtime');
        harness.assertMatches(issContent, /node\s+-v/i, 'Must run "node -v" command to verify runtime presence');
    }, { tier: 1, feature: 'r1', id: 'T1-R1-04' });

    harness.test('T1-R1-05: Component Bundling Manifest & Build Automation Script', async () => {
        const issContent = readSetupScript();
        harness.assertTrue(issContent !== null, 'Inno Setup script must exist for bundle verification');

        // Verify bundle components
        harness.assertMatches(issContent, /AutoEfficiencyWatcher\.exe/i, 'Must bundle AutoEfficiencyWatcher.exe');
        harness.assertMatches(issContent, /server\.js/i, 'Must bundle server.js');
        harness.assertMatches(issContent, /rules\.json/i, 'Must bundle rules.json');
        harness.assertMatches(issContent, /public\\\*/i, 'Must bundle public web dashboard assets');

        // Verify automated build script
        harness.assertTrue(fs.existsSync(BUILD_SCRIPT_PATH), 'build_installer.ps1 automated build script must exist');
        const scriptContent = fs.readFileSync(BUILD_SCRIPT_PATH, 'utf8');
        harness.assertMatches(scriptContent, /ISCC(\.exe)?/i, 'build_installer.ps1 must reference ISCC Inno Setup compiler');
    }, { tier: 1, feature: 'r1', id: 'T1-R1-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r1' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
