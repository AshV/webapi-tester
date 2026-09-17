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
- **URL Querystring & File Loading (FetchXmlTester Parity)**:
  - Load remote query files via `?load=<url>`, `?url=<url>`, `?file=<url>`, or `?src=<url>` (auto-converts GitHub blob links to raw content).
  - Load inline queries via `?query=<encoded_query>`, `?q=<query>`, or `?odata=<query>`.
  - Connect and activate environments via `?env=<org_url>` or `?org=<org_url>`.
  - Deep-link directly into Split Screen view (`?view=split`) or Visual Builder (`?view=visual`).
  - Open local query files from disk with the **Open** toolbar button (`Ctrl+O`).
  - One-click sharable deep link generation with the **Share** toolbar button (`Ctrl+Shift+S`).
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

## 🔗 URL Querystring Deep-Linking & File Loading

WebAPI Studio features complete parity with [FetchXmlTester](https://www.ashishvishwakarma.com/FetchXmlTester/)'s query string loading capabilities, enabling seamless query sharing, automated documentation links, and remote file loading directly into the studio.

### Supported URL Parameters

| Parameter | Example | Behavior |
| :--- | :--- | :--- |
| **`?load=`** / **`?url=`** / **`?file=`** / **`?src=`** | `?load=https://example.com/query.odata`<br>`?load=sample-query.odata` | Fetches any public OData query file (including relative paths). Automatically extracts query name from filename and formats the query into the editor. |
| **`?query=`** / **`?q=`** / **`?odata=`** | `?query=accounts%3F%24select%3Dname` | Directly populates the editor from a URL-encoded OData query string or a full Dataverse Web API request URL. |
| **`?env=`** / **`?org=`** | `?env=https://contoso.crm.dynamics.com` | Automatically connects to and activates the specified Dataverse tenant in the Environment Manager. |
| **`?name=`** / **`?title=`** | `?name=Active%20Accounts` | Sets the query title and updates the browser tab title (`OData: <name>`). |
| **`?view=`** | `?view=split` / `?view=visual` / `?view=code` | Direct deep-linking to Split Screen, Visual Builder, or Code Editor mode. |

### Smart GitHub Link Transformation
If a GitHub repository link is passed (e.g. `https://github.com/user/repo/blob/main/query.odata`), WebAPI Studio automatically transforms it to `https://raw.githubusercontent.com/user/repo/main/query.odata` for direct, CORS-friendly client-side loading.

### One-Click Sharable Link Generator
Click the **Share** button on the toolbar (or press `Ctrl+Shift+S`) to generate an all-inclusive deep link that preserves:
1. Current query clauses and formatting (`query`)
2. Connected Dataverse organization (`env`)
3. Query name and description (`name`)
4. Active studio workspace view (`view`)

Example generated shareable link:
```
https://www.ashishvishwakarma.com/webapi-tester/?query=accounts%3F%24select%3Dname%2Ctelephone1&env=https%3A%2F%2Fcontosocrm.crm.dynamics.com&name=Active%20Accounts&view=split
```

### Local File Picker
Click the **Open** button on the toolbar (or press `Ctrl+O`) to pick and load any local `.odata`, `.txt`, or `.json` query file from your computer.

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
| `Ctrl / Cmd + O` | **Open File**: Load OData query from local file |
| `Ctrl / Cmd + Shift + S` | **Share Link**: Copy one-click sharable URL with query & environment |
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