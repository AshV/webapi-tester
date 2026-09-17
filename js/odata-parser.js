/**
 * OData Parser & Formatter for Microsoft Dataverse Web API
 * Handles bidirectional transformation between raw single-line Web API URLs
 * and formatted, indented multi-line OData syntax.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ODataParser = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Splits query string parameters respecting parentheses and quotes.
     * Prevents splitting on '&' inside $expand(...) or quotes.
     */
    function splitParameters(queryString) {
        const params = [];
        if (!queryString) return params;

        let cur = '';
        let parenDepth = 0;
        let inSingleQuote = false;

        for (let i = 0; i < queryString.length; i++) {
            const char = queryString[i];

            if (char === "'" && (i === 0 || queryString[i - 1] !== '\\')) {
                inSingleQuote = !inSingleQuote;
                cur += char;
            } else if (!inSingleQuote && (char === '(' || char === '{' || char === '[')) {
                parenDepth++;
                cur += char;
            } else if (!inSingleQuote && (char === ')' || char === '}' || char === ']')) {
                if (parenDepth > 0) parenDepth--;
                cur += char;
            } else if (!inSingleQuote && parenDepth === 0 && (char === '&' || (char === '?' && cur.length === 0))) {
                if (cur.trim().length > 0) {
                    params.push(cur.trim());
                    cur = '';
                }
            } else {
                cur += char;
            }
        }

        if (cur.trim().length > 0) {
            params.push(cur.trim());
        }

        return params;
    }

    /**
     * Splits nested $expand parameters separated by semicolons.
     */
    function splitExpandSubParams(expandInner) {
        const clauses = [];
        let cur = '';
        let parenDepth = 0;
        let inSingleQuote = false;

        for (let i = 0; i < expandInner.length; i++) {
            const char = expandInner[i];

            if (char === "'" && (i === 0 || expandInner[i - 1] !== '\\')) {
                inSingleQuote = !inSingleQuote;
                cur += char;
            } else if (!inSingleQuote && char === '(') {
                parenDepth++;
                cur += char;
            } else if (!inSingleQuote && char === ')') {
                if (parenDepth > 0) parenDepth--;
                cur += char;
            } else if (!inSingleQuote && parenDepth === 0 && char === ';') {
                if (cur.trim().length > 0) {
                    clauses.push(cur.trim());
                    cur = '';
                }
            } else {
                cur += char;
            }
        }

        if (cur.trim().length > 0) {
            clauses.push(cur.trim());
        }

        return clauses;
    }

    /**
     * Splits top-level $expand items separated by commas.
     * e.g. "primarycontactid($select=fullname),account_tasks($select=subject)"
     */
    function splitExpandItems(expandStr) {
        const items = [];
        let cur = '';
        let parenDepth = 0;
        let inSingleQuote = false;

        for (let i = 0; i < expandStr.length; i++) {
            const char = expandStr[i];

            if (char === "'" && (i === 0 || expandStr[i - 1] !== '\\')) {
                inSingleQuote = !inSingleQuote;
                cur += char;
            } else if (!inSingleQuote && char === '(') {
                parenDepth++;
                cur += char;
            } else if (!inSingleQuote && char === ')') {
                if (parenDepth > 0) parenDepth--;
                cur += char;
            } else if (!inSingleQuote && parenDepth === 0 && char === ',') {
                if (cur.trim().length > 0) {
                    items.push(cur.trim());
                    cur = '';
                }
            } else {
                cur += char;
            }
        }

        if (cur.trim().length > 0) {
            items.push(cur.trim());
        }

        return items;
    }

    /**
     * Formats an $expand clause with nested indentation.
     */
    function formatExpandClause(expandValue, baseIndent = '  ') {
        const items = splitExpandItems(expandValue);
        if (items.length === 0) return expandValue;

        const formattedItems = items.map(item => {
            const match = item.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/s);
            if (!match) {
                return item;
            }

            const navProperty = match[1];
            const inner = match[2].trim();
            const subClauses = splitExpandSubParams(inner);

            if (subClauses.length <= 1 && inner.length < 50 && !inner.includes('(')) {
                // Short single clause, keep compact on one line
                return `${navProperty}(${inner})`;
            }

            const innerIndent = baseIndent + '    ';
            const formattedSubClauses = subClauses.map(sc => {
                if (sc.startsWith('$expand=')) {
                    const subExpandVal = sc.substring(8);
                    return `$expand=${formatExpandClause(subExpandVal, innerIndent)}`;
                } else if (sc.startsWith('$select=')) {
                    const selectVal = sc.substring(8).split(',').map(s => s.trim()).join(', ');
                    return `$select=${selectVal}`;
                } else if (sc.startsWith('$orderby=')) {
                    const orderVal = sc.substring(9).split(',').map(s => s.trim()).join(', ');
                    return `$orderby=${orderVal}`;
                }
                return sc;
            }).join(';\n' + innerIndent);

            return `${navProperty}(\n${innerIndent}${formattedSubClauses}\n${baseIndent}  )`;
        });

        if (items.length > 1) {
            return formattedItems.join(',\n' + baseIndent + '  ');
        }

        return formattedItems[0];
    }

    /**
     * Parses an arbitrary URL or OData string into structured components.
     */
    function parse(input) {
        if (!input || typeof input !== 'string') {
            return {
                orgUrl: '',
                apiVersion: 'v9.2',
                path: '',
                params: [],
                rawQuery: ''
            };
        }

        let str = input.trim();
        let orgUrl = '';
        let apiVersion = 'v9.2';

        // Check if string contains full HTTP(S) URL
        const httpMatch = str.match(/^(https?:\/\/[^\/?#]+)/i);
        if (httpMatch) {
            orgUrl = httpMatch[1];
            str = str.substring(orgUrl.length);
        }

        // Extract API path e.g. /api/data/v9.2/
        const apiMatch = str.match(/^\/?api\/data\/(v\d+\.\d+)\//i);
        if (apiMatch) {
            apiVersion = apiMatch[1];
            str = str.substring(apiMatch[0].length);
        } else if (str.startsWith('/')) {
            str = str.replace(/^\/+/, '');
        }

        // Separate path and query string
        let path = '';
        let queryStr = '';

        const qIdx = str.indexOf('?');
        if (qIdx >= 0) {
            path = str.substring(0, qIdx).trim();
            queryStr = str.substring(qIdx + 1).trim();
        } else if (str.includes('$') || str.includes('&')) {
            // Might be multi-line without '?' on the path line
            const lines = str.split('\n');
            path = lines[0].replace(/[?&].*$/, '').trim();
            const rest = str.substring(lines[0].length).trim();
            queryStr = rest.replace(/^[?&]+/, '');
        } else {
            path = str.trim();
        }

        // Decode query string if it appears URL encoded (e.g. %24select or %20)
        let decodedQuery = queryStr;
        if (queryStr.includes('%')) {
            try {
                decodedQuery = decodeURIComponent(queryStr.replace(/\+/g, ' '));
            } catch (e) {
                decodedQuery = queryStr;
            }
        }

        // Normalize query by removing newlines between parameter tokens
        const rawParams = splitParameters(decodedQuery);
        const params = [];

        for (const p of rawParams) {
            const cleanP = p.replace(/^[?&]+/, '').trim();
            if (!cleanP) continue;

            const eqIdx = cleanP.indexOf('=');
            if (eqIdx > 0) {
                const key = cleanP.substring(0, eqIdx).trim();
                const value = cleanP.substring(eqIdx + 1).trim();
                params.push({ key, value });
            } else {
                params.push({ key: cleanP, value: '' });
            }
        }

        return {
            orgUrl,
            apiVersion,
            path,
            params,
            rawQuery: decodedQuery
        };
    }

    /**
     * Beautifies an OData query into an indented, multi-line representation.
     */
    function beautify(input) {
        if (!input || typeof input !== 'string') return '';
        const parsed = parse(input);

        let entityPath = parsed.path || 'accounts';
        if (!parsed.params || parsed.params.length === 0) {
            return entityPath;
        }

        const lines = [entityPath];

        parsed.params.forEach((param, idx) => {
            const prefix = idx === 0 ? '  ?' : '  &';
            const key = param.key;
            let val = param.value;

            if (key.toLowerCase() === '$expand') {
                val = formatExpandClause(val, '  ');
            } else if (key.toLowerCase() === '$select') {
                // Tidy spacing after commas
                val = val.split(',').map(s => s.trim()).join(', ');
            } else if (key.toLowerCase() === '$orderby') {
                val = val.split(',').map(s => s.trim()).join(', ');
            }

            lines.push(`${prefix}${key}=${val}`);
        });

        return lines.join('\n');
    }

    /**
     * Minifies an OData query into a single-line query string.
     */
    function minify(input) {
        if (!input || typeof input !== 'string') return '';
        const parsed = parse(input);

        let result = parsed.path || '';
        if (parsed.params && parsed.params.length > 0) {
            const paramStrings = parsed.params.map(p => {
                // Collapse internal whitespace in value
                const cleanVal = p.value.replace(/\s+/g, ' ').trim();
                return `${p.key}=${cleanVal}`;
            });
            result += '?' + paramStrings.join('&');
        }

        return result;
    }

    /**
     * Builds the complete Web API URL.
     */
    function buildFullUrl(orgUrl, apiVersion, odataQuery) {
        const cleanOrg = (orgUrl || '').trim().replace(/\/+$/, '');
        const version = apiVersion || 'v9.2';
        const minified = minify(odataQuery);

        if (!cleanOrg) {
            return `/api/data/${version}/${minified}`;
        }

        return `${cleanOrg}/api/data/${version}/${minified}`;
    }

    /**
     * Builds a safe, properly encoded Web API URL suitable for window.open() or fetch().
     */
    function buildEncodedUrl(orgUrl, apiVersion, odataQuery) {
        const parsed = parse(odataQuery);
        const cleanOrg = (orgUrl || '').trim().replace(/\/+$/, '');
        const version = apiVersion || 'v9.2';
        const path = parsed.path || '';

        let queryPart = '';
        if (parsed.params && parsed.params.length > 0) {
            const encodedParams = parsed.params.map(p => {
                const key = p.key.startsWith('$') ? '$' + encodeURIComponent(p.key.substring(1)) : encodeURIComponent(p.key);
                // Encode value but preserve standard OData delimiters for server recognition
                const val = encodeURIComponent(p.value.replace(/\s+/g, ' ').trim())
                    .replace(/%27/g, "'")
                    .replace(/%28/g, '(')
                    .replace(/%29/g, ')')
                    .replace(/%2C/g, ',')
                    .replace(/%3B/g, ';')
                    .replace(/%3D/g, '=');
                return `${key}=${val}`;
            });
            queryPart = '?' + encodedParams.join('&');
        }

        const base = cleanOrg ? `${cleanOrg}/api/data/${version}/` : `/api/data/${version}/`;
        return `${base}${path}${queryPart}`;
    }

    return {
        parse,
        beautify,
        minify,
        buildFullUrl,
        buildEncodedUrl,
        splitParameters,
        formatExpandClause
    };
}));
