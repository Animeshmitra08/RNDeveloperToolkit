import * as vscode from 'vscode';

// One terminal per name, so long-running processes (e.g. Metro)
// don't receive commands meant for another tool (e.g. EAS).
const terminals = new Map<string, vscode.Terminal>();

export function runExpoCommand(
  command: string,
  terminalName = 'RN Toolkit'
): void {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    vscode.window.showWarningMessage(
      'Open a React Native or Expo project first.'
    );
    return;
  }

  let terminal = terminals.get(terminalName);

  if (!terminal || terminal.exitStatus !== undefined) {
    terminal = vscode.window.createTerminal({
      name: terminalName,
      cwd: workspace.uri.fsPath,
    });
    terminals.set(terminalName, terminal);
  }

  terminal.show();
  terminal.sendText(command);
}
