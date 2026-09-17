/**
 * WebAPI Tester Studio - Main Application Controller
 * Connects CodeMirror editor, OData parser, validator, environment manager,
 * query library, code generator, and execution handlers.
 */

(function () {
    'use strict';

    // Global application state
    window.App = {
        theme: 'light',
        apiVersion: 'v9.2',
        editor: null,
        selectedPreferHeaders: [
            'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
        ],
        isProgrammaticChange: false
    };

    // =========================================================================
    // Toast Notification System
    // =========================================================================
    window.showToast = function (message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        } else {
            iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9b4dca" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `${iconSvg} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px) scale(0.95)';
            toast.style.transition = 'all 0.2s ease-out';
            setTimeout(() => {
                if (toast.parentElement) toast.parentElement.removeChild(toast);
            }, 200);
        }, 3200);
    };

    // =========================================================================
    // Theme Management (Default Light, Toggle to Dark)
    // =========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem('webapi_theme') || localStorage.getItem('fx_theme') || 'light';
        applyTheme(savedTheme);
    }

    window.applyTheme = function (theme) {
        App.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('webapi_theme', theme);

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            if (theme === 'dark') {
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
                btn.title = 'Switch to Light Theme';
            } else {
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
                btn.title = 'Switch to Dark Theme';
            }
        }
    };

    window.toggleTheme = function () {
        const next = App.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        showToast(`Switched to ${next} theme`, 'info');
    };

    // =========================================================================
    // Editor Setup & Validation
    // =========================================================================
    function initEditor() {
        const textarea = document.getElementById('odataEditor');
        if (!textarea) return;

        App.editor = CodeMirror.fromTextArea(textarea, {
            mode: "odata",
            lineNumbers: true,
            matchBrackets: true,
            styleActiveLine: true,
            lineWrapping: false,
            tabSize: 2,
            indentWithTabs: false,
            viewportMargin: Infinity
        });

        App.editor.on('change', () => {
            if (!App.isProgrammaticChange) {
                onQueryChange();
            }
        });

        // Initialize with default query if empty
        if (!App.editor.getValue().trim()) {
            const defaultQuery = `accounts\n  ?$select=name, accountnumber, telephone1, address1_city\n  &$filter=statecode eq 0\n  &$expand=primarycontactid(\n      $select=fullname, emailaddress1, mobilephone;\n      $filter=donotemail eq false\n  )\n  &$orderby=name asc\n  &$top=50`;
            App.editor.setValue(defaultQuery);
        }

        onQueryChange();
    }

    function onQueryChange() {
        const text = App.editor ? App.editor.getValue() : '';
        validateQuery(text);
        updateGeneratedUrl(text);
    }

    function validateQuery(text) {
        const res = ODataValidator.validate(text);
        const pill = document.getElementById('statusPill');
        const errorBanner = document.getElementById('validationToastBar');
        const errorTextSpan = document.getElementById('validationErrorText');

        if (!pill) return;

        if (res.isValid && res.warningCount === 0) {
            pill.className = 'status-pill valid';
            pill.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Valid OData</span>
            `;
            pill.title = 'Query syntax is valid';
            if (errorBanner) errorBanner.classList.remove('active');
        } else if (!res.isValid) {
            pill.className = 'status-pill invalid';
            pill.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>${res.errorCount} ${res.errorCount === 1 ? 'Error' : 'Errors'}</span>
            `;
            pill.title = res.issues.map(i => i.message).join('\n');

            if (errorBanner && errorTextSpan) {
                const firstErr = res.issues.find(i => i.type === 'error');
                errorTextSpan.textContent = firstErr ? (firstErr.line ? `Line ${firstErr.line}: ${firstErr.message}` : firstErr.message) : 'Invalid OData syntax';
                errorBanner.classList.add('active');
            }
        } else {
            // Warnings only
            pill.className = 'status-pill warning';
            pill.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>${res.warningCount} ${res.warningCount === 1 ? 'Warning' : 'Warnings'}</span>
            `;
            pill.title = res.issues.map(i => i.message).join('\n');
            if (errorBanner) errorBanner.classList.remove('active');
        }
    }

    function updateGeneratedUrl(text) {
        const input = document.getElementById('requestURI');
        if (!input) return;

        const activeUrl = EnvManager.getActiveUrl();
        const fullUrl = ODataParser.buildFullUrl(activeUrl, App.apiVersion, text);
        input.value = fullUrl;
    }

    // =========================================================================
    // Two-Way URL Input Synchronization
    // =========================================================================
    function initUrlSync() {
        const uriInput = document.getElementById('requestURI');
        if (!uriInput) return;

        uriInput.addEventListener('change', () => {
            const raw = uriInput.value.trim();
            if (!raw) return;

            const parsed = ODataParser.parse(raw);

            // If an org URL was pasted, connect/switch environment
            if (parsed.orgUrl && EnvManager.isValidURL(parsed.orgUrl)) {
                EnvManager.addOrg(parsed.orgUrl);
            }

            if (parsed.apiVersion) {
                App.apiVersion = parsed.apiVersion;
                const verSelect = document.getElementById('apiVersionSelect');
                if (verSelect) verSelect.value = parsed.apiVersion;
            }

            // Beautify and load into editor
            const formatted = ODataParser.beautify(raw);
            if (App.editor) {
                App.isProgrammaticChange = true;
                App.editor.setValue(formatted);
                App.isProgrammaticChange = false;
                onQueryChange();
                showToast('URL parsed & formatted into editor', 'info');
            }
        });
    }

    // =========================================================================
    // Execution Handlers (100% Client-Side Browser SSO)
    // =========================================================================
    window.testOData = function () {
        const activeUrl = EnvManager.getActiveUrl();
        if (!activeUrl) {
            showToast('Please connect an environment first', 'error');
            EnvManager.openModal();
            return;
        }

        const text = App.editor ? App.editor.getValue() : '';
        if (!text.trim()) {
            showToast('Please enter an OData query to test', 'error');
            return;
        }

        const encodedUrl = ODataParser.buildEncodedUrl(activeUrl, App.apiVersion, text);
        window.open(encodedUrl, '_blank');
        showToast('Executing query in authenticated Dataverse session...', 'success');
    };

    window.copyRequestUri = function () {
        const uriInput = document.getElementById('requestURI');
        if (!uriInput || !uriInput.value) return;

        navigator.clipboard.writeText(uriInput.value).then(() => {
            const label = document.getElementById('copyUriLabel');
            if (label) {
                const old = label.textContent;
                label.textContent = 'Copied!';
                setTimeout(() => label.textContent = old, 1800);
            }
            showToast('Web API Request URI copied to clipboard', 'success');
        }).catch(() => {
            showToast('Failed to copy to clipboard', 'error');
        });
    };

    // =========================================================================
    // Toolbar Actions
    // =========================================================================
    window.beautifyQuery = function () {
        if (!App.editor) return;
        const cur = App.editor.getValue();
        const beautified = ODataParser.beautify(cur);
        App.editor.setValue(beautified);
        showToast('Query beautified', 'info');
    };

    window.minifyQuery = function () {
        if (!App.editor) return;
        const cur = App.editor.getValue();
        const minified = ODataParser.minify(cur);
        App.editor.setValue(minified);
        showToast('Query minified to single line', 'info');
    };

    window.saveQueryToLibrary = function () {
        if (!App.editor) return;
        const text = App.editor.getValue().trim();
        if (!text) {
            showToast('Cannot save an empty query', 'error');
            return;
        }

        const nameInput = document.getElementById('queryName');
        const name = (nameInput ? nameInput.value.trim() : '') || 'Untitled OData Query';

        QueryLibrary.addQuery(name, text);
        showToast(`Saved "${name}" to library`, 'success');
    };

    window.openCodeGenerator = function () {
        const activeUrl = EnvManager.getActiveUrl();
        const text = App.editor ? App.editor.getValue() : '';
        CodeGenerator.openModal(activeUrl, App.apiVersion, text, App.selectedPreferHeaders);
    };

    window.copyCodeSnippet = function () {
        const pre = document.getElementById('codeSnippetArea');
        if (!pre || !pre.textContent) return;

        navigator.clipboard.writeText(pre.textContent).then(() => {
            showToast('Code snippet copied to clipboard', 'success');
        });
    };

    // =========================================================================
    // Dataverse Request Headers Manager
    // =========================================================================
    window.openHeadersModal = function () {
        const modal = document.getElementById('headersModal');
        if (modal) modal.classList.add('active');
    };

    window.closeHeadersModal = function () {
        const modal = document.getElementById('headersModal');
        if (modal) modal.classList.remove('active');
    };

    window.updateSelectedHeaders = function () {
        const checkboxes = document.querySelectorAll('.header-checkbox');
        const selected = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selected.push(cb.value);
            }
        });
        App.selectedPreferHeaders = selected;

        const badge = document.getElementById('headersCountBadge');
        if (badge) {
            badge.textContent = selected.length.toString();
        }
        showToast(`Updated request headers (${selected.length} active)`, 'info');
        closeHeadersModal();
    };

    // =========================================================================
    // Keyboard Shortcuts
    // =========================================================================
    function initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            // Ctrl/Cmd + Enter: Test OData
            if (ctrlOrCmd && e.key === 'Enter') {
                e.preventDefault();
                testOData();
            }

            // Ctrl/Cmd + S: Save to Library
            if (ctrlOrCmd && e.key === 's') {
                e.preventDefault();
                saveQueryToLibrary();
            }

            // Ctrl/Cmd + Shift + F: Beautify
            if (ctrlOrCmd && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                beautifyQuery();
            }

            // Escape: Close any active modal
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
                const errorBanner = document.getElementById('validationToastBar');
                if (errorBanner) errorBanner.classList.remove('active');
            }
        });
    }

    // =========================================================================
    // Studio View Mode Switcher (Code Editor vs Visual Clause Builder)
    // =========================================================================
    window.switchStudioView = function (view) {
        const editorContainer = document.getElementById('editorContainer');
        const vbContainer = document.getElementById('visualBuilderContainer');
        const btnCode = document.getElementById('btnViewCode');
        const btnVisual = document.getElementById('btnViewVisual');

        if (view === 'visual') {
            if (window.ClauseBuilder) {
                window.ClauseBuilder.syncFromCodeEditor();
            }
            if (editorContainer) editorContainer.classList.add('hidden');
            if (vbContainer) vbContainer.classList.add('active');
            if (btnCode) btnCode.classList.remove('active');
            if (btnVisual) btnVisual.classList.add('active');
            showToast('Switched to Visual Clause Builder', 'info');
        } else {
            if (window.ClauseBuilder) {
                window.ClauseBuilder.syncToCodeEditor();
            }
            if (vbContainer) vbContainer.classList.remove('active');
            if (editorContainer) editorContainer.classList.remove('hidden');
            if (btnVisual) btnVisual.classList.remove('active');
            if (btnCode) btnCode.classList.add('active');
            if (window.App && window.App.editor) {
                window.App.editor.refresh();
            }
            showToast('Switched to Code Editor', 'info');
        }
    };

    // =========================================================================
    // Initialization
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initEditor();
        initUrlSync();
        initKeyboardShortcuts();

        // Initialize Clause Builder
        if (window.ClauseBuilder) {
            window.ClauseBuilder.syncFromCodeEditor();
        }

        // Initialize Environment Manager
        EnvManager.init((activeName, activeUrl) => {
            onQueryChange();
        });

        // Initialize Query Library
        QueryLibrary.init((queryText, queryName) => {
            if (App.editor) {
                App.editor.setValue(queryText);
                const nameInput = document.getElementById('queryName');
                if (nameInput && queryName) {
                    nameInput.value = queryName;
                }
                if (window.ClauseBuilder) {
                    window.ClauseBuilder.syncFromCodeEditor();
                }
                onQueryChange();
            }
        });

        // API Version selector
        const verSelect = document.getElementById('apiVersionSelect');
        if (verSelect) {
            verSelect.addEventListener('change', (e) => {
                App.apiVersion = e.target.value;
                onQueryChange();
            });
        }
    });

})();
