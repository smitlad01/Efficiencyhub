/**
 * Tier 1 Feature Tests: R7 - Open Source Repository & Release Preparation
 * Derived from ORIGINAL_REQUEST.md §R7, PROJECT.md, and Spec Miner 1 report.
 */

const fs = require('fs');
const path = require('path');
const harness = require('../helpers/harness');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const README_PATH = path.join(WORKSPACE_ROOT, 'README.md');
const LICENSE_PATH = path.join(WORKSPACE_ROOT, 'LICENSE');
const PACKAGE_JSON_PATH = path.join(WORKSPACE_ROOT, 'package.json');
const GITIGNORE_PATH = path.join(WORKSPACE_ROOT, '.gitignore');
const BUILD_SCRIPT_PATH = path.join(WORKSPACE_ROOT, 'build_installer.ps1');

harness.describe('Tier 1: Feature R7 - Open Source Repository & Release Preparation', () => {

    harness.test('T1-R7-01: Release Manifest & Core Files Existence', async () => {
        harness.assertTrue(fs.existsSync(README_PATH), 'README.md must exist in repository root');
        harness.assertTrue(fs.existsSync(LICENSE_PATH), 'LICENSE must exist in repository root');
        harness.assertTrue(fs.existsSync(PACKAGE_JSON_PATH), 'package.json must exist in repository root');
        harness.assertTrue(fs.existsSync(GITIGNORE_PATH), '.gitignore must exist in repository root');
        harness.assertTrue(fs.existsSync(BUILD_SCRIPT_PATH), 'build_installer.ps1 must exist in repository root');
    }, { tier: 1, feature: 'r7', id: 'T1-R7-01' });

    harness.test('T1-R7-02: package.json Schema & Standard Scripts', async () => {
        harness.assertTrue(fs.existsSync(PACKAGE_JSON_PATH), 'package.json must exist');
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

        harness.assertEqual(pkg.name.toLowerCase(), 'efficiencyhub', 'Package name must be efficiencyhub');
        harness.assertTrue(Boolean(pkg.version), 'Package version must be defined');
        harness.assertTrue(Boolean(pkg.scripts), 'Package scripts object must be defined');

        // Required standard scripts
        harness.assertTrue(Boolean(pkg.scripts.start), 'npm script "start" must be defined');
        harness.assertTrue(Boolean(pkg.scripts.test), 'npm script "test" must be defined');
        harness.assertTrue(Boolean(pkg.scripts['build:watcher'] || pkg.scripts.build), 'Build script for C# watcher must be defined');
        harness.assertTrue(Boolean(pkg.scripts['build:installer'] || pkg.scripts['installer:build']), 'Build script for installer must be defined');
    }, { tier: 1, feature: 'r7', id: 'T1-R7-02' });

    harness.test('T1-R7-03: Open Source MIT License Verification', async () => {
        harness.assertTrue(fs.existsSync(LICENSE_PATH), 'LICENSE must exist');
        const license = fs.readFileSync(LICENSE_PATH, 'utf8');

        harness.assertMatches(license, /MIT\s+License/i, 'LICENSE must be the MIT License');
        harness.assertMatches(license, /Permission is hereby granted, free of charge/i, 'LICENSE must contain standard MIT permission text');
        harness.assertMatches(license, /Copyright\s*\(c\)/i, 'LICENSE must contain copyright notice');
    }, { tier: 1, feature: 'r7', id: 'T1-R7-03' });

    harness.test('T1-R7-04: Comprehensive Documentation Verification', async () => {
        harness.assertTrue(fs.existsSync(README_PATH), 'README.md must exist');
        const readme = fs.readFileSync(README_PATH, 'utf8');

        // Verify required sections per acceptance criteria
        harness.assertMatches(readme, /#\s+EfficiencyHub/i, 'README must have EfficiencyHub main title');
        harness.assertMatches(readme, /##\s+Features/i, 'README must have Features section');
        harness.assertMatches(readme, /##\s+Prerequisites/i, 'README must have Prerequisites section');
        harness.assertMatches(readme, /##\s+Installation/i, 'README must have Installation section');
        harness.assertMatches(readme, /##\s+Usage/i, 'README must have Usage section');
        harness.assertMatches(readme, /##\s+Building|##\s+Build/i, 'README must have Build Instructions section');
        harness.assertMatches(readme, /##\s+API/i, 'README must document HTTP and IPC API');
    }, { tier: 1, feature: 'r7', id: 'T1-R7-04' });

    harness.test('T1-R7-05: Git Repository Configuration & Remote URL Reference', async () => {
        const readme = fs.existsSync(README_PATH) ? fs.readFileSync(README_PATH, 'utf8') : '';
        const pkg = fs.existsSync(PACKAGE_JSON_PATH) ? fs.readFileSync(PACKAGE_JSON_PATH, 'utf8') : '';

        const referencesRepo = /github\.com\/smitlad01\/Efficiencyhub/i.test(readme) ||
                               /github\.com\/smitlad01\/Efficiencyhub/i.test(pkg);
        harness.assertTrue(referencesRepo, 'Project documentation or package.json must reference canonical repo https://github.com/smitlad01/Efficiencyhub.git');
    }, { tier: 1, feature: 'r7', id: 'T1-R7-05' });

});

if (require.main === module) {
    harness.run({ tier: 1, feature: 'r7' }).then(summary => {
        process.exit(summary.success ? 0 : 1);
    });
}

module.exports = harness;
