# RN Development Toolkit

Developer utilities for **React Native** and **Expo**, right inside VS Code.

Run Expo, build and ship with EAS, install packages, generate components and check your project's health from a single sidebar, without memorising CLI flags.

## Features

Open the **RN Toolkit** icon in the Activity Bar to see the toolkit panel. Every action is also available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) under `RN Toolkit: …`.

### Project Overview

- **Analyze Project**: detects whether the workspace is an Expo or React Native CLI project and shows the installed versions of React Native, Expo and Expo Router.

### Generators

- **Create Component**: asks for a PascalCase name and an output folder (default `src/components`), then creates:

  ```
  src/components/UserCard/
  ├── UserCard.tsx
  └── UserCard.styles.ts
  ```

  If the files already exist, you are asked before they are overwritten. The output folder must be inside the workspace.

- Create Screen, Create Hook and Create Service are coming soon.

### Expo Commands

| Action | Runs |
|---|---|
| Start Expo | `npx expo start` |
| Run Android | `npx expo run:android` |
| Run iOS | `npx expo run:ios` |
| Start with Clear Cache | `npx expo start --clear` |
| Expo Doctor | `npx expo-doctor` |
| Fix Dependencies | `npx expo install --fix` |
| Prebuild (Clean) | `npx expo prebuild --clean` (asks for confirmation, because it deletes and regenerates `android/` and `ios/`) |

### Packages

- **Install Package**: enter one or more package names separated by spaces (for example `react-native-reanimated @react-navigation/native@^7`), then choose **Dependency** or **Dev Dependency**.
  - In **Expo** projects it runs `npx expo install`, which picks versions compatible with your Expo SDK.
  - In **React Native CLI** projects it detects your package manager from the lock file and runs `bun add`, `pnpm add`, `yarn add` or `npm install`.

### EAS Build & Deploy

EAS commands run through `npx eas-cli`, so a global `eas-cli` install is optional.

| Action | Runs |
|---|---|
| Login / Who Am I / Logout | `eas login`, `eas whoami`, `eas logout` |
| Init Project | `eas init` (links the app to your Expo account) |
| Configure Build | `eas build:configure` (creates `eas.json`) |
| Build | `eas build --platform <platform> --profile <profile>` |
| Build & Submit | `eas build … --auto-submit` |
| Submit to Store | `eas submit --platform <platform> --profile <profile> [--latest]` |
| Publish OTA Update | `eas update --branch <branch> --message "<message>"` |
| Recent Builds | `eas build:list --limit 10` |
| Manage Credentials | `eas credentials` |

- **Build** and **Submit** ask you for the platform (Android, iOS or All) and a profile.
- Profiles are read from the `build` and `submit` sections of your `eas.json`. If `eas.json` is missing, the toolkit offers to run **Configure Build** first.

### Project Doctor

- **Run Project Checks**: checks for `package.json` and `app.json`, reports the Expo and React Native versions, and warns if neither is installed or if Expo is present without React Native. It does not yet check whether dependency versions are compatible; use **Expo Doctor** for that.

### Terminals

Commands run in named terminals so they don't get in each other's way:

- **RN Toolkit**: Expo commands (Metro, run, prebuild)
- **EAS**: login, build, submit and update
- **Packages**: package installs

You can keep Metro running while you start an EAS build or install a package.

## Requirements

- VS Code `1.140.0` or later
- [Node.js](https://nodejs.org/) (LTS) with `npx` available on your `PATH`
- A React Native or Expo project open as the workspace root (the folder containing `package.json`)
- For native runs: Android Studio / Android SDK for Android, and Xcode on macOS for iOS
- For EAS: a free [Expo account](https://expo.dev/signup)

## Known Issues

- **Create Screen**, **Create Hook** and **Create Service** are placeholders. Their command (`rn-developer-toolkit.generatorComingSoon`) is not registered yet, so clicking them shows a "command not found" error.
- Only the first folder of a multi-root workspace is used.
- **Publish OTA Update** replaces double quotes in the message with single quotes, to avoid quoting problems between shells.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm run lint
npm test
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

### Project structure

```
src/
├── extension.ts                 # Activation and command registration
├── commands/
│   ├── expoCommands.ts          # Shared terminal runner
│   ├── easCommands.ts           # EAS login/build/submit/update
│   └── packageCommands.ts       # Install Package
├── generators/
│   └── componentGenerator.ts    # Create Component
├── providers/
│   └── toolkitTreeProvider.ts   # Sidebar tree view
└── diagonistics/
    └── projectDoctor.ts
resources/
└── rn-toolkit.svg               # Activity Bar icon
```

## Release Notes

### 0.0.1

Initial release:

- Sidebar with Project Overview, Generators, Expo Commands, Packages, EAS Build & Deploy and Project Doctor
- Component generator
- Expo run, clear cache, doctor, fix dependencies and clean prebuild commands
- EAS login, init, configure, build, build & submit, submit, update, build list and credentials commands
- Install Package with Expo SDK-aware installs and package manager detection
