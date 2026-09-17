/**
 * OData Validator & Linter for Microsoft Dataverse Web API
 * Detects syntax errors, unbalanced brackets/quotes, OData v4 operator mistakes,
 * illegal separators in $expand, and provides helpful Dataverse-specific guidance.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ODataValidator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const VALID_QUERY_OPTIONS = [
        '$select',
        '$filter',
        '$expand',
        '$orderby',
        '$top',
        '$skip',
        '$count',
        '$apply',
        '$search',
        'fetchXml'
    ];

    const COMMON_MISTAKES = [
        { regex: /==/g, message: 'Use "eq" operator instead of "=="', type: 'error' },
        { regex: /!=/g, message: 'Use "ne" operator instead of "!="', type: 'error' },
        { regex: /&&/g, message: 'Use "and" operator instead of "&&"', type: 'error' },
        { regex: /\|\|/g, message: 'Use "or" operator instead of "||"', type: 'error' },
        { regex: /\b(?<!\$)(?:like)\b/gi, message: 'OData does not have a "like" operator. Use contains(attribute, \'value\') or startswith(...)', type: 'error' }
    ];

    /**
     * Validates matching parentheses and single quotes across lines.
     */
    function validateBracketsAndQuotes(text) {
        const issues = [];
        const lines = text.split('\n');

        const parenStack = [];
        let inQuote = false;
        let quoteStart = null;

        for (let l = 0; l < lines.length; l++) {
            const line = lines[l];
            const lineNum = l + 1;

            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                const colNum = c + 1;

                if (char === "'") {
                    // Check for escaped quote in OData ('')
                    if (inQuote && c + 1 < line.length && line[c + 1] === "'") {
                        c++; // Skip escaped quote
                        continue;
                    }

                    if (inQuote) {
                        inQuote = false;
                        quoteStart = null;
                    } else {
                        inQuote = true;
                        quoteStart = { line: lineNum, col: colNum };
                    }
                } else if (!inQuote) {
                    if (char === '(') {
                        parenStack.push({ char: '(', line: lineNum, col: colNum });
                    } else if (char === ')') {
                        if (parenStack.length === 0) {
                            issues.push({
                                type: 'error',
                                line: lineNum,
                                col: colNum,
                                message: `Unexpected closing parenthesis ')' without matching '('`
                            });
                        } else {
                            parenStack.pop();
                        }
                    }
                }
            }
        }

        if (inQuote && quoteStart) {
            issues.push({
                type: 'error',
                line: quoteStart.line,
                col: quoteStart.col,
                message: `Unterminated string literal. Missing closing single quote '`
            });
        }

        while (parenStack.length > 0) {
            const unclosed = parenStack.pop();
            issues.push({
                type: 'error',
                line: unclosed.line,
                col: unclosed.col,
                message: `Unclosed parenthesis '('`
            });
        }

        return issues;
    }

    /**
     * Validates $expand clauses for illegal separators (semicolon vs comma/ampersand).
     */
    function validateExpandClauses(text) {
        const issues = [];
        if (!text) return issues;

        // Find occurrences of $expand= in the text
        const lower = text.toLowerCase();
        let searchIndex = 0;

        while ((searchIndex = lower.indexOf('$expand=', searchIndex)) !== -1) {
            const startPos = searchIndex + 8; // length of '$expand='
            let parenDepth = 0;
            let inQuote = false;
            let expandContent = '';
            let endPos = text.length;

            // Collect the entire expand clause respecting parentheses and top-level boundaries
            for (let i = startPos; i < text.length; i++) {
                const char = text[i];
                if (char === "'" && (i === 0 || text[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                    expandContent += char;
                } else if (!inQuote && char === '(') {
                    parenDepth++;
                    expandContent += char;
                } else if (!inQuote && char === ')') {
                    if (parenDepth > 0) parenDepth--;
                    expandContent += char;
                } else if (!inQuote && parenDepth === 0 && (char === '&' || (char === '\n' && text[i + 1] !== ' '))) {
                    endPos = i;
                    break;
                } else {
                    expandContent += char;
                }
            }

            // Now inspect expandContent for inner parenthesis contents
            let innerDepth = 0;
            let currentInner = '';

            for (let i = 0; i < expandContent.length; i++) {
                const c = expandContent[i];
                if (c === '(') {
                    if (innerDepth === 0) {
                        currentInner = '';
                    }
                    innerDepth++;
                } else if (c === ')') {
                    innerDepth--;
                    if (innerDepth === 0) {
                        // Check if currentInner uses '&' between query options
                        if (/(\$select=[^;)]*)&(\$filter=|\$orderby=|\$top=|\$expand=)/i.test(currentInner)) {
                            issues.push({
                                type: 'error',
                                message: `Inside $expand(...), query options must be separated by semicolons (';'), not ampersands ('&').`
                            });
                        }
                        if (/(\$select=[^;)]*),(\$(?:filter|orderby|top|expand)=)/i.test(currentInner)) {
                            issues.push({
                                type: 'error',
                                message: `Inside $expand(...), query options must be separated by semicolons (';'), not commas (',').`
                            });
                        }
                    }
                } else if (innerDepth > 0) {
                    currentInner += c;
                }
            }

            searchIndex = endPos;
        }

        return issues;
    }

    /**
     * Checks for common operator errors and syntax issues.
     */
    function validateOperatorsAndOptions(text) {
        const issues = [];
        const lines = text.split('\n');

        lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            const trimmed = line.trim();

            if (!trimmed) return;

            // Check for missing $ on standard query options
            const missingDollarMatch = trimmed.match(/^[?&]?(select|filter|expand|orderby|top|skip|count|apply)=/i);
            if (missingDollarMatch) {
                issues.push({
                    type: 'error',
                    line: lineNum,
                    col: 1,
                    message: `Missing '$' on standard OData option: use "$${missingDollarMatch[1]}=" instead of "${missingDollarMatch[1]}="`
                });
            }

            // Check for unknown $ options
            const unknownDollarMatch = trimmed.match(/^[?&]?(\$[a-zA-Z]+)=/);
            if (unknownDollarMatch) {
                const opt = unknownDollarMatch[1].toLowerCase();
                if (!VALID_QUERY_OPTIONS.includes(opt)) {
                    issues.push({
                        type: 'warning',
                        line: lineNum,
                        col: 1,
                        message: `Unknown or non-standard OData query option "${unknownDollarMatch[1]}"`
                    });
                }
            }

            // Check for single = inside $filter comparison (ignoring named params in function calls e.g. Func(PropertyName='val'))
            const filterMatch = trimmed.match(/(?:^|[?&]|\s)\$filter=([^&?\n]+)/i);
            if (filterMatch) {
                const filterBody = filterMatch[1];
                // Remove strings
                const withoutStrings = filterBody.replace(/'[^']*'/g, "''");
                // Remove function calls with named parameters e.g. CRM.In(PropertyName=...)
                const withoutFuncCalls = withoutStrings.replace(/[a-zA-Z0-9_.]+\s*\([^)]*\)/g, ' ');
                if (/(?<![<>!=:])=(?![=])/.test(withoutFuncCalls)) {
                    issues.push({
                        type: 'error',
                        line: lineNum,
                        message: `In $filter, equality comparison must use "eq", not "="`
                    });
                }
            }

            // Check common operator mistakes outside string literals
            const sanitizedLine = trimmed.replace(/'[^']*'/g, "''");
            COMMON_MISTAKES.forEach(mistake => {
                if (mistake.regex.test(sanitizedLine)) {
                    issues.push({
                        type: mistake.type,
                        line: lineNum,
                        message: mistake.message
                    });
                }
            });

            // Check for quoted GUIDs in filters (Dataverse preference warning)
            if (trimmed.includes('$filter')) {
                const quotedGuidMatch = trimmed.match(/'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'/);
                if (quotedGuidMatch) {
                    issues.push({
                        type: 'warning',
                        line: lineNum,
                        message: `In Dataverse Web API, GUID literals in $filter typically should NOT be quoted (e.g. accountid eq ${quotedGuidMatch[0].replace(/'/g, '')})`
                    });
                }
            }
        });

        return issues;
    }

    /**
     * Runs all validation rules on the OData query text.
     */
    function validate(text) {
        if (!text || !text.trim()) {
            return {
                isValid: true,
                errorCount: 0,
                warningCount: 0,
                issues: []
            };
        }

        const issues = [];
        issues.push(...validateBracketsAndQuotes(text));
        issues.push(...validateExpandClauses(text));
        issues.push(...validateOperatorsAndOptions(text));

        // Deduplicate issues with same line and message
        const uniqueIssues = [];
        const seen = new Set();
        for (const iss of issues) {
            const key = `${iss.type}_${iss.line || 0}_${iss.col || 0}_${iss.message}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueIssues.push(iss);
            }
        }

        const errorCount = uniqueIssues.filter(i => i.type === 'error').length;
        const warningCount = uniqueIssues.filter(i => i.type === 'warning').length;

        return {
            isValid: errorCount === 0,
            errorCount,
            warningCount,
            issues: uniqueIssues
        };
    }

    return {
        validate,
        validateBracketsAndQuotes,
        validateExpandClauses,
        validateOperatorsAndOptions
    };
}));
