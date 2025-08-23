import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import the functions we want to test
import { resolveTargetFolder, openSymlinkDirectory, openRealpathDirectory } from '../../extension';

suite('Extension Test Suite', () => {
	let tempDir: string;
	let testFile: string;
	let testDir: string;
	let testSymlinkToFile: string;
	let testSymlinkToDir: string;

	suiteSetup(async () => {
		// Create a temporary directory for testing
		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vscode-test-'));
		
		// Create test files and directories
		testFile = path.join(tempDir, 'test.txt');
		testDir = path.join(tempDir, 'testfolder');
		
		await fs.promises.writeFile(testFile, 'test content');
		await fs.promises.mkdir(testDir);
		
		// Create symlinks for testing
		testSymlinkToFile = path.join(tempDir, 'symlink-to-file.txt');
		testSymlinkToDir = path.join(tempDir, 'symlink-to-dir');
		
		await fs.promises.symlink(testFile, testSymlinkToFile);
		await fs.promises.symlink(testDir, testSymlinkToDir);
	});

	suiteTeardown(async () => {
		// Clean up temp directory
		await fs.promises.rm(tempDir, { recursive: true, force: true });
	});

	test('should return parent directory for a file', async () => {
		const result = await resolveTargetFolder(testFile);
		assert.strictEqual(result, tempDir);
	});

	test('should return the directory itself when given a directory', async () => {
		const result = await resolveTargetFolder(testDir);
		assert.strictEqual(result, testDir);
	});

	test('should resolve symlink to file and return its parent directory', async () => {
		const result = await resolveTargetFolder(testSymlinkToFile);
		assert.strictEqual(result, tempDir);
	});

	test('should resolve symlink to directory and return that directory', async () => {
		const result = await resolveTargetFolder(testSymlinkToDir);
		assert.strictEqual(result, testDir);
	});

	test('should handle relative symlinks correctly', async () => {
		// Create a relative symlink
		const symlinkDir = path.join(tempDir, 'symlink-dir');
		await fs.promises.mkdir(symlinkDir);
		
		// Create relative symlink from symlink-dir to ../test.txt
		const relativeSymlinkPath = path.join(symlinkDir, 'relative-link.txt');
		await fs.promises.symlink('../test.txt', relativeSymlinkPath);
		
		const result = await resolveTargetFolder(relativeSymlinkPath);
		assert.strictEqual(result, tempDir);
		
		// Clean up
		await fs.promises.rm(symlinkDir, { recursive: true, force: true });
	});

	test('should fallback gracefully for non-existent files', async () => {
		const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');
		const result = await resolveTargetFolder(nonExistentPath);
		// Should return the parent directory as fallback
		assert.strictEqual(result, tempDir);
	});

	test('Fix for issue #4: should open folder itself, not parent', async () => {
		// This test specifically addresses the reported issue
		// Create a nested directory structure like in the issue
		const projectRoot = path.join(tempDir, 'myapp');
		const uiFolder = path.join(projectRoot, 'ui');
		const buildFolder = path.join(uiFolder, 'build');
		
		await fs.promises.mkdir(projectRoot);
		await fs.promises.mkdir(uiFolder);
		await fs.promises.mkdir(buildFolder);
		
		// Test: opening 'ui' folder should open 'ui', not 'myapp'
		const uiResult = await resolveTargetFolder(uiFolder);
		assert.strictEqual(uiResult, uiFolder, 'Should open ui folder, not its parent myapp');
		
		// Test: opening 'build' folder should open 'build', not 'ui'
		const buildResult = await resolveTargetFolder(buildFolder);
		assert.strictEqual(buildResult, buildFolder, 'Should open build folder, not its parent ui');
		
		// Test: opening a file in ui folder should open ui folder
		const uiFile = path.join(uiFolder, 'package.json');
		await fs.promises.writeFile(uiFile, '{}');
		const fileResult = await resolveTargetFolder(uiFile);
		assert.strictEqual(fileResult, uiFolder, 'Should open containing folder for files');
	});

	test('All commands should be registered', async () => {
		// Test that all commands are available
		const commands = await vscode.commands.getCommands(true);
		
		assert.ok(commands.includes('vscode-open-file-folder.openFileParentFolderAsWorkspace'), 'openFileParentFolderAsWorkspace command should be registered');
		assert.ok(commands.includes('vscode-open-file-folder.openFileRealpathParentFolderAsWorkspace'), 'openFileRealpathParentFolderAsWorkspace command should be registered');
		assert.ok(commands.includes('vscode-open-file-folder.openFolderAsWorkspace'), 'openFolderAsWorkspace command should be registered');
	});

	// Tests for symlink directory handling
	test('openSymlinkDirectory should return symlink\'s parent directory', async () => {
		const result = await openSymlinkDirectory(testSymlinkToFile);
		assert.strictEqual(result, tempDir, 'Should return the directory containing the symlink');
	});

	test('openRealpathDirectory should return target file\'s parent for file symlinks', async () => {
		const result = await openRealpathDirectory(testSymlinkToFile);
		assert.strictEqual(result, tempDir, 'Should return the directory containing the target file');
	});

	test('openRealpathDirectory should return target directory for directory symlinks', async () => {
		const result = await openRealpathDirectory(testSymlinkToDir);
		assert.strictEqual(result, testDir, 'Should return the target directory itself');
	});

	test('openRealpathDirectory should handle relative symlinks correctly', async () => {
		// Create a relative symlink in a subdirectory
		const symlinkDir = path.join(tempDir, 'symlink-test-dir');
		await fs.promises.mkdir(symlinkDir);
		
		const relativeSymlinkPath = path.join(symlinkDir, 'relative-file-link.txt');
		await fs.promises.symlink('../test.txt', relativeSymlinkPath);
		
		const result = await openRealpathDirectory(relativeSymlinkPath);
		assert.strictEqual(result, tempDir, 'Should resolve relative symlink to correct target directory');
		
		// Clean up
		await fs.promises.rm(symlinkDir, { recursive: true, force: true });
	});

	test('openRealpathDirectory should handle non-symlinks by falling back to normal logic', async () => {
		const result = await openRealpathDirectory(testFile);
		assert.strictEqual(result, tempDir, 'Should handle regular files normally');
	});

	test('openRealpathDirectory should handle broken symlinks gracefully', async () => {
		// Create a symlink to a non-existent file
		const brokenSymlink = path.join(tempDir, 'broken-symlink.txt');
		await fs.promises.symlink('./non-existent-file.txt', brokenSymlink);
		
		const result = await openRealpathDirectory(brokenSymlink);
		assert.strictEqual(result, tempDir, 'Should fallback to symlink\'s directory for broken symlinks');
		
		// Clean up
		await fs.promises.unlink(brokenSymlink);
	});

	test('Dual symlink functionality - different behaviors', async () => {
		// Create a complex scenario: symlink in subdirectory pointing to file in different directory
		const sourceDir = path.join(tempDir, 'source');
		const symlinkDir = path.join(tempDir, 'links');
		const sourceFile = path.join(sourceDir, 'source-file.txt');
		const symlinkFile = path.join(symlinkDir, 'link-to-source.txt');
		
		await fs.promises.mkdir(sourceDir);
		await fs.promises.mkdir(symlinkDir);
		await fs.promises.writeFile(sourceFile, 'source content');
		await fs.promises.symlink(sourceFile, symlinkFile);
		
		// Test symlink directory (should return symlinkDir)
		const symlinkDirResult = await openSymlinkDirectory(symlinkFile);
		assert.strictEqual(symlinkDirResult, symlinkDir, 'Should return symlink\'s parent directory');
		
		// Test realpath directory (should return sourceDir)
		const realpathDirResult = await openRealpathDirectory(symlinkFile);
		assert.strictEqual(realpathDirResult, sourceDir, 'Should return target file\'s parent directory');
		
		// Verify they're different
		assert.notStrictEqual(symlinkDirResult, realpathDirResult, 'Symlink and realpath directories should be different');
		
		// Clean up
		await fs.promises.rm(sourceDir, { recursive: true, force: true });
		await fs.promises.rm(symlinkDir, { recursive: true, force: true });
	});

	test('Symlink pointing to symlink (chain resolution)', async () => {
		// Create a chain: file -> symlink1 -> symlink2
		const intermediateSymlink = path.join(tempDir, 'intermediate-link.txt');
		const finalSymlink = path.join(tempDir, 'final-link.txt');
		
		await fs.promises.symlink(testFile, intermediateSymlink);
		await fs.promises.symlink(intermediateSymlink, finalSymlink);
		
		// Test realpath resolution follows the chain
		const result = await openRealpathDirectory(finalSymlink);
		assert.strictEqual(result, tempDir, 'Should resolve through symlink chain to final target');
		
		// Clean up
		await fs.promises.unlink(finalSymlink);
		await fs.promises.unlink(intermediateSymlink);
	});
});