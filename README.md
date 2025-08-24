# vscode-open-folder-or-file-folder-as-workspace

VS Code extension that adds intelligent context menu options to open files and folders as workspaces in new VS Code windows.

## Features

### 🎯 Smart Folder Opening

- **Files**: Right-click any file → opens the file's containing folder as workspace
- **Folders**: Right-click any folder → opens that folder as workspace (not its parent)

### 🔗 Symlink Support

If you selected a symlink, you will have two options:

1. `Open file's folder as workspace`
2. `Open file's realpath directory as workspace`

If you selected `~/.zshrc` which symlinks to `~/projects/dotfiles/zshrc`:

- `Open file's folder as workspace` → Opens `~`
- `Open file's realpath directory as workspace` → Opens `~/projects/dotfiles`

### ✨ Context-Aware Menus

Menu options automatically adjust based on what you right-click, providing clear and relevant actions.

## Installation

Launch VS Code Quick Open (⌘+P), paste the following command, and press enter:

```sh
ext install nowaker.vscode-open-file-folder
```

## License

MIT
