// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import { GitExtension } from './api/git';
import * as diff from 'diff';
import { DecorationRangeBehavior } from 'vscode';
import { getLatestRelease } from './steroidApi';

let state: any = {};

export function deactivate() {}

const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
const gitApi = gitExtension.getAPI(1);

export async function activate(context: vscode.ExtensionContext) {
	gitApi.onDidOpenRepository((repo) => {
		repo.state.onDidChange(async () => {
			if (!repo.state.HEAD || !repo.state.HEAD.commit) {
				return;
			}
			const log = await repo.log({ maxEntries: 100 });
			state[repo.state.HEAD!.commit] = await getLatestRelease(log.map(({ hash }) => hash));

			const activeTextEditor = vscode.window.activeTextEditor;

			if (activeTextEditor) {
				await markCodePlaces(activeTextEditor);
			}
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

	const latestReleaseForRepo = state[commit];

	if (!latestReleaseForRepo) {
		return;
	}

	const relative = vscode.workspace.asRelativePath(textEditor.document.fileName);
	const traces = latestReleaseForRepo.codePlaces.sort((a: any, b: any) => a.lineNumber - b.lineNumber);

	if (!relative || !relative[0] || relative[0] === '/') {
		return;
	}

	const originalFile = await repo.show(latestReleaseForRepo.commit, textEditor.document.fileName);
	const calculatedDiff = diff.diffLines(originalFile, textEditor.document.getText());

	for (const trace of traces) {
		if (trace.fileName !== relative) {
			continue;
		}

		const offset = getOffset(trace.startLine, trace.endLine, calculatedDiff);

		if (offset === undefined) {
			continue;
		}

		vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({
			backgroundColor: '#FF0000',
			rangeBehavior: DecorationRangeBehavior.OpenOpen,
			overviewRulerLane: 7,
		}), [new vscode.Range(
			trace.startLine + offset,
			trace.startColumn,
			trace.endLine + offset,
			trace.endColumn,
		)]);
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