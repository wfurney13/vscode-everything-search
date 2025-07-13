import * as vscode from 'vscode';
import { EverythingService, SearchResult } from './everything-service';

let everythingService: EverythingService;

export function activate(context: vscode.ExtensionContext) {
  everythingService = new EverythingService();

  // Register search command
  const searchCommand = vscode.commands.registerCommand('everything-search.search', async () => {
    await performSearch(false);
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
      // Open folder in Explorer
      await vscode.commands.executeCommand('revealFileInOS', uri);
    } else {
      // Open file in editor
      await vscode.window.showTextDocument(uri);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
  }
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