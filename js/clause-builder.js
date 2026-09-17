/**
 * Visual Clause Builder for Microsoft Dataverse OData Web API
 * Provides a structured visual interface for $select, $filter, $expand, $orderby, $top,
 * with bidirectional live synchronization to the Code Editor and URL bar.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./odata-parser'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./odata-parser'));
    } else {
        root.ClauseBuilder = factory(root.ODataParser);
    }
}(typeof self !== 'undefined' ? self : this, function (ODataParser) {
    'use strict';

    const state = {
        entity: 'accounts',
        recordId: '',
        select: 'name, accountnumber, telephone1, address1_city',
        filters: [
            { field: 'statecode', op: 'eq', value: '0', logic: 'and' }
        ],
        rawFilter: '',
        isRawFilterMode: false,
        expands: [
            {
                navProp: 'primarycontactid',
                select: 'fullname, emailaddress1, mobilephone',
                filter: 'donotemail eq false',
                orderby: '',
                top: ''
            }
        ],
        orderbyField: 'name',
        orderbyDir: 'asc',
        top: '50',
        skip: '',
        count: false,
        apply: '',
        search: ''
    };

    let isUpdatingFromCode = false;

    /**
     * Parses an OData query string or multi-line text into builder state.
     */
    function parseQueryToState(queryText) {
        const parser = ODataParser || (typeof window !== 'undefined' ? window.ODataParser : null);
        if (!parser) return;

        const parsed = parser.parse(queryText);

        // 1. Entity and record ID
        let path = (parsed.path || 'accounts').trim();
        const idMatch = path.match(/^([a-zA-Z0-9_]+)\(([^)]+)\)$/);
        if (idMatch) {
            state.entity = idMatch[1];
            state.recordId = idMatch[2];
        } else {
            state.entity = path;
            state.recordId = '';
        }

        // Reset parameters
        state.select = '';
        state.filters = [];
        state.rawFilter = '';
        state.expands = [];
        state.orderbyField = '';
        state.orderbyDir = 'asc';
        state.top = '';
        state.skip = '';
        state.count = false;
        state.apply = '';
        state.search = '';

        parsed.params.forEach(p => {
            const key = p.key.toLowerCase();
            const val = p.value;

            if (key === '$select') {
                state.select = val.split(',').map(s => s.trim()).join(', ');
            } else if (key === '$filter') {
                state.rawFilter = val;
                parseFilterToRows(val);
            } else if (key === '$expand') {
                parseExpandToCards(val);
            } else if (key === '$orderby') {
                const parts = val.split(',')[0].trim().split(/\s+/);
                state.orderbyField = parts[0] || '';
                state.orderbyDir = (parts[1] || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
            } else if (key === '$top') {
                state.top = val.trim();
            } else if (key === '$skip') {
                state.skip = val.trim();
            } else if (key === '$count') {
                state.count = val.toLowerCase() === 'true';
            } else if (key === '$apply') {
                state.apply = val.trim();
            } else if (key === '$search') {
                state.search = val.trim();
            }
        });
    }

    /**
     * Attempts to parse $filter into simple condition rows.
     * Falls back to raw filter mode if complex parentheses or CRM functions exist.
     */
    function parseFilterToRows(filterStr) {
        if (!filterStr || !filterStr.trim()) {
            state.filters = [];
            state.isRawFilterMode = false;
            return;
        }

        const trimmed = filterStr.trim();

        // Check if filter contains complex functions or deeply nested parentheses
        if (trimmed.includes('Microsoft.Dynamics.CRM') || (trimmed.match(/\(/g) || []).length > 1) {
            state.isRawFilterMode = true;
            state.filters = [];
            return;
        }

        // Split by top-level 'and' / 'or'
        const parts = trimmed.split(/\s+(and|or)\s+/i);
        const rows = [];
        let currentLogic = 'and';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (part.toLowerCase() === 'and' || part.toLowerCase() === 'or') {
                currentLogic = part.toLowerCase();
                continue;
            }

            // Clean wrapping parentheses if wrapped entirely e.g. (statecode eq 0)
            let cleanPart = part;
            while (cleanPart.startsWith('(') && cleanPart.endsWith(')') && !cleanPart.match(/^[a-zA-Z0-9_.]+\(/)) {
                cleanPart = cleanPart.slice(1, -1).trim();
            }

            // Match "field op value"
            const binaryMatch = cleanPart.match(/^([a-zA-Z0-9_]+)\s+(eq|ne|gt|ge|lt|le|has|in)\s+(.+)$/i);
            if (binaryMatch) {
                rows.push({
                    field: binaryMatch[1],
                    op: binaryMatch[2].toLowerCase(),
                    value: binaryMatch[3].trim(),
                    logic: currentLogic
                });
                continue;
            }

            // Match functions: contains(field, 'value'), startswith(field, 'value'), endswith(field, 'value')
            const funcMatch = cleanPart.match(/^(contains|startswith|endswith)\(([a-zA-Z0-9_]+),\s*(.+)\)$/i);
            if (funcMatch) {
                rows.push({
                    field: funcMatch[2],
                    op: funcMatch[1].toLowerCase(),
                    value: funcMatch[3].trim(),
                    logic: currentLogic
                });
                continue;
            }

            // Null checks: field eq null
            if (cleanPart.match(/^([a-zA-Z0-9_]+)\s+eq\s+null$/i)) {
                const m = cleanPart.match(/^([a-zA-Z0-9_]+)\s+eq\s+null$/i);
                rows.push({ field: m[1], op: 'null', value: '', logic: currentLogic });
                continue;
            }
            if (cleanPart.match(/^([a-zA-Z0-9_]+)\s+ne\s+null$/i)) {
                const m = cleanPart.match(/^([a-zA-Z0-9_]+)\s+ne\s+null$/i);
                rows.push({ field: m[1], op: 'not null', value: '', logic: currentLogic });
                continue;
            }

            // If not matched cleanly, switch to raw mode
            state.isRawFilterMode = true;
            state.filters = [];
            return;
        }

        state.filters = rows;
        state.isRawFilterMode = false;
    }

    /**
     * Parses $expand string into structured expand cards.
     */
    function parseExpandToCards(expandStr) {
        const parser = ODataParser || (typeof window !== 'undefined' ? window.ODataParser : null);
        const items = parser && parser.splitExpandItems ? parser.splitExpandItems(expandStr) : [expandStr];

        state.expands = items.map(item => {
            const match = item.match(/^([a-zA-Z0-9_]+)(?:\((.*)\))?$/s);
            if (!match) return { navProp: item, select: '', filter: '', orderby: '', top: '' };

            const navProp = match[1];
            const inner = (match[2] || '').trim();

            const card = { navProp, select: '', filter: '', orderby: '', top: '' };
            if (!inner) return card;

            const subClauses = parser && parser.splitExpandSubParams ? parser.splitExpandSubParams(inner) : inner.split(';');
            subClauses.forEach(sc => {
                const trimmedSc = sc.trim();
                if (trimmedSc.startsWith('$select=')) card.select = trimmedSc.substring(8);
                else if (trimmedSc.startsWith('$filter=')) card.filter = trimmedSc.substring(8);
                else if (trimmedSc.startsWith('$orderby=')) card.orderby = trimmedSc.substring(9);
                else if (trimmedSc.startsWith('$top=')) card.top = trimmedSc.substring(5);
            });

            return card;
        });
    }

    /**
     * Builds the complete formatted OData query from builder state.
     */
    function buildQueryFromState() {
        let basePath = state.entity.trim() || 'accounts';
        if (state.recordId.trim()) {
            basePath += `(${state.recordId.trim()})`;
        }

        const clauses = [];

        // $select
        if (state.select.trim()) {
            const cleanSelect = state.select.split(',').map(s => s.trim()).filter(Boolean).join(', ');
            clauses.push(`$select=${cleanSelect}`);
        }

        // $filter
        if (state.isRawFilterMode) {
            if (state.rawFilter.trim()) {
                clauses.push(`$filter=${state.rawFilter.trim()}`);
            }
        } else if (state.filters.length > 0) {
            const filterParts = [];
            state.filters.forEach((f, idx) => {
                const field = f.field.trim();
                const val = f.value.trim();
                if (!field) return;

                let part = '';
                if (f.op === 'contains' || f.op === 'startswith' || f.op === 'endswith') {
                    // Ensure quotes around string value if missing
                    const formattedVal = val.startsWith("'") && val.endsWith("'") ? val : `'${val}'`;
                    part = `${f.op}(${field}, ${formattedVal})`;
                } else if (f.op === 'null') {
                    part = `${field} eq null`;
                } else if (f.op === 'not null') {
                    part = `${field} ne null`;
                } else {
                    part = `${field} ${f.op} ${val}`;
                }

                if (idx > 0 && filterParts.length > 0) {
                    filterParts.push(f.logic || 'and');
                }
                filterParts.push(part);
            });

            if (filterParts.length > 0) {
                clauses.push(`$filter=${filterParts.join(' ')}`);
            }
        }

        // $expand
        if (state.expands.length > 0) {
            const expandItems = [];
            state.expands.forEach(exp => {
                const nav = exp.navProp.trim();
                if (!nav) return;

                const innerOptions = [];
                if (exp.select.trim()) innerOptions.push(`$select=${exp.select.trim()}`);
                if (exp.filter.trim()) innerOptions.push(`$filter=${exp.filter.trim()}`);
                if (exp.orderby.trim()) innerOptions.push(`$orderby=${exp.orderby.trim()}`);
                if (exp.top.trim()) innerOptions.push(`$top=${exp.top.trim()}`);

                if (innerOptions.length > 0) {
                    expandItems.push(`${nav}(\n      ${innerOptions.join(';\n      ')}\n  )`);
                } else {
                    expandItems.push(nav);
                }
            });

            if (expandItems.length > 0) {
                clauses.push(`$expand=${expandItems.join(', ')}`);
            }
        }

        // $orderby
        if (state.orderbyField.trim()) {
            clauses.push(`$orderby=${state.orderbyField.trim()} ${state.orderbyDir || 'asc'}`);
        }

        // $top
        if (state.top.trim()) {
            clauses.push(`$top=${state.top.trim()}`);
        }

        // $skip
        if (state.skip.trim()) {
            clauses.push(`$skip=${state.skip.trim()}`);
        }

        // $count
        if (state.count) {
            clauses.push(`$count=true`);
        }

        // $apply
        if (state.apply.trim()) {
            clauses.push(`$apply=${state.apply.trim()}`);
        }

        // $search
        if (state.search.trim()) {
            clauses.push(`$search=${state.search.trim()}`);
        }

        if (clauses.length === 0) {
            return basePath;
        }

        const lines = [basePath];
        clauses.forEach((c, idx) => {
            const prefix = idx === 0 ? '  ?' : '  &';
            lines.push(`${prefix}${c}`);
        });

        return lines.join('\n');
    }

    /**
     * Renders the interactive Visual Clause Builder UI.
     */
    function render() {
        const container = document.getElementById('visualBuilderContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="clause-builder-layout">
                <!-- Section 1: Entity & Path -->
                <div class="builder-section">
                    <div class="builder-section-header">
                        <span class="builder-section-title">1. Entity Set & Resource Path</span>
                        <div class="quick-entities-row">
                            <span class="quick-chip" onclick="ClauseBuilder.setEntity('accounts')">accounts</span>
                            <span class="quick-chip" onclick="ClauseBuilder.setEntity('contacts')">contacts</span>
                            <span class="quick-chip" onclick="ClauseBuilder.setEntity('incidents')">incidents</span>
                            <span class="quick-chip" onclick="ClauseBuilder.setEntity('opportunities')">opportunities</span>
                            <span class="quick-chip" onclick="ClauseBuilder.setEntity('leads')">leads</span>
                            <span class="quick-chip" onclick="ClauseBuilder.setEntity('systemusers')">systemusers</span>
                        </div>
                    </div>
                    <div class="builder-row">
                        <div class="field-group" style="flex: 2;">
                            <label class="field-label">Table / Collection Name</label>
                            <input type="text" id="vbEntity" class="builder-input" value="${escapeHtml(state.entity)}" placeholder="e.g. accounts" oninput="ClauseBuilder.onInputChanged()" />
                        </div>
                        <div class="field-group" style="flex: 2;">
                            <label class="field-label">Record GUID (Optional for single record)</label>
                            <input type="text" id="vbRecordId" class="builder-input" value="${escapeHtml(state.recordId)}" placeholder="e.g. 00000000-0000-0000-0000-000000000000" oninput="ClauseBuilder.onInputChanged()" />
                        </div>
                    </div>
                </div>

                <!-- Section 2: Select Columns -->
                <div class="builder-section">
                    <div class="builder-section-header">
                        <span class="builder-section-title">2. Select Columns ($select)</span>
                        <div class="quick-entities-row">
                            <span class="quick-chip" onclick="ClauseBuilder.addSelectCol('name')">+ name</span>
                            <span class="quick-chip" onclick="ClauseBuilder.addSelectCol('createdon')">+ createdon</span>
                            <span class="quick-chip" onclick="ClauseBuilder.addSelectCol('modifiedon')">+ modifiedon</span>
                            <span class="quick-chip" onclick="ClauseBuilder.addSelectCol('statecode')">+ statecode</span>
                            <span class="quick-chip" onclick="ClauseBuilder.addSelectCol('ownerid')">+ ownerid</span>
                        </div>
                    </div>
                    <div class="field-group">
                        <input type="text" id="vbSelect" class="builder-input" value="${escapeHtml(state.select)}" placeholder="Comma-separated attributes (e.g. name, accountnumber, telephone1, createdon)" oninput="ClauseBuilder.onInputChanged()" />
                    </div>
                </div>

                <!-- Section 3: Filter Rows -->
                <div class="builder-section">
                    <div class="builder-section-header">
                        <span class="builder-section-title">3. Filter Rows ($filter)</span>
                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                            <button class="btn-sm-secondary" onclick="ClauseBuilder.toggleRawFilterMode()">
                                ${state.isRawFilterMode ? 'Switch to Visual Rows' : 'Switch to Raw Expression'}
                            </button>
                            ${!state.isRawFilterMode ? `<button class="btn-sm-secondary btn-accent-subtle" onclick="ClauseBuilder.addFilterRow()">+ Add Condition</button>` : ''}
                        </div>
                    </div>

                    ${state.isRawFilterMode ? `
                        <div class="field-group">
                            <textarea id="vbRawFilter" class="builder-textarea" rows="3" placeholder="e.g. statecode eq 0 and (revenue gt 100000 or customertypecode eq 1)" oninput="ClauseBuilder.onInputChanged()">${escapeHtml(state.rawFilter)}</textarea>
                        </div>
                    ` : `
                        <div id="vbFilterRowsContainer" class="filter-rows-container">
                            ${state.filters.length === 0 ? '<div class="empty-builder-hint">No filter conditions. Click "+ Add Condition" to filter rows.</div>' : ''}
                            ${state.filters.map((f, idx) => `
                                <div class="filter-builder-row">
                                    ${idx > 0 ? `
                                        <select class="builder-select logic-select" onchange="ClauseBuilder.updateFilterLogic(${idx}, this.value)">
                                            <option value="and" ${f.logic === 'and' ? 'selected' : ''}>AND</option>
                                            <option value="or" ${f.logic === 'or' ? 'selected' : ''}>OR</option>
                                        </select>
                                    ` : '<div class="logic-placeholder">WHERE</div>'}
                                    <input type="text" class="builder-input field-input" placeholder="Field (e.g. statecode)" value="${escapeHtml(f.field)}" oninput="ClauseBuilder.updateFilterField(${idx}, this.value)" />
                                    <select class="builder-select op-select" onchange="ClauseBuilder.updateFilterOp(${idx}, this.value)">
                                        <option value="eq" ${f.op === 'eq' ? 'selected' : ''}>eq (=)</option>
                                        <option value="ne" ${f.op === 'ne' ? 'selected' : ''}>ne (&ne;)</option>
                                        <option value="gt" ${f.op === 'gt' ? 'selected' : ''}>gt (&gt;)</option>
                                        <option value="ge" ${f.op === 'ge' ? 'selected' : ''}>ge (&ge;)</option>
                                        <option value="lt" ${f.op === 'lt' ? 'selected' : ''}>lt (&lt;)</option>
                                        <option value="le" ${f.op === 'le' ? 'selected' : ''}>le (&le;)</option>
                                        <option value="contains" ${f.op === 'contains' ? 'selected' : ''}>contains()</option>
                                        <option value="startswith" ${f.op === 'startswith' ? 'selected' : ''}>startswith()</option>
                                        <option value="endswith" ${f.op === 'endswith' ? 'selected' : ''}>endswith()</option>
                                        <option value="null" ${f.op === 'null' ? 'selected' : ''}>is null</option>
                                        <option value="not null" ${f.op === 'not null' ? 'selected' : ''}>is not null</option>
                                    </select>
                                    ${f.op !== 'null' && f.op !== 'not null' ? `
                                        <input type="text" class="builder-input val-input" placeholder="Value (e.g. 0 or 'Acme')" value="${escapeHtml(f.value)}" oninput="ClauseBuilder.updateFilterVal(${idx}, this.value)" />
                                    ` : '<div style="flex: 2;"></div>'}
                                    <button class="btn-icon-danger" title="Remove condition" onclick="ClauseBuilder.removeFilterRow(${idx})">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- Section 4: Expand Relations -->
                <div class="builder-section">
                    <div class="builder-section-header">
                        <span class="builder-section-title">4. Expand Related Entities ($expand)</span>
                        <button class="btn-sm-secondary btn-accent-subtle" onclick="ClauseBuilder.addExpandCard()">+ Add Relation</button>
                    </div>
                    <div id="vbExpandsContainer" class="expands-cards-container">
                        ${state.expands.length === 0 ? '<div class="empty-builder-hint">No relations expanded. Click "+ Add Relation" to include related tables (e.g. primarycontactid).</div>' : ''}
                        ${state.expands.map((exp, idx) => `
                            <div class="expand-card">
                                <div class="expand-card-header">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                        <input type="text" class="builder-input" style="font-weight: 700; max-width: 240px;" placeholder="Navigation Property (e.g. primarycontactid)" value="${escapeHtml(exp.navProp)}" oninput="ClauseBuilder.updateExpandNav(${idx}, this.value)" />
                                    </div>
                                    <button class="btn-icon-danger" title="Remove relation" onclick="ClauseBuilder.removeExpandCard(${idx})">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                                <div class="expand-card-body">
                                    <div class="builder-row">
                                        <div class="field-group" style="flex: 2;">
                                            <label class="field-label">Nested $select</label>
                                            <input type="text" class="builder-input" placeholder="e.g. fullname, emailaddress1" value="${escapeHtml(exp.select)}" oninput="ClauseBuilder.updateExpandSelect(${idx}, this.value)" />
                                        </div>
                                        <div class="field-group" style="flex: 2;">
                                            <label class="field-label">Nested $filter</label>
                                            <input type="text" class="builder-input" placeholder="e.g. donotemail eq false" value="${escapeHtml(exp.filter)}" oninput="ClauseBuilder.updateExpandFilter(${idx}, this.value)" />
                                        </div>
                                        <div class="field-group" style="flex: 1;">
                                            <label class="field-label">Nested $top</label>
                                            <input type="text" class="builder-input" placeholder="e.g. 5" value="${escapeHtml(exp.top)}" oninput="ClauseBuilder.updateExpandTop(${idx}, this.value)" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Section 5: Order, Top, Skip, Count -->
                <div class="builder-section">
                    <div class="builder-section-header">
                        <span class="builder-section-title">5. Sorting &amp; Pagination</span>
                    </div>
                    <div class="builder-row">
                        <div class="field-group" style="flex: 2;">
                            <label class="field-label">Order By Column ($orderby)</label>
                            <input type="text" id="vbOrderbyField" class="builder-input" value="${escapeHtml(state.orderbyField)}" placeholder="e.g. createdon" oninput="ClauseBuilder.onInputChanged()" />
                        </div>
                        <div class="field-group" style="flex: 1;">
                            <label class="field-label">Direction</label>
                            <select id="vbOrderbyDir" class="builder-select" onchange="ClauseBuilder.onInputChanged()">
                                <option value="asc" ${state.orderbyDir === 'asc' ? 'selected' : ''}>Ascending (asc)</option>
                                <option value="desc" ${state.orderbyDir === 'desc' ? 'selected' : ''}>Descending (desc)</option>
                            </select>
                        </div>
                        <div class="field-group" style="flex: 1;">
                            <label class="field-label">Top Count ($top)</label>
                            <input type="number" id="vbTop" class="builder-input" value="${escapeHtml(state.top)}" placeholder="50" oninput="ClauseBuilder.onInputChanged()" />
                        </div>
                        <div class="field-group" style="flex: 1;">
                            <label class="field-label">Skip ($skip)</label>
                            <input type="number" id="vbSkip" class="builder-input" value="${escapeHtml(state.skip)}" placeholder="0" oninput="ClauseBuilder.onInputChanged()" />
                        </div>
                        <div class="field-group" style="flex: 1; align-self: flex-end; padding-bottom: 0.35rem;">
                            <label class="checkbox-label">
                                <input type="checkbox" id="vbCount" ${state.count ? 'checked' : ''} onchange="ClauseBuilder.onInputChanged()" />
                                <span>Include Count ($count)</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function onInputChanged() {
        if (isUpdatingFromCode) return;

        const entityInput = document.getElementById('vbEntity');
        const recordIdInput = document.getElementById('vbRecordId');
        const selectInput = document.getElementById('vbSelect');
        const rawFilterInput = document.getElementById('vbRawFilter');
        const orderbyFieldInput = document.getElementById('vbOrderbyField');
        const orderbyDirSelect = document.getElementById('vbOrderbyDir');
        const topInput = document.getElementById('vbTop');
        const skipInput = document.getElementById('vbSkip');
        const countCheckbox = document.getElementById('vbCount');

        if (entityInput) state.entity = entityInput.value;
        if (recordIdInput) state.recordId = recordIdInput.value;
        if (selectInput) state.select = selectInput.value;
        if (rawFilterInput) state.rawFilter = rawFilterInput.value;
        if (orderbyFieldInput) state.orderbyField = orderbyFieldInput.value;
        if (orderbyDirSelect) state.orderbyDir = orderbyDirSelect.value;
        if (topInput) state.top = topInput.value;
        if (skipInput) state.skip = skipInput.value;
        if (countCheckbox) state.count = countCheckbox.checked;

        syncToCodeEditor();
    }

    function setEntity(name) {
        state.entity = name;
        const input = document.getElementById('vbEntity');
        if (input) input.value = name;
        onInputChanged();
    }

    function addSelectCol(col) {
        const cur = (state.select || '').trim();
        const parts = cur ? cur.split(',').map(s => s.trim()) : [];
        if (!parts.includes(col)) {
            parts.push(col);
            state.select = parts.join(', ');
            const input = document.getElementById('vbSelect');
            if (input) input.value = state.select;
            onInputChanged();
        }
    }

    function addFilterRow() {
        state.filters.push({ field: '', op: 'eq', value: '', logic: 'and' });
        render();
        syncToCodeEditor();
    }

    function removeFilterRow(index) {
        state.filters.splice(index, 1);
        render();
        syncToCodeEditor();
    }

    function updateFilterLogic(index, logic) {
        if (state.filters[index]) {
            state.filters[index].logic = logic;
            syncToCodeEditor();
        }
    }

    function updateFilterField(index, field) {
        if (state.filters[index]) {
            state.filters[index].field = field;
            syncToCodeEditor();
        }
    }

    function updateFilterOp(index, op) {
        if (state.filters[index]) {
            state.filters[index].op = op;
            render();
            syncToCodeEditor();
        }
    }

    function updateFilterVal(index, val) {
        if (state.filters[index]) {
            state.filters[index].value = val;
            syncToCodeEditor();
        }
    }

    function toggleRawFilterMode() {
        state.isRawFilterMode = !state.isRawFilterMode;
        if (state.isRawFilterMode) {
            // Reconstruct raw filter from rows if raw filter is empty
            if (!state.rawFilter && state.filters.length > 0) {
                const parts = [];
                state.filters.forEach((f, idx) => {
                    if (idx > 0) parts.push(f.logic || 'and');
                    parts.push(`${f.field} ${f.op} ${f.value}`);
                });
                state.rawFilter = parts.join(' ');
            }
        } else {
            parseFilterToRows(state.rawFilter);
        }
        render();
        syncToCodeEditor();
    }

    function addExpandCard() {
        state.expands.push({ navProp: '', select: '', filter: '', orderby: '', top: '' });
        render();
        syncToCodeEditor();
    }

    function removeExpandCard(index) {
        state.expands.splice(index, 1);
        render();
        syncToCodeEditor();
    }

    function updateExpandNav(index, navProp) {
        if (state.expands[index]) {
            state.expands[index].navProp = navProp;
            syncToCodeEditor();
        }
    }

    function updateExpandSelect(index, select) {
        if (state.expands[index]) {
            state.expands[index].select = select;
            syncToCodeEditor();
        }
    }

    function updateExpandFilter(index, filter) {
        if (state.expands[index]) {
            state.expands[index].filter = filter;
            syncToCodeEditor();
        }
    }

    function updateExpandTop(index, top) {
        if (state.expands[index]) {
            state.expands[index].top = top;
            syncToCodeEditor();
        }
    }

    function syncToCodeEditor() {
        const queryText = buildQueryFromState();
        if (typeof window !== 'undefined' && window.App && window.App.editor) {
            window.App.isProgrammaticChange = true;
            window.App.editor.setValue(queryText);
            window.App.isProgrammaticChange = false;

            // Trigger URL and validator update
            const uriInput = document.getElementById('requestURI');
            const activeUrl = window.EnvManager ? window.EnvManager.getActiveUrl() : '';
            if (uriInput && window.ODataParser) {
                uriInput.value = window.ODataParser.buildFullUrl(activeUrl, window.App.apiVersion, queryText);
            }
            if (window.ODataValidator) {
                const res = window.ODataValidator.validate(queryText);
                const pill = document.getElementById('statusPill');
                if (pill) {
                    if (res.isValid) {
                        pill.className = 'status-pill valid';
                        pill.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Valid OData</span>`;
                    } else {
                        pill.className = 'status-pill invalid';
                        pill.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>${res.errorCount} ${res.errorCount === 1 ? 'Error' : 'Errors'}</span>`;
                    }
                }
            }
        }
    }

    function syncFromCodeEditor() {
        if (typeof window !== 'undefined' && window.App && window.App.editor) {
            const code = window.App.editor.getValue();
            isUpdatingFromCode = true;
            parseQueryToState(code);
            render();
            isUpdatingFromCode = false;
        }
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        parseQueryToState,
        buildQueryFromState,
        render,
        onInputChanged,
        setEntity,
        addSelectCol,
        addFilterRow,
        removeFilterRow,
        updateFilterLogic,
        updateFilterField,
        updateFilterOp,
        updateFilterVal,
        toggleRawFilterMode,
        addExpandCard,
        removeExpandCard,
        updateExpandNav,
        updateExpandSelect,
        updateExpandFilter,
        updateExpandTop,
        syncToCodeEditor,
        syncFromCodeEditor,
        get state() { return state; }
    };
}));
