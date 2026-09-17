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

    let splitSyncTimeout = null;
    function debounceSplitSync() {
        if (splitSyncTimeout) clearTimeout(splitSyncTimeout);
        splitSyncTimeout = setTimeout(() => {
            const workspace = document.getElementById('studioWorkspace');
            if (workspace && workspace.dataset.view === 'split' && window.ClauseBuilder) {
                window.ClauseBuilder.syncFromCodeEditor();
            }
        }, 250);
    }

    function onQueryChange() {
        const text = App.editor ? App.editor.getValue() : '';
        validateQuery(text);
        updateGeneratedUrl(text);

        const workspace = document.getElementById('studioWorkspace');
        if (workspace && workspace.dataset.view === 'split' && window.ClauseBuilder) {
            debounceSplitSync();
        }
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

            // Ctrl/Cmd + O: Open local file
            if (ctrlOrCmd && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                openLocalQueryFile();
            }

            // Ctrl/Cmd + Shift + S: Share Query Link
            if (ctrlOrCmd && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                shareQueryLink();
            }

            // Ctrl/Cmd + Enter: Test OData
            if (ctrlOrCmd && e.key === 'Enter') {
                e.preventDefault();
                testOData();
            }

            // Ctrl/Cmd + S: Save to Library
            if (ctrlOrCmd && !e.shiftKey && e.key === 's') {
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
    // Local File Loader & Sharable Link Generator
    // =========================================================================
    window.openLocalQueryFile = function () {
        const fileInput = document.getElementById('localQueryFileInput');
        if (fileInput) fileInput.click();
    };

    window.handleLocalQueryFile = function (input) {
        const file = input.files && input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            if (!content || !content.trim()) {
                showToast('Selected file is empty', 'warning');
                return;
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, '');
            const nameInput = document.getElementById('queryName');
            if (nameInput) nameInput.value = cleanName;
            document.title = `OData: ${cleanName}`;

            const trimmed = content.trim();
            let formatted = trimmed;

            if (trimmed.startsWith('http') || trimmed.startsWith('/api/data/')) {
                const parsed = ODataParser.parse(trimmed);
                if (parsed.orgUrl && EnvManager.isValidURL(parsed.orgUrl)) {
                    EnvManager.addOrg(parsed.orgUrl);
                }
                if (parsed.apiVersion) {
                    App.apiVersion = parsed.apiVersion;
                    const verSelect = document.getElementById('apiVersionSelect');
                    if (verSelect) verSelect.value = parsed.apiVersion;
                }
                formatted = ODataParser.beautify(trimmed);
            } else {
                formatted = ODataParser.beautify(trimmed);
            }

            if (App.editor) {
                App.isProgrammaticChange = true;
                App.editor.setValue(formatted);
                App.isProgrammaticChange = false;
                onQueryChange();
                if (window.ClauseBuilder) {
                    window.ClauseBuilder.syncFromCodeEditor();
                }
            }

            showToast(`Loaded query file: "${file.name}"`, 'success');
        };
        reader.onerror = function () {
            showToast('Failed to read local file', 'error');
        };
        reader.readAsText(file);
        input.value = '';
    };

    window.shareQueryLink = function () {
        const queryText = App.editor ? App.editor.getValue().trim() : '';
        if (!queryText) {
            showToast('No query to share', 'warning');
            return;
        }

        const shareUrl = new URL(window.location.origin + window.location.pathname);
        shareUrl.searchParams.set('query', queryText);

        const activeUrl = EnvManager.getActiveUrl();
        if (activeUrl) {
            shareUrl.searchParams.set('env', activeUrl);
        }

        const nameInput = document.getElementById('queryName');
        if (nameInput && nameInput.value.trim()) {
            shareUrl.searchParams.set('name', nameInput.value.trim());
        }

        const workspace = document.getElementById('studioWorkspace');
        if (workspace && workspace.dataset.view) {
            shareUrl.searchParams.set('view', workspace.dataset.view);
        }

        navigator.clipboard.writeText(shareUrl.toString()).then(() => {
            showToast('Sharable query link copied to clipboard!', 'success');
        }).catch(() => {
            prompt('Copy this sharable query link:', shareUrl.toString());
        });
    };

    // =========================================================================
    // URL Query Parameters Loader (FetchXmlTester Parity: ?load=, ?url=, ?file=, ?query=, ?env=)
    // =========================================================================
    function loadFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);

        // 1. Environment parameter (?env= or ?org=)
        const envParam = urlParams.get('env') || urlParams.get('org');
        if (envParam && EnvManager.isValidURL(envParam)) {
            EnvManager.addOrg(envParam);
        }

        // 2. Query name parameter (?name= or ?title=)
        const nameParam = urlParams.get('name') || urlParams.get('title');
        if (nameParam) {
            const cleanName = decodeURIComponent(nameParam);
            const nameInput = document.getElementById('queryName');
            if (nameInput) nameInput.value = cleanName;
            document.title = `OData: ${cleanName}`;
        }

        // 3. View layout parameter (?view=split | visual | code)
        const viewParam = urlParams.get('view');
        if (viewParam && ['split', 'visual', 'code'].includes(viewParam.toLowerCase())) {
            switchStudioView(viewParam.toLowerCase());
        }

        // 4. Remote file URL parameter (?load= or ?url= or ?file= or ?src=)
        let remoteUrl = urlParams.get('load') || urlParams.get('url') || urlParams.get('file') || urlParams.get('src');
        if (remoteUrl && remoteUrl.trim()) {
            remoteUrl = remoteUrl.trim();

            // Auto-convert GitHub blob URLs to raw user content URLs for direct CORS loading
            const ghMatch = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
            if (ghMatch) {
                remoteUrl = `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}/${ghMatch[4]}`;
            }

            showToast('Loading query file from URL...', 'info');

            fetch(remoteUrl)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    return res.text();
                })
                .then(content => {
                    if (!content || !content.trim()) {
                        showToast('Remote query file is empty', 'warning');
                        return;
                    }

                    // Extract file name from URL if query name isn't set
                    try {
                        const urlObj = new URL(remoteUrl, window.location.href);
                        const parts = urlObj.pathname.split('/');
                        const filename = parts[parts.length - 1];
                        const nameInput = document.getElementById('queryName');
                        if (filename && nameInput && !nameInput.value) {
                            const cleanName = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
                            nameInput.value = cleanName;
                            document.title = `OData: ${cleanName}`;
                        }
                    } catch (e) {}

                    // Load content into editor
                    const trimmed = content.trim();
                    let formatted = trimmed;

                    if (trimmed.startsWith('http') || trimmed.startsWith('/api/data/')) {
                        const parsed = ODataParser.parse(trimmed);
                        if (parsed.orgUrl && EnvManager.isValidURL(parsed.orgUrl)) {
                            EnvManager.addOrg(parsed.orgUrl);
                        }
                        if (parsed.apiVersion) {
                            App.apiVersion = parsed.apiVersion;
                            const verSelect = document.getElementById('apiVersionSelect');
                            if (verSelect) verSelect.value = parsed.apiVersion;
                        }
                        formatted = ODataParser.beautify(trimmed);
                    } else {
                        formatted = ODataParser.beautify(trimmed);
                    }

                    if (App.editor) {
                        App.isProgrammaticChange = true;
                        App.editor.setValue(formatted);
                        App.isProgrammaticChange = false;
                        onQueryChange();
                        if (window.ClauseBuilder) {
                            window.ClauseBuilder.syncFromCodeEditor();
                        }
                    }

                    showToast('Query loaded successfully from URL', 'success');
                })
                .catch(err => {
                    console.error('Failed to load file from URL:', err);
                    showToast(`Failed to load URL (check CORS / link): ${err.message}`, 'error');
                });
            return;
        }

        // 5. Raw inline query parameter (?query= or ?q= or ?odata=)
        const inlineQuery = urlParams.get('query') || urlParams.get('q') || urlParams.get('odata');
        if (inlineQuery && inlineQuery.trim()) {
            const raw = inlineQuery.trim();
            let formatted = raw;

            if (raw.startsWith('http') || raw.startsWith('/api/data/')) {
                const parsed = ODataParser.parse(raw);
                if (parsed.orgUrl && EnvManager.isValidURL(parsed.orgUrl)) {
                    EnvManager.addOrg(parsed.orgUrl);
                }
                if (parsed.apiVersion) {
                    App.apiVersion = parsed.apiVersion;
                    const verSelect = document.getElementById('apiVersionSelect');
                    if (verSelect) verSelect.value = parsed.apiVersion;
                }
                formatted = ODataParser.beautify(raw);
            } else {
                formatted = ODataParser.beautify(raw);
            }

            if (App.editor) {
                App.isProgrammaticChange = true;
                App.editor.setValue(formatted);
                App.isProgrammaticChange = false;
                onQueryChange();
                if (window.ClauseBuilder) {
                    window.ClauseBuilder.syncFromCodeEditor();
                }
            }

            showToast('Query loaded from URL parameter', 'success');
        }
    }

    // =========================================================================
    // Studio View Mode Switcher (Code Editor vs Visual Clause Builder vs Split)
    // =========================================================================
    window.switchStudioView = function (view) {
        const workspace = document.getElementById('studioWorkspace');
        const editorPane = document.getElementById('editorPane');
        const btnCode = document.getElementById('btnViewCode');
        const btnVisual = document.getElementById('btnViewVisual');
        const btnSplit = document.getElementById('btnViewSplit');

        if (!workspace) return;

        workspace.dataset.view = view;

        if (btnCode) btnCode.classList.toggle('active', view === 'code');
        if (btnVisual) btnVisual.classList.toggle('active', view === 'visual');
        if (btnSplit) btnSplit.classList.toggle('active', view === 'split');

        if (view === 'visual') {
            if (window.ClauseBuilder) {
                window.ClauseBuilder.syncFromCodeEditor();
            }
            showToast('Switched to Visual Clause Builder', 'info');
        } else if (view === 'split') {
            // Restore saved ratio or default 50%
            const savedRatio = localStorage.getItem('webapi_split_ratio') || '50';
            if (editorPane && window.innerWidth > 800) {
                editorPane.style.width = savedRatio + '%';
            }
            if (window.ClauseBuilder) {
                window.ClauseBuilder.syncFromCodeEditor();
            }
            if (window.App && window.App.editor) {
                setTimeout(() => window.App.editor.refresh(), 50);
            }
            showToast('Split Screen: Code & Visual Builder side-by-side', 'info');
        } else {
            // 'code'
            if (window.ClauseBuilder) {
                window.ClauseBuilder.syncToCodeEditor();
            }
            if (editorPane) {
                editorPane.style.width = '';
            }
            if (window.App && window.App.editor) {
                setTimeout(() => window.App.editor.refresh(), 50);
            }
            showToast('Switched to Code Editor', 'info');
        }
    };

    // =========================================================================
    // Resizable Split Screen Drag Controller
    // =========================================================================
    function initSplitterDrag() {
        const splitter = document.getElementById('workspaceSplitter');
        const workspace = document.getElementById('studioWorkspace');
        const editorPane = document.getElementById('editorPane');
        if (!splitter || !workspace || !editorPane) return;

        // Restore saved ratio if present
        const savedRatio = localStorage.getItem('webapi_split_ratio');
        if (savedRatio && window.innerWidth > 800) {
            const num = parseFloat(savedRatio);
            if (!isNaN(num) && num >= 20 && num <= 80) {
                editorPane.style.width = num + '%';
            }
        }

        let isDragging = false;

        function onPointerDown(e) {
            if (workspace.dataset.view !== 'split') return;
            isDragging = true;
            splitter.classList.add('dragging');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = window.innerWidth <= 800 ? 'row-resize' : 'col-resize';
            try {
                splitter.setPointerCapture(e.pointerId);
            } catch (err) {}
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            const rect = workspace.getBoundingClientRect();
            if (window.innerWidth <= 800) {
                const offsetY = e.clientY - rect.top;
                const pct = (offsetY / rect.height) * 100;
                const clamped = Math.max(20, Math.min(80, pct));
                editorPane.style.height = clamped + '%';
                editorPane.style.width = '100%';
            } else {
                const offsetX = e.clientX - rect.left;
                const pct = (offsetX / rect.width) * 100;
                const clamped = Math.max(20, Math.min(80, pct));
                editorPane.style.width = clamped + '%';
                editorPane.style.height = '100%';
                localStorage.setItem('webapi_split_ratio', clamped.toFixed(2));
            }

            if (window.App && window.App.editor) {
                window.App.editor.refresh();
            }
        }

        function onPointerUp(e) {
            if (!isDragging) return;
            isDragging = false;
            splitter.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            try {
                splitter.releasePointerCapture(e.pointerId);
            } catch (err) {}

            if (window.App && window.App.editor) {
                window.App.editor.refresh();
            }
        }

        splitter.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }

    // =========================================================================
    // Documentation, OData Reference & FAQ Modal Controller
    // =========================================================================
    window.openDocsModal = function () {
        const modal = document.getElementById('docsModal');
        if (modal) modal.classList.add('active');
    };

    window.closeDocsModal = function () {
        const modal = document.getElementById('docsModal');
        if (modal) modal.classList.remove('active');
    };

    window.switchDocsTab = function (tabKey) {
        const tabs = ['syntax', 'crmfuncs', 'comparison', 'faq'];
        tabs.forEach(t => {
            const btn = document.getElementById(`docTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
            const sec = document.getElementById(`docsTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (btn) btn.classList.toggle('active', t === tabKey);
            if (sec) sec.classList.toggle('active', t === tabKey);
        });
    };

    window.toggleFaqAccordion = function (btn) {
        const answer = btn.nextElementSibling;
        if (!answer) return;
        const isOpen = answer.style.display === 'block';
        answer.style.display = isOpen ? 'none' : 'block';
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            svg.style.transition = 'transform 0.2s ease';
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
        initSplitterDrag();
        loadFromUrlParams();

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
