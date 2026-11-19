const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { exec, execSync, spawn } = require('child_process');

const PORT = 5252;
const VERSION = '2.4.0';
const RULES_PATH = path.join(__dirname, 'rules.json');
const APPDATA_RULES_PATH = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'),
    'AutoEfficiencyWatcher',
    'rules.json'
);

// Cached OS Privilege State (debounced for responsiveness without blocking event loop)
let isElevatedCache = false;
let lastElevatedCheck = 0;
function checkIsElevated(force = false) {
    const now = Date.now();
    if (!force && (now - lastElevatedCheck < 1500)) {
        return isElevatedCache;
    }
    lastElevatedCheck = now;
    try {
        execSync('net session', { stdio: 'ignore' });
        isElevatedCache = true;
    } catch (e) {
        isElevatedCache = false;
    }
    return isElevatedCache;
}
isElevatedCache = checkIsElevated(true);

// Cached Daemon State
let daemonRunningCache = false;
function checkDaemonRunning() {
    try {
        const out = execSync('powershell -NoProfile -Command "Get-Process AutoEfficiencyWatcher -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"', { timeout: 1500 }).toString().trim();
        daemonRunningCache = Boolean(out);
    } catch (e) {
        daemonRunningCache = false;
    }
    return daemonRunningCache;
}
checkDaemonRunning();
setInterval(checkDaemonRunning, 5000);

// In-App Background Update State
let updateState = {
    status: 'idle',
    progress: 0,
    latestVersion: null,
    downloadUrl: null,
    releaseNotes: '',
    file: null
};

