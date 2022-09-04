// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import { GitExtension } from './api/git';
import * as diff from 'diff';
import { DecorationRangeBehavior } from 'vscode';
import { getLatestRelease } from './steroidApi';

let state: any = {};
let repoCommitMap: Record<string, string> = {};

// this method is called when your extension is deactivated
export function deactivate() {}


// private

export async function activate2(context: vscode.ExtensionContext) {
    // await new Promise(resolve => setTimeout(resolve, 1000)); // if uncomment this, HEAD becomes initialized
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
    const gitApi = gitExtension.getAPI(1);

    // for (const workSpaceFolder of vscode.workspace.workspaceFolders || []) {
    //     const rootPath = workSpaceFolder.uri.fsPath;
    //     const repo = await gitApi.openRepository(vscode.Uri.parse(rootPath));

    //     const head = repo!.state.HEAD;

    //     console.log('head', head); // undefined
    // }

	console.log('gitApi.state', gitApi.state);
	
	// gitApi.onDidChangeState(() => {
	// 	console.log('onDidChangeState gitApi.state', gitApi.state);
	// 	for (const repo of gitApi.repositories) {
	// 		console.log(repo.status())
	// 		console.log('repos', repo.state.HEAD);
	// 	}
	// })
	gitApi.onDidOpenRepository((repo) => {
		repo.state.onDidChange(async () => {
			if (!repo.state.HEAD || !repo.state.HEAD.commit) {
				return;
			}
			// state[repo.state.HEAD!.commit] = await getState(repo.state.HEAD.commit)
			console.log('received steroid state', state[repo.state.HEAD!.commit])
		});
	});

	// vscode.workspace.onDidChangeTextDocument(async (e) => {
		
	// });

	const another = vscode.workspace.onDidSaveTextDocument(async (e) => {
		const activeTextEditor = vscode.window.activeTextEditor;
		if (!activeTextEditor) {
			return;
		}

		const repo = await gitApi.openRepository(vscode.Uri.parse(activeTextEditor.document.uri.fsPath));
		const commit = repo?.state.HEAD?.commit;

		// const diff = await repo?.blame('/Users/maxmax/steroid/src/example/controllers.ts')
		// console.log('diff', diff);

		if (!commit) {
			return;
		}

		const commitState = state[commit];

		if (!commitState) {
			return;
		}

		const relative = vscode.workspace.asRelativePath(activeTextEditor.document.fileName);
		// console.log('commitState', commitState);
		// console.log('relative', relative);

		const traces = commitState.traces
			// .filter((a: any) => a.startColumnNumber === 5 && a.startLineNumber === 11 && a.fileName === '/src/example/services.ts')
			// .filter((a: any) => a.id === 75)
			// .filter((a: any) => a.lineNumber === 17)
			// .filter((a: any) => [17,18,19].includes(a.lineNumber))
			.sort((a: any, b: any) => a.lineNumber - b.lineNumber);
		
		console.log('traces', traces)

		if (!relative || !relative[0] || relative[0] === '/') {
			return;
		}

		const originalFile = await repo.show(commit, activeTextEditor.document.fileName);
		// console.log('original file', originalFile);

		const calculatedDiff = diff.diffLines(originalFile, activeTextEditor.document.getText(), {
			// newlineIsToken: true
		})

		console.log('diff', calculatedDiff);

		for (const trace of traces) {
			if (trace.fileName !== `/${relative}`) {
				continue;
			}
			// console.log('here123', commit, relative, trace.fileName, activeTextEditor.document.fileName)

			// const offset = getOffset(trace.startLineNumber, calculatedDiff);
			const offset = getOffset(trace.startLineNumber, trace.endLineNumber, calculatedDiff);
			console.log('offset', offset)
			console.log('=====================')

			if (offset === undefined) {
				continue;
			}
			// vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({
			// 	backgroundColor: trace.state.colour,
			// }), [new vscode.Range(
			// 	trace.lineNumber - 1 + offset,
			// 	trace.columnNumber - 1,
			// 	trace.lineNumber - 1 + offset,
			// 	trace.columnNumber,
			// )]);
			vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({
				backgroundColor: trace.state.colour,
				rangeBehavior: DecorationRangeBehavior.OpenClosed,
				overviewRulerLane: 7,
			}), [new vscode.Range(
				trace.startLineNumber - 1 + offset,
				trace.startColumnNumber - 1,
				trace.endLineNumber + offset - 1,
				trace.endColumnNumber,
			)]);
		}


		// vscode.window.showInformationMessage('Hello World from 33333!');
		// vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({backgroundColor: '#FF1111' }), [new vscode.Range(1, 1, 10, 1)]);
	});

	// context.subscriptions.push(disposable);
	context.subscriptions.push(another);
}

