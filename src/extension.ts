
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ToolkitTreeProvider } from './providers/toolkitTreeProvider';
import { runExpoCommand } from './commands/expoCommands';
import { registerEasCommands } from './commands/easCommands';
import { installPackage } from './commands/packageCommands';
import { createComponent } from './generators/componentGenerator';

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new ToolkitTreeProvider();

  const treeView = vscode.window.createTreeView(
    'rnToolkitView',
    {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    }
  );

  context.subscriptions.push(treeView);

  const showProjectInfo = vscode.commands.registerCommand(
    'rn-developer-toolkit.showProjectInfo',
    async () => {
      const workspace = vscode.workspace.workspaceFolders?.[0];

      if (!workspace) {
        vscode.window.showWarningMessage(
          'Open a React Native or Expo project first.'
        );
        return;
      }

      const packagePath = path.join(
        workspace.uri.fsPath,
        'package.json'
      );

      if (!fs.existsSync(packagePath)) {
        vscode.window.showWarningMessage(
          'No package.json found in the workspace root.'
        );
        return;
      }

      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packagePath, 'utf8')
        );

        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        const isExpo = Boolean(dependencies.expo);
        const isReactNative = Boolean(
          dependencies['react-native']
        );

        const details = [
          `Project: ${packageJson.name ?? 'Unnamed project'}`,
          `Type: ${
            isExpo
              ? 'Expo'
              : isReactNative
                ? 'React Native CLI'
                : 'Unknown'
          }`,
          `React Native: ${
            dependencies['react-native'] ?? 'Not installed'
          }`,
          `Expo: ${dependencies.expo ?? 'Not installed'}`,
          `Expo Router: ${
            dependencies['expo-router'] ?? 'Not installed'
          }`,
        ];

        const document = await vscode.workspace.openTextDocument({
          language: 'plaintext',
          content: details.join('\n'),
        });

        await vscode.window.showTextDocument(document);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Could not read package.json: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  );

  const expoStart = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoStart',
    () => runExpoCommand('npx expo start')
  );

  const expoAndroid = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoAndroid',
    () => runExpoCommand('npx expo run:android')
  );

  const expoIOS = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoIOS',
    () => runExpoCommand('npx expo run:ios')
  );

  const expoClearCache = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoClearCache',
    () => runExpoCommand('npx expo start --clear')
  );

  const expoDoctor = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoDoctor',
    () => runExpoCommand('npx expo-doctor')
  );

  const expoFixDependencies = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoFixDependencies',
    () => runExpoCommand('npx expo install --fix')
  );

  const expoPrebuildClean = vscode.commands.registerCommand(
    'rn-developer-toolkit.expoPrebuildClean',
    async () => {
      const choice = await vscode.window.showWarningMessage(
        'This deletes and regenerates the android/ and ios/ folders. Any manual native changes will be lost.',
        { modal: true },
        'Run Prebuild'
      );

      if (choice) {
        runExpoCommand('npx expo prebuild --clean');
      }
    }
  );

  const installPackageCommand = vscode.commands.registerCommand(
    'rn-developer-toolkit.installPackage',
    installPackage
  );

  registerEasCommands(context);

  const createComponentCommand = vscode.commands.registerCommand(
	'rn-developer-toolkit.createComponent',
	createComponent
  );

//   const generatorComingSoon = vscode.commands.registerCommand(
//     'rn-developer-toolkit.generatorComingSoon',
//     () => {
//       vscode.window.showInformationMessage(
//         'This generator will be implemented in Step 5.'
//       );
//     }
//   );

  const runDoctor = vscode.commands.registerCommand(
    'rn-developer-toolkit.runDoctor',
    async () => {
      const workspace = vscode.workspace.workspaceFolders?.[0];

      if (!workspace) {
        vscode.window.showWarningMessage(
          'Open a React Native or Expo project first.'
        );
        return;
      }

      const packagePath = path.join(
        workspace.uri.fsPath,
        'package.json'
      );

      const appJsonPath = path.join(
        workspace.uri.fsPath,
        'app.json'
      );

      const results: string[] = [];

      if (!fs.existsSync(packagePath)) {
        results.push('ERROR: package.json is missing.');
      } else {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packagePath, 'utf8')
          );

          const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          results.push(
            `Project: ${packageJson.name ?? 'Unnamed project'}`
          );

          results.push(
            `Expo: ${dependencies.expo ?? 'Not installed'}`
          );

          results.push(
            `React Native: ${
              dependencies['react-native'] ?? 'Not installed'
            }`
          );

          if (!dependencies.expo && !dependencies['react-native']) {
            results.push(
              'WARNING: Neither Expo nor React Native was found.'
            );
          }

          if (
            dependencies.expo &&
            !dependencies['react-native']
          ) {
            results.push(
              'WARNING: Expo is present but React Native is missing from declared dependencies.'
            );
          }

          results.push(
            `app.json: ${
              fs.existsSync(appJsonPath)
                ? 'Found'
                : 'Not found at workspace root'
            }`
          );

          results.push(
            'Note: This initial check does not validate dependency compatibility.'
          );
        } catch {
          results.push(
            'ERROR: package.json contains invalid JSON.'
          );
        }
      }

      const document = await vscode.workspace.openTextDocument({
        language: 'plaintext',
        content: results.join('\n'),
      });

      await vscode.window.showTextDocument(document);
    }
  );

  context.subscriptions.push(
    showProjectInfo,
    expoStart,
    expoAndroid,
    expoIOS,
    expoClearCache,
    expoDoctor,
    expoFixDependencies,
    expoPrebuildClean,
    installPackageCommand,
	createComponentCommand,
    runDoctor
  );
}

export function deactivate() {}