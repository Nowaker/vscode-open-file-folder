import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolves the target folder path for opening in VS Code.
 *
 * Logic:
 * - If path is a symlink, resolve it first
 * - If resolved path is a file, open its containing folder
 * - If resolved path is a directory, open that directory
 *
 * @param inputPath The path to process
 * @returns Promise<string> The folder path to open
 */
export async function resolveTargetFolder(inputPath: string): Promise<string> {
  try {
    let resolvedPath = inputPath;

    // Check if it's a symlink and resolve it
    const lstat = await fs.promises.lstat(inputPath);
    if (lstat.isSymbolicLink()) {
      const linkTarget = await fs.promises.readlink(inputPath);
      // Handle relative symlinks by resolving against the symlink's directory
      resolvedPath = path.isAbsolute(linkTarget)
        ? linkTarget
        : path.resolve(path.dirname(inputPath), linkTarget);
    }

    // Check if the resolved path is a file or directory
    const stat = await fs.promises.stat(resolvedPath);

    if (stat.isFile()) {
      // If it's a file, return its containing directory
      return path.dirname(resolvedPath);
    } else if (stat.isDirectory()) {
      // If it's a directory, return the directory itself
      return resolvedPath;
    } else {
      // Fallback for edge cases (shouldn't happen in normal use)
      return path.dirname(resolvedPath);
    }
  } catch (error) {
    // If any error occurs (file doesn't exist, permission denied, etc.)
    // fall back to the original behavior of returning the parent directory
    console.warn(`Failed to resolve path ${inputPath}:`, error);
    return path.dirname(inputPath);
  }
}

/**
 * Opens the symlink's parent directory (not the resolved target's directory)
 */
export async function openSymlinkDirectory(inputPath: string): Promise<string> {
  return path.dirname(inputPath);
}

/**
 * Opens the realpath (resolved target) directory
 */
export async function openRealpathDirectory(inputPath: string): Promise<string> {
  try {
    const lstat = await fs.promises.lstat(inputPath);
    if (lstat.isSymbolicLink()) {
      const linkTarget = await fs.promises.readlink(inputPath);
      const resolvedPath = path.isAbsolute(linkTarget)
        ? linkTarget
        : path.resolve(path.dirname(inputPath), linkTarget);

      const stat = await fs.promises.stat(resolvedPath);
      if (stat.isFile()) {
        return path.dirname(resolvedPath);
      } else if (stat.isDirectory()) {
        return resolvedPath;
      } else {
        return path.dirname(resolvedPath);
      }
    } else {
      // For non-symlinks, same behavior as regular file handling
      return await resolveTargetFolder(inputPath);
    }
  } catch (error) {
    console.warn(`Failed to resolve realpath for ${inputPath}:`, error);
    return path.dirname(inputPath);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Command for opening file's symlink directory as workspace (symlink's parent, not target's parent)
  const openFileCommand = vscode.commands.registerCommand(
    'vscode-open-folder-or-file-folder-as-workspace.openFileParentFolderAsWorkspace',
    async (resourceUri: vscode.Uri) => {
      try {
        const targetFolder = await openSymlinkDirectory(resourceUri.fsPath);
        const folderUri = vscode.Uri.file(targetFolder);
        await vscode.commands.executeCommand('vscode.openFolder', folderUri, true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open folder: ${error}`);
      }
    }
  );

  // Command for opening file's realpath directory as workspace
  const openFileRealpathCommand = vscode.commands.registerCommand(
    'vscode-open-folder-or-file-folder-as-workspace.openFileRealpathParentFolderAsWorkspace',
    async (resourceUri: vscode.Uri) => {
      try {
        const targetFolder = await openRealpathDirectory(resourceUri.fsPath);
        const folderUri = vscode.Uri.file(targetFolder);
        await vscode.commands.executeCommand('vscode.openFolder', folderUri, true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open folder: ${error}`);
      }
    }
  );

  // Command for opening folder as workspace (same logic, but different context)
  const openFolderCommand = vscode.commands.registerCommand(
    'vscode-open-folder-or-file-folder-as-workspace.openFolderAsWorkspace',
    async (resourceUri: vscode.Uri) => {
      try {
        const targetFolder = await resolveTargetFolder(resourceUri.fsPath);
        const folderUri = vscode.Uri.file(targetFolder);
        await vscode.commands.executeCommand('vscode.openFolder', folderUri, true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open folder: ${error}`);
      }
    }
  );

  context.subscriptions.push(openFileCommand, openFileRealpathCommand, openFolderCommand);
}

export function deactivate() {
  // Nothing to clean up
}
