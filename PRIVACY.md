# Privacy Policy & Zero-Telemetry Guarantee

EfficiencyHub is built on a non-negotiable principle: **Your personal computer, your processes, and your data belong to you alone.**

---

## 1. Zero Telemetry & Zero Analytics

- **No Tracking SDKs**: EfficiencyHub contains zero third-party telemetry, metrics, tracking, or crash analytics libraries (no Google Analytics, no Sentry, no Mixpanel, no PostHog, no Segment).
- **No Diagnostic Pings**: EfficiencyHub does not ping remote servers when started, stopped, or operated.
- **No Hardware Fingerprinting**: EfficiencyHub does not read, hash, store, or transmit your MAC address, Motherboard UUID, CPU serial, or Windows Digital Product ID.

---

## 2. Zero Data Exfiltration Guarantee

EfficiencyHub never collects, logs, or uploads:
- Your active or background process lists.
- Process window titles, open documents, file paths, or browser URLs.
- Keyboard or mouse inputs.
- Personal identity, usernames, email addresses, or IP addresses.
- System crash dumps or memory snapshots.

All process discovery, EcoQoS prioritization, and auto-kill policies execute strictly in local system volatile memory (RAM). Nothing is transmitted outside your machine.

---

## 3. 100% Offline & Local Operation

- **Localhost Bound**: The dashboard and server operate entirely on `127.0.0.1:5252`. They do not connect to external servers to render UI components, load fonts, or process data.
- **Local Rules Storage**: User-configured throttling and kill rules are stored locally on your hard drive in plain JSON format (`rules.json`) inside the application directory. You can inspect or modify this file at any time using any text editor.

---

## 4. Transparent Network Outbound Activity

EfficiencyHub performs only **one** optional external outbound HTTP connection:
- **GitHub Release Checks (`GET /api/updates/check`)**:
  - Connects solely to the official public GitHub Releases API (`https://api.github.com/repos/smitlad01/Efficiencyhub/releases/latest`).
  - Fetches the published version tag and release asset list.
  - Sends standard HTTP client headers (`User-Agent: EfficiencyHub-Updater/...`, `Accept: application/vnd.github.v3+json`).
  - Transmits **zero** personal information, machine telemetry, or operational metrics.
  - If internet access is disconnected or blocked, EfficiencyHub operates with full functionality offline.

---

## 5. Independent Auditability

Because EfficiencyHub is 100% open source under the MIT License, you can independently verify these privacy guarantees:
1. Review network socket creation in `server.js` (confirming `127.0.0.1` binding).
2. Monitor process network traffic using tools like **Wireshark**, **Fiddler**, or **Sysinternals TCPView** to verify that zero external network packets are emitted during process management.
