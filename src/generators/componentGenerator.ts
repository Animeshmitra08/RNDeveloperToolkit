
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

function isValidComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function componentTemplate(name: string): string {
  return `import { View, Text } from 'react-native';
import { styles } from './${name}.styles';

type ${name}Props = {
  title?: string;
};

export default function ${name}({
  title = '${name}',
}: ${name}Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}
`;
}

function stylesTemplate(): string {
  return `import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
});
`;
}

export async function createComponent(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    vscode.window.showWarningMessage(
      'Open a project folder before generating a component.'
    );
    return;
  }

  const name = await vscode.window.showInputBox({
    title: 'Create React Native Component',
    prompt: 'Enter a PascalCase component name',
    placeHolder: 'UserCard',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Component name is required.';
      }

      if (!isValidComponentName(value.trim())) {
        return 'Use PascalCase letters and numbers, e.g. UserCard or Profile2.';
      }

      return undefined;
    },
  });

  if (name === undefined) {
    return;
  }

  const outputDirectory = await vscode.window.showInputBox({
    title: 'Component Output Directory',
    prompt: 'Path relative to the workspace root',
    value: 'src/components',
    placeHolder: 'src/components',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Output directory is required.';
      }

      if (path.isAbsolute(value)) {
        return 'Enter a relative path inside the workspace.';
      }

      const resolved = path.resolve(workspace.uri.fsPath, value);

      if (
        resolved !== workspace.uri.fsPath &&
        !resolved.startsWith(
          workspace.uri.fsPath + path.sep
        )
      ) {
        return 'Output directory must stay inside the workspace.';
      }

      return undefined;
    },
  });

  if (outputDirectory === undefined) {
    return;
  }

  const componentName = name.trim();
  const root = workspace.uri.fsPath;
  const destination = path.resolve(root, outputDirectory.trim());
  const componentDirectory = path.join(
    destination,
    componentName
  );

  try {
    await fs.mkdir(destination, { recursive: true });

    const tsxPath = path.join(
      componentDirectory,
      `${componentName}.tsx`
    );
    const stylesPath = path.join(
      componentDirectory,
      `${componentName}.styles.ts`
    );

    let existingFiles: string[] = [];

    try {
      existingFiles = await fs.readdir(componentDirectory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== 'ENOENT') {
        throw error;
      }
    }

    const conflicts = existingFiles.filter((file) =>
      [
        `${componentName}.tsx`,
        `${componentName}.styles.ts`,
      ].includes(file)
    );

    if (conflicts.length > 0) {
      const choice = await vscode.window.showWarningMessage(
        `Some component files already exist in ${componentDirectory}. Overwrite them?`,
        { modal: true },
        'Overwrite'
      );

      if (choice !== 'Overwrite') {
        return;
      }
    }

    await fs.mkdir(componentDirectory, { recursive: true });

    await fs.writeFile(
      tsxPath,
      componentTemplate(componentName),
      'utf8'
    );

    await fs.writeFile(
      stylesPath,
      stylesTemplate(),
      'utf8'
    );

    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(tsxPath)
    );

    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      `Created ${componentName} with its styles file.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Component generation failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
}