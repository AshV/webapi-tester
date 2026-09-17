/**
 * Environment Context Manager
 * 100% interoperable with QDV (Quick Dataverse View) and FetchXmlTester.
 * Manages Dataverse tenant URLs in localStorage ('lsOrgURLs', 'qdv_active_env').
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.EnvManager = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STORAGE_KEY_ORGS = 'lsOrgURLs';
    const STORAGE_KEY_ACTIVE_QDV = 'qdv_active_env';
    const STORAGE_KEY_ACTIVE_LOCAL = 'webapi_active_env';

    const state = {
        orgURLs: {},
        activeOrg: null,
        onActiveChanged: null
    };

    /**
     * Sanitizes raw user input into a clean origin (e.g. https://org.crm.dynamics.com)
     */
    function cleanUrl(raw) {
        if (!raw || typeof raw !== 'string') return '';
        let val = raw.trim().replace(/^["'<(\[]+|[>"')\]]+$/g, '').trim();
        if (!val) return '';

        const hasProtocol = /^https?:\/\//i.test(val);
        const hasDomainPattern = /[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/i.test(val) || /^localhost(:\d+)?/i.test(val);

        if (!hasProtocol && !hasDomainPattern) {
            return val;
        }

        if (!hasProtocol) {
            val = 'https://' + val;
        }

        try {
            const url = new URL(val);
            if (url.hostname && (url.hostname.includes('.') || url.hostname === 'localhost')) {
                return url.origin;
            }
        } catch (e) {
            const match = val.match(/^(https?:\/\/[^\/?#]+)/i);
            if (match) return match[1];
        }

        return val.replace(/[?#].*$/, '').replace(/\/+$/, '');
    }

    function isValidURL(str) {
        if (!str || typeof str !== 'string') return false;
        const cleaned = cleanUrl(str);
        try {
            const url = new URL(cleaned);
            return url.hostname.length > 3 && (url.hostname.includes('.') || url.hostname === 'localhost');
        } catch (e) {
            return false;
        }
    }

    function deriveNameFromUrl(cleanedUrl) {
        try {
            const url = new URL(cleanedUrl);
            const host = url.hostname;
            const parts = host.split('.');
            return parts[0] || 'org';
        } catch (e) {
            return 'org';
        }
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ORGS);
            if (raw) {
                state.orgURLs = JSON.parse(raw);
            } else {
                state.orgURLs = {};
            }

            // Fallback to legacy orgURL
            const legacy = localStorage.getItem('orgURL');
            if (legacy && Object.keys(state.orgURLs).length === 0) {
                const cleaned = cleanUrl(legacy);
                if (cleaned) {
                    const name = deriveNameFromUrl(cleaned);
                    state.orgURLs[name] = cleaned;
                    saveToStorage();
                }
            }

            const active = localStorage.getItem(STORAGE_KEY_ACTIVE_QDV) || localStorage.getItem(STORAGE_KEY_ACTIVE_LOCAL);
            if (active && state.orgURLs[active]) {
                state.activeOrg = active;
            } else {
                const keys = Object.keys(state.orgURLs);
                state.activeOrg = keys.length > 0 ? keys[0] : null;
            }
        } catch (e) {
            console.error('Error loading environments:', e);
            state.orgURLs = {};
            state.activeOrg = null;
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(state.orgURLs));
            if (state.activeOrg) {
                localStorage.setItem(STORAGE_KEY_ACTIVE_QDV, state.activeOrg);
                localStorage.setItem(STORAGE_KEY_ACTIVE_LOCAL, state.activeOrg);
                const activeUrl = state.orgURLs[state.activeOrg];
                if (activeUrl) {
                    localStorage.setItem('orgURL', activeUrl);
                }
            } else {
                localStorage.removeItem(STORAGE_KEY_ACTIVE_QDV);
                localStorage.removeItem(STORAGE_KEY_ACTIVE_LOCAL);
                localStorage.removeItem('orgURL');
            }
        } catch (e) {
            console.error('Error saving environments:', e);
        }
    }

    function getActiveUrl() {
        if (!state.activeOrg || !state.orgURLs[state.activeOrg]) return '';
        return state.orgURLs[state.activeOrg];
    }

    function setActiveOrg(name) {
        if (!name || !state.orgURLs[name]) return;
        state.activeOrg = name;
        saveToStorage();
        renderPills();
        updateIndicator();
        renderModalList();

        if (typeof state.onActiveChanged === 'function') {
            state.onActiveChanged(name, state.orgURLs[name]);
        }
    }

    function addOrg(urlOrRaw, customName) {
        const cleaned = cleanUrl(urlOrRaw);
        if (!isValidURL(cleaned)) {
            return { success: false, message: 'Please enter a valid Dataverse URL (e.g. https://contoso.crm.dynamics.com)' };
        }

        let name = (customName || '').trim();
        if (!name) {
            name = deriveNameFromUrl(cleaned);
        }

        // Avoid accidental overwrites of different URLs with same name
        let uniqueName = name;
        let counter = 1;
        while (state.orgURLs[uniqueName] && state.orgURLs[uniqueName] !== cleaned) {
            uniqueName = `${name}-${counter++}`;
        }

        state.orgURLs[uniqueName] = cleaned;
        state.activeOrg = uniqueName;
        saveToStorage();
        renderPills();
        updateIndicator();
        renderModalList();

        if (typeof state.onActiveChanged === 'function') {
            state.onActiveChanged(uniqueName, cleaned);
        }

        return { success: true, name: uniqueName, url: cleaned };
    }

    function removeOrg(name) {
        if (!name || !state.orgURLs[name]) return;
        delete state.orgURLs[name];

        if (state.activeOrg === name) {
            const keys = Object.keys(state.orgURLs);
            state.activeOrg = keys.length > 0 ? keys[0] : null;
        }

        saveToStorage();
        renderPills();
        updateIndicator();
        renderModalList();

        if (typeof state.onActiveChanged === 'function') {
            state.onActiveChanged(state.activeOrg, state.activeOrg ? state.orgURLs[state.activeOrg] : '');
        }
    }

    function renderPills() {
        const container = document.getElementById('envPillsRow');
        if (!container) return;

        container.innerHTML = '';
        const keys = Object.keys(state.orgURLs);

        keys.forEach(key => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = `env-pill ${key === state.activeOrg ? 'active' : ''}`;
            pill.title = `${key} (${state.orgURLs[key]})`;
            pill.textContent = key;
            pill.onclick = () => setActiveOrg(key);
            container.appendChild(pill);
        });
    }

    function updateIndicator() {
        const dot = document.getElementById('envStatusDot');
        const label = document.getElementById('envActiveLabel');
        const hiddenOrg = document.getElementById('orgURL');

        if (state.activeOrg && state.orgURLs[state.activeOrg]) {
            if (dot) {
                dot.className = 'status-dot online';
            }
            if (label) {
                label.textContent = state.activeOrg;
                label.title = state.orgURLs[state.activeOrg];
            }
            if (hiddenOrg) {
                hiddenOrg.value = state.orgURLs[state.activeOrg];
            }
        } else {
            if (dot) {
                dot.className = 'status-dot offline';
            }
            if (label) {
                label.textContent = 'No environment selected';
                label.title = 'Click to select or add a Dataverse environment';
            }
            if (hiddenOrg) {
                hiddenOrg.value = '';
            }
        }
    }

    function renderModalList() {
        const list = document.getElementById('modalEnvList');
        const countSpan = document.getElementById('modalEnvCount');
        if (!list) return;

        list.innerHTML = '';
        const keys = Object.keys(state.orgURLs);

        if (countSpan) {
            countSpan.textContent = `${keys.length} saved`;
        }

        if (keys.length === 0) {
            list.innerHTML = `<div class="empty-state-text">No environments added yet. Paste your Dataverse organization URL above.</div>`;
            return;
        }

        keys.forEach(key => {
            const url = state.orgURLs[key];
            const item = document.createElement('div');
            item.className = `env-item-row ${key === state.activeOrg ? 'selected' : ''}`;

            item.innerHTML = `
                <div class="env-item-info" onclick="EnvManager.setActiveOrg('${key}'); EnvManager.closeModal();">
                    <span class="env-item-name">${key}</span>
                    <span class="env-item-url">${url}</span>
                </div>
                <div class="env-item-actions">
                    ${key === state.activeOrg ? '<span class="badge-active">Active</span>' : `<button class="btn-sm-secondary" onclick="EnvManager.setActiveOrg('${key}')">Select</button>`}
                    <button class="btn-icon-danger" title="Remove environment" onclick="EnvManager.removeOrg('${key}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            list.appendChild(item);
        });
    }

    function bindPasteCleaner(input) {
        if (!input) return;

        input.addEventListener('paste', (e) => {
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData ? clipboardData.getData('text') : '';
            if (pastedText) {
                const cleaned = cleanUrl(pastedText);
                if (cleaned) {
                    e.preventDefault();
                    input.value = cleaned;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    }

    function openModal() {
        const modal = document.getElementById('envModal');
        if (modal) {
            modal.classList.add('active');
            renderModalList();
            const input = document.getElementById('txtModalEnv');
            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 80);
            }
        }
    }

    function closeModal() {
        const modal = document.getElementById('envModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function init(onActiveChangedCallback) {
        state.onActiveChanged = onActiveChangedCallback;
        loadFromStorage();
        renderPills();
        updateIndicator();
        renderModalList();

        const modalInput = document.getElementById('txtModalEnv');
        if (modalInput) {
            bindPasteCleaner(modalInput);
            modalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFromModal();
                }
            });
        }
    }

    function handleAddFromModal() {
        const input = document.getElementById('txtModalEnv');
        if (!input) return;

        const val = input.value.trim();
        if (!val) return;

        const res = addOrg(val);
        if (res.success) {
            input.value = '';
            if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                window.showToast(`Connected to ${res.name}`, 'success');
            }
        } else {
            if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                window.showToast(res.message, 'error');
            }
        }
    }

    return {
        init,
        cleanUrl,
        isValidURL,
        getActiveUrl,
        setActiveOrg,
        addOrg,
        removeOrg,
        openModal,
        closeModal,
        handleAddFromModal,
        bindPasteCleaner,
        get state() { return state; }
    };
}));
