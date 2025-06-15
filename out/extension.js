/// <reference types="vscode" />
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// src/extension.ts
// VSCode File Template Extension Main Entry
// Implement custom template file creation
//
// Author: your-name
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function activate(context) {
    let disposable = vscode.commands.registerCommand('file-template.createFileFromTemplate', async (uri) => {
        const templates = vscode.workspace.getConfiguration().get('fileTemplate.templates', []);
        let params = {};
        if (!templates.length) {
            vscode.window.showWarningMessage('No file templates configured. Please add one in settings.');
            return;
        }
        // Grouped dropdown to select template
        const pickItems = templates.map(t => ({
            label: t.name,
            template: t
        }));
        const picked = await vscode.window.showQuickPick(pickItems, {
            placeHolder: 'Select a template'
        });
        if (!picked)
            return;
        const template = picked.template;
        // Parameter input: single InputBox, input all parameters at once (comma separated), supports object array parameter config
        if (template.parameters && template.parameters.length > 0) {
            let prompt = '';
            if (template.parameters.length > 1) {
                prompt = 'Please separate parameters with commas';
            }
            const placeHolder = template.parameters.map((p) => p.name).join(',');
            const input = await vscode.window.showInputBox({
                prompt,
                placeHolder,
                validateInput: (value) => {
                    const values = value.split(',').map(s => s.trim());
                    for (let i = 0; i < template.parameters.length; i++) {
                        const p = template.parameters[i];
                        if (p.required !== false && (!values[i] || values[i] === '')) {
                            return `Parameter "${p.name}" is required`;
                        }
                    }
                    return null;
                }
            });
            if (input === undefined)
                return;
            const values = input.split(',').map(s => s.trim());
            template.parameters.forEach((p, i) => {
                params[p.name] = values[i] || '';
            });
        }
        // Generate content
        let content = '';
        if (!template.templateType || template.templateType === 'string') {
            // String mode: direct variable replacement
            content = template.template;
            for (const key in params) {
                content = content.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), params[key]);
            }
        }
        else if (!template.templateType || template.templateType === 'js') {
            // JS mode: execute, then replace ${param} with values
            try {
                // Prepare parameter variable declarations
                const paramVars = template.parameters?.map(p => p.name).filter(Boolean) || [];
                const paramDecl = paramVars.map(name => `var ${name} = params['${name}'];`).join('\n');
                // eslint-disable-next-line no-new-func
                const fn = new Function('params', 'toPascalCase', 'toSnakeCase', `${paramDecl}\n${template.template}`);
                let result = fn(params, toPascalCase, toSnakeCase);
                if (typeof result === 'string') {
                    content = result;
                    for (const key in params) {
                        content = content.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), params[key]);
                    }
                }
                else {
                    content = '';
                }
            }
            catch (e) {
                vscode.window.showErrorMessage('Template JS execution error: ' + e);
                return;
            }
        }
        // Generate file name
        let fileName = template.fileName;
        for (const key in params) {
            fileName = fileName.replace(new RegExp(`\\$\{${key}\}`, 'g'), params[key]);
        }
        const filePath = path.join(uri.fsPath, fileName);
        // Check if file already exists
        if (fs.existsSync(filePath)) {
            vscode.window.showErrorMessage('File already exists: ' + fileName);
            return;
        }
        // Write file
        await fs.promises.writeFile(filePath, content, 'utf8');
        const doc = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(doc);
    });
    // Register template management command (Webview overview)
    let manageDisposable = vscode.commands.registerCommand('file-template.manageTemplates', async () => {
        const panel = vscode.window.createWebviewPanel('fileTemplateManager', 'File Template Manager', vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        let templates = vscode.workspace.getConfiguration().get('fileTemplate.templates', []);
        let expandedIdx = -1;
        panel.webview.html = getManagerHtml(templates, expandedIdx);
        panel.reveal(vscode.ViewColumn.Active);
        panel.iconPath = vscode.Uri.file(require('path').join(__dirname, '../resources/template.svg'));
        panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'add') {
                templates.push({ name: 'new template', description: '', parameters: [{ name: '', description: '', required: true }], template: '', fileName: 'new_file.txt', templateType: 'string' });
                expandedIdx = typeof msg.expandedIdx === 'number' ? msg.expandedIdx : templates.length - 1;
                await vscode.workspace.getConfiguration().update('fileTemplate.templates', templates, vscode.ConfigurationTarget.Global);
                panel.webview.html = getManagerHtml(templates, expandedIdx);
                panel.webview.postMessage({ type: 'updateTemplates', templates, expandedIdx });
            }
            else if (msg.type === 'edit') {
                const { idx, field, value } = msg;
                if (field === 'parameters') {
                    templates[idx].parameters = value;
                }
                else if (field === 'name') {
                    templates[idx].name = value;
                }
                else if (field === 'fileName') {
                    templates[idx].fileName = value;
                }
                else if (field === 'template') {
                    templates[idx].template = value;
                }
                else if (field === 'templateType') {
                    templates[idx].templateType = value;
                }
                else if (field === 'description') {
                    templates[idx].description = value;
                }
                expandedIdx = typeof msg.expandedIdx === 'number' ? msg.expandedIdx : idx;
                await vscode.workspace.getConfiguration().update('fileTemplate.templates', templates, vscode.ConfigurationTarget.Global);
                panel.webview.html = getManagerHtml(templates, expandedIdx);
                panel.webview.postMessage({ type: 'updateTemplates', templates, expandedIdx });
            }
            else if (msg.type === 'delete') {
                templates.splice(msg.idx, 1);
                expandedIdx = -1;
                await vscode.workspace.getConfiguration().update('fileTemplate.templates', templates, vscode.ConfigurationTarget.Global);
                panel.webview.html = getManagerHtml(templates, expandedIdx);
                panel.webview.postMessage({ type: 'updateTemplates', templates, expandedIdx });
            }
            else if (msg.type === 'editSettings') {
                vscode.commands.executeCommand('workbench.action.openSettingsJson');
            }
        });
    });
    // Import templates command
    let importDisposable = vscode.commands.registerCommand('file-template.importTemplates', async () => {
        const uris = await vscode.window.showOpenDialog({ filters: { 'JSON': ['json'] }, canSelectMany: false });
        if (uris && uris[0]) {
            const buf = await vscode.workspace.fs.readFile(uris[0]);
            try {
                const imported = JSON.parse(buf.toString());
                if (!Array.isArray(imported))
                    throw new Error('File content is not a template array');
                let templates = vscode.workspace.getConfiguration().get('fileTemplate.templates', []);
                let always = '';
                let changed = false;
                for (const tpl of imported) {
                    const idx = templates.findIndex(t => t.name === tpl.name);
                    if (idx !== -1) {
                        if (!always) {
                            const pick = await vscode.window.showInformationMessage(`Template with the same name "${tpl.name}" already exists. What do you want to do?`, { modal: true }, 'Replace', 'Skip', 'Always Replace', 'Always Skip');
                            if (!pick)
                                continue;
                            if (pick === 'Replace') {
                                templates[idx] = tpl;
                                changed = true;
                            }
                            else if (pick === 'Skip') {
                                // skip
                            }
                            else if (pick === 'Always Replace') {
                                always = 'replace';
                                templates[idx] = tpl;
                                changed = true;
                            }
                            else if (pick === 'Always Skip') {
                                always = 'skip';
                            }
                        }
                        else if (always === 'replace') {
                            templates[idx] = tpl;
                            changed = true;
                        } // skip does nothing
                    }
                    else {
                        templates.push(tpl);
                        changed = true;
                    }
                }
                if (changed) {
                    await vscode.workspace.getConfiguration().update('fileTemplate.templates', templates, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Templates imported');
                }
            }
            catch (e) {
                vscode.window.showErrorMessage('Import failed: ' + e);
            }
        }
    });
    // Export templates command
    let exportDisposable = vscode.commands.registerCommand('file-template.exportTemplates', async () => {
        const templates = vscode.workspace.getConfiguration().get('fileTemplate.templates', []);
        if (!templates.length) {
            vscode.window.showWarningMessage('No templates to export');
            return;
        }
        const uri = await vscode.window.showSaveDialog({ filters: { 'JSON': ['json'] }, defaultUri: vscode.Uri.file('file-templates.json') });
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(templates, null, 2), 'utf8'));
            vscode.window.showInformationMessage('Templates exported: ' + uri.fsPath);
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(manageDisposable);
    context.subscriptions.push(importDisposable);
    context.subscriptions.push(exportDisposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
function getManagerHtml(templates, expandedIdx = -1) {
    // Only supports parameter as object array
    return `
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family, 'Segoe UI', 'Arial', sans-serif); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); margin: 0; padding: 2.5em 0 3em 0; }
            h2 { margin-top: 0; font-size: 1.7em; font-weight: 700; letter-spacing: 0.01em; margin-bottom: 1em; color: var(--vscode-editor-foreground); margin-left: 48px; }
            .top-actions { margin-bottom: 2.2em; display: flex; justify-content: flex-start; margin-left: 48px; }
            .template-list { margin-bottom: 2.5em; display: flex; flex-direction: column; gap: 2.5em; }
            .template-item { border: 1.5px solid var(--vscode-editorWidget-border); border-radius: 12px; background: var(--vscode-editorWidget-background); padding: 0; margin-bottom: 0; box-shadow: 0 4px 24px #0002; max-width: 720px; margin-left: 48px; margin-right: auto; display: flex; flex-direction: column; }
            .template-header { display: flex; align-items: center; justify-content: space-between; padding: 1.2em 2.2em 1.2em 2.2em; cursor: pointer; user-select: none; }
            .template-title { font-size: 1.18em; font-weight: 500; }
            .toggle-btn { background: none; border: none; color: var(--vscode-editor-foreground); font-size: 1.2em; cursor: pointer; margin-left: 1em; }
            .template-detail { padding: 0 2.2em 2em 2.2em; display: none; }
            .template-item.expanded .template-detail { display: block; }
            .template-item.expanded .toggle-btn { transform: rotate(90deg); }
            .template-item:not(.expanded) .toggle-btn { transform: rotate(0deg); }
            .template-fields { display: flex; flex-direction: column; gap: 0.4em; margin-bottom: 0; }
            .template-fields label { font-size: 1.08em; margin-bottom: 0.08em; color: var(--vscode-editor-foreground); font-weight: 350; padding-left: 0.05em; }
            .template-fields input, .template-fields textarea { width: 100%; font-family: inherit; font-size: 1em; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1.5px solid var(--vscode-input-border); border-radius: 5px; padding: 0.5em 0.7em; margin-bottom: 0.1em; box-sizing: border-box; transition: border 0.15s; }
            .template-fields input:focus, .template-fields textarea:focus { border: 1.5px solid var(--vscode-focusBorder); outline: none; }
            .template-fields textarea { resize: vertical; min-height: 90px; }
            .param-table-card { background: linear-gradient(rgba(90,90,90,0.18), rgba(90,90,90,0.18)), var(--vscode-editorWidget-background, #23272e); border-radius: 8px; box-shadow: 0 1px 6px #0002; padding: 1.2em 1em 1.5em 1em; margin-bottom: 0.2em; width: 100%; max-width: none; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch; gap: 0.7em; }
            .param-table { width: 100%; max-width: 100%; margin: 0; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
            .param-table th, .param-table td { border: none; padding: 0.45em 0.5em; font-size: 1em; text-align: center; vertical-align: middle; background: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .param-table th { background: var(--vscode-editorWidget-border); color: var(--vscode-editor-foreground); font-weight: 350; border-bottom: 2px solid var(--vscode-editorWidget-border); }
            .param-table input[type="text"] { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; height: 2.1em; padding: 0.3em 0.6em; font-size: 1em; border-radius: 4px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); transition: border 0.15s; }
            .param-table input[type="text"]:focus { border: 1.5px solid var(--vscode-focusBorder); outline: none; }
            .param-table input[type="checkbox"] { transform: scale(1.15); margin: 0; }
            .param-table .param-req { text-align: center; }
            .param-table .delete-btn { min-width: 36px; max-width: 48px; padding: 0.2em 0.5em; font-size: 0.98em; border-radius: 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-secondaryBorder); cursor: pointer; transition: background 0.15s, border 0.15s; }
            .param-table .delete-btn:hover { background: var(--vscode-button-hoverBackground); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-hoverBorder, var(--vscode-button-hoverBackground)); }
            .param-table tr { height: 2.5em; }
            .actions { margin-top: 1.2em; display: flex; justify-content: flex-end; }
            .actions .delete-btn { margin-left: 0.5em; }
            @media (max-width: 900px) { .template-item { max-width: 98vw; padding: 1.2em 0.5em 1em 0.5em; margin-left: 0; } .top-actions { margin-left: 0; } h2 { margin-left: 0; } .blue-btn.add-template-btn { margin-left: 0; } }
            .blue-btn { background: var(--vscode-button-background, #007acc) !important; color: var(--vscode-button-foreground, #fff) !important; border: none !important; border-radius: 4px !important; font-weight: 350 !important; box-shadow: 0 2px 8px #0002; transition: background 0.15s, box-shadow 0.15s; cursor: pointer; }
            .blue-btn:hover { background: var(--vscode-button-hoverBackground, #005fa3) !important; color: #fff !important; }
            .add-param-btn { margin: 0.3em auto 0 auto; display: block; padding: 0.3em 1.0em; font-size: 1em; }
            .param-table .delete-btn { min-width: 36px; max-width: 48px; padding: 0.2em 0.5em; font-size: 0.98em; border-radius: 6px; }
            .actions .delete-btn { padding: 0.5em 1.6em; font-size: 1em; border-radius: 4px; }
            .top-actions .edit-settings-btn { padding: 0.5em 1.6em; font-size: 1em; border-radius: 4px; margin-bottom: 1.0em; }
            .blue-btn.add-template-btn { width: 180px; height: 38px; font-size: 1.08em; margin-left: 48px; margin-top: 2.0em; display: block; }
            .template-type-group { display: flex; flex-direction: row; align-items: center; gap: 0.7em; margin-bottom: 0.7em; }
            .template-type-btn { padding: 0.35em 1.2em; border: 1.5px solid var(--vscode-input-border); border-radius: 5px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font-size: 1em; font-family: inherit; cursor: pointer; margin-right: 0.5em; transition: background 0.15s, border 0.15s; }
            .template-type-btn.selected { background: var(--vscode-button-background, #007acc); color: var(--vscode-button-foreground, #fff); border: 1.5px solid var(--vscode-focusBorder, #409eff); }
        </style>
    </head>
    <body>
        <div class="top-actions">
            <button class="edit-settings-btn blue-btn" onclick="editSettings()">Edit in settings.json</button>
        </div>
        ${templates.length === 0 ? `` : `
            <h2>Template Overview</h2>
            <div class="template-list">
                ${templates.map((tpl, idx) => `
                    <div class="template-item${expandedIdx === idx ? ' expanded' : ''}" id="template-item-${idx}">
                        <div class="template-header" onclick="toggleDetail(${idx})">
                            <span class="template-title">${tpl.name || '未命名模板'}</span>
                            <button class="toggle-btn" title="展开/收起">▶</button>
                        </div>
                        <div class="template-detail">
                            <div class="template-fields">
                                <label>Template Name</label>
                                <input value="${tpl.name}" onchange="edit(${idx}, 'name', this.value)" placeholder="Enter template name" />
                            </div>
                            <div class="template-fields">
                                <label>Template Description</label>
                                <input value="${tpl.description || ''}" onchange="edit(${idx}, 'description', this.value)" placeholder="Template usage/description (optional)" />
                            </div>
                            <div class="template-fields">
                                <label style="margin-bottom:0.3em;padding-left:0.05em;">Parameter Configuration</label>
                                <div class="param-table-card">
                                <table class="param-table">
                                    <colgroup>
                                        <col style="width:40%">
                                        <col style="width:40%">
                                        <col style="width:10%">
                                        <col style="width:10%">
                                    </colgroup>
                                    <tr><th class="param-name">Name</th><th class="param-desc">Description</th><th>Required</th><th></th></tr>
                                    ${(tpl.parameters || []).map((p, pi) => `
                                        <tr>
                                            <td><input type="text" value="${p.name}" onchange="editParam(${idx},${pi},'name',this.value)" placeholder="Parameter name" /></td>
                                            <td><input type="text" value="${p.description || ''}" onchange="editParam(${idx},${pi},'description',this.value)" placeholder="Parameter description (optional)" /></td>
                                            <td class="param-req"><input type="checkbox" ${p.required !== false ? 'checked' : ''} onchange="editParam(${idx},${pi},'required',this.checked)" /></td>
                                            <td><button class="delete-btn blue-btn" onclick="deleteParam(${idx},${pi});event.stopPropagation();return false;">Delete</button></td>
                                        </tr>
                                    `).join('')}
                                </table>
                                <button class="add-param-btn blue-btn" onclick="addParam(${idx});event.stopPropagation();return false;">Add Parameter</button>
                                </div>
                            </div>
                            <div class="template-fields">
                                <label>File Name</label>
                                <input value="${tpl.fileName}" onchange="edit(${idx}, 'fileName', this.value)" placeholder="e.g. filename.js" />
                            </div>
                            <div class="template-fields">
                                <label>Template Type</label>
                                <div class="template-type-group">
                                    <button type="button" class="template-type-btn${tpl.templateType === 'string' ? ' selected' : ''}" onclick="edit(${idx}, 'templateType', 'string');event.stopPropagation();return false;">String</button>
                                    <button type="button" class="template-type-btn${tpl.templateType !== 'string' ? ' selected' : ''}" onclick="edit(${idx}, 'templateType', 'js');event.stopPropagation();return false;">JS</button>
                                </div>
                            </div>
                            <div class="template-fields">
                                <label>Template Content</label>
                                <textarea rows="8" onchange="edit(${idx}, 'template', this.value)" placeholder="Enter template content (String or JS, supports params)">${tpl.template.replace(/</g, '&lt;')}</textarea>
                            </div>
                            <div class="actions">
                                <button class="delete-btn blue-btn" onclick="deleteTemplate(${idx});event.stopPropagation();return false;">Delete</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `}
        <button class="blue-btn add-template-btn" onclick="addTemplate()">Add Template</button>
        <script>
        const vscode = acquireVsCodeApi();
        let templates = ${JSON.stringify(templates)};
        let expandedIdx = ${expandedIdx};
        let expanded = templates.map((_,i)=>i===expandedIdx);
        function addTemplate() { 
            vscode.postMessage({ type: 'add', expandedIdx: templates.length }); 
        }
        function edit(idx, field, value) { 
            vscode.postMessage({ type: 'edit', idx, field, value, expandedIdx: idx });
        }
        function deleteTemplate(idx) { vscode.postMessage({ type: 'delete', idx }); }
        function editSettings() { vscode.postMessage({ type: 'editSettings' }); }
        function addParam(idx) { vscode.postMessage({ type: 'edit', idx, field: 'parameters', value: [...(templates[idx].parameters||[]), {name:'',description:'',required:true}], expandedIdx: idx }); }
        function editParam(idx, pi, field, value) { const params = [...(templates[idx].parameters||[])]; if(field==='required') value = !!value; params[pi] = { ...params[pi], [field]: value }; vscode.postMessage({ type: 'edit', idx, field: 'parameters', value: params, expandedIdx: idx }); }
        function deleteParam(idx, pi) { const params = [...(templates[idx].parameters||[])]; params.splice(pi,1); vscode.postMessage({ type: 'edit', idx, field: 'parameters', value: params, expandedIdx: idx }); }
        function toggleDetail(idx) {
            expanded = templates.map((_,i)=>i===idx ? !expanded[idx] : false); // 只展开一个
            document.querySelectorAll('.template-item').forEach((el,i)=>{
                if(expanded[i]) el.classList.add('expanded');
                else el.classList.remove('expanded');
            });
        }
        window.addEventListener('message', e => {
            if(e.data.type==='updateTemplates') {
                templates = e.data.templates;
                expandedIdx = e.data.expandedIdx ?? -1;
                expanded = templates.map((_,i)=>i===expandedIdx);
                setTimeout(()=>{
                    document.querySelectorAll('.template-item').forEach((el,i)=>{
                        if(expanded[i]) el.classList.add('expanded');
                        else el.classList.remove('expanded');
                    });
                }, 50);
            }
        });
        // 初始化
        setTimeout(()=>{
            document.querySelectorAll('.template-item').forEach((el,i)=>{
                if(expanded[i]) el.classList.add('expanded');
                else el.classList.remove('expanded');
            });
        }, 10);
        </script>
    </body>
    </html>
    `;
}
function getParamFormHtml(template) {
    return `
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family, sans-serif); background: var(--vscode-editor-background, #fff); color: var(--vscode-editor-foreground, #222); margin: 0; padding: 2em; }
            h2 { margin-top: 0; }
            .desc { color: var(--vscode-descriptionForeground, #888); margin-bottom: 1.2em; font-size: 1.08em; }
            .form-group { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 1.1em; }
            label { display: block; margin-bottom: 0.18em; font-weight: 350; font-size: 1em; }
            .param-desc { color: var(--vscode-descriptionForeground, #888); font-size: 0.97em; margin-bottom: 0.18em; }
            input { width: 100%; max-width: 400px; box-sizing: border-box; padding: 0.45em 0.7em; font-size: 1em; border-radius: 4px; border: 1px solid var(--vscode-input-border, #ccc); background: var(--vscode-input-background, #fff); color: var(--vscode-input-foreground, #222); }
            .error { color: #e53935; margin-bottom: 1em; }
            .actions { margin-top: 1.5em; display: flex; gap: 1em; }
            button { background: var(--vscode-button-background, #007acc); color: var(--vscode-button-foreground, #fff); border: none; border-radius: 4px; padding: 0.5em 1.5em; font-size: 1em; cursor: pointer; }
            button:hover { background: var(--vscode-button-hoverBackground, #005fa3); }
        </style>
    </head>
    <body>
        <h2>${template.name || 'Fill in parameters'}</h2>
        ${template.description ? `<div class="desc">${template.description}</div>` : ''}
        <form id="paramForm">
            <div id="error" class="error"></div>
            ${(template.parameters || []).map((param) => `
                <div class="form-group">
                    <label for="${param.name}">${param.name}${param.required === false ? ' <span style=\"color:#888;font-weight:normal;font-size:0.95em;\">(Optional)</span>' : ''}</label>
                    ${param.description ? `<div class=\"param-desc\">${param.description}</div>` : ''}
                    <input id="${param.name}" name="${param.name}"${param.required === false ? '' : ' required'} />
                </div>
            `).join('')}
            <div class="actions">
                <button type="submit">Generate File</button>
                <button type="button" onclick="cancel()">Cancel</button>
            </div>
        </form>
        <script>
        const vscode = acquireVsCodeApi();
        const form = document.getElementById('paramForm');
        const errorDiv = document.getElementById('error');
        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'error') {
                errorDiv.textContent = msg.message;
            }
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            errorDiv.textContent = '';
            const params = {};
            ${(template.parameters || []).map(param => `params['${param.name}'] = form['${param.name}'].value.trim();`).join('\n')}
            vscode.postMessage({ type: 'submit', params });
        });
        function cancel() {
            vscode.postMessage({ type: 'cancel' });
        }
        </script>
    </body>
    </html>
    `;
}
// Utility: snake_case to PascalCase
function toPascalCase(str) {
    return str
        .split('_')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join('');
}
// Utility: PascalCase/camelCase to snake_case
function toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase();
}
//# sourceMappingURL=extension.js.map