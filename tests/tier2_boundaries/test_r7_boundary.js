/**
 * Tier 2 Boundary Tests: R7 - Repository Hygiene, SemVer & Build Parameters
 * Derived from ORIGINAL_REQUEST.md §R7, PROJECT.md, and Spec Miner 1 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const GITIGNORE_PATH = path.join(WORKSPACE_ROOT, '.gitignore');
const PACKAGE_JSON_PATH = path.join(WORKSPACE_ROOT, 'package.json');
const README_PATH = path.join(WORKSPACE_ROOT, 'README.md');
const BUILD_SCRIPT_PATH = path.join(WORKSPACE_ROOT, 'build_installer.ps1');

harness.describe('Tier 2 Boundary: Feature R7 - Repository Integrity & Build Parameters', () => {

    harness.test('T2-R7-01: .gitignore Leak Prevention Boundary', async () => {
        harness.assertTrue(fs.existsSync(GITIGNORE_PATH), '.gitignore must exist');
        const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf8');

        // Verify exclusions
        harness.assertMatches(gitignore, /(^|\n)\s*(\/?dist|\/?dist\/|\*\.log|node_modules)/i, '.gitignore must exclude dist/ or *.log or node_modules');
    }, { tier: 2, feature: 'r7', id: 'T2-R7-01' });

    harness.test('T2-R7-02: Strict SemVer & Manifest Metadata Validation', async () => {
        harness.assertTrue(fs.existsSync(PACKAGE_JSON_PATH), 'package.json must exist');
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

        // Strict SemVer regex
        harness.assertMatches(pkg.version, /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'Version must strictly conform to Semantic Versioning (X.Y.Z)');
        harness.assertEqual(pkg.license, 'MIT', 'License in package.json must be SPDX "MIT"');
    }, { tier: 2, feature: 'r7', id: 'T2-R7-02' });

    harness.test('T2-R7-03: README.md Section Structure & Code Block Integrity', async () => {
        harness.assertTrue(fs.existsSync(README_PATH), 'README.md must exist');
        const readme = fs.readFileSync(README_PATH, 'utf8');

        // Check code blocks are properly balanced (even count of ```)
        const codeFences = (readme.match(/```/g) || []).length;
        harness.assertEqual(codeFences % 2, 0, 'Markdown code fence backticks (```) must be properly paired');
    }, { tier: 2, feature: 'r7', id: 'T2-R7-03' });

    harness.test('T2-R7-04: Build Script Custom Output Directory Parameter', async () => {
        harness.assertTrue(fs.existsSync(BUILD_SCRIPT_PATH), 'build_installer.ps1 must exist');
        const script = fs.readFileSync(BUILD_SCRIPT_PATH, 'utf8');

        // Build script should support -OutputDir parameter
        harness.assertMatches(script, /\$OutputDir/i, 'build_installer.ps1 must support an $OutputDir parameter');
    }, { tier: 2, feature: 'r7', id: 'T2-R7-04' });

    harness.test('T2-R7-05: Documentation Cleanliness — Zero Unresolved Placeholders & Standard Sections', async () => {
        harness.assertTrue(fs.existsSync(README_PATH), 'README.md must exist in repository root');
        const readme = fs.readFileSync(README_PATH, 'utf8');

        // Verify absence of placeholder tokens
        const placeholderRegex = /\[TBD\]|\[TODO\]|\[INSERT|\[REPLACE\]|<placeholder>/i;
        harness.assertFalse(placeholderRegex.test(readme), 'README.md must not contain unresolved template placeholders ([TBD], [TODO], etc.)');

        // Verify essential documentation sections
        harness.assertMatches(readme, /##\s+(Installation|Getting Started)/i, 'README.md must have an Installation or Getting Started section');
        harness.assertMatches(readme, /##\s+(Usage|Features)/i, 'README.md must have a Features or Usage section');
    }, { tier: 2, feature: 'r7', id: 'T2-R7-05' });

});

if (require.main === module) {
    harness.run({ tier: 2, feature: 'r7' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
