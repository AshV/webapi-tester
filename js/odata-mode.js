/**
 * CodeMirror Mode for OData v4 / Microsoft Dataverse Web API Queries
 */

(function (mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function (CodeMirror) {
    "use strict";

    CodeMirror.defineMode("odata", function () {
        const SYSTEM_OPTIONS = new Set([
            "$select", "$filter", "$expand", "$orderby", "$top",
            "$skip", "$count", "$apply", "$search", "fetchxml"
        ]);

        const OPERATORS = new Set([
            "eq", "ne", "gt", "ge", "lt", "le",
            "and", "or", "not", "has", "in"
        ]);

        const BUILTIN_FUNCTIONS = new Set([
            "contains", "startswith", "endswith", "indexof", "length",
            "substring", "tolower", "toupper", "trim", "concat",
            "year", "month", "day", "hour", "minute", "second",
            "fractionalseconds", "date", "time", "totaloffsetminutes",
            "now", "maxdatetime", "mindatetime", "totalseconds",
            "round", "floor", "ceiling", "isof", "cast", "geo.distance",
            "geo.intersects", "geo.length"
        ]);

        const ATOMS = new Set(["true", "false", "null"]);
        const ORDER_KEYWORDS = new Set(["asc", "desc"]);

        const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

        function tokenBase(stream, state) {
            // Check whitespace
            if (stream.eatSpace()) return null;

            const ch = stream.peek();

            // Comments
            if (ch === "#" || (ch === "/" && stream.match(/^\/\//))) {
                stream.skipToEnd();
                return "comment";
            }

            // String literals: 'value' (with '' escaped quotes)
            if (ch === "'") {
                stream.next();
                state.tokenize = tokenString;
                return state.tokenize(stream, state);
            }

            // GUID literals
            if (stream.match(GUID_REGEX)) {
                return "atom";
            }

            // Numbers
            if (stream.match(/^[0-9]+(\.[0-9]+)?/)) {
                return "number";
            }

            // Dataverse CRM Functions (e.g. Microsoft.Dynamics.CRM.In)
            if (stream.match(/^Microsoft\.Dynamics\.CRM\.[a-zA-Z0-9_]+/i)) {
                return "builtin";
            }

            // System query options starting with $
            if (ch === "$") {
                stream.next();
                stream.eatWhile(/^[a-zA-Z0-9_]/);
                const word = "$" + stream.current().substring(1).toLowerCase();
                if (SYSTEM_OPTIONS.has(word)) {
                    return "keyword";
                }
                return "variable-2";
            }

            // Punctuation and delimiters
            if (/[?&=;,()\[\]{}]/.test(ch)) {
                stream.next();
                if (ch === "?" || ch === "&") return "def";
                if (ch === "=") return "operator";
                return "punctuation";
            }

            // Identifiers / Operators / Functions
            if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
                const word = stream.current();
                const lower = word.toLowerCase();

                if (OPERATORS.has(lower)) {
                    return "operator";
                }
                if (ORDER_KEYWORDS.has(lower)) {
                    return "keyword";
                }
                if (BUILTIN_FUNCTIONS.has(lower)) {
                    return "builtin";
                }
                if (ATOMS.has(lower)) {
                    return "atom";
                }

                // Check if followed by ( => function call or navigation property
                if (stream.peek() === "(") {
                    return "qualifier";
                }

                return "variable";
            }

            // Catch-all
            stream.next();
            return null;
        }

        function tokenString(stream, state) {
            let escaped = false;
            let ch;

            while ((ch = stream.next()) != null) {
                if (ch === "'" && !escaped) {
                    if (stream.peek() === "'") {
                        // Escaped quote in OData ('')
                        stream.next();
                    } else {
                        state.tokenize = tokenBase;
                        break;
                    }
                }
                escaped = !escaped && ch === "\\";
            }

            return "string";
        }

        return {
            startState: function () {
                return { tokenize: tokenBase };
            },
            token: function (stream, state) {
                return state.tokenize(stream, state);
            },
            lineComment: "//",
            fold: "brace"
        };
    });

    CodeMirror.defineMIME("text/x-odata", "odata");
});
