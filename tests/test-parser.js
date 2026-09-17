const assert = require('assert');
const ODataParser = require('./js/odata-parser.js');
const ODataValidator = require('./js/odata-validator.js');

console.log('--- Testing OData Parser & Validator ---');

// Test 1: Simple query parsing
const q1 = 'accounts?$select=name,accountnumber&$filter=statecode eq 0&$orderby=name asc&$top=50';
const parsed1 = ODataParser.parse(q1);
assert.strictEqual(parsed1.path, 'accounts');
assert.strictEqual(parsed1.params.length, 4);
assert.strictEqual(parsed1.params[0].key, '$select');
assert.strictEqual(parsed1.params[0].value, 'name,accountnumber');
console.log('✓ Test 1: Simple query parsed successfully');

// Test 2: Beautify & Minify roundtrip
const beautified1 = ODataParser.beautify(q1);
const minified1 = ODataParser.minify(beautified1);
assert.strictEqual(minified1.replace(/\s+/g, ''), q1.replace(/\s+/g, ''));
console.log('✓ Test 2: Beautify & Minify roundtrip');

// Test 3: Complex $expand with nested semicolons
const q3 = 'accounts?$select=name&$expand=primarycontactid($select=fullname,emailaddress1;$filter=donotemail eq false),account_tasks($select=subject;$orderby=scheduledend desc;$top=5)&$top=10';
const parsed3 = ODataParser.parse(q3);
assert.strictEqual(parsed3.params.length, 3);
const beautified3 = ODataParser.beautify(q3);
assert.ok(beautified3.includes('primarycontactid('));
assert.ok(beautified3.includes('account_tasks('));
console.log('✓ Test 3: Complex $expand preserved and formatted');

// Test 4: Full URL parsing with org & api version
const fullUrl = 'https://contoso.crm.dynamics.com/api/data/v9.2/contacts?$select=fullname&$filter=contains(fullname, \'Smith\')';
const parsedFull = ODataParser.parse(fullUrl);
assert.strictEqual(parsedFull.orgUrl, 'https://contoso.crm.dynamics.com');
assert.strictEqual(parsedFull.apiVersion, 'v9.2');
assert.strictEqual(parsedFull.path, 'contacts');
console.log('✓ Test 4: Full URL decomposed into org, version, path, and params');

// Test 5: Validation - Valid Query
const vValid = ODataValidator.validate(q3);
assert.strictEqual(vValid.isValid, true);
assert.strictEqual(vValid.errorCount, 0);
console.log('✓ Test 5: Valid query passes validator');

// Test 6: Validation - Unbalanced parenthesis
const vParen = ODataValidator.validate('accounts?$filter=(statecode eq 0 and revenue gt 100');
assert.strictEqual(vParen.isValid, false);
assert.ok(vParen.issues.some(i => i.message.includes('Unclosed parenthesis')));
console.log('✓ Test 6: Unclosed parenthesis detected');

// Test 7: Validation - Unclosed quote
const vQuote = ODataValidator.validate("accounts?$filter=name eq 'Acme Corp");
assert.strictEqual(vQuote.isValid, false);
assert.ok(vQuote.issues.some(i => i.message.includes('Unterminated string literal')));
console.log('✓ Test 7: Unterminated string literal detected');

// Test 8: Validation - Common operator mistake (== instead of eq, && instead of and)
const vOp = ODataValidator.validate("accounts?$filter=statecode == 0 && revenue > 1000");
assert.strictEqual(vOp.isValid, false);
assert.ok(vOp.issues.some(i => i.message.includes('eq')));
assert.ok(vOp.issues.some(i => i.message.includes('and')));
console.log('✓ Test 8: Operator mistakes (==, &&) flagged');

// Test 9: Validation - Missing $ on parameter
const vDollar = ODataValidator.validate("accounts\n?select=name\n&filter=statecode eq 0");
assert.strictEqual(vDollar.isValid, false);
assert.ok(vDollar.issues.some(i => i.message.includes("Missing '$'")));
console.log('✓ Test 9: Missing $ on standard options flagged');

// Test 10: Validation - Illegal & inside $expand(...)
const vExpandAmp = ODataValidator.validate("accounts?$expand=primarycontactid($select=fullname&$filter=statecode eq 0)");
assert.strictEqual(vExpandAmp.isValid, false);
assert.ok(vExpandAmp.issues.some(i => i.message.includes("semicolons")));
console.log('✓ Test 10: Illegal ampersand inside $expand detected');

console.log('\nAll 10 tests passed with 100% success!');
