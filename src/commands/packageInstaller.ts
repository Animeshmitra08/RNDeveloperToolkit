
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runExpoCommand } from './expoCommands';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

interface NpmSearchPackage {
  name: string;
  version?: string;
  description?: string;
  license?: string;
  links?: {
    npm?: string;
    repository?: string;
    homepage?: string;
  };
}

interface NpmSearchResult {
  package: NpmSearchPackage;
  downloads?: {
    monthly?: number;
    weekly?: number;
  };
}

interface NpmSearchResponse {
  objects?: NpmSearchResult[];
  total?: number;
}

interface PackageQuickPickItem extends vscode.QuickPickItem {
  packageName: string;
}

function detectPackageManager(root: string): PackageManager {
  const has = (file: string) => fs.existsSync(path.join(root, file));

  if (has('bun.lock') || has('bun.lockb')) {
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
      packageJson.dependencies?.expo ??
      packageJson.devDependencies?.expo
    );
  } catch {
    return false;
  }
}

// Only package names are installed; arbitrary shell arguments are not accepted.
function isValidPackageName(name: string): boolean {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name);
}

function formatDownloads(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'Monthly downloads unavailable';
  }

  return `${new Intl.NumberFormat().format(value)} downloads/month`;
}

async function searchNpmPackages(
  query: string,
  signal: AbortSignal
): Promise<NpmSearchResponse> {
  const params = new URLSearchParams({
    text: query,
    size: '30',
    from: '0',
  });

  const response = await fetch(
    `https://registry.npmjs.org/-/v1/search?${params.toString()}`,
    {
      signal,
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`npm Registry returned HTTP ${response.status}.`);
  }

  return (await response.json()) as NpmSearchResponse;
}

async function selectPackages(): Promise<PackageQuickPickItem[] | undefined> {
  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<PackageQuickPickItem>();

    picker.title = 'Search npm Packages';
    picker.placeholder =
      'Search packages: animation, camera, maps, navigation...';
    picker.matchOnDescription = true;
    picker.matchOnDetail = true;
    picker.canSelectMany = true;
    picker.ignoreFocusOut = true;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;
    let requestId = 0;
    let finished = false;

    const finish = (
      selection: PackageQuickPickItem[] | undefined
    ) => {
      if (finished) {
        return;
      }

      finished = true;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      activeController?.abort();
      picker.dispose();
      resolve(selection);
    };

    // Replacing items clears the selection, so keep checked packages
    // pinned at the top across searches.
    const setItems = (items: PackageQuickPickItem[]) => {
      const selected = picker.selectedItems.filter(
        (item) => Boolean(item.packageName)
      );
      const selectedNames = new Set(
        selected.map((item) => item.packageName)
      );

      picker.items = [
        ...selected,
        ...items.filter((item) => !selectedNames.has(item.packageName)),
      ];
      picker.selectedItems = selected;
    };

    picker.items = [];
    picker.busy = false;

    picker.onDidChangeValue((value) => {
      const query = value.trim();
      const currentRequestId = ++requestId;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      activeController?.abort();

      if (query.length < 2) {
        setItems([]);
        picker.busy = false;
        picker.placeholder = 'Enter at least 2 characters to search npm';
        return;
      }

      picker.placeholder = 'Searching npm Registry...';
      picker.busy = true;

      debounceTimer = setTimeout(async () => {
        const controller = new AbortController();
        activeController = controller;

        try {
          const result = await searchNpmPackages(query, controller.signal);

          // Ignore stale responses from earlier searches.
          if (
            finished ||
            currentRequestId !== requestId ||
            controller.signal.aborted
          ) {
            return;
          }

          const items: PackageQuickPickItem[] = (result.objects ?? [])
            .filter((item) => isValidPackageName(item.package.name))
            .map((item) => {
              const pkg = item.package;
              const monthlyDownloads = item.downloads?.monthly;

              const metadata = [
                pkg.version ? `v${pkg.version}` : undefined,
                formatDownloads(monthlyDownloads),
                pkg.license ? `License: ${pkg.license}` : undefined,
              ].filter(Boolean);

              return {
                label: `$(package) ${pkg.name}`,
                description: metadata.join(' · '),
                detail: pkg.description || 'No description provided.',
                packageName: pkg.name,
                // npm already ranked these; don't let the QuickPick's
                // fuzzy filter hide results whose name lacks the query.
                alwaysShow: true,
              };
            });

          picker.placeholder =
            result.total === 0
              ? 'No packages found. Try another search.'
              : 'Select one or more packages, then press Enter';

          setItems(
            items.length > 0
              ? items
              : [
                  {
                    label: 'No matching packages',
                    description: 'Try a different search term.',
                    packageName: '',
                    alwaysShow: true,
                  },
                ]
          );
        } catch (error) {
          if (
            finished ||
            currentRequestId !== requestId ||
            controller.signal.aborted
          ) {
            return;
          }

          setItems([
            {
              label: '$(error) Package search failed',
              description:
                error instanceof Error
                  ? error.message
                  : 'Unable to reach the npm Registry.',
              packageName: '',
              alwaysShow: true,
            },
          ]);
        } finally {
          if (!finished && currentRequestId === requestId) {
            picker.busy = false;
          }
        }
      }, 350);
    });

    picker.onDidAccept(() => {
      const selected = picker.selectedItems.filter(
        (item) => Boolean(item.packageName)
      );

      if (selected.length === 0) {
        vscode.window.showWarningMessage(
          'Select at least one package from the search results.'
        );
        return;
      }

      finish(selected);
    });

    picker.onDidHide(() => finish(undefined));

    picker.show();
  });
}

export async function installPackage(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    vscode.window.showWarningMessage(
      'Open a React Native or Expo project first.'
    );
    return;
  }

  const selectedPackages = await selectPackages();

  if (!selectedPackages?.length) {
    return;
  }

  const packages = [
    ...new Set(selectedPackages.map((item) => item.packageName)),
  ];

  // Validate the package names again before building a terminal command.
  const invalid = packages.find((name) => !isValidPackageName(name));

  if (invalid) {
    vscode.window.showErrorMessage(`Invalid package name: ${invalid}`);
    return;
  }

  const type = await vscode.window.showQuickPick(
    [
      {
        label: 'Dependency',
        description: 'Install for application/runtime use',
        dev: false,
      },
      {
        label: 'Dev Dependency',
        description: 'Install for development/build tooling',
        dev: true,
      },
    ],
    {
      title: 'Install Selected Packages',
      placeHolder: 'Choose dependency type',
    }
  );

  if (!type) {
    return;
  }

  const root = workspace.uri.fsPath;
  const packageList = packages.join(' ');
  const devFlag = type.dev ? ' -D' : '';

  let command: string;

  if (isExpoProject(root)) {
    // Keep Expo SDK-compatible package resolution.
    command = `npx expo install ${packageList}${
      type.dev ? ' -- -D' : ''
    }`;
  } else {
    const manager = detectPackageManager(root);
    const verb = manager === 'npm' ? 'install' : 'add';

    command = `${manager} ${verb} ${packageList}${devFlag}`;
  }

  runExpoCommand(command, 'Packages');
}