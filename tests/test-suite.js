const assert = require('assert');
const ODataParser = require('../js/odata-parser.js');
const ODataValidator = require('../js/odata-validator.js');
const CodeGenerator = require('../js/code-generator.js');

console.log('====================================================');
console.log(' Running Comprehensive WebAPI Studio Test Suite     ');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        console.log(`✓ [${total}] ${name}`);
        passed++;
    } catch (err) {
        console.error(`✗ [${total}] ${name}`);
        console.error('   ', err.message);
    }
}

// 1. Basic Query Parsing
runTest('Parse simple accounts query with $select and $filter', () => {
    const q = 'accounts?$select=name,accountnumber&$filter=statecode eq 0';
    const p = ODataParser.parse(q);
    assert.strictEqual(p.path, 'accounts');
    assert.strictEqual(p.params.length, 2);
    assert.strictEqual(p.params[0].key, '$select');
    assert.strictEqual(p.params[1].key, '$filter');
});

// 2. Full URL Parsing
runTest('Parse full Dynamics 365 URL with tenant and API version', () => {
    const url = 'https://myorg.crm.dynamics.com/api/data/v9.2/contacts?$select=fullname,emailaddress1&$top=20';
    const p = ODataParser.parse(url);
    assert.strictEqual(p.orgUrl, 'https://myorg.crm.dynamics.com');
    assert.strictEqual(p.apiVersion, 'v9.2');
    assert.strictEqual(p.path, 'contacts');
    assert.strictEqual(p.params.length, 2);
});

// 3. Nested $expand with semicolons
runTest('Parse and format nested $expand with inner $select and $filter', () => {
    const q = 'accounts?$select=name&$expand=primarycontactid($select=fullname,emailaddress1;$filter=donotemail eq false)&$top=10';
    const p = ODataParser.parse(q);
    assert.strictEqual(p.params.length, 3);
    const beautified = ODataParser.beautify(q);
    assert.ok(beautified.includes('primarycontactid('));
    assert.ok(beautified.includes('$select=fullname, emailaddress1;'));
});

// 4. Multiple $expand relations
runTest('Parse multiple $expand relations separated by comma', () => {
    const q = 'accounts?$expand=primarycontactid($select=fullname),account_tasks($select=subject;$top=5)';
    const p = ODataParser.parse(q);
    assert.strictEqual(p.params.length, 1);
    const beautified = ODataParser.beautify(q);
    assert.ok(beautified.includes('primarycontactid('));
    assert.ok(beautified.includes('account_tasks('));
});

// 5. Minify query
runTest('Minify multi-line query to clean single-line URL string', () => {
    const multi = `accounts\n  ?$select=name, accountnumber\n  &$filter=statecode eq 0\n  &$top=25`;
    const mini = ODataParser.minify(multi);
    assert.strictEqual(mini, 'accounts?$select=name, accountnumber&$filter=statecode eq 0&$top=25');
});

// 6. Full URL generation
runTest('Generate full URL with org and API version', () => {
    const full = ODataParser.buildFullUrl('https://myorg.crm.dynamics.com', 'v9.2', 'accounts?$select=name');
    assert.strictEqual(full, 'https://myorg.crm.dynamics.com/api/data/v9.2/accounts?$select=name');
});

// 7. Safe URL Encoding
runTest('Encode URL preserving OData delimiters (?, &, =, quotes, parens)', () => {
    const enc = ODataParser.buildEncodedUrl('https://myorg.crm.dynamics.com', 'v9.2', "accounts?$select=name&$filter=name eq 'Acme Corp' and statecode eq 0");
    assert.ok(enc.includes("name%20eq%20'Acme%20Corp'"));
    assert.ok(enc.includes("&$filter="));
});

// 8. Validator: Valid Query
runTest('Validate correct query with multiple options', () => {
    const q = `accounts\n  ?$select=name, revenue\n  &$filter=revenue gt 50000 and statecode eq 0\n  &$orderby=revenue desc\n  &$top=10`;
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errorCount, 0);
});

// 9. Validator: Unbalanced Opening Parenthesis
runTest('Detect unclosed parenthesis error', () => {
    const q = 'accounts?$filter=(statecode eq 0 and (revenue gt 100)';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('Unclosed parenthesis')));
});

// 10. Validator: Unexpected Closing Parenthesis
runTest('Detect unexpected closing parenthesis error', () => {
    const q = 'accounts?$filter=statecode eq 0)';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('Unexpected closing parenthesis')));
});

// 11. Validator: Unterminated String Literal
runTest('Detect unterminated single quote in string literal', () => {
    const q = "accounts?$filter=name eq 'Unfinished String";
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('Unterminated string literal')));
});

// 12. Validator: Operator Mistake "==" instead of "eq"
runTest('Flag JavaScript == equality operator as invalid in OData', () => {
    const q = 'accounts?$filter=statecode == 0';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('Use "eq" operator')));
});

// 13. Validator: Operator Mistake "&&" instead of "and"
runTest('Flag JavaScript && logical operator as invalid in OData', () => {
    const q = 'accounts?$filter=statecode eq 0 && statuscode eq 1';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('Use "and" operator')));
});

