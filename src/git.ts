import * as vscode from 'vscode';
import { GitExtension } from './api/git';

const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
const gitApi = gitExtension.getAPI(1);

export function onRepositoryChange(cb: () => any) {
    
}

export async function getLastCommits(count = 100) {
    
}