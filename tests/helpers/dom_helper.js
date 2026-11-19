/**
 * EfficiencyHub E2E Test Suite - Lightweight DOM & CSS Helper
 * Inspects HTML structure, CSS rules, and simulates minimal browser DOM environment.
 * Zero external npm dependencies.
 */

class DomHelper {
    static escapeRegex(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Checks if HTML contains an element with the given ID.
     */
    static hasElementWithId(html, id) {
        if (!html) return false;
        const escapedId = DomHelper.escapeRegex(id);
        return new RegExp(`id=["']${escapedId}["']`, 'i').test(html);
    }

    /**
     * Checks if HTML contains an element with the given class.
     */
    static hasElementWithClass(html, className) {
        if (!html) return false;
        const escapedClass = DomHelper.escapeRegex(className);
        return new RegExp(`class=["'][^"']*\\b${escapedClass}\\b[^"']*["']`, 'i').test(html);
    }

    /**
     * Extracts tag, content, and full HTML for an element by ID.
     */
    static getElementById(html, id) {
        if (!html) return null;
        const escapedId = DomHelper.escapeRegex(id);
        const regex = new RegExp(`<([a-zA-Z0-9]+)[^>]*id=["']${escapedId}["'][^>]*>(.*?)</\\1>`, 'is');
        const match = html.match(regex);
        if (!match) {
            // Check self-closing tag or tag with attributes
            const selfClosingRegex = new RegExp(`<([a-zA-Z0-9]+)[^>]*id=["']${escapedId}["'][^>]*\\/?>`, 'is');
            const selfMatch = html.match(selfClosingRegex);
            return selfMatch ? { tag: selfMatch[1], content: '', fullMatch: selfMatch[0] } : null;
        }
        return { tag: match[1], content: match[2], fullMatch: match[0] };
    }

    /**
     * Extracts all elements matching a class name.
     */
    static getElementsByClass(html, className) {
        if (!html) return [];
        const escapedClass = DomHelper.escapeRegex(className);
        const regex = new RegExp(`<([a-zA-Z0-9]+)[^>]*class=["'][^"']*\\b${escapedClass}\\b[^"']*["'][^>]*>(.*?)</\\1>`, 'gis');
        const results = [];
        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({ tag: match[1], content: match[2], fullMatch: match[0] });
        }
        return results;
    }

    /**
     * Extracts table rows from a tbody by ID.
     */
    static extractTableRows(html, tbodyId = 'ledgerBody') {
        if (!html) return [];
        const tbodyRegex = new RegExp(`<tbody[^>]*id=["']${tbodyId}["'][^>]*>(.*?)</tbody>`, 'is');
        const tbodyMatch = html.match(tbodyRegex);
        if (!tbodyMatch) return [];

        const rows = [];
        const trRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
        let match;
        while ((match = trRegex.exec(tbodyMatch[1])) !== null) {
            rows.push(match[1]);
        }
        return rows;
    }

    /**
     * Extracts CSS property values for a given selector.
     */
    static extractCssProperty(cssOrHtml, selector, property) {
        if (!cssOrHtml) return null;
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const ruleRegex = new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`, 'is');
        const match = cssOrHtml.match(ruleRegex);
        if (!match) return null;

        const body = match[1];
        const propRegex = new RegExp(`${property}\\s*:\\s*([^;]+);`, 'i');
        const propMatch = body.match(propRegex);
        return propMatch ? propMatch[1].trim() : null;
    }

    /**
     * Extracts all JavaScript <script> block contents from an HTML document.
     */
    static extractScriptContent(html) {
        if (!html) return '';
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        const scripts = [];
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            scripts.push(match[1]);
        }
        return scripts.join('\n');
    }

    /**
     * Extracts full body of a named JavaScript function using balanced brace counting.
     */
    static extractFunctionBody(source, funcName) {
        if (!source) return null;
        const fnPattern = new RegExp(`function\\s+${DomHelper.escapeRegex(funcName)}\\s*\\(`);
        const match = source.match(fnPattern);
        if (!match) return null;
        const startBrace = source.indexOf('{', match.index);
        if (startBrace === -1) return null;

        let depth = 1;
        let i = startBrace + 1;
        while (i < source.length && depth > 0) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}') depth--;
            i++;
        }
        return depth === 0 ? source.slice(startBrace + 1, i - 1) : null;
    }

    /**
     * Creates a lightweight mock DOM / window environment for executing frontend logic.
     */
    static createMockWindow(html = '') {
        const elementsById = new Map();
        const elementsByClass = new Map();

        class MockElement {
            constructor(id = '', tag = 'div', className = '') {
                this.id = id;
                this.tagName = tag.toUpperCase();
                this.className = className;
                this._innerText = '';
                this._innerHTML = '';
                this.style = {};
                this.attributes = {};
                this.classList = {
                    classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
                    add: (cls) => this.classList.classes.add(cls),
                    remove: (cls) => this.classList.classes.delete(cls),
                    contains: (cls) => this.classList.classes.has(cls),
                    toggle: (cls) => {
                        if (this.classList.classes.has(cls)) {
                            this.classList.classes.delete(cls);
                            return false;
                        }
                        this.classList.classes.add(cls);
                        return true;
                    }
                };
            }

            get innerText() { return this._innerText; }
            set innerText(val) { this._innerText = String(val); }

            get innerHTML() { return this._innerHTML; }
            set innerHTML(val) { this._innerHTML = String(val); }

            setAttribute(k, v) { this.attributes[k] = String(v); }
            getAttribute(k) { return this.attributes[k] || null; }
        }

        function getOrCreateElement(id, tag = 'div', cls = '') {
            if (!elementsById.has(id)) {
                const el = new MockElement(id, tag, cls);
                elementsById.set(id, el);
            }
            return elementsById.get(id);
        }

        // Initialize standard elements found in dashboard
        const standardIds = [
            'cntAll', 'cntEff', 'cntServices', 'cntAutoKill', 'cntBanned',
            'ledgerBody', 'filterInput', 'kpiTotal', 'kpiEff', 'kpiAutoKill', 'kpiBanned',
            'elevationPrompt', 'btnElevate', 'updateNotification', 'btnApplyUpdate'
        ];
        for (const id of standardIds) {
            getOrCreateElement(id);
        }

        const mockDocument = {
            getElementById: (id) => elementsById.get(id) || null,
            registerElement: (id, el) => elementsById.set(id, el),
            querySelector: (selector) => {
                if (selector.startsWith('#')) return elementsById.get(selector.slice(1)) || null;
                return null;
            },
            querySelectorAll: (selector) => []
        };

        return {
            document: mockDocument,
            MockElement,
            getOrCreateElement
        };
    }
}

module.exports = DomHelper;
