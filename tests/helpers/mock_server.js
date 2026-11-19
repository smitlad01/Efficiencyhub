/**
 * EfficiencyHub E2E Test Suite - Dynamic Mock HTTP Server
 * Used for simulating GitHub Releases, background asset downloads, and backend mock endpoints.
 * Zero external npm dependencies.
 */

const http = require('http');
const { URL } = require('url');

class MockServer {
    constructor() {
        this.server = null;
        this.port = 0;
        this.baseUrl = '';
        this.routes = [];
        this.requests = [];
        this.sockets = new Set();
    }

    on(method, pathPattern, handler) {
        this.routes.push({
            method: method.toUpperCase(),
            pattern: pathPattern instanceof RegExp ? pathPattern : new RegExp(`^${pathPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
            handler
        });
        return this;
    }

    get(pathPattern, handler) {
        return this.on('GET', pathPattern, handler);
    }

    post(pathPattern, handler) {
        return this.on('POST', pathPattern, handler);
    }

    reset() {
        this.routes = [];
        this.requests = [];
    }

    sendJson(res, statusCode, data, headers = {}) {
        const body = JSON.stringify(data);
        res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...headers
        });
        res.end(body);
    }

    sendBinary(res, statusCode, buffer, filename = 'update.exe', headers = {}) {
        res.writeHead(statusCode, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': buffer.length,
            'Content-Disposition': `attachment; filename="${filename}"`,
            ...headers
        });
        res.end(buffer);
    }

    /**
     * Preset for GitHub Releases API simulation
     */
    mockGitHubRelease(options = {}) {
        const {
            tagName = 'v2.5.0',
            assetName = 'EfficiencyHub_Setup_v2.5.0.exe',
            assetSize = 1024 * 128, // 128 KB dummy binary
            bodyText = 'Automated E2E update release payload'
        } = options;

        const assetPath = `/download/${assetName}`;

        this.get(/\/repos\/[^/]+\/[^/]+\/releases\/latest/, (req, res) => {
            const downloadUrl = `${this.baseUrl}${assetPath}`;
            this.sendJson(res, 200, {
                tag_name: tagName,
                name: `EfficiencyHub Release ${tagName}`,
                body: bodyText,
                draft: false,
                prerelease: false,
                assets: [
                    {
                        name: assetName,
                        size: assetSize,
                        browser_download_url: downloadUrl,
                        content_type: 'application/octet-stream'
                    }
                ]
            });
        });

        // Set up the binary download asset route
        const dummyBinary = Buffer.alloc(assetSize, 0xAA);
        this.get(assetPath, (req, res) => {
            this.sendBinary(res, 200, dummyBinary, assetName);
        });

        return {
            tagName,
            assetName,
            assetPath,
            assetSize
        };
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                let reqBody = '';
                req.on('data', chunk => {
                    reqBody += chunk;
                });

                req.on('end', () => {
                    const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.port || 80}`);
                    const pathname = parsedUrl.pathname;

                    const recordedReq = {
                        method: req.method,
                        url: req.url,
                        pathname,
                        headers: req.headers,
                        body: reqBody,
                        timestamp: Date.now()
                    };
                    this.requests.push(recordedReq);

                    // Find matching route
                    for (const route of this.routes) {
                        if (route.method === req.method && route.pattern.test(pathname)) {
                            return Promise.resolve()
                                .then(() => route.handler(req, res, reqBody, parsedUrl))
                                .catch(err => {
                                    if (!res.headersSent) {
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: err.message }));
                                    }
                                });
                        }
                    }

                    // Default 404
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Mock route not matched', path: pathname }));
                });
            });

            this.server.on('connection', socket => {
                this.sockets.add(socket);
                socket.on('close', () => this.sockets.delete(socket));
            });

            this.server.listen(0, '127.0.0.1', () => {
                this.port = this.server.address().port;
                this.baseUrl = `http://127.0.0.1:${this.port}`;
                resolve(this.baseUrl);
            });

            this.server.on('error', reject);
        });
    }

    async stop() {
        return new Promise(resolve => {
            if (!this.server) return resolve();
            for (const socket of this.sockets) {
                try { socket.destroy(); } catch (e) {}
            }
            this.sockets.clear();
            this.server.close(() => {
                this.server = null;
                resolve();
            });
        });
    }
}

module.exports = MockServer;
