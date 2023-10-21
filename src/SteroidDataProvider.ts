import * as vscode from 'vscode';
import { StateResponse } from './steroidApi';

export class SteroidDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private data: vscode.TreeItem[];

    constructor(traces?: StateResponse['latestRelease']['codePlaces']) {
        this.data = [new vscode.TreeItem('Meow!')]
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element === undefined) {
            return this.data;
          }
        //   return element.children;
        // return [new vscode.TreeItem('item asdZXC', vscode.TreeItemCollapsibleState.Collapsed)];
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
        // return new vscode.TreeItem('item asdZXC', vscode.TreeItemCollapsibleState.Collapsed);
    }
}