const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
const gitApi = gitExtension.getAPI(1);

export async function activate(context: vscode.ExtensionContext) {
	// const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
	// const gitApi = gitExtension.getAPI(1);

	gitApi.onDidOpenRepository((repo) => {
		repo.state.onDidChange(async () => {
			if (!repo.state.HEAD || !repo.state.HEAD.commit) {
				return;
			}
			const log = await repo.log({ maxEntries: 100 });
			console.log('repo', repo);
			// state[repo.state.HEAD!.commit] = await getState([repo.state.HEAD.commit])
			state[repo.state.HEAD!.commit] = await getLatestRelease(log.map(({ hash }) => hash));
			console.log('received steroid state', state[repo.state.HEAD!.commit]);
		});
	});

	vscode.workspace.onDidOpenTextDocument((doc) => {
		console.log('doc', doc);
	})

	vscode.window.onDidChangeActiveTextEditor((textEditor) => textEditor && markCodePlaces(textEditor));

	const another = vscode.workspace.onDidSaveTextDocument(async (e) => {
		const activeTextEditor = vscode.window.activeTextEditor;
		if (!activeTextEditor) {
			return;
		}

		const repo = await gitApi.openRepository(vscode.Uri.parse(activeTextEditor.document.uri.fsPath));
		const commit = repo?.state.HEAD?.commit;

		if (!commit) {
			return;
		}

		const commitState = state[commit];

		if (!commitState) {
			return;
		}

		// vscode.workspace.onDidCh

		const relative = vscode.workspace.asRelativePath(activeTextEditor.document.fileName);

		const traces = commitState.latestRelease.codePlaces
			// .filter((a: any) => a.startColumnNumber === 5 && a.startLineNumber === 11 && a.fileName === '/src/example/services.ts')
			// .filter((a: any) => a.id === 75)
			// .filter((a: any) => a.lineNumber === 17)
			// .filter((a: any) => [17,18,19].includes(a.lineNumber))
			.sort((a: any, b: any) => a.lineNumber - b.lineNumber);

		if (!relative || !relative[0] || relative[0] === '/') {
			return;
		}

		// const originalFile = await repo.show(commit, activeTextEditor.document.fileName);
		console.log('commitState', commitState)
		const originalFile = await repo.show(commitState.latestRelease.commit, activeTextEditor.document.fileName);

		// console.log(tempFile)
		console.log(activeTextEditor.document.getText())

		const calculatedDiff = diff.diffLines(originalFile, activeTextEditor.document.getText(), {
			// newlineIsToken: true
		})

		console.log('diff', calculatedDiff);

		for (const trace of traces) {
			console.log('trace.fileName', trace.fileName)
			console.log(`/${relative}`, `/${relative}`)
			// if (trace.fileName !== `/${relative}`) {
			// 	console.log('not match', trace.fileName, `/${relative}`)
			// 	continue;
			// }
			if (trace.fileName !== relative) {
				console.log('not match', trace.fileName, `/${relative}`)
				continue;
			}
			// console.log('here123', commit, relative, trace.fileName, activeTextEditor.document.fileName)

			// const offset = getOffset(trace.startLineNumber, calculatedDiff);
			const offset = getOffset(trace.startLine, trace.endLine, calculatedDiff);
			console.log('offset', offset)
			console.log('=====================')

			if (offset === undefined) {
				continue;
			}
			// vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({
			// 	backgroundColor: trace.state.colour,
			// }), [new vscode.Range(
			// 	trace.lineNumber - 1 + offset,
			// 	trace.columnNumber - 1,
			// 	trace.lineNumber - 1 + offset,
			// 	trace.columnNumber,
			// )]);
			console.log('draw')
			vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({
				backgroundColor: '#FF0000' || trace.state.colour,
				rangeBehavior: DecorationRangeBehavior.OpenClosed,
				overviewRulerLane: 7,
			}), [new vscode.Range(
				trace.startLine + offset,
				trace.startColumn,
				trace.endLine + offset,
				trace.endColumn,
			)]);
		}


		// vscode.window.showInformationMessage('Hello World from 33333!');
		// vscode.window.activeTextEditor?.setDecorations(vscode.window.createTextEditorDecorationType({backgroundColor: '#FF1111' }), [new vscode.Range(1, 1, 10, 1)]);
	});

	context.subscriptions.push(another);
}

