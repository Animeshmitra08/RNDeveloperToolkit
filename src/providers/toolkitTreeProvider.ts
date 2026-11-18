
import * as vscode from 'vscode';

type ToolkitNode = {
  label: string;
  description?: string;
  command?: string;
  collapsible?: boolean;
  icon?: string;
};

export class ToolkitTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();

  readonly onDidChangeTreeData =
    this.onDidChangeTreeDataEmitter.event;

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: vscode.TreeItem
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    if (!vscode.workspace.workspaceFolders?.length) {
      if (!element) {
        return [
          new vscode.TreeItem(
            'Open a project to get started',
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      return [];
    }

    if (!element) {
      return [
        this.createNode({
          label: 'Project Overview',
          collapsible: true,
          icon: 'info',
        }),
        this.createNode({
          label: 'Generators',
          collapsible: true,
          icon: 'file-code',
        }),
        this.createNode({
          label: 'Expo Commands',
          collapsible: true,
          icon: 'terminal',
        }),
        this.createNode({
          label: 'Packages',
          collapsible: true,
          icon: 'package',
        }),
        this.createNode({
          label: 'EAS Build & Deploy',
          collapsible: true,
          icon: 'cloud',
        }),
        this.createNode({
          label: 'Git',
          collapsible: true,
          icon: 'source-control',
        }),
        this.createNode({
          label: 'Project Doctor',
          collapsible: true,
          icon: 'checklist',
        }),
      ];
    }

    switch (element.label) {
      case 'Project Overview':
        return this.getProjectOverview();

      case 'Generators':
        return [
          this.createNode({
            label: 'Create Component',
            description: 'TSX + styles',
            command: 'rn-developer-toolkit.createComponent',
            icon: 'file-code',
          }),
          this.createNode({
            label: 'Create Screen',
            description: 'Coming soon',
            command: 'rn-developer-toolkit.generatorComingSoon',
            icon: 'layout',
          }),
          this.createNode({
            label: 'Create Hook',
            description: 'Coming soon',
            command: 'rn-developer-toolkit.generatorComingSoon',
            icon: 'symbol-function',
          }),
          this.createNode({
            label: 'Create Service',
            description: 'Coming soon',
            command: 'rn-developer-toolkit.generatorComingSoon',
            icon: 'plug',
          }),
        ];

      case 'Expo Commands':
        return [
          this.createNode({
            label: 'Start Expo',
            command: 'rn-developer-toolkit.expoStart',
            icon: 'play',
          }),
          this.createNode({
            label: 'Run Android',
            command: 'rn-developer-toolkit.expoAndroid',
            icon: 'device-mobile',
          }),
          this.createNode({
            label: 'Run iOS',
            command: 'rn-developer-toolkit.expoIOS',
            icon: 'device-mobile',
          }),
          this.createNode({
            label: 'Start with Clear Cache',
            command: 'rn-developer-toolkit.expoClearCache',
            icon: 'refresh',
          }),
          this.createNode({
            label: 'Expo Doctor',
            description: 'expo-doctor',
            command: 'rn-developer-toolkit.expoDoctor',
            icon: 'pulse',
          }),
          this.createNode({
            label: 'Fix Dependencies',
            description: 'expo install --fix',
            command: 'rn-developer-toolkit.expoFixDependencies',
            icon: 'tools',
          }),
          this.createNode({
            label: 'Prebuild (Clean)',
            description: 'regenerates native folders',
            command: 'rn-developer-toolkit.expoPrebuildClean',
            icon: 'sync',
          }),
        ];

      case 'Packages':
        return [
          this.createNode({
            label: 'Search & Install Package',
            description: 'search npm',
            command: 'rn-developer-toolkit.installPackage',
            icon: 'add',
          }),
        ];

      case 'EAS Build & Deploy':
        return [
          this.createNode({
            label: 'Login',
            command: 'rn-developer-toolkit.easLogin',
            icon: 'sign-in',
          }),
          this.createNode({
            label: 'Who Am I',
            command: 'rn-developer-toolkit.easWhoAmI',
            icon: 'account',
          }),
          this.createNode({
            label: 'Logout',
            command: 'rn-developer-toolkit.easLogout',
            icon: 'sign-out',
          }),
          this.createNode({
            label: 'Init Project',
            description: 'link to EAS',
            command: 'rn-developer-toolkit.easInit',
            icon: 'link',
          }),
          this.createNode({
            label: 'Configure Build',
            description: 'creates eas.json',
            command: 'rn-developer-toolkit.easBuildConfigure',
            icon: 'gear',
          }),
          this.createNode({
            label: 'Build',
            command: 'rn-developer-toolkit.easBuild',
            icon: 'package',
          }),
          this.createNode({
            label: 'Build & Submit',
            description: '--auto-submit',
            command: 'rn-developer-toolkit.easBuildAndSubmit',
            icon: 'rocket',
          }),
          this.createNode({
            label: 'Submit to Store',
            command: 'rn-developer-toolkit.easSubmit',
            icon: 'cloud-upload',
          }),
          this.createNode({
            label: 'Publish OTA Update',
            command: 'rn-developer-toolkit.easUpdate',
            icon: 'zap',
          }),
          this.createNode({
            label: 'Recent Builds',
            command: 'rn-developer-toolkit.easBuildList',
            icon: 'history',
          }),
          this.createNode({
            label: 'Manage Credentials',
            command: 'rn-developer-toolkit.easCredentials',
            icon: 'key',
          }),
        ];

      case 'Git':
        return [
          this.createNode({
            label: 'Status',
            command: 'rn-developer-toolkit.gitStatus',
            icon: 'git-compare',
          }),
          this.createNode({
            label: 'Add All',
            description: 'git add -A',
            command: 'rn-developer-toolkit.gitAddAll',
            icon: 'add',
          }),
          this.createNode({
            label: 'Add Files...',
            description: 'pick files to stage',
            command: 'rn-developer-toolkit.gitAddFiles',
            icon: 'diff-added',
          }),
          this.createNode({
            label: 'Commit',
            command: 'rn-developer-toolkit.gitCommit',
            icon: 'git-commit',
          }),
          this.createNode({
            label: 'Push',
            description: 'publishes new branches',
            command: 'rn-developer-toolkit.gitPush',
            icon: 'repo-push',
          }),
          this.createNode({
            label: 'Publish to New Repository',
            description: 'init, commit, add origin, push',
            command: 'rn-developer-toolkit.gitPublishNewRepo',
            icon: 'cloud-upload',
          }),
          this.createNode({
            label: 'Pull',
            command: 'rn-developer-toolkit.gitPull',
            icon: 'repo-pull',
          }),
          this.createNode({
            label: 'Fetch',
            description: '--all --prune',
            command: 'rn-developer-toolkit.gitFetch',
            icon: 'git-fetch',
          }),
          this.createNode({
            label: 'Switch Branch',
            command: 'rn-developer-toolkit.gitSwitchBranch',
            icon: 'git-branch',
          }),
          this.createNode({
            label: 'New Branch',
            command: 'rn-developer-toolkit.gitNewBranch',
            icon: 'git-branch-create',
          }),
          this.createNode({
            label: 'Stash Changes',
            description: 'includes untracked',
            command: 'rn-developer-toolkit.gitStash',
            icon: 'git-stash',
          }),
          this.createNode({
            label: 'Pop Stash',
            command: 'rn-developer-toolkit.gitStashPop',
            icon: 'git-stash-pop',
          }),
          this.createNode({
            label: 'Recent Commits',
            description: 'last 20',
            command: 'rn-developer-toolkit.gitLog',
            icon: 'history',
          }),
        ];

      case 'Project Doctor':
        return [
          this.createNode({
            label: 'Run Project Checks',
            command: 'rn-developer-toolkit.runDoctor',
            icon: 'checklist',
          }),
        ];

      default:
        return [];
    }
  }

  private createNode(node: ToolkitNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      node.label,
      node.collapsible
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    item.description = node.description;
    item.iconPath = node.icon
      ? new vscode.ThemeIcon(node.icon)
      : undefined;

    if (node.command) {
      item.command = {
        command: node.command,
        title: node.label,
      };
    }

    return item;
  }

  private getProjectOverview(): vscode.TreeItem[] {
    const workspace = vscode.workspace.workspaceFolders?.[0];

    if (!workspace) {
      return [];
    }

    // const packageJsonPath = vscode.Uri.joinPath(
    //   workspace.uri,
    //   'package.json'
    // );

    // Use the filesystem-backed workspace API to support
    // local and remote VS Code workspaces.
    return [
      this.infoItem('Workspace', workspace.name),
      this.infoItem(
        'Package',
        'Read from package.json when Project Doctor runs'
      ),
      this.createNode({
        label: 'Analyze Project',
        command: 'rn-developer-toolkit.showProjectInfo',
        icon: 'search',
      }),
    ];
  }

  private infoItem(
    label: string,
    description: string
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );

    item.description = description;
    item.tooltip = `${label}: ${description}`;

    return item;
  }
}