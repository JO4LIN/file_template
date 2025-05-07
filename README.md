# File Template VSCode Extension

A VSCode extension for creating, managing, and using custom file templates with parameterization and modern UI.

**Version: 1.0.0**

## Features
- Visual management of all templates in the settings page (add/edit/delete)
- Support for parameterized templates, with JS logic or plain string templates (selectable)
- Quick file creation from context menu or command palette
- Import/export templates with conflict resolution
- Beautiful, modern, dark-themed management UI
- Each template and parameter supports its own description
- Template cards and title are left-aligned (margin-left: 58px) for a clean look
- Template type (String or JS) can be selected per template, with a modern button group UI
- Add Template button is compact and unobtrusive
- Template description is shown in the template selection quick pick
- Parameter input: after selecting a template, the input box shows a single-line hint in the format serviceName-Service class name | baseUrl-Base API URL, with no popups
- All parameter usage is `${param}` style, even in JS templates (and you can use public functions like `toPascalCase`)
- No popups for parameter hints or file creation
- All UI and prompts are in English

## Getting Started
1. Install the extension and reload VSCode
2. Open the settings page, search for `fileTemplate.templates`, and click "Manage Templates" to open the visual UI
3. In the management UI, you can add, edit, or delete templates, or click "Edit in settings.json" to edit JSON directly
4. Right-click a folder and select "New File from Template" or use the command palette
5. Use the import/export buttons to manage templates in bulk

## Template Configuration Example

```json
[
  {
    "name": "Simple Text",
    "description": "A plain text template using string mode.",
    "parameters": [
      { "name": "title", "description": "Document title" },
      { "name": "author", "description": "Author name" }
    ],
    "templateType": "string",
    "template": "# ${title}\n\nAuthor: ${author}\n",
    "fileName": "${title}.md"
  },
  {
    "name": "API Service",
    "description": "Quickly generate an API Service file with basic structure.",
    "parameters": [
      { "name": "serviceName", "description": "Service class name (e.g. UserService)" },
      { "name": "baseUrl", "description": "Base API URL (e.g. /api/user)" },
      { "name": "token", "description": "Optional: auth token", "required": false }
    ],
    "templateType": "js",
    "template": "return `export class ${toPascalCase(serviceName)}Service {\\n  baseUrl = '${baseUrl}';\\n  token = '${token}';\\n}`;",
    "fileName": "${serviceName}.service.ts"
  }
]
```

- `templateType`: `js` for JavaScript logic (default), `string` for plain string with parameter replacement.
- `parameters`: Array of parameter objects, each with `name`, `description` (optional), and `required` (default true).
- Parameter input: After selecting a template, the input box shows a single-line hint in the format serviceName-Service class name | baseUrl-Base API URL, with no popups. Enter all parameters comma-separated, in order. Optional parameters can be left blank.

## Usage Notes
- When using JS template type, you can use `${param}` style for all parameters (e.g. `${baseUrl}`), and utility functions like `toPascalCase`, `toSnakeCase` in your template code. You can reference parameters directly by name (e.g. `serviceName`).
- When using String template type, `${param}` will be replaced with the corresponding value.
- Template descriptions are shown in the quick pick when selecting a template.
- All UI and prompts are in English.

---

For more details, see the extension in VSCode or open an issue for feedback. 