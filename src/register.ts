import * as vscode from "vscode";
import { parseProfilingData } from "./utilities/ProfileParser";
import { updateDecorations } from "./render";
import { readTextFile, selectProfileFile } from "./utilities/io";
import { lineColorDecorationType } from "./render";
import { FlamegraphPanel } from "./panels/FlamegraphPanel";

export async function registerProfile(
  context: vscode.ExtensionContext,
  profileUri: vscode.Uri
) {
  const profileString = await readTextFile(profileUri);
  context.workspaceState.update("profileData", profileString);
  const result = parseProfilingData(profileString);

  // Update decorations when the active editor changes
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      updateDecorations(editor, result);
    },
    null,
    context.subscriptions
  );

  // Update decorations when the document changes
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      updateDecorations(vscode.window.activeTextEditor, result);
    },
    null,
    context.subscriptions
  );

  // Initial update for the current active editor
  updateDecorations(vscode.window.activeTextEditor, result);
}

export function unregisterProfile(context: vscode.ExtensionContext) {
  // Remove decorations
  vscode.window.visibleTextEditors.forEach((editor) => {
    editor.setDecorations(lineColorDecorationType, []);
  });

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      editor?.setDecorations(lineColorDecorationType, []);
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      vscode.window.activeTextEditor?.setDecorations(
        lineColorDecorationType,
        []
      );
    },
    null,
    context.subscriptions
  );
}