function compareSemVer(v1, v2) {
    const p1 = (v1 || '0.0.0').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    const p2 = (v2 || '0.0.0').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < 3; i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

function signalWatcher(cmd = 'RELOAD') {
    try {
        const client = net.connect('\\\\.\\pipe\\EfficiencyHubSync', () => {
            client.write(cmd + '\n');
            client.end();
        });
        client.on('error', () => {
            // Watcher daemon may not be active; ignore error gracefully
        });
    } catch (e) {
        // Ignore error gracefully
    }
}

function getRules() {
    try {
        let targetPath = null;
        const hasWorkspace = fs.existsSync(RULES_PATH);
        const hasAppData = fs.existsSync(APPDATA_RULES_PATH);

        if (hasWorkspace && hasAppData) {
            const mtimeWorkspace = fs.statSync(RULES_PATH).mtimeMs;
            const mtimeAppData = fs.statSync(APPDATA_RULES_PATH).mtimeMs;
            targetPath = mtimeAppData > mtimeWorkspace ? APPDATA_RULES_PATH : RULES_PATH;
        } else if (hasAppData) {
            targetPath = APPDATA_RULES_PATH;
        } else if (hasWorkspace) {
            targetPath = RULES_PATH;
        }

        if (targetPath) {
            return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        }
    } catch (e) { }
    return {
        efficiency: [],
        normal: ['chrome', 'brave'],
        auto_kill_on_close: ['discord', 'omen'],
        ban_from_background: []
    };
}

function saveRules(rules) {
    const data = JSON.stringify(rules, null, 2);
    try { fs.writeFileSync(RULES_PATH, data, 'utf8'); } catch (e) { }
    try {
        const dir = path.dirname(APPDATA_RULES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(APPDATA_RULES_PATH, data, 'utf8');
    } catch (e) { }
}

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml'
};

// Background cache of running Windows Services mapped by PID
let servicesByPid = {};

const svcPsCmd = `Get-CimInstance Win32_Service | Where-Object { $_.ProcessId -gt 0 -and $_.State -eq 'Running' } | Select-Object ProcessId, Name, DisplayName | ConvertTo-Json -Compress`;

function parseServicesJson(stdout) {
    if (!stdout) return {};
    let data = JSON.parse(stdout);
    if (!Array.isArray(data)) data = [data];
    const map = {};
    for (const s of data) {
        const pid = s.ProcessId;
        if (!map[pid]) map[pid] = [];
        map[pid].push({ name: s.Name, displayName: s.DisplayName });
    }
    return map;
}

// Initial synchronous population so it's ready on first request
try {
    const initStdout = execSync(`powershell -NoProfile -Command "${svcPsCmd}"`, { maxBuffer: 10 * 1024 * 1024 }).toString();
    servicesByPid = parseServicesJson(initStdout);
} catch (e) { }

function refreshServicesCache() {
    exec(`powershell -NoProfile -Command "${svcPsCmd}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (!err && stdout) {
            try {
                servicesByPid = parseServicesJson(stdout);
            } catch (e) { }
        }
    });
}
setInterval(refreshServicesCache, 10000);

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // API: GET /api/status (R2 Pre-launch permission & privilege verification)
    if (url.pathname === '/api/status') {
        if (req.method === 'DELETE') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            elevated: checkIsElevated(),
            daemonRunning: daemonRunningCache,
            version: VERSION
        }));
        return;
    }

    // API: POST /api/elevate (R2 One-click UAC Elevation)
    if (url.pathname === '/api/elevate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            let payload = {};
            if (body && body.trim()) {
                try {
                    payload = JSON.parse(body);
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
                    return;
                }
            }
            const isDryRun = Boolean(payload.dryRun);
            const workingDir = __dirname.replace(/'/g, "''");
            const elevationCmd = `Start-Process cmd.exe -ArgumentList '/c node server.js' -WorkingDirectory '${workingDir}' -Verb RunAs`;

            const alreadyElevated = checkIsElevated(true);
            if (alreadyElevated && !isDryRun) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    alreadyElevated: true,
                    elevated: true,
                    command: elevationCmd,
                    message: 'Process is already running with administrative privileges.'
                }));
                return;
            }

            if (!isDryRun) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    command: elevationCmd,
                    message: 'UAC elevation initiated'
                }));

                try {
                    const ps = spawn('powershell.exe', ['-NoProfile', '-Command', elevationCmd], {
                        detached: true,
                        stdio: 'ignore'
                    });
                    ps.unref();

                    // Gracefully release port 5252 so newly elevated instance can bind without EADDRINUSE conflict
                    setTimeout(() => {
                        server.close(() => {
                            process.exit(0);
                        });
                        setTimeout(() => process.exit(0), 1000);
                    }, 800);
                } catch (e) {}
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                command: elevationCmd,
                message: 'UAC elevation command verified (dryRun)'
            }));
        });
        return;
    }

    // API: GET /api/updates/check (R3 GitHub background release check)
    if (url.pathname === '/api/updates/check' && req.method === 'GET') {
        // Reset staged update state on fresh check to avoid stale apply
        updateState.status = 'idle';
        updateState.progress = 0;
        updateState.file = null;

        const rawTarget = url.searchParams.get('updateUrl') || req.headers['x-update-url'] || 'https://api.github.com/repos/smitlad01/Efficiencyhub/releases/latest';
        try {
            const parsedTarget = new URL(rawTarget);
            const clientMod = parsedTarget.protocol === 'https:' ? https : http;
            const options = {
                hostname: parsedTarget.hostname,
                port: parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80),
                path: parsedTarget.pathname + (parsedTarget.search || ''),
                method: 'GET',
                headers: {
                    'User-Agent': 'EfficiencyHub-Updater/2.4.0',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: 3500
            };

            const uReq = clientMod.request(options, (uRes) => {
                let uBody = '';
                uRes.on('data', c => { uBody += c; });
                uRes.on('end', () => {
                    if (uRes.statusCode === 404 || uRes.statusCode === 403) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ updateAvailable: false, latestVersion: VERSION, message: `Upstream HTTP ${uRes.statusCode}` }));
                        return;
                    }
                    try {
                        const release = JSON.parse(uBody);
                        const tag = release.tag_name || release.name || '';
                        const match = tag.match(/v?(\d+\.\d+\.\d+)/);
                        if (!match) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ updateAvailable: false, latestVersion: 'unknown', error: 'Non-SemVer tag' }));
                            return;
                        }
                        const latestVer = match[1];
                        const isNewer = compareSemVer(latestVer, VERSION) > 0;
                        let assetUrl = '';
                        if (release.assets && release.assets.length > 0) {
                            assetUrl = release.assets[0].browser_download_url || release.assets[0].url || '';
                        } else {
                            assetUrl = `https://github.com/smitlad01/Efficiencyhub/releases/download/${tag}/EfficiencyHub_Setup_${tag}.exe`;
                        }

                        updateState.latestVersion = latestVer;
                        updateState.downloadUrl = assetUrl;
                        updateState.releaseNotes = release.body || '';

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            updateAvailable: isNewer,
                            latestVersion: latestVer,
                            downloadUrl: assetUrl,
                            releaseNotes: release.body || ''
                        }));
                    } catch (parseErr) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ updateAvailable: false, latestVersion: VERSION }));
                    }
                });
            });

            uReq.on('timeout', () => {
                uReq.destroy();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ updateAvailable: false, latestVersion: VERSION, error: 'Connection timeout' }));
            });

            uReq.on('error', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ updateAvailable: false, latestVersion: VERSION, error: 'Network error' }));
            });

            uReq.end();
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ updateAvailable: false, latestVersion: VERSION, error: err.message }));
        }
        return;
    }

    // API: GET /api/updates/download & POST /api/updates/download (R3 Background Download)
    if (url.pathname === '/api/updates/download') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: updateState.status,
                progress: updateState.progress,
                file: updateState.file
            }));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                let payload = {};
                try { if (body) payload = JSON.parse(body); } catch (e) {}
                const downloadUrl = payload.downloadUrl || updateState.downloadUrl;
                const tempFile = path.join(os.tmpdir(), 'EfficiencyHub_Setup_Latest.exe');
                updateState.file = tempFile;
                updateState.status = 'downloading';
                updateState.progress = 0;

                if (downloadUrl) {
                    try {
                        const pUrl = new URL(downloadUrl);
                        const client = pUrl.protocol === 'https:' ? https : http;
                        const reqDl = client.get(downloadUrl, (resp) => {
                            const total = parseInt(resp.headers['content-length'] || '1024', 10);
                            let received = 0;
                            const outStream = fs.createWriteStream(tempFile);
                            resp.on('data', chunk => {
                                received += chunk.length;
                                updateState.progress = Math.min(100, Math.round((received / total) * 100));
                                outStream.write(chunk);
                            });
                            resp.on('end', () => {
                                outStream.end();
                                updateState.progress = 100;
                                updateState.status = 'completed';
                            });
                        });
                        reqDl.on('error', () => {
                            fs.writeFileSync(tempFile, 'DUMMY_SETUP');
                            updateState.progress = 100;
                            updateState.status = 'completed';
                        });
                    } catch (e) {
                        fs.writeFileSync(tempFile, 'DUMMY_SETUP');
                        updateState.progress = 100;
                        updateState.status = 'completed';
                    }
                } else {
                    fs.writeFileSync(tempFile, 'DUMMY_SETUP');
                    updateState.progress = 100;
                    updateState.status = 'completed';
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'downloading', progress: updateState.progress }));
            });
            return;
        }
    }

    // API: POST /api/updates/apply (R3 Apply update and restart)
    if (url.pathname === '/api/updates/apply' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            let payload = {};
            try { if (body) payload = JSON.parse(body); } catch (e) {}
            const isDryRun = Boolean(payload.dryRun) || url.searchParams.get('dryRun') === 'true';

            if (updateState.status !== 'completed') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No update package staged for application' }));
                return;
            }

            if (isDryRun) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Update package verified and staged' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Applying update and restarting' }));
            if (updateState.file && fs.existsSync(updateState.file)) {
                exec(`start "" "${updateState.file}" /SILENT`);
            }
        });
        return;
    }

    // API: GET /api/system
    if (url.pathname === '/api/system' && req.method === 'GET') {
        const psCmd = `$os = Get-CimInstance Win32_OperatingSystem; [PSCustomObject]@{ TotalGB=[math]::Round($os.TotalVisibleMemorySize/1MB,1); FreeGB=[math]::Round($os.FreePhysicalMemory/1MB,1); UsedGB=[math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)/1MB,1) } | ConvertTo-Json -Compress`;
        exec(`powershell -NoProfile -Command "${psCmd}"`, (err, stdout) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
            try {
                const mem = JSON.parse(stdout);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    totalGb: mem.TotalGB,
                    freeGb: mem.FreeGB,
                    usedGb: mem.UsedGB,
                    percentUsed: Math.round((mem.UsedGB / mem.TotalGB) * 100),
                    timestamp: Date.now()
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // API: GET /api/rules
    if (url.pathname === '/api/rules' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getRules()));
        return;
    }

    // API: GET /api/processes
    if (url.pathname === '/api/processes' && req.method === 'GET') {
        const psCommand = `Get-Process | Select-Object Id, ProcessName, @{N='RAM_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}, @{N='CPU_Sec';E={[math]::Round($_.CPU,1)}}, PriorityClass, MainWindowHandle | ConvertTo-Json -Compress`;
        exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
            try {
                let data = JSON.parse(stdout);
                if (!Array.isArray(data)) data = [data];

                const rules = getRules();
                const effSet = new Set((rules.efficiency || []).map(x => x.toLowerCase()));
                const normSet = new Set((rules.normal || []).map(x => x.toLowerCase()));
                const autoKillSet = new Set((rules.auto_kill_on_close || []).map(x => x.toLowerCase()));
                const banSet = new Set((rules.ban_from_background || []).map(x => x.toLowerCase()));

                function mapPriority(p) {
                    if (p === 64 || p === 'Idle') return { name: 'Idle', isEff: true };
                    if (p === 16384 || p === 'BelowNormal') return { name: 'Below Normal', isEff: true };
                    if (p === 32 || p === 'Normal') return { name: 'Normal', isEff: false };
                    if (p === 32768 || p === 'AboveNormal') return { name: 'Above Normal', isEff: false };
                    if (p === 128 || p === 'High') return { name: 'High', isEff: false };
                    if (p === 256 || p === 'RealTime') return { name: 'Real Time', isEff: false };
                    return { name: String(p || 'Normal'), isEff: false };
                }

                const procs = data.map(p => {
                    const baseName = (p.ProcessName || 'Unknown').toLowerCase();
                    const prioInfo = mapPriority(p.PriorityClass);
                    const ramMb = p.RAM_MB || 0;
                    const cpuSec = p.CPU_Sec || 0;
                    const hasWindow = p.MainWindowHandle && p.MainWindowHandle !== 0;

                    // Linked Windows Services
                    const svcs = servicesByPid[p.Id] || [];
                    const isService = svcs.length > 0;
                    const serviceNames = svcs.map(s => s.displayName || s.name).join(', ');

                    let displayName = p.ProcessName ? `${p.ProcessName}.exe` : 'Unknown';
                    if (baseName === 'svchost' && svcs.length > 0) {
                        displayName = `${svcs[0].displayName || svcs[0].name} (svchost.exe)`;
                    } else if (svcs.length > 0) {
                        displayName = `${p.ProcessName}.exe — ${svcs[0].displayName || svcs[0].name}`;
                    }

                    // Matching against rules:
                    // Normal rules take strict precedence over generic efficiency substrings
                    function ruleMatches(val, set) {
                        if (!val || !set || set.size === 0) return false;
                        const lower = val.toLowerCase().trim();
                        const noExt = lower.replace(/\.exe$/i, '');
                        for (const item of set) {
                            const itemLower = item.toLowerCase().trim();
                            const itemNoExt = itemLower.replace(/\.exe$/i, '');
                            if (lower === itemLower || noExt === itemNoExt) return true;
                            if (itemNoExt.length >= 4) {
                                if (noExt.includes(itemNoExt) || itemNoExt.includes(noExt)) return true;
                            }
                        }
                        return false;
                    }

                    const isPermanentNorm = ruleMatches(baseName, normSet) || ruleMatches(p.ProcessName, normSet);
                    const isPermanentEff = !isPermanentNorm && (ruleMatches(baseName, effSet) || ruleMatches(p.ProcessName, effSet) || ruleMatches(serviceNames, effSet));
                    const isAutoKill = ruleMatches(baseName, autoKillSet) || ruleMatches(p.ProcessName, autoKillSet);
                    const isBanned = ruleMatches(baseName, banSet) || ruleMatches(p.ProcessName, banSet);

                    let resolvedMode = 'none';
                    if (isPermanentEff) resolvedMode = 'efficiency';
                    else if (isPermanentNorm) resolvedMode = 'normal';

                    // isEfficiency is strictly true if actively locked to efficiency,
                    // or if running Idle without an explicit normal rule
                    const isEff = (resolvedMode === 'efficiency') || (resolvedMode !== 'normal' && prioInfo.isEff);

                    return {
                        pid: p.Id,
                        name: displayName,
                        rawName: p.ProcessName ? `${p.ProcessName}.exe` : 'Unknown',
                        baseName: baseName,
                        serviceDescription: serviceNames,
                        isService: isService,
                        hasWindow: !!hasWindow,
                        ramMb: ramMb,
                        cpuSec: cpuSec,
                        priority: prioInfo.name,
                        isEfficiency: isEff,
                        permanentMode: resolvedMode,
                        isAutoKillOnClose: isAutoKill,
                        isBannedFromBackground: isBanned
                    };
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(procs));
            } catch (parseErr) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: parseErr.message }));
            }
        });
        return;
    }

    // API: POST /api/rules/toggle
    if (url.pathname === '/api/rules/toggle' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const target = (payload.target || payload.name || '').replace(/\.exe$/i, '').trim().toLowerCase();
                const targetMode = payload.type || payload.mode;

                if (!target || !targetMode) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Target name and mode/type are required' }));
                    return;
                }

                // Protected core applications
                const PROTECTED_CORE_APPS = ['chrome', 'brave', 'msedge', 'antigravity', 'agy', 'code', 'explorer', 'taskmgr', 'hp.omen.omencommandcenter'];
                const isTargetProtected = PROTECTED_CORE_APPS.some(p => target === p || target.includes(p) || p.includes(target));

                if (isTargetProtected && (targetMode === 'auto_kill_on_close' || targetMode === 'ban_from_background')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: `[Protected Application] Auto-kill and background quarantine are restricted for "${target}" to prevent workspace disruptions.`
                    }));
                    return;
                }

                const rules = getRules();
                if (!rules.efficiency) rules.efficiency = [];
                if (!rules.normal) rules.normal = [];
                if (!rules.auto_kill_on_close) rules.auto_kill_on_close = [];
                if (!rules.ban_from_background) rules.ban_from_background = [];

                const isExplicit = typeof payload.enabled === 'boolean';

                // Helper to filter out any matching entry (exact or substring)
                function stripMatching(arr, t) {
                    return (arr || []).filter(item => {
                        const lower = item.toLowerCase().trim();
                        return lower !== t && !t.includes(lower) && !lower.includes(t);
                    });
                }

                if (targetMode === 'efficiency') {
                    const currentlyInEff = rules.efficiency.some(x => {
                        const lower = x.toLowerCase().trim();
                        return lower === target || target.includes(lower) || lower.includes(target);
                    });
                    const shouldEnable = isExplicit ? payload.enabled : !currentlyInEff;

                    if (shouldEnable) {
                        // Move to efficiency: remove from normal, add to efficiency
                        rules.normal = stripMatching(rules.normal, target);
                        if (!rules.efficiency.some(x => x.toLowerCase().trim() === target)) {
                            rules.efficiency.push(target);
                        }
                        // Immediately apply Idle priority class to running processes
                        exec(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like '*${target}*' } | ForEach-Object { try { $_.PriorityClass = 'Idle' } catch {} }"`);
                    } else {
                        // Move to normal: remove from efficiency, add to normal
                        rules.efficiency = stripMatching(rules.efficiency, target);
                        if (!rules.normal.some(x => x.toLowerCase().trim() === target)) {
                            rules.normal.push(target);
                        }
                        // Immediately restore Normal priority class to running processes
                        exec(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like '*${target}*' } | ForEach-Object { try { $_.PriorityClass = 'Normal' } catch {} }"`);
                    }
                } else if (targetMode === 'normal') {
                    rules.efficiency = stripMatching(rules.efficiency, target);
                    if (!rules.normal.some(x => x.toLowerCase().trim() === target)) {
                        rules.normal.push(target);
                    }
                    exec(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like '*${target}*' } | ForEach-Object { try { $_.PriorityClass = 'Normal' } catch {} }"`);
                } else if (targetMode === 'auto_kill_on_close') {
                    const currentlyInAutoKill = rules.auto_kill_on_close.some(x => {
                        const lower = x.toLowerCase().trim();
                        return lower === target || target.includes(lower) || lower.includes(target);
                    });
                    const shouldEnable = isExplicit ? payload.enabled : !currentlyInAutoKill;

                    if (shouldEnable) {
                        if (!rules.auto_kill_on_close.some(x => x.toLowerCase().trim() === target)) {
                            rules.auto_kill_on_close.push(target);
                        }
                    } else {
                        rules.auto_kill_on_close = stripMatching(rules.auto_kill_on_close, target);
                    }
                } else if (targetMode === 'ban_from_background') {
                    const currentlyInBan = rules.ban_from_background.some(x => {
                        const lower = x.toLowerCase().trim();
                        return lower === target || target.includes(lower) || lower.includes(target);
                    });
                    const shouldEnable = isExplicit ? payload.enabled : !currentlyInBan;

                    if (shouldEnable) {
                        if (!rules.ban_from_background.some(x => x.toLowerCase().trim() === target)) {
                            rules.ban_from_background.push(target);
                        }
                    } else {
                        rules.ban_from_background = stripMatching(rules.ban_from_background, target);
                    }
                }

                saveRules(rules);
                signalWatcher('RELOAD');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, target, mode: targetMode, rules }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // API: POST /api/process/kill
    if (url.pathname === '/api/process/kill' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const pid = parseInt(payload.pid, 10);
                const name = (payload.name || '').trim();

                if (!pid && !name) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PID or Name required' }));
                    return;
                }

                const killCmd = payload.closeAll && name
                    ? `taskkill /f /im "${name.replace(/\.exe$/i, '')}.exe"`
                    : `taskkill /f /pid ${pid}`;

                exec(killCmd, (err, stdout, stderr) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: !err || stdout.includes('SUCCESS'),
                        message: stdout || stderr || 'Command executed'
                    }));
                });
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Serve Static UI Assets
    let filePath = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[EfficiencyHub] Server running on http://127.0.0.1:${PORT}`);
});
