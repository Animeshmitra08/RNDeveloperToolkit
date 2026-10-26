import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runExpoCommand } from './expoCommands';

// name, @scope/name, optionally followed by @version / @tag.
// Shell-sensitive characters (<, >, |, &, ;, quotes) are rejected.
const PACKAGE_SPEC =
  /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[\w.^~*-]+)?$/i;

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

function detectPackageManager(root: string): PackageManager {
  const has = (file: string) => fs.existsSync(path.join(root, file));

  if (has('bun.lockb') || has('bun.lock')) {
    return 'bun';
  }

  if (has('pnpm-lock.yaml')) {
    return 'pnpm';
  }

  if (has('yarn.lock')) {
    return 'yarn';
  }

  return 'npm';
}

function isExpoProject(root: string): boolean {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    );

    return Boolean(
      packageJson.dependencies?.expo ?? packageJson.devDependencies?.expo
    );
  } catch {
    return false;
  }
}

export async function installPackage(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    vscode.window.showWarningMessage(
      'Open a React Native or Expo project first.'
    );
    return;
  }

  const input = await vscode.window.showInputBox({
    prompt: 'Package name(s) to install, separated by spaces',
    placeHolder: 'react-native-reanimated @react-navigation/native',
    validateInput: (value) => {
      const names = value.trim().split(/\s+/).filter(Boolean);

      if (!names.length) {
        return 'Enter at least one package name.';
      }

      const invalid = names.find((name) => !PACKAGE_SPEC.test(name));

      return invalid ? `Invalid package name: ${invalid}` : undefined;
    },
  });

  if (!input) {
    return;
  }

  const packages = input.trim().split(/\s+/).join(' ');

  const type = await vscode.window.showQuickPick(
    [
      { label: 'Dependency', dev: false },
      { label: 'Dev Dependency', description: '-D', dev: true },
    ],
    { placeHolder: 'Install as' }
  );

  if (!type) {
    return;
  }

  const root = workspace.uri.fsPath;
  const devFlag = type.dev ? ' -D' : '';
  let command: string;

  if (isExpoProject(root)) {
    // expo install picks versions compatible with the project's SDK
    // and forwards anything after `--` to the package manager.
    command = `npx expo install ${packages}${type.dev ? ' -- -D' : ''}`;
  } else {
    const manager = detectPackageManager(root);
    const verb = manager === 'npm' ? 'install' : 'add';
    command = `${manager} ${verb} ${packages}${devFlag}`;
  }

  runExpoCommand(command, 'Packages');
}
