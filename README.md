# OData WebAPI Tester Studio

[![GitHub Pages](https://img.shields.io/badge/Hosted%20On-GitHub%20Pages-blue.svg)](https://www.ashishvishwakarma.com/webapi-tester/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Dataverse](https://img.shields.io/badge/Microsoft-Dataverse%20Web%20API-0078D4.svg)](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)

A modern, 100% client-side **Microsoft Dataverse & Dynamics 365 OData Web API Query Tester Studio**, designed to run directly in the browser with **zero credential storage, zero proxies, and complete privacy**.

Built by [Ashish Vishwakarma (AshV)](https://www.ashishvishwakarma.com/) as the companion and modern OData successor to [FetchXML Tester Online](https://www.ashishvishwakarma.com/FetchXmlTester/).

---

## 🌟 Key Features

- **Multi-Line OData Query Editor**: Composes dense OData queries in structured, readable, multi-line formatting with automated nested indentation for `$expand(...)`.
- **Visual Clause Builder**:
  - Build complex queries visually with entity set auto-pluralization, field-by-field conditions, logical operators (`and`/`or`), and nested `$expand` relation cards.
  - Full bidirectional sync with the code editor and URL bar.
- **Resizable Split Screen Studio**:
  - View both the Code Editor and Visual Clause Builder side-by-side.
  - Interactive draggable divider with percentage memory and responsive stacking on mobile.
  - Real-time debounced live sync keeps both views in sync continuously.
- **Live OData v4 Syntax Linter & Validator**:
  - Real-time detection of unbalanced parentheses and quotes.
  - Flags common operator mistakes (`==` vs `eq`, `!=` vs `ne`, `&&` vs `and`, `||` vs `or`).
  - Enforces OData v4 semicolons (`;`) inside nested `$expand(...)` clauses.
  - Validates Dataverse CRM custom functions (`Microsoft.Dynamics.CRM.In`, `LastXDays`, `Between`, etc.).
- **Zero-Credential Browser SSO Execution**:
  - Executes directly against your active Microsoft Dataverse / Dynamics 365 environment in a new browser tab via native browser Single Sign-On (SSO).
  - **100% Secure**: Your credentials, tokens, and tenant data never touch any server, proxy, or third-party service.
- **Environment Manager (Parity with QDV & FetchXmlTester)**:
  - Shares your saved Dataverse organizations across tools seamlessly (`lsOrgURLs` and `qdv_active_env`).
  - Automatic URL sanitization on paste (strips `/main.aspx`, app IDs, and query parameters).
  - Quick environment switcher pills on the top toolbar.
- **Two-Way URL Synchronizer**:
  - Live preview of the generated Web API Request URI.
  - Paste any raw Dataverse Web API URL into the URI bar to automatically decode, parse, and format it into the editor.
- **Code Snippet Generator**:
  - Generates ready-to-paste snippets for **JavaScript (Xrm.WebApi)**, **Native Fetch API**, **Power Automate 'List rows'**, **C# (HttpClient)**, **cURL**, and **PowerShell**.
- **Interactive Documentation, Syntax Reference & FAQ**:
  - Built-in OData reference guide, Dataverse CRM query functions catalog, FetchXML to OData cheat sheet, and comprehensive FAQ.
- **Dataverse Request Headers & Preferences**:
  - Quick toggles for essential headers including `Prefer: odata.include-annotations="OData.Community.Display.V1.FormattedValue"`.
- **Preloaded Dataverse Query Templates**:
  - Jumpstart queries with patterns for nested expands, CRM date functions, the CRM `In` operator, `$apply` aggregations, metadata, and `WhoAmI()`.
- **Saved Queries Library**:
  - Store frequently used queries in browser local storage with instant search, tags, and JSON export/import.
- **Dark & Light Mode Studio**:
  - Tailored color palette, JetBrains Mono code typography, and keyboard shortcuts (`Ctrl+Enter` to test, `Ctrl+S` to save, `Ctrl+Shift+F` to beautify).

---

## 🚀 Getting Started

### Hosted Online
Open the live tool directly in your browser:
👉 **[https://www.ashishvishwakarma.com/webapi-tester/](https://www.ashishvishwakarma.com/webapi-tester/)**

### Local Development / Static Server
No build step or node server required. Serve with any static web server:

```bash
# Using Python
python3 -m http.server 8080

# Or using npx serve
npx serve .
```

Open `http://localhost:8080` in your browser.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl / Cmd + Enter` | **Test OData**: Execute query against active Dataverse environment |
| `Ctrl / Cmd + S` | **Save to Library**: Save current query to browser library |
| `Ctrl / Cmd + Shift + F` | **Beautify**: Format and indent OData clauses |
| `Ctrl / Cmd + K` | **Environment Manager**: Open environment selector |
| `Escape` | Close any active modal or error banner |

---

## 🔒 Privacy & Security

This tool is entirely client-side. All processing (parsing, validation, formatting, and storage) happens locally in your browser. Queries are executed directly against your Dataverse instance using your browser's existing authenticated session. No credentials or data are sent to any external server.

---

## 📄 License

MIT License &copy; [Ashish Vishwakarma](https://www.ashishvishwakarma.com/)