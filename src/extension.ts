// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import { GitExtension } from './api/git';
import * as diff from 'diff';
import { DecorationRangeBehavior } from 'vscode';
import { StateResponse, getLatestRelease } from './steroidApi';
import { SteroidDataProvider } from './SteroidDataProvider';
import { join, resolve } from 'path';

let state: {[key:string]: StateResponse['latestRelease']} = {};

export function deactivate() {}

const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
const gitApi = gitExtension.getAPI(1);

const slowCodeDecoration = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255, 0, 0, 0.25)',
	rangeBehavior: DecorationRangeBehavior.ClosedClosed,
	overviewRulerLane: vscode.OverviewRulerLane.Full,
});

export async function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('steroidTraces.viewInTextEditor', (params) => console.log('executed', params));
	const steroidDataProvider = new SteroidDataProvider('', []);
	const view = vscode.window.createTreeView('steroid-traces', {
		treeDataProvider: steroidDataProvider,
	});
	view.onDidChangeSelection(async ({ selection: [item] }) => {
		console.log(item)
		console.log(vscode.workspace)

		if (!item) {
			return;
		}

		console.log(vscode.workspace.workspaceFolders)

		const openedFolders = vscode.workspace.workspaceFolders;

		if (!openedFolders) {
			return;
		}

		for (const folder of openedFolders) {
			const repo = await gitApi.openRepository(folder.uri);
			if (repo?.state.HEAD?.commit === item.commit) {
				const fullFileParh = join(folder.uri.path, item.fileName);
				console.log(fullFileParh, folder)
				const originalFile = await repo.show(item.commit, fullFileParh);
				const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(fullFileParh));
				const currentText = document.getText();
				const calculatedDiff = diff.diffLines(originalFile, currentText);
				const offset = getOffset(item.startLine - 1, item.startLine - 1, calculatedDiff);
				await vscode.window.showTextDocument(document, {
					selection: new vscode.Range(new vscode.Position(item.startLine - 1, item.startColumn - 1), new vscode.Position(item.startLine - 1, item.startColumn - 1))
				});

				if (offset && offset !== 0) {
					await vscode.commands
						.executeCommand("cursorMove", {
							to: "down",
							by: "line",
							value: offset,
						});
				}
				
				
				break;
			}
		}
		// const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse('/Users/maxmax/steroid/src/express.ts'))
		// console.log(folder);
		// vscode.window.showTextDocument(vscode.Uri.parse('/Users/maxmax/steroid/src/express.ts'));
	});

	gitApi.onDidOpenRepository((repo) => {
		repo.state.onDidChange(async () => {
			if (!repo.state.HEAD || !repo.state.HEAD.commit) {
				return;
			}

			const commit = repo.state.HEAD.commit;
			const log = await repo.log({ maxEntries: 100 });
			state[commit] = await getLatestRelease(log.map(({ hash }) => hash));

			const activeTextEditor = vscode.window.activeTextEditor;

			if (activeTextEditor) {
				await markCodePlaces(activeTextEditor);
			}

			steroidDataProvider.refresh(commit, state[commit].codePlaces);
		});
	});

	const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((textEditor) => textEditor && markCodePlaces(textEditor));

	context.subscriptions.push(onDidChangeActiveTextEditor);
}

async function markCodePlaces(textEditor: vscode.TextEditor) {
	const repo = await gitApi.openRepository(vscode.Uri.parse(textEditor.document.uri.fsPath));
	const commit = repo?.state.HEAD?.commit;

	if (!commit) {
		return;
	}

	const latestReleaseForRepo: Awaited<ReturnType<typeof getLatestRelease>> | undefined = state[commit];

	if (!latestReleaseForRepo) {
		return;
	}

	let relative = vscode.workspace.asRelativePath(textEditor.document.fileName);
	const traces = latestReleaseForRepo.codePlaces.sort((a: any, b: any) => a.lineNumber - b.lineNumber);
	console.log('traces', traces);

	if (!relative || !relative[0] || relative[0] === '/') {
		return;
	}

	relative = relative[0] === '/' ? relative : `/${relative}`;

	const originalFile = await repo.show(latestReleaseForRepo.commit, textEditor.document.fileName);
	const calculatedDiff = diff.diffLines(originalFile, textEditor.document.getText());

	// const ranges: vscode.Range[] = [];
	const rangesWithSettings: vscode.DecorationOptions[] = [];

	for (const trace of traces) {
		if (trace.fileName !== relative) {
			continue;
		}

		const offset = getOffset(trace.startLine - 1, trace.endLine - 1, calculatedDiff);

		if (offset === undefined) {
			continue;
		}

		// ranges.push(new vscode.Range(
		// 	trace.startLine + offset - 1,
		// 	trace.startColumn - 1,
		// 	trace.endLine + offset - 1,
		// 	trace.endColumn - 1,
		// ));
		rangesWithSettings.push({
			range: new vscode.Range(
				trace.startLine + offset - 1,
				trace.startColumn - 1,
				trace.endLine + offset - 1,
				trace.endColumn - 1,
			),
			hoverMessage: new vscode.MarkdownString(`${226}ms | view trace: [link](http://google.com)`),
		})
	}

	if (rangesWithSettings.length) {
		vscode.window.activeTextEditor?.setDecorations(slowCodeDecoration, []);
		vscode.window.activeTextEditor?.setDecorations(slowCodeDecoration, rangesWithSettings);
	}
} 

function getOffset(trackingOriginalStartlLine: number, trackingOriginalEndLine: number, diffs: diff.Change[]) {
	let originalIndex = 0;
	let modifiedIndex = 0;

	for (const diff of diffs) {
		// console.log('diff', diff)
		// console.log('trackingOriginalStartlLine', trackingOriginalStartlLine)
		// console.log('trackingOriginalEndLine', trackingOriginalEndLine)
		// console.log('originalIndex', originalIndex)
		// console.log('modifiedIndex', modifiedIndex)
		// console.log('===============')

		if (
			trackingOriginalStartlLine >= originalIndex
			&& trackingOriginalEndLine < originalIndex + (diff.count || 0)
			&& (diff.removed || (!diff.removed && !diff.added))
		) {
			if (diff.removed) {
				return undefined;
			} else {
				const localOffset = trackingOriginalStartlLine - originalIndex;
				return modifiedIndex - originalIndex;
			}
		}

		if (diff.removed) {
			originalIndex += diff.count || 0;
		} else if (diff.added) {
			modifiedIndex += diff.count || 0;
		} else {
			modifiedIndex += diff.count || 0;
			originalIndex += diff.count || 0;
		}
	}

	// console.log('originalIndex', originalIndex);
	// console.log('modifiedIndex', modifiedIndex);
}