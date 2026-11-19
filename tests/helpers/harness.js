/**
 * EfficiencyHub E2E Test Suite - Core Test Harness & Assertion Engine
 * Zero external npm dependencies. Standard Node.js core library only.
 */

const assert = require('assert');

class TestHarness {
    constructor() {
        this.tests = [];
        this.results = [];
        this.currentSuite = 'Default Suite';
        this.hooks = {
            beforeAll: [],
            afterAll: [],
            beforeEach: [],
            afterEach: []
        };
    }

    describe(name, fn) {
        const prevSuite = this.currentSuite;
        this.currentSuite = name;
        try {
            fn();
        } finally {
            this.currentSuite = prevSuite;
        }
    }

    test(name, fn, meta = {}) {
        this.tests.push({
            name,
            suite: this.currentSuite,
            fn,
            tier: meta.tier || 1,
            feature: (meta.feature || 'general').toLowerCase(),
            id: meta.id || `TEST-${this.tests.length + 1}`,
            status: 'PENDING',
            durationMs: 0,
            error: null
        });
    }

    beforeAll(fn) { this.hooks.beforeAll.push(fn); }
    afterAll(fn) { this.hooks.afterAll.push(fn); }
    beforeEach(fn) { this.hooks.beforeEach.push(fn); }
    afterEach(fn) { this.hooks.afterEach.push(fn); }

    // Matchers
    assertEqual(actual, expected, msg) {
        assert.strictEqual(actual, expected, msg || `Expected ${JSON.stringify(actual)} to strictly equal ${JSON.stringify(expected)}`);
    }

    assertNotEqual(actual, expected, msg) {
        assert.notStrictEqual(actual, expected, msg || `Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`);
    }

    assertTrue(val, msg) {
        assert.strictEqual(Boolean(val), true, msg || `Expected truthy value, got ${val}`);
    }

    assertFalse(val, msg) {
        assert.strictEqual(Boolean(val), false, msg || `Expected falsy value, got ${val}`);
    }

    assertIncludes(haystack, needle, msg) {
        if (typeof haystack === 'string') {
            assert.ok(haystack.includes(needle), msg || `Expected string to include "${needle}"`);
        } else if (Array.isArray(haystack)) {
            assert.ok(haystack.includes(needle), msg || `Expected array to include item ${JSON.stringify(needle)}`);
        } else if (typeof haystack === 'object' && haystack !== null) {
            assert.ok(needle in haystack, msg || `Expected object to contain key "${needle}"`);
        } else {
            throw new Error(`assertIncludes unsupported haystack type: ${typeof haystack}`);
        }
    }

    assertNotIncludes(haystack, needle, msg) {
        if (typeof haystack === 'string') {
            assert.ok(!haystack.includes(needle), msg || `Expected string NOT to include "${needle}"`);
        } else if (Array.isArray(haystack)) {
            assert.ok(!haystack.includes(needle), msg || `Expected array NOT to include item ${JSON.stringify(needle)}`);
        } else if (typeof haystack === 'object' && haystack !== null) {
            assert.ok(!(needle in haystack), msg || `Expected object NOT to contain key "${needle}"`);
        } else {
            throw new Error(`assertNotIncludes unsupported haystack type: ${typeof haystack}`);
        }
    }

    assertMatches(str, regex, msg) {
        assert.ok(regex.test(str), msg || `Expected "${str}" to match ${regex}`);
    }

    assertNotMatches(str, regex, msg) {
        assert.ok(!regex.test(str), msg || `Expected "${str}" NOT to match ${regex}`);
    }

    async assertRejects(asyncFn, errorValidator, msg) {
        await assert.rejects(asyncFn, errorValidator, msg);
    }

