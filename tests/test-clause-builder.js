const assert = require('assert');
const ODataParser = require('../js/odata-parser.js');
const ClauseBuilder = require('../js/clause-builder.js');

console.log('--- Testing Visual Clause Builder ---');

// Test 1: Parse query into builder state
const q1 = `accounts\n  ?$select=name, revenue\n  &$filter=statecode eq 0\n  &$orderby=revenue desc\n  &$top=50`;
ClauseBuilder.parseQueryToState(q1);

assert.strictEqual(ClauseBuilder.state.entity, 'accounts');
assert.strictEqual(ClauseBuilder.state.select, 'name, revenue');
assert.strictEqual(ClauseBuilder.state.filters.length, 1);
assert.strictEqual(ClauseBuilder.state.filters[0].field, 'statecode');
assert.strictEqual(ClauseBuilder.state.filters[0].op, 'eq');
assert.strictEqual(ClauseBuilder.state.filters[0].value, '0');
assert.strictEqual(ClauseBuilder.state.orderbyField, 'revenue');
assert.strictEqual(ClauseBuilder.state.orderbyDir, 'desc');
assert.strictEqual(ClauseBuilder.state.top, '50');
console.log('✓ Test 1: Query parsed into Clause Builder state');

// Test 2: Build query from state
const rebuilt = ClauseBuilder.buildQueryFromState();
assert.ok(rebuilt.includes('accounts'));
assert.ok(rebuilt.includes('$select=name, revenue'));
assert.ok(rebuilt.includes('$filter=statecode eq 0'));
assert.ok(rebuilt.includes('$orderby=revenue desc'));
assert.ok(rebuilt.includes('$top=50'));
console.log('✓ Test 2: Query rebuilt from Clause Builder state');

// Test 3: Complex Expand parsing
const q3 = `accounts\n  ?$select=name\n  &$expand=primarycontactid($select=fullname, emailaddress1;$filter=donotemail eq false;$top=5)`;
ClauseBuilder.parseQueryToState(q3);
assert.strictEqual(ClauseBuilder.state.expands.length, 1);
assert.strictEqual(ClauseBuilder.state.expands[0].navProp, 'primarycontactid');
assert.strictEqual(ClauseBuilder.state.expands[0].select, 'fullname, emailaddress1');
assert.strictEqual(ClauseBuilder.state.expands[0].filter, 'donotemail eq false');
assert.strictEqual(ClauseBuilder.state.expands[0].top, '5');
console.log('✓ Test 3: Nested expand parsed into structured expand cards');

// Test 4: String filter functions (contains, startswith)
const q4 = `contacts\n  ?$filter=contains(fullname, 'Smith') and statecode eq 0`;
ClauseBuilder.parseQueryToState(q4);
assert.strictEqual(ClauseBuilder.state.filters.length, 2);
assert.strictEqual(ClauseBuilder.state.filters[0].op, 'contains');
assert.strictEqual(ClauseBuilder.state.filters[0].field, 'fullname');
assert.strictEqual(ClauseBuilder.state.filters[0].value, "'Smith'");
console.log('✓ Test 4: OData string functions parsed correctly');

console.log('\nAll Visual Clause Builder tests passed successfully!');
