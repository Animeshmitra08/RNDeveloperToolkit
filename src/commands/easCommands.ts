import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runExpoCommand } from './expoCommands';

const EAS_TERMINAL = 'EAS';

type Platform = 'android' | 'ios' | 'all';
type EasJsonSection = 'build' | 'submit';

function runEas(args: string): void {
  // npx uses a locally installed eas-cli if present,
  // otherwise downloads it, so a global install isn't required.
  runExpoCommand(`npx eas-cli ${args}`, EAS_TERMINAL);
}

function getEasJsonPath(): string | undefined {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  return workspace
    ? path.join(workspace.uri.fsPath, 'eas.json')
    : undefined;
}

function readEasProfiles(section: EasJsonSection): string[] {
  const easJsonPath = getEasJsonPath();

  if (!easJsonPath || !fs.existsSync(easJsonPath)) {
    return [];
  }

  try {
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    return Object.keys(easJson[section] ?? {});
  } catch {
    return [];
  }
}

async function ensureEasConfig(): Promise<boolean> {
  const easJsonPath = getEasJsonPath();

  if (easJsonPath && fs.existsSync(easJsonPath)) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    'eas.json was not found. Configure EAS Build for this project first?',
    'Configure EAS Build'
  );

  if (choice) {
    runEas('build:configure');
  }

  return false;
}

async function pickPlatform(): Promise<Platform | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Android', value: 'android' as const },
      { label: 'iOS', value: 'ios' as const },
      { label: 'All', description: 'Android + iOS', value: 'all' as const },
    ],
    { placeHolder: 'Select platform' }
  );

  return picked?.value;
}

async function pickProfile(
  section: EasJsonSection,
  fallback: string[]
): Promise<string | undefined> {
  const profiles = readEasProfiles(section);

  return vscode.window.showQuickPick(
    profiles.length ? profiles : fallback,
    { placeHolder: `Select ${section} profile (from eas.json)` }
  );
}

export function easLogin(): void {
  runEas('login');
}

export function easLogout(): void {
  runEas('logout');
}

export function easWhoAmI(): void {
  runEas('whoami');
}

export function easInit(): void {
  runEas('init');
}

export function easBuildConfigure(): void {
  runEas('build:configure');
}

export async function easBuild(autoSubmit = false): Promise<void> {
  if (!(await ensureEasConfig())) {
    return;
  }

  const platform = await pickPlatform();

  if (!platform) {
    return;
  }

  const profile = await pickProfile('build', [
    'development',
    'preview',
    'production',
  ]);

  if (!profile) {
    return;
  }

  runEas(
    `build --platform ${platform} --profile ${profile}${
      autoSubmit ? ' --auto-submit' : ''
    }`
  );
}

export async function easSubmit(): Promise<void> {
  if (!(await ensureEasConfig())) {
    return;
  }

  const platform = await pickPlatform();

  if (!platform) {
    return;
  }

  const profile = await pickProfile('submit', ['production']);

  if (!profile) {
    return;
  }

  const source = await vscode.window.showQuickPick(
    [
      {
        label: 'Latest build',
        description: 'Submit the most recent EAS build',
        flag: ' --latest',
      },
      {
        label: 'Choose build',
        description: 'Pick a build interactively in the terminal',
        flag: '',
      },
    ],
    { placeHolder: 'Which build should be submitted?' }
  );

  if (!source) {
    return;
  }

  runEas(
    `submit --platform ${platform} --profile ${profile}${source.flag}`
  );
}

export async function easUpdate(): Promise<void> {
  const branch = await vscode.window.showInputBox({
    prompt: 'EAS Update branch',
    value: 'production',
    validateInput: (value) =>
      /^[\w.-]+$/.test(value)
        ? undefined
        : 'Use letters, numbers, dots, dashes or underscores.',
  });

  if (!branch) {
    return;
  }

  const message = await vscode.window.showInputBox({
    prompt: 'Update message',
    placeHolder: 'Fix login screen crash',
  });

  if (message === undefined) {
    return;
  }

  // Double quotes are escaped differently across shells; avoid them.
  const safeMessage = message.replace(/"/g, "'").trim();

  runEas(
    `update --branch ${branch}${
      safeMessage ? ` --message "${safeMessage}"` : ' --auto'
    }`
  );
}

export function easBuildList(): void {
  runEas('build:list --limit 10');
}

export function easCredentials(): void {
  runEas('credentials');
}

export function registerEasCommands(
  context: vscode.ExtensionContext
): void {
  const commands: [string, () => unknown][] = [
    ['rn-developer-toolkit.easLogin', easLogin],
    ['rn-developer-toolkit.easLogout', easLogout],
    ['rn-developer-toolkit.easWhoAmI', easWhoAmI],
    ['rn-developer-toolkit.easInit', easInit],
    ['rn-developer-toolkit.easBuildConfigure', easBuildConfigure],
    ['rn-developer-toolkit.easBuild', () => easBuild()],
    ['rn-developer-toolkit.easBuildAndSubmit', () => easBuild(true)],
    ['rn-developer-toolkit.easSubmit', easSubmit],
    ['rn-developer-toolkit.easUpdate', easUpdate],
    ['rn-developer-toolkit.easBuildList', easBuildList],
    ['rn-developer-toolkit.easCredentials', easCredentials],
  ];

  context.subscriptions.push(
    ...commands.map(([id, handler]) =>
      vscode.commands.registerCommand(id, handler)
    )
  );
}