    /**
     * Native HTTP request helper returning promise with statusCode, headers, body, json()
     */
    async httpRequest(options, requestBody = null) {
        const http = require('http');
        const https = require('https');
        const { URL } = require('url');

        return new Promise((resolve, reject) => {
            const urlObj = typeof options === 'string' ? new URL(options) : null;
            const protocol = (urlObj ? urlObj.protocol : (options.protocol || 'http:')) === 'https:' ? https : http;

            const reqOptions = urlObj ? {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET'
            } : { ...options };

            const req = protocol.request(reqOptions, (res) => {
                let chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const rawBuffer = Buffer.concat(chunks);
                    const bodyText = rawBuffer.toString('utf8');
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        raw: rawBuffer,
                        body: bodyText,
                        json: () => {
                            try {
                                return JSON.parse(bodyText);
                            } catch (e) {
                                throw new Error(`Failed to parse JSON response: "${bodyText.slice(0, 100)}"`);
                            }
                        }
                    });
                });
            });

            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy(new Error('Request timed out'));
            });

            if (requestBody) {
                if (typeof requestBody === 'object' && !Buffer.isBuffer(requestBody)) {
                    req.setHeader('Content-Type', 'application/json');
                    req.write(JSON.stringify(requestBody));
                } else {
                    req.write(requestBody);
                }
            }
            req.end();
        });
    }

    clear() {
        this.tests = [];
        this.results = [];
        this.hooks = { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] };
    }

    async run(filters = {}) {
        const startTime = Date.now();
        this.results = [];

        let passed = 0;
        let failed = 0;
        let skipped = 0;

        // Run beforeAll hooks
        for (const hook of this.hooks.beforeAll) {
            await hook();
        }

        const tierFilter = (filters.tier !== undefined && filters.tier !== null) ? Number(filters.tier) : null;
        const featureFilter = (filters.feature !== undefined && filters.feature !== null) ? String(filters.feature).toLowerCase() : null;
        const patternFilter = filters.pattern ? new RegExp(filters.pattern, 'i') : null;

        for (const t of this.tests) {
            if (tierFilter !== null && t.tier !== tierFilter) {
                t.status = 'SKIPPED';
                skipped++;
                this.results.push(t);
                continue;
            }
            if (featureFilter !== null && t.feature !== featureFilter) {
                t.status = 'SKIPPED';
                skipped++;
                this.results.push(t);
                continue;
            }
            if (patternFilter !== null && !patternFilter.test(t.name) && !patternFilter.test(t.id)) {
                t.status = 'SKIPPED';
                skipped++;
                this.results.push(t);
                continue;
            }

            // BeforeEach
            for (const hook of this.hooks.beforeEach) {
                await hook(t);
            }

            const tStart = Date.now();
            try {
                await t.fn();
                t.status = 'PASSED';
                t.durationMs = Date.now() - tStart;
                passed++;
                if (!filters.silent) {
                    console.log(`  ✓ [T${t.tier}][${t.feature.toUpperCase()}][${t.id}] ${t.name} (${t.durationMs}ms)`);
                }
            } catch (err) {
                t.status = 'FAILED';
                t.durationMs = Date.now() - tStart;
                t.error = err.message || String(err);
                t.stack = err.stack;
                failed++;
                if (!filters.silent) {
                    console.error(`  ✗ [T${t.tier}][${t.feature.toUpperCase()}][${t.id}] ${t.name} (${t.durationMs}ms)`);
                    console.error(`    Error: ${t.error}`);
                }
            }

            // AfterEach
            for (const hook of this.hooks.afterEach) {
                try {
                    await hook(t);
                } catch (hookErr) {
                    console.error(`    Warning: afterEach hook failed: ${hookErr.message}`);
                }
            }

            this.results.push(t);
        }

        // Run afterAll hooks
        for (const hook of this.hooks.afterAll) {
            try {
                await hook();
            } catch (hookErr) {
                console.error(`Warning: afterAll hook failed: ${hookErr.message}`);
            }
        }

        const totalDurationMs = Date.now() - startTime;

        const summary = {
            total: this.tests.length,
            executed: passed + failed,
            passed,
            failed,
            skipped,
            totalDurationMs,
            success: failed === 0,
            results: this.results
        };

        return summary;
    }

    /**
     * Self-validation test to verify test harness assertion integrity and isolation.
     */
    async validateSelf() {
        const subHarness = new TestHarness();
        let sanityCheckCount = 0;

        subHarness.assertEqual(1, 1);
        sanityCheckCount++;
        subHarness.assertNotEqual(1, 2);
        sanityCheckCount++;
        subHarness.assertTrue(true);
        sanityCheckCount++;
        subHarness.assertFalse(false);
        sanityCheckCount++;
        subHarness.assertIncludes('hello world', 'world');
        sanityCheckCount++;
        subHarness.assertIncludes([1, 2, 3], 2);
        sanityCheckCount++;
        subHarness.assertNotIncludes('hello', 'xyz');
        sanityCheckCount++;
        subHarness.assertMatches('EfficiencyHub_v2.4.0', /^EfficiencyHub_v\d+\.\d+\.\d+$/);
        sanityCheckCount++;
        subHarness.assertNotMatches('test.txt', /\.exe$/i);
        sanityCheckCount++;

        let errorCaught = false;
        try {
            subHarness.assertEqual(1, 2);
        } catch (e) {
            errorCaught = true;
        }
        if (!errorCaught) throw new Error('validateSelf failed: assertEqual did not throw on inequality');

        await subHarness.assertRejects(
            async () => { throw new Error('Expected failure'); },
            /Expected failure/
        );
        sanityCheckCount++;

        // Verify async runner execution
        subHarness.test('SelfTest Mock Pass', async () => {
            subHarness.assertTrue(true);
        }, { tier: 1, feature: 'self' });

        subHarness.test('SelfTest Mock Fail', async () => {
            throw new Error('Simulated failure');
        }, { tier: 1, feature: 'self' });

        const summary = await subHarness.run({ silent: true });
        if (summary.passed !== 1 || summary.failed !== 1) {
            throw new Error(`validateSelf failed: runner summary unexpected ${JSON.stringify(summary)}`);
        }

        return {
            valid: true,
            sanityChecksVerified: sanityCheckCount,
            timestamp: new Date().toISOString()
        };
    }
}

const defaultHarness = new TestHarness();
defaultHarness.TestHarness = TestHarness;

module.exports = defaultHarness;
