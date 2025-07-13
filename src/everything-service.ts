import { spawn } from 'child_process';
import * as vscode from 'vscode';

export interface SearchOptions {
  regex?: boolean;
  caseSensitive?: boolean;
  wholePath?: boolean;
  maxResults?: number;
}

export interface SearchResult {
  path: string;
  name: string;
  isDirectory: boolean;
}

export class EverythingService {
  private executablePath: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('everything-search');
    this.executablePath = config.get('executablePath', 'es.exe');
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(query, options);
      
      const process = spawn(this.executablePath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Everything search failed: ${stderr}`));
          return;
        }

        try {
          const results = this.parseResults(stdout);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start Everything search: ${error.message}`));
      });
    });
  }

  private buildArgs(query: string, options: SearchOptions): string[] {
    const args: string[] = [];

    // Add search options
    if (options.regex) {
      args.push('-r');
    }
    
    if (options.caseSensitive) {
      args.push('-i');
    }
    
    if (options.wholePath) {
      args.push('-p');
    }

    // Limit results for performance
    const maxResults = options.maxResults || 100;
    args.push('-n', maxResults.toString());

    // Add the search query
    args.push(query);

    return args;
  }

  private parseResults(output: string): SearchResult[] {
    const lines = output.trim().split('\n');
    const results: SearchResult[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const path = line.trim();
      const parts = path.split('\\');
      const name = parts[parts.length - 1];
      
      // Simple heuristic to detect directories (no extension)
      const isDirectory = !name.includes('.') || path.endsWith('\\');

      results.push({
        path,
        name,
        isDirectory
      });
    }

    return results;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.search('', { maxResults: 1 });
      return true;
    } catch {
      return false;
    }
  }
}