// 14. Validator: Operator Mistake "||" instead of "or"
runTest('Flag JavaScript || logical operator as invalid in OData', () => {
    const q = 'accounts?$filter=statecode eq 0 || statecode eq 1';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('Use "or" operator')));
});

// 15. Validator: Missing $ on standard parameter
runTest('Flag missing $ prefix on standard query option (select= instead of $select=)', () => {
    const q = 'accounts\n?select=name\n&filter=statecode eq 0';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes("Missing '$'")));
});

// 16. Validator: Semicolon enforcement in $expand
runTest('Flag illegal & inside $expand(...) query options', () => {
    const q = 'accounts?$expand=primarycontactid($select=fullname&$filter=statecode eq 0)';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('semicolons')));
});

// 17. Validator: Dataverse CRM Date Function
runTest('Recognize Microsoft.Dynamics.CRM.LastXDays function as valid', () => {
    const q = "incidents?$filter=Microsoft.Dynamics.CRM.LastXDays(PropertyName='createdon',PropertyValue=30)";
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, true);
});

// 18. Validator: Dataverse CRM.In function
runTest('Recognize Microsoft.Dynamics.CRM.In function with parameter alias', () => {
    const q = "contacts?$filter=Microsoft.Dynamics.CRM.In(PropertyName='address1_country',PropertyValue=@p1)&@p1=['USA','UK']";
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, true);
});

// 19. Validator: Single = inside $filter comparison
runTest('Flag single = inside filter comparison', () => {
    const q = 'accounts?$filter=statecode = 0';
    const res = ODataValidator.validate(q);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.issues.some(i => i.message.includes('must use "eq", not "="')));
});

// 20. Code Generator: Xrm.WebApi
runTest('Generate Xrm.WebApi snippet for client scripting', () => {
    const gen = CodeGenerator.generate('https://myorg.crm.dynamics.com', 'v9.2', 'accounts?$select=name,accountnumber&$filter=statecode eq 0');
    assert.ok(gen.xrm.includes('Xrm.WebApi.retrieveMultipleRecords'));
    assert.ok(gen.xrm.includes('entityLogicalName = "account"'));
    assert.ok(gen.xrm.includes('?$select=name,accountnumber&$filter=statecode eq 0'));
});

// 21. Code Generator: Power Automate
runTest('Generate Power Automate parameters broken down by fields', () => {
    const gen = CodeGenerator.generate('https://myorg.crm.dynamics.com', 'v9.2', 'accounts?$select=name,revenue&$filter=statecode eq 0&$top=50');
    assert.strictEqual(gen.flowFields.table, 'accounts');
    assert.strictEqual(gen.flowFields.select, 'name,revenue');
    assert.strictEqual(gen.flowFields.filter, 'statecode eq 0');
    assert.strictEqual(gen.flowFields.top, '50');
});

// 22. Code Generator: C# HttpClient
runTest('Generate C# HttpClient snippet with Dataverse Prefer headers', () => {
    const gen = CodeGenerator.generate('https://myorg.crm.dynamics.com', 'v9.2', 'accounts?$select=name');
    assert.ok(gen.csharp.includes('client.BaseAddress = new Uri'));
    assert.ok(gen.csharp.includes('OData.Community.Display.V1.FormattedValue'));
    assert.ok(gen.csharp.includes('api/data/v9.2/accounts?$select=name'));
});

// 23. Code Generator: cURL
runTest('Generate cURL command with Bearer token placeholder', () => {
    const gen = CodeGenerator.generate('https://myorg.crm.dynamics.com', 'v9.2', 'accounts?$select=name');
    assert.ok(gen.curl.startsWith('curl -X GET'));
    assert.ok(gen.curl.includes('https://myorg.crm.dynamics.com/api/data/v9.2/accounts?$select=name'));
    assert.ok(gen.curl.includes('Authorization: Bearer <YOUR_ACCESS_TOKEN>'));
});

// 24. Code Generator: PowerShell
runTest('Generate PowerShell Invoke-RestMethod snippet with escaped backticks', () => {
    const gen = CodeGenerator.generate('https://myorg.crm.dynamics.com', 'v9.2', 'accounts?$select=name');
    assert.ok(gen.powershell.includes('Invoke-RestMethod'));
    assert.ok(gen.powershell.includes('`$select=name'));
});

// 25. Unbound functions
runTest('Handle unbound function queries like WhoAmI()', () => {
    const q = 'WhoAmI()';
    const p = ODataParser.parse(q);
    assert.strictEqual(p.path, 'WhoAmI()');
    const full = ODataParser.buildFullUrl('https://myorg.crm.dynamics.com', 'v9.2', q);
    assert.strictEqual(full, 'https://myorg.crm.dynamics.com/api/data/v9.2/WhoAmI()');
});

console.log(`\n====================================================`);
console.log(` Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
console.log(`====================================================\n`);

if (passed !== total) {
    process.exit(1);
}
