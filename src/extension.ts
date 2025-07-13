import * as vscode from 'vscode';
import { EverythingService, SearchResult } from './everything-service';

let everythingService: EverythingService;

export function activate(context: vscode.ExtensionContext) {
  everythingService = new EverythingService();

  // Register search command (now uses incremental search)
  const searchCommand = vscode.commands.registerCommand('everything-search.search', async () => {
    await performIncrementalSearch();
  });

  // Register regex search command
  const searchRegexCommand = vscode.commands.registerCommand('everything-search.searchRegex', async () => {
    await performSearch(true);
  });

  context.subscriptions.push(searchCommand, searchRegexCommand);

  // Test connection on activation
  testEverythingConnection();
}

async function performSearch(useRegex: boolean = false) {
  try {
    // Get search query from user
    const query = await vscode.window.showInputBox({
      placeHolder: useRegex ? 'Enter regex search pattern...' : 'Enter search query...',
      prompt: useRegex ? 'Search files using Everything (Regex)' : 'Search files using Everything'
    });

    if (!query) {
      return;
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('everything-search');
    const caseSensitive = config.get('caseSensitive', false);
    const maxResults = config.get('maxResults', 100);

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Searching with Everything...',
      cancellable: false
    }, async (progress) => {
      try {
        const results = await everythingService.search(query, {
          regex: useRegex,
          caseSensitive,
          maxResults
        });

        if (results.length === 0) {
          vscode.window.showInformationMessage('No results found');
          return;
        }

        // Show results in QuickPick
        await showSearchResults(results, query);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Everything search failed: ${errorMessage}`);
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Search failed: ${errorMessage}`);
  }
}

async function showSearchResults(results: SearchResult[], query: string) {
  const quickPickItems: vscode.QuickPickItem[] = results.map(result => ({
    label: result.name,
    description: result.path,
    detail: result.isDirectory ? 'Directory' : 'File'
  }));

  const selected = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: `Found ${results.length} results for "${query}"`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (selected && selected.description) {
    await openFile(selected.description);
  }
}

async function openFile(filePath: string) {
  try {
    const uri = vscode.Uri.file(filePath);
    const stat = await vscode.workspace.fs.stat(uri);

    if (stat.type === vscode.FileType.Directory) {
      const config = vscode.workspace.getConfiguration('everything-search');
      const openInVSCode = config.get('openFoldersInVSCode', true);
      
      if (openInVSCode) {
        // Open folder in VS Code
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
      } else {
        // Open folder in file explorer
        await vscode.commands.executeCommand('revealFileInOS', uri);
      }
    } else {
      // Open file in editor
      await vscode.window.showTextDocument(uri);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
  }
}

function convertWildcardToRegex(query: string): string {
  // Convert Everything wildcards to proper regex patterns
  return query
    .replace(/\./g, '\\.')           // Escape dots: . → \.
    .replace(/\*/g, '.*')            // Convert wildcards: * → .*
    .replace(/\?/g, '.');            // Convert single char wildcard: ? → .
}

function detectRegexPattern(query: string): boolean {
  // Detect common regex patterns that indicate user wants regex search
  const regexIndicators = [
    /\*/,                           // Wildcards: *glaze*config.yaml
    /\?/,                           // Single char wildcard: config?.yaml
    /\[.*\]/,                       // Character classes: [abc]
    /\{.*\}/,                       // Quantifiers: {2,4}
    /\|/,                           // Alternation: jpg|png
    /\^/,                           // Start anchor: ^config
    /\$$/,                          // End anchor: .yaml$
    /\+/,                           // One or more: .+
    /\\./,                          // Escaped dots: \.
    /\\\w/,                         // Other escape sequences: \d, \w, etc.
    /\..*\./,                       // Multiple dots (not just extension): a.b.c
    /\.\+/,                         // Dot plus: .+
    /\.\*/,                         // Dot star: .*
  ];

  // Special case: single dot at end might be file extension, not regex
  if (query.endsWith('.') && !query.includes('*') && !query.includes('+')) {
    return false;
  }

  return regexIndicators.some(pattern => pattern.test(query));
}

async function performIncrementalSearch() {
  const config = vscode.workspace.getConfiguration('everything-search');
  const searchDelay = config.get('incrementalSearchDelay', 300);
  const minSearchLength = config.get('minSearchLength', 2);
  const caseSensitive = config.get('caseSensitive', false);
  const maxResults = config.get('maxResults', 100);

  const quickPick = vscode.window.createQuickPick();
  quickPick.placeholder = 'Type to search files...';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  let searchTimeout: NodeJS.Timeout | undefined;
  let currentController: AbortController | undefined;
  let isRegexMode = false;

  // Handle search input changes
  quickPick.onDidChangeValue(async (value) => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Cancel previous search
    if (currentController) {
      currentController.abort();
    }

    // Check minimum length
    if (value.length < minSearchLength) {
      quickPick.items = [];
      quickPick.busy = false;
      isRegexMode = false;
      quickPick.placeholder = 'Type to search files...';
      return;
    }

    // Detect if user is using regex patterns
    const shouldUseRegex = detectRegexPattern(value);
    console.log(`Pattern detection for "${value}": shouldUseRegex=${shouldUseRegex}, currentMode=${isRegexMode}`);
    
    if (shouldUseRegex !== isRegexMode) {
      isRegexMode = shouldUseRegex;
      quickPick.placeholder = isRegexMode 
        ? '🔍 Regex mode active - searching with pattern matching'
        : 'Type to search files...';
      console.log(`Regex mode changed to: ${isRegexMode}`);
    }

    // Show loading state
    quickPick.busy = true;

    // Debounce search
    searchTimeout = setTimeout(async () => {
      try {
        currentController = new AbortController();
        
        // Convert wildcards to regex if in regex mode
        const searchQuery = isRegexMode ? convertWildcardToRegex(value) : value;
        
        const searchOptions = {
          regex: isRegexMode,
          caseSensitive,
          maxResults,
          signal: currentController.signal
        };
        
        console.log(`Searching with originalQuery="${value}", convertedQuery="${searchQuery}", options:`, searchOptions);
        
        const results = await everythingService.search(searchQuery, searchOptions);

        console.log(`Search completed. Found ${results.length} results`);

        // Convert results to QuickPick items
        const items = results.map(result => ({
          label: result.name,
          description: result.path,
          detail: result.isDirectory ? 'Directory' : (isRegexMode ? 'File (regex match)' : 'File')
        }));

        // Add regex indicator to the first item if in regex mode
        if (items.length > 0 && isRegexMode) {
          items[0] = {
            ...items[0],
            detail: `🔍 ${items[0].detail} - Pattern: ${value} → ${searchQuery}`
          };
        }

        quickPick.items = items;
        quickPick.busy = false;

      } catch (error) {
        if (error instanceof Error && error.message !== 'Search cancelled') {
          console.error('Incremental search failed:', error);
          quickPick.items = [];
        }
        quickPick.busy = false;
      }
    }, searchDelay);
  });

  // Handle selection
  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0];
    if (selected && selected.description) {
      quickPick.hide();
      await openFile(selected.description);
    }
  });

  // Handle hide/dispose
  quickPick.onDidHide(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    if (currentController) {
      currentController.abort();
    }
    quickPick.dispose();
  });

  quickPick.show();
}

async function testEverythingConnection() {
  try {
    const isConnected = await everythingService.testConnection();
    if (!isConnected) {
      vscode.window.showWarningMessage(
        'Everything search is not available. Make sure Everything is running and es.exe is in your PATH.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'everything-search');
        }
      });
    }
  } catch (error) {
    console.error('Failed to test Everything connection:', error);
  }
}

export function deactivate() {
  // Cleanup if needed
}