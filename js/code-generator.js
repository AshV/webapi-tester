/**
 * Code Generator for Microsoft Dataverse & Power Platform
 * Transforms OData queries into production-ready code snippets across
 * Xrm.WebApi, Power Automate, C#, Fetch API, cURL, and PowerShell.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./odata-parser'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./odata-parser'));
    } else {
        root.CodeGenerator = factory(root.ODataParser);
    }
}(typeof self !== 'undefined' ? self : this, function (ODataParser) {
    'use strict';

    function getParamValue(params, key) {
        const found = (params || []).find(p => p.key.toLowerCase() === key.toLowerCase());
        return found ? found.value : '';
    }

    function generate(orgUrl, apiVersion, queryText, selectedPreferHeaders = []) {
        const parser = ODataParser || (typeof window !== 'undefined' ? window.ODataParser : null);
        const parsed = parser ? parser.parse(queryText) : { path: 'accounts', params: [] };

        const targetOrg = (orgUrl || 'https://contoso.crm.dynamics.com').replace(/\/+$/, '');
        const version = apiVersion || 'v9.2';
        const entityPath = parsed.path || 'accounts';

        // Derive singular logical name for Xrm.WebApi if possible
        let entityLogicalName = entityPath;
        if (typeof plurals !== 'undefined') {
            for (const [sing, plur] of Object.entries(plurals)) {
                if (plur.toLowerCase() === entityPath.toLowerCase()) {
                    entityLogicalName = sing;
                    break;
                }
            }
        }
        if (entityLogicalName === entityPath && entityPath.endsWith('s')) {
            entityLogicalName = entityPath.slice(0, -1);
        }

        const minifiedQuery = parser ? parser.minify(queryText) : queryText;
        const qIdx = minifiedQuery.indexOf('?');
        const queryOptionsPart = qIdx >= 0 ? minifiedQuery.substring(qIdx) : '';

        const fullUrl = `${targetOrg}/api/data/${version}/${minifiedQuery}`;

        // Prefer header string
        const preferValues = [...selectedPreferHeaders];
        if (preferValues.length === 0) {
            preferValues.push('odata.include-annotations="OData.Community.Display.V1.FormattedValue"');
        }
        const preferHeaderVal = preferValues.join(',');

        // 1. Xrm.WebApi (Model-driven apps / Client Scripting)
        const xrmCode = `// Dynamics 365 / Dataverse Client Scripting (Web Resources, Forms)
var entityLogicalName = "${entityLogicalName}";
var options = "${queryOptionsPart}";

Xrm.WebApi.retrieveMultipleRecords(entityLogicalName, options).then(
    function success(result) {
        console.log("Retrieved records: " + result.entities.length);
        for (var i = 0; i < result.entities.length; i++) {
            var record = result.entities[i];
            console.log(record);
        }
        
        // Paging link (if more records exist)
        if (result.nextLink) {
            console.log("Next page link: " + result.nextLink);
        }
    },
    function (error) {
        console.error("Xrm.WebApi Error: " + error.message);
    }
);`;

        // 2. Fetch API (JavaScript / TypeScript / Portal)
        const fetchCode = `// Native JavaScript Fetch API
const endpoint = "${fullUrl}";

async function executeDataverseQuery(bearerToken) {
    const headers = {
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Prefer": '${preferHeaderVal}'
    };

    if (bearerToken) {
        headers["Authorization"] = \`Bearer \${bearerToken}\`;
    }

    const response = await fetch(endpoint, {
        method: "GET",
        headers: headers
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error?.message || \`HTTP \${response.status}: \${response.statusText}\`);
    }

    const data = await response.json();
    console.log("Dataverse records:", data.value);
    return data.value;
}`;

        // 3. Power Automate (List rows action fields)
        const selectCols = getParamValue(parsed.params, '$select');
        const filterRows = getParamValue(parsed.params, '$filter');
        const expandQuery = getParamValue(parsed.params, '$expand');
        const orderBy = getParamValue(parsed.params, '$orderby');
        const topCount = getParamValue(parsed.params, '$top');

        const flowFields = {
            table: entityPath,
            select: selectCols,
            filter: filterRows,
            expand: expandQuery,
            orderby: orderBy,
            top: topCount
        };

        const flowSummaryText = `<!-- Power Automate: 'List rows' action parameters -->
Table Name:          ${entityPath}
Select Columns:      ${selectCols || '(All columns)'}
Filter Rows:         ${filterRows || '(None)'}
Sort By:             ${orderBy || '(None)'}
Expand Query:        ${expandQuery || '(None)'}
Row Count:           ${topCount || '(Default)'}`;

        // 4. C# (HttpClient)
        const csharpCode = `using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace DataverseSample
{
    public class WebApiRunner
    {
        public static async Task ExecuteQueryAsync(string orgUrl, string accessToken)
        {
            using var client = new HttpClient();
            client.BaseAddress = new Uri(orgUrl.TrimEnd('/') + "/");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            client.DefaultRequestHeaders.Add("OData-MaxVersion", "4.0");
            client.DefaultRequestHeaders.Add("OData-Version", "4.0");
            client.DefaultRequestHeaders.Add("Prefer", @"${preferHeaderVal}");

            var requestUri = "api/data/${version}/${minifiedQuery}";
            using var response = await client.GetAsync(requestUri);
            response.EnsureSuccessStatusCode();

            var jsonResult = await response.Content.ReadAsStringAsync();
            Console.WriteLine(jsonResult);
        }
    }
}`;

        // 5. cURL (Terminal / Postman)
        const curlCode = `curl -X GET "${fullUrl}" \\
  -H "Accept: application/json" \\
  -H "OData-MaxVersion: 4.0" \\
  -H "OData-Version: 4.0" \\
  -H "Prefer: ${preferHeaderVal}" \\
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"`;

        // 6. PowerShell
        const psCode = `$orgUrl = "${targetOrg}"
$endpoint = "$orgUrl/api/data/${version}/${minifiedQuery.replace(/\$/g, '`$')}"

$headers = @{
    "Accept" = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version" = "4.0"
    "Prefer" = '${preferHeaderVal}'
    "Authorization" = "Bearer $accessToken"
}

$response = Invoke-RestMethod -Uri $endpoint -Headers $headers -Method Get
$response.value | Format-Table`;

        return {
            xrm: xrmCode,
            fetch: fetchCode,
            flow: flowSummaryText,
            flowFields,
            csharp: csharpCode,
            curl: curlCode,
            powershell: psCode
        };
    }

    function openModal(orgUrl, apiVersion, queryText, selectedPreferHeaders) {
        const modal = document.getElementById('codeGenModal');
        if (!modal) return;

        const snippets = generate(orgUrl, apiVersion, queryText, selectedPreferHeaders);
        renderTabs(snippets);
        modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('codeGenModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function renderTabs(snippets) {
        const container = document.getElementById('codeGenContent');
        if (!container) return;

        container.setAttribute('data-snippets', JSON.stringify(snippets));
        switchTab('xrm');
    }

    function switchTab(lang) {
        const container = document.getElementById('codeGenContent');
        if (!container) return;

        const raw = container.getAttribute('data-snippets');
        if (!raw) return;

        const snippets = JSON.parse(raw);
        const tabs = document.querySelectorAll('.code-tab-btn');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === lang);
        });

        const pre = document.getElementById('codeSnippetArea');
        if (pre) {
            pre.textContent = snippets[lang] || '';
        }
    }

    return {
        generate,
        openModal,
        closeModal,
        switchTab
    };
}));
