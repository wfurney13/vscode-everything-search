# Everything Search for VS Code

A Visual Studio Code extension that integrates Everything search functionality directly into your editor.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/wfurney13.everything-search)](https://marketplace.visualstudio.com/items?itemName=wfurney13.everything-search)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/wfurney13.everything-search)](https://marketplace.visualstudio.com/items?itemName=wfurney13.everything-search)

## Features

- **Quick File Search**: Search your entire system using Everything's lightning-fast indexing
- **Regex Support**: Use regular expressions for advanced search patterns
- **Keyboard Shortcut**: Quick access with `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac)
- **Configurable**: Customize search behavior and es.exe path

## Prerequisites

1. **Everything** must be installed and running on your system
2. **es.exe** (Everything Command Line Interface) must be available in your PATH or configured in settings

Download Everything from: https://www.voidtools.com/
Download es.exe from: https://www.voidtools.com/ES-1.1.0.18.zip

## Installation

1. Copy this extension to your VS Code extensions folder:
   - Windows: `%USERPROFILE%\.vscode\extensions\`
   - macOS: `~/.vscode/extensions/`
   - Linux: `~/.vscode/extensions/`

2. Restart VS Code

3. The extension will be activated automatically

## Usage

### Commands

- **Everything: Search Files** - Real-time incremental search as you type
- **Everything: Search Files (Regex)** - Search using regular expressions (input box)

### Keyboard Shortcuts

- `Ctrl+Shift+E` (Windows/Linux) or `Cmd+Shift+E` (Mac) - Incremental search

### Via Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Everything: Search"
3. Select the desired search command

## Configuration

Open VS Code settings and search for "everything-search":

- **everything-search.executablePath**: Path to es.exe (default: "es.exe")
- **everything-search.maxResults**: Maximum number of results to display (default: 100)
- **everything-search.caseSensitive**: Enable case-sensitive search by default (default: false)

## Building from Source

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile TypeScript:
   ```bash
   npm run compile
   ```

3. Watch for changes during development:
   ```bash
   npm run watch
   ```

## Troubleshooting

### "Everything search is not available"

1. Ensure Everything is installed and running
2. Verify es.exe is in your PATH or configure the full path in settings
3. Test es.exe from command line: `es.exe test`

### No results found

1. Check that Everything has indexed your drives
2. Verify the search query syntax
3. Try a simpler search term

## Development

To package the extension:

```bash
npm install -g vsce
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.