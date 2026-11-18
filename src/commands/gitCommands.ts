import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { runExpoCommand } from './expoCommands';

const GIT_TERMINAL = 'Git';

const execFileAsync = promisify(execFile);

const BRANCH_NAME = /^(?!-)(?!.*\.\.)[\w./-]+$/;
const BRANCH_NAME_HINT =
  'Use letters, numbers, dots, dashes, underscores or slashes.';

type RepoState = 'repo' | 'not-repo' | 'no-git';

interface BranchQuickPickItem extends vscode.QuickPickItem {
  args: string;
}

interface FileQuickPickItem extends vscode.QuickPickItem {
  file: string;
}

const FILE_STATUS: Record<string, string> = {
  M: 'modified',
  T: 'type changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  U: 'conflict',
  '?': 'untracked',
};

function runGit(args: string): void {
  runExpoCommand(`git ${args}`, GIT_TERMINAL);
}

// Runs git directly (no shell) to read repository state for pickers.
async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root });
  return stdout.trim();
}

// Quote a value for the terminal's shell so commit messages with
// apostrophes, $ or ! reach git unchanged.
function quoteArg(value: string): string {
  // Embedded double quotes and trailing backslashes reach native
  // programs differently across shells (notably Windows PowerShell
  // 5.1, where a trailing \ escapes its closing quote); avoid them.
  const safe = value.replace(/"/g, "'").replace(/\\+$/, '');
  const shell = path.basename(vscode.env.shell).toLowerCase();

  if (shell.startsWith('cmd')) {
    return `"${safe}"`;
  }

  if (shell.startsWith('pwsh') || shell.startsWith('powershell')) {
    // PowerShell also treats typographic single quotes as quotes.
    return `'${safe.replace(/['‘-‛]/g, '$&$&')}'`;
  }

  return `'${safe.replace(/'/g, `'\\''`)}'`;
}

function getWorkspaceRoot(): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!root) {
    vscode.window.showWarningMessage(
      'Open a React Native or Expo project first.'
    );
  }

  return root;
}

async function getRepoState(root: string): Promise<RepoState> {
  try {
    await git(root, ['rev-parse', '--is-inside-work-tree']);
    return 'repo';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      vscode.window.showErrorMessage(
        'Git was not found. Install Git and make sure it is on your PATH.'
      );
      return 'no-git';
    }

    return 'not-repo';
  }
}

async function ensureGitRepo(): Promise<string | undefined> {
  const root = getWorkspaceRoot();

  if (!root) {
    return undefined;
  }

  const state = await getRepoState(root);

  if (state === 'repo') {
    return root;
  }

  if (state === 'not-repo') {
    const choice = await vscode.window.showWarningMessage(
      'This workspace is not a Git repository. Initialize one?',
      'Initialize Repository'
    );

    if (choice) {
      runGit('init');
    }
  }

  return undefined;
}

// `git add -A` in a project without node_modules in .gitignore would
// commit thousands of dependency files, so confirm first.
async function confirmStageAll(
  root: string,
  isRepo = true
): Promise<boolean> {
  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    return true;
  }

  let ignored: boolean;

  if (isRepo) {
    try {
      await git(root, ['check-ignore', '-q', 'node_modules']);
      ignored = true;
    } catch {
      ignored = false;
    }
  } else {
    try {
      ignored = /^\/?node_modules\/?\s*$/m.test(
        fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
      );
    } catch {
      ignored = false;
    }
  }

  if (ignored) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    'node_modules is not in .gitignore, so staging all changes would add it to Git. Stage everything anyway?',
    { modal: true },
    'Stage Anyway'
  );

  return Boolean(choice);
}

async function askCommitMessage(
  value?: string
): Promise<string | undefined> {
  const message = await vscode.window.showInputBox({
    prompt: 'Commit message',
    placeHolder: 'Fix login screen crash',
    value,
    validateInput: (input) =>
      input.trim() ? undefined : 'Enter a commit message.',
  });

  return message?.trim() || undefined;
}

async function listUnstagedFiles(
  root: string
): Promise<FileQuickPickItem[]> {
  // Not trimmed: the first entry may start with a space (" M file").
  const { stdout } = await execFileAsync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: root, maxBuffer: 10 * 1024 * 1024 }
  );

  const entries = stdout.split('\0');
  const items: FileQuickPickItem[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.length < 4) {
      continue;
    }

    const [index, worktree] = entry;
    const file = entry.slice(3);

    // Renames and copies are followed by an entry with the old path.
    if (index === 'R' || index === 'C') {
      i++;
    }

    // Already fully staged; nothing left to add.
    if (worktree === ' ') {
      continue;
    }

    const code =
      index === 'U' || worktree === 'U' ? 'U' : worktree;

    items.push({
      label: file,
      description: FILE_STATUS[code] ?? code,
      file,
    });
  }

  return items;
}

async function runGitInRepo(args: string): Promise<void> {
  if (await ensureGitRepo()) {
    runGit(args);
  }
}

async function hasUpstream(root: string): Promise<boolean> {
  try {
    await git(root, ['rev-parse', '--abbrev-ref', '@{u}']);
    return true;
  } catch {
    return false;
  }
}

export function gitStatus(): Promise<void> {
  return runGitInRepo('status');
}

export function gitPull(): Promise<void> {
  return runGitInRepo('pull');
}

export function gitFetch(): Promise<void> {
  return runGitInRepo('fetch --all --prune');
}

export function gitStash(): Promise<void> {
  return runGitInRepo('stash push --include-untracked');
}

export function gitStashPop(): Promise<void> {
  return runGitInRepo('stash pop');
}

export function gitLog(): Promise<void> {
  // Skip the pager so the terminal stays usable for the next command.
  return runGitInRepo('--no-pager log --oneline --graph --decorate -n 20');
}

export async function gitAddAll(): Promise<void> {
  const root = await ensureGitRepo();

  if (root && (await confirmStageAll(root))) {
    runGit('add -A');
  }
}

export async function gitAddFiles(): Promise<void> {
  const root = await ensureGitRepo();

  if (!root) {
    return;
  }

  let items: FileQuickPickItem[];

  try {
    items = await listUnstagedFiles(root);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Could not list changed files: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  if (!items.length) {
    vscode.window.showInformationMessage('No unstaged changes to add.');
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Git Add',
    placeHolder: 'Select files to stage',
    canPickMany: true,
    matchOnDescription: true,
  });

  if (!picked?.length) {
    return;
  }

  // `--` stops a file named like an option from being read as one.
  runGit(`add -- ${picked.map((item) => quoteArg(item.file)).join(' ')}`);
}

export async function gitCommit(): Promise<void> {
  const root = await ensureGitRepo();

  if (!root) {
    return;
  }

  const mode = await vscode.window.showQuickPick(
    [
      {
        label: 'Stage all & commit',
        description: 'git add -A, including new files',
        stageAll: true,
      },
      {
        label: 'Commit staged only',
        description: 'Commit what is already staged',
        stageAll: false,
      },
    ],
    { placeHolder: 'What should be committed?' }
  );

  if (!mode) {
    return;
  }

  if (mode.stageAll && !(await confirmStageAll(root))) {
    return;
  }

  const message = await askCommitMessage();

  if (!message) {
    return;
  }

  if (mode.stageAll) {
    runGit('add -A');
  }

  runGit(`commit -m ${quoteArg(message)}`);
}

export async function gitPush(): Promise<void> {
  const root = await ensureGitRepo();

  if (!root) {
    return;
  }

  if (await hasUpstream(root)) {
    runGit('push');
    return;
  }

  // First push of a new branch: publish it and set the upstream.
  const remotes = (await git(root, ['remote']))
    .split('\n')
    .filter(Boolean);

  if (!remotes.length) {
    const choice = await vscode.window.showWarningMessage(
      'No Git remote is configured. Publish this project to a new repository?',
      'Publish to New Repository'
    );

    if (choice) {
      await gitPublishNewRepo();
    }

    return;
  }

  const remote = remotes.includes('origin') ? 'origin' : remotes[0];

  runGit(`push -u ${quoteArg(remote)} HEAD`);
}

// First-time setup for a repository just created on GitHub, GitLab etc.:
// init (if needed), add, commit, name the branch, add origin and push.
export async function gitPublishNewRepo(): Promise<void> {
  const root = getWorkspaceRoot();

  if (!root) {
    return;
  }

  const state = await getRepoState(root);

  if (state === 'no-git') {
    return;
  }

  const isRepo = state === 'repo';
  let current = '';
  let originUrl: string | undefined;
  let hasChanges = true;

  if (isRepo) {
    const [branch, remotes, status] = await Promise.all([
      git(root, ['branch', '--show-current']),
      git(root, ['remote']),
      git(root, ['status', '--porcelain']),
    ]);

    current = branch;
    hasChanges = status !== '';

    if (remotes.split('\n').includes('origin')) {
      originUrl = await git(root, ['remote', 'get-url', 'origin']);
    }
  }

  const url = (
    await vscode.window.showInputBox({
      title: 'Publish to New Repository',
      prompt:
        'URL of the empty repository you created (GitHub, GitLab, Bitbucket...)',
      placeHolder: 'https://github.com/your-name/my-app.git',
      value: originUrl,
      ignoreFocusOut: true,
      validateInput: (value) =>
        /^(https?:\/\/|ssh:\/\/|git@)[^\s"'`$]+$/.test(value.trim())
          ? undefined
          : 'Enter an HTTPS or SSH repository URL.',
    })
  )?.trim();

  if (!url) {
    return;
  }

  if (originUrl && originUrl !== url) {
    const choice = await vscode.window.showWarningMessage(
      `origin already points to ${originUrl}. Replace it with ${url}?`,
      { modal: true },
      'Replace origin'
    );

    if (!choice) {
      return;
    }
  }

  const branch = await vscode.window.showInputBox({
    title: 'Publish to New Repository',
    prompt: 'Branch to push',
    value: current || 'main',
    validateInput: (value) =>
      BRANCH_NAME.test(value) ? undefined : BRANCH_NAME_HINT,
  });

  if (!branch) {
    return;
  }

  let message: string | undefined;

  if (hasChanges) {
    if (!(await confirmStageAll(root, isRepo))) {
      return;
    }

    message = await askCommitMessage('Initial commit');

    if (!message) {
      return;
    }
  }

  if (!isRepo) {
    runGit('init');
  }

  if (message) {
    runGit('add -A');
    runGit(`commit -m ${quoteArg(message)}`);
  }

  if (branch !== current) {
    runGit(`branch -M ${quoteArg(branch)}`);
  }

  if (originUrl === undefined) {
    runGit(`remote add origin ${quoteArg(url)}`);
  } else if (originUrl !== url) {
    runGit(`remote set-url origin ${quoteArg(url)}`);
  }

  runGit(`push -u origin ${quoteArg(branch)}`);
}