async function markCodePlaces(textEditor: vscode.TextEditor) {
	const fileName = textEditor.document.fileName;
	const repo = await gitApi.openRepository(vscode.Uri.parse(textEditor.document.uri.fsPath));
	const commit = repo?.state.HEAD?.commit;

	// const repo = 
	// const comm
} 

function getOffset_(originalLine: number, diffs: diff.Change[]) {
	console.log('originalLine', originalLine);
	let removalIndex = 0;
	let addIndex = 0;
	let originalIndex = 0;

	for (const diff of diffs) {
		let current = originalIndex - addIndex + removalIndex;
		
		if (!diff.count) {
			continue;
		}

		console.log('current', current);
		console.log('current + 1', current + 1);
		console.log('originalLine >= current + 1', originalLine >= current + 1);
		console.log('originalLine >= current + 1 + diff.count', originalLine >= current + 1 + diff.count);
		console.log('=================');

		if (originalLine >= current + 1 && originalLine <= current + 1 + diff.count) {
			if (diff.added || diff.removed) {
				return undefined
			}

			return current;
		} else {
			if (diff.added) {
				addIndex += diff.count;
			} else if (diff.removed) {
				removalIndex += diff.count;
			} else {
				originalIndex += diff.count;
			}
		}
	}

	return originalIndex - addIndex + removalIndex;
}

function getOffset1(originalLine: number, diffs: diff.Change[]) {
	console.log('originalLine', originalLine)
	let prefixed = 0;
	let index = 0;
	let removalIndex = 0;

	for (const diff of diffs) {
		if (!diff.count) {
			continue;
		}

		console.log('+++++++++')
		console.log('diff.count', diff.count)
		console.log('diff.added', diff.added)
		console.log('diff.removed', diff.removed)
		console.log('index', index)
		console.log('prefixed', prefixed)
		console.log('removalIndex', removalIndex)
		console.log('--------')

		if (!diff.added && !diff.removed) {
			index += diff.count;
			// removalIndex = 0;
		} else if (diff.removed) {
			removalIndex += diff.count;
			
			if (originalLine >= index + 1 && originalLine < index + 1 + diff.count) {
				console.log('removal 1st', originalLine >= index + 1, originalLine, index + 1)
				console.log('removal 2nd', originalLine <= index + 1 + diff.count)
				console.log('removal', index + 1)
				return undefined;
			}
		} else if (diff.added) {
			
			if (index < originalLine) {
				prefixed += diff.count;
			}

			if (removalIndex) {
				index += removalIndex > diff.count ? diff.count : removalIndex;
				// removalIndex = 0;
			}

			if (originalLine >= index + 1 && originalLine < index + 1 + diff.count) {
				console.log('removal 1st', originalLine >= index + 1, originalLine, index + 1)
				console.log('removal 2nd', originalLine <= index + 1 + diff.count)
				console.log('removal', index + 1)
				return undefined;
			}
		}

		// if (index < originalLine && diff.added) {
		// 	prefixed += diff.count
		// } else {
			
		// }
	}

	console.log('prfixed', prefixed)
	console.log('index', prefixed)
	console.log('removal index', removalIndex)

	return prefixed - removalIndex;
}

