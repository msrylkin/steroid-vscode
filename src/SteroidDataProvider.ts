import * as vscode from 'vscode';
import { StateResponse } from './steroidApi';

export class SteroidDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private commit: string;
    private data: TreeItem[];
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(commit: string, traces: StateResponse['latestRelease']['codePlaces']): void {
        this.commit = commit;
        this.data = this.mapTracesToTreeViewItems(traces);
        this._onDidChangeTreeData.fire();
    }

    constructor(commit: string, traces: StateResponse['latestRelease']['codePlaces']) {
        // this.data = [new vscode.TreeItem('Meow!')];
        this.commit = commit;
        this.data = this.mapTracesToTreeViewItems(traces);
    }

    getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return this.data;
        }
        // return element;
        //   return element.children;
        // return [new vscode.TreeItem('item asdZXC', vscode.TreeItemCollapsibleState.Collapsed)];
    }

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
        // return new vscode.TreeItem('item asdZXC', vscode.TreeItemCollapsibleState.Collapsed);
    }

    private mapTracesToTreeViewItems(traces: StateResponse['latestRelease']['codePlaces']) {
        return traces.map(
            ({ fileName, startColumn, startLine, executionTime }) => new TreeItem(fileName, startColumn, startLine, executionTime, this.commit)
        );
    }
}

class TreeItem extends vscode.TreeItem {
    fileName: string;
    startColumn: number;
    startLine: number;
    executionTime: number;
    commit: string;

    constructor(fileName: string, startColumn: number, startLine: number, executionTime: number, commit: string) {
        super(`${fileName}:${startLine}:${startColumn} 224ms`);
        this.fileName = fileName;
        this.startColumn = startColumn;
        this.startLine = startLine;
        this.executionTime = executionTime;
        this.commit = commit;
    }

    command: vscode.Command | undefined = {
        title: 'show',
        command: 'steroidTraces.viewInTextEditor'
    }
}