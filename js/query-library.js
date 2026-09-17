/**
 * Query Library & Dataverse Templates Manager
 * Handles local storage query library, template snippets, and JSON import/export.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.QueryLibrary = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STORAGE_KEY = 'webapi_saved_queries';

    const BUILTIN_TEMPLATES = [
        {
            id: 'tpl_active_accounts',
            name: 'Active Accounts with Primary Contact',
            category: 'Accounts',
            description: 'Queries active accounts with contact details expanded, ordered by account name.',
            query: `accounts\n  ?$select=name, accountnumber, telephone1, address1_city\n  &$filter=statecode eq 0\n  &$expand=primarycontactid(\n      $select=fullname, emailaddress1, mobilephone;\n      $filter=donotemail eq false\n  )\n  &$orderby=name asc\n  &$top=50`
        },
        {
            id: 'tpl_high_value_opps',
            name: 'Recent High Value Opportunities',
            category: 'Sales',
            description: 'Finds open opportunities with estimated value greater than 50,000.',
            query: `opportunities\n  ?$select=name, estimatedvalue, estimatedclosedate, prioritycode\n  &$filter=statecode eq 0 and estimatedvalue gt 50000\n  &$expand=customerid_account($select=name, telephone1)\n  &$orderby=estimatedvalue desc\n  &$top=25`
        },
        {
            id: 'tpl_date_crm_function',
            name: 'Cases Created in Last 30 Days',
            category: 'Service',
            description: 'Demonstrates Dataverse CRM date function Microsoft.Dynamics.CRM.LastXDays.',
            query: `incidents\n  ?$select=title, ticketnumber, createdon, prioritycode, statecode\n  &$filter=Microsoft.Dynamics.CRM.LastXDays(PropertyName='createdon', PropertyValue=30) and statecode eq 0\n  &$expand=customerid_contact($select=fullname, emailaddress1)\n  &$orderby=createdon desc\n  &$top=50`
        },
        {
            id: 'tpl_crm_in_operator',
            name: 'Contacts in Specific Countries (CRM.In)',
            category: 'Query Functions',
            description: 'Filters contacts matching any values in a list using the Dataverse CRM.In operator with parameter alias.',
            query: `contacts\n  ?$select=fullname, jobtitle, emailaddress1, address1_country\n  &$filter=Microsoft.Dynamics.CRM.In(PropertyName='address1_country', PropertyValue=@p1)&@p1=['USA','Canada','United Kingdom']\n  &$orderby=fullname asc\n  &$top=50`
        },
        {
            id: 'tpl_aggregations_groupby',
            name: 'Account Aggregations by Status ($apply)',
            category: 'Analytics',
            description: 'Uses OData $apply groupby to count account distribution across statuses.',
            query: `accounts\n  ?$apply=groupby((statuscode), aggregate($count as total_accounts))`
        },
        {
            id: 'tpl_unbound_whoami',
            name: 'WhoAmI Function',
            category: 'System & Admin',
            description: 'Executes the Dataverse WhoAmI() unbound function to retrieve current user and business unit ID.',
            query: `WhoAmI()`
        },
        {
            id: 'tpl_metadata_attributes',
            name: 'Entity Attributes Metadata',
            category: 'Metadata',
            description: 'Queries Dataverse metadata for attributes on the account entity.',
            query: `EntityDefinitions(LogicalName='account')/Attributes\n  ?$select=LogicalName, DisplayName, AttributeType\n  &$filter=IsValidForRead eq true\n  &$top=100`
        }
    ];

    let savedQueries = [];
    let onQuerySelected = null;

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                savedQueries = JSON.parse(raw);
            } else {
                savedQueries = [];
            }
        } catch (e) {
            console.error('Failed to load saved queries:', e);
            savedQueries = [];
        }
        updateBadge();
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedQueries));
        } catch (e) {
            console.error('Failed to save queries:', e);
        }
        updateBadge();
    }

    function updateBadge() {
        const badge = document.getElementById('savedQueriesBadge');
        if (badge) {
            badge.textContent = savedQueries.length.toString();
        }
    }

    function addQuery(name, query, description = '') {
        const id = 'sq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const item = {
            id,
            name: (name || 'Untitled Query').trim(),
            query: query.trim(),
            description: description.trim(),
            createdAt: new Date().toISOString()
        };

        savedQueries.unshift(item);
        saveToStorage();
        renderSavedQueriesList();
        return item;
    }

    function deleteQuery(id) {
        savedQueries = savedQueries.filter(q => q.id !== id);
        saveToStorage();
        renderSavedQueriesList();
    }

    function exportJson() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedQueries, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `dataverse_webapi_queries_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    }

    function importJson(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (Array.isArray(parsed)) {
                        let imported = 0;
                        parsed.forEach(item => {
                            if (item.query && item.name) {
                                savedQueries.push({
                                    id: 'sq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                                    name: item.name,
                                    query: item.query,
                                    description: item.description || '',
                                    createdAt: item.createdAt || new Date().toISOString()
                                });
                                imported++;
                            }
                        });
                        saveToStorage();
                        renderSavedQueriesList();
                        resolve(imported);
                    } else {
                        reject(new Error('Invalid file format. Expected JSON array of queries.'));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsText(file);
        });
    }

    function renderSavedQueriesList(filterTerm = '') {
        const listContainer = document.getElementById('savedQueriesList');
        const countLabel = document.getElementById('savedQueriesCountLabel');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const term = filterTerm.toLowerCase().trim();

        const filtered = savedQueries.filter(q => {
            if (!term) return true;
            return q.name.toLowerCase().includes(term) || (q.description && q.description.toLowerCase().includes(term)) || q.query.toLowerCase().includes(term);
        });

        if (countLabel) {
            countLabel.textContent = `${filtered.length} of ${savedQueries.length} queries`;
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state-text" style="padding: 2.5rem 1rem; text-align: center;">
                    ${savedQueries.length === 0 ? 'No saved queries in your library yet. Click "Save to Library" on any query to store it here.' : 'No queries matching your search.'}
                </div>
            `;
            return;
        }

        filtered.forEach(q => {
            const item = document.createElement('div');
            item.className = 'saved-query-card';

            const firstLine = q.query.split('\n')[0] || '';
            const preview = q.query.length > 120 ? q.query.substring(0, 120) + '...' : q.query;

            item.innerHTML = `
                <div class="saved-query-header" onclick="QueryLibrary.selectQuery('${q.id}')">
                    <span class="saved-query-title">${escapeHtml(q.name)}</span>
                    <span class="saved-query-date">${new Date(q.createdAt).toLocaleDateString()}</span>
                </div>
                ${q.description ? `<p class="saved-query-desc">${escapeHtml(q.description)}</p>` : ''}
                <div class="saved-query-snippet" onclick="QueryLibrary.selectQuery('${q.id}')">${escapeHtml(preview)}</div>
                <div class="saved-query-actions">
                    <button class="btn-sm-secondary" onclick="QueryLibrary.selectQuery('${q.id}')">Load Query</button>
                    <button class="btn-icon-danger" title="Delete query" onclick="QueryLibrary.deleteQuery('${q.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    function renderTemplatesList() {
        const container = document.getElementById('templatesList');
        if (!container) return;

        container.innerHTML = '';

        BUILTIN_TEMPLATES.forEach(tpl => {
            const card = document.createElement('div');
            card.className = 'template-card';

            card.innerHTML = `
                <div class="template-header">
                    <span class="template-title">${escapeHtml(tpl.name)}</span>
                    <span class="template-category-badge">${escapeHtml(tpl.category)}</span>
                </div>
                <p class="template-desc">${escapeHtml(tpl.description)}</p>
                <pre class="template-snippet">${escapeHtml(tpl.query)}</pre>
                <div class="template-actions">
                    <button class="btn-primary" onclick="QueryLibrary.loadTemplate('${tpl.id}')">Use Template</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function selectQuery(id) {
        const item = savedQueries.find(q => q.id === id);
        if (item && typeof onQuerySelected === 'function') {
            onQuerySelected(item.query, item.name);
            closeModal();
            if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                window.showToast(`Loaded "${item.name}"`, 'success');
            }
        }
    }

    function loadTemplate(templateId) {
        const tpl = BUILTIN_TEMPLATES.find(t => t.id === templateId);
        if (tpl && typeof onQuerySelected === 'function') {
            onQuerySelected(tpl.query, tpl.name);
            closeTemplatesModal();
            if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                window.showToast(`Loaded template "${tpl.name}"`, 'success');
            }
        }
    }

    function openModal() {
        const modal = document.getElementById('savedQueriesModal');
        if (modal) {
            modal.classList.add('active');
            renderSavedQueriesList();
        }
    }

    function closeModal() {
        const modal = document.getElementById('savedQueriesModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function openTemplatesModal() {
        const modal = document.getElementById('templatesModal');
        if (modal) {
            modal.classList.add('active');
            renderTemplatesList();
        }
    }

    function closeTemplatesModal() {
        const modal = document.getElementById('templatesModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function init(onQuerySelectedCallback) {
        onQuerySelected = onQuerySelectedCallback;
        loadFromStorage();

        const searchInput = document.getElementById('txtSearchSavedQueries');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderSavedQueriesList(e.target.value);
            });
        }
    }

    return {
        init,
        addQuery,
        deleteQuery,
        selectQuery,
        exportJson,
        importJson,
        openModal,
        closeModal,
        openTemplatesModal,
        closeTemplatesModal,
        loadTemplate,
        get templates() { return BUILTIN_TEMPLATES; },
        get savedQueries() { return savedQueries; }
    };
}));