export async function gitNewBranch(): Promise<void> {
  if (!(await ensureGitRepo())) {
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'New branch name',
    placeHolder: 'feature/login-screen',
    validateInput: (value) =>
      BRANCH_NAME.test(value) ? undefined : BRANCH_NAME_HINT,
  });

  if (!name) {
    return;
  }

  runGit(`switch -c ${quoteArg(name)}`);
}

export async function gitSwitchBranch(): Promise<void> {
  const root = await ensureGitRepo();

  if (!root) {
    return;
  }

  let refs: string;
  let current: string;

  try {
    [refs, current] = await Promise.all([
      git(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/heads',
        'refs/remotes',
      ]),
      git(root, ['branch', '--show-current']),
    ]);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Could not list branches: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  const local: string[] = [];
  const remote: string[] = [];

  for (const ref of refs.split('\n')) {
    if (ref.startsWith('refs/heads/')) {
      local.push(ref.slice('refs/heads/'.length));
    } else if (ref.startsWith('refs/remotes/') && !ref.endsWith('/HEAD')) {
      remote.push(ref.slice('refs/remotes/'.length));
    }
  }

  const items: BranchQuickPickItem[] = [
    ...local
      .filter((branch) => branch !== current)
      .map((branch) => ({
        label: `$(git-branch) ${branch}`,
        args: `switch ${quoteArg(branch)}`,
      })),
    // Remote branches that don't have a local branch yet.
    ...remote
      .filter((ref) => !local.includes(ref.slice(ref.indexOf('/') + 1)))
      .map((ref) => ({
        label: `$(cloud) ${ref}`,
        description: 'remote',
        args: `switch --track ${quoteArg(ref)}`,
      })),
  ];

  if (!items.length) {
    vscode.window.showInformationMessage(
      'No other branches found. Try Fetch to load remote branches.'
    );
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: current
      ? `On ${current}. Select a branch to switch to`
      : 'Select a branch to switch to',
    matchOnDescription: true,
  });

  if (picked) {
    runGit(picked.args);
  }
}

export function registerGitCommands(
  context: vscode.ExtensionContext
): void {
  const commands: [string, () => unknown][] = [
    ['rn-developer-toolkit.gitStatus', gitStatus],
    ['rn-developer-toolkit.gitAddAll', gitAddAll],
    ['rn-developer-toolkit.gitAddFiles', gitAddFiles],
    ['rn-developer-toolkit.gitCommit', gitCommit],
    ['rn-developer-toolkit.gitPush', gitPush],
    ['rn-developer-toolkit.gitPublishNewRepo', gitPublishNewRepo],
    ['rn-developer-toolkit.gitPull', gitPull],
    ['rn-developer-toolkit.gitFetch', gitFetch],
    ['rn-developer-toolkit.gitSwitchBranch', gitSwitchBranch],
    ['rn-developer-toolkit.gitNewBranch', gitNewBranch],
    ['rn-developer-toolkit.gitStash', gitStash],
    ['rn-developer-toolkit.gitStashPop', gitStashPop],
    ['rn-developer-toolkit.gitLog', gitLog],
  ];

  context.subscriptions.push(
    ...commands.map(([id, handler]) =>
      vscode.commands.registerCommand(id, handler)
    )
  );
}