function getOffset333(trackingOriginalLine: number, diffs: diff.Change[]) {
	let originalIndex = 0;
	let modifiedIndex = 0;

	let originalAddIndex = 0;

	for (const diff of diffs) {
		if (
			trackingOriginalLine >= originalIndex + 1
			&& trackingOriginalLine < 1 + originalIndex + (diff.count || 0)
			&& (diff.removed || (!diff.removed && !diff.added))
		) {
			console.log('original index', originalIndex);
			console.log('inside of', diff.value);
			if (diff.removed) {
				return undefined;
			} else {
				const localOffset = trackingOriginalLine - originalIndex - 1;
				console.log('localOffset', localOffset);
				console.log('modified index', modifiedIndex);
				// return modifiedIndex - originalIndex + localOffset - 1;
				return modifiedIndex - originalIndex;
				// console.log('')
			}
		}
		if (diff.removed) {
			// modifiedIndex -= diff.count || 0;
		} else if (diff.added) {
			modifiedIndex += diff.count || 0;
		} else {
			modifiedIndex += diff.count || 0;
		}
		
		// if (diff.added) {
		// 	originalIndex += diff.count || 0;
		// } else if (diff.removed) {
		// 	originalIndex -= diff.count || 0;
		// } else {
		// 	originalIndex += diff.count || 0;
		// }
		// if (!diff.added && !diff.removed) {
		// 	originalIndex += diff.count || 0;
		// }
		if (diff.removed) {
			originalIndex += diff.count || 0;
		} else if (diff.added) {
			// originalIndex -= diff.count || 0;
			originalAddIndex += diff.count || 0;
		} else {
			originalIndex += diff.count || 0;
		}
	}

	console.log('originalIndex', originalIndex);
	console.log('modifiedIndex', modifiedIndex);
}

function getOffsetUnindexed(trackingOriginalStartlLine: number, trackingOriginalEndLine: number, diffs: diff.Change[]) {
	let originalIndex = 0;
	let modifiedIndex = 0;

	for (const diff of diffs) {
		console.log('diff', diff)
		console.log('trackingOriginalStartlLine', trackingOriginalStartlLine)
		console.log('trackingOriginalEndLine', trackingOriginalEndLine)
		console.log('originalIndex', originalIndex)
		console.log('modifiedIndex', modifiedIndex)
		console.log('===============')

		if (
			trackingOriginalStartlLine >= originalIndex + 1
			&& trackingOriginalEndLine < 1 + originalIndex + (diff.count || 0)
			&& (diff.removed || (!diff.removed && !diff.added))
		) {
			if (diff.removed) {
				return undefined;
			} else {
				const localOffset = trackingOriginalStartlLine - originalIndex - 1;
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

	console.log('originalIndex', originalIndex);
	console.log('modifiedIndex', modifiedIndex);
}

function getOffset(trackingOriginalStartlLine: number, trackingOriginalEndLine: number, diffs: diff.Change[]) {
	let originalIndex = 0;
	let modifiedIndex = 0;

	for (const diff of diffs) {
		console.log('diff', diff)
		console.log('trackingOriginalStartlLine', trackingOriginalStartlLine)
		console.log('trackingOriginalEndLine', trackingOriginalEndLine)
		console.log('originalIndex', originalIndex)
		console.log('modifiedIndex', modifiedIndex)
		console.log('===============')

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

	console.log('originalIndex', originalIndex);
	console.log('modifiedIndex', modifiedIndex);
}