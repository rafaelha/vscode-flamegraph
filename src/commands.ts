import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { selectProfileFile } from "./utilities/io";
import { registerProfile, unregisterProfile } from "./register";

export function loadProfileCommand(context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand("flamegraph.loadProfile", async () => {
    const profileUri = await selectProfileFile();
    context.workspaceState.update("profileUri", profileUri);
    context.workspaceState.update("profileVisible", true);

    if (!profileUri) {
      vscode.window.showErrorMessage("No profile file selected.");
      return;
    }
    registerProfile(context, profileUri);

    vscode.window.showInformationMessage("Profile loaded successfully.");
  });
}

export function toggleProfileCommand(context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand("flamegraph.toggleProfile", () => {
    const profileVisible = context.workspaceState.get("profileVisible") as
      | boolean
      | undefined;
    const profileUri = context.workspaceState.get("profileUri") as
      | vscode.Uri
      | undefined;
    console.log("profileVisible", profileVisible);

    if (profileVisible) {
      unregisterProfile(context);
      context.workspaceState.update("profileVisible", false);
    } else {
      if (!profileUri) {
        vscode.window.showErrorMessage(
          "No profile loaded. Please load a profile first."
        );
        return;
      }
      registerProfile(context, profileUri);
      context.workspaceState.update("profileVisible", true);
    }
  });
}

export function runProfilerCommand(context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand("flamegraph.runProfiler", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found.");
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      editor.document.uri
    );

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("File is not part of a workspace.");
      return;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
    let terminal: vscode.Terminal;

    const platform = os.platform();
    if (platform === "darwin" || platform === "linux") {
      // macOS or Linux
      terminal = vscode.window.createTerminal("PySpy Profiler");
      terminal.sendText(
        `sudo py-spy record -o .pyspy-profile --format raw -- python ${relativePath} && exit`
      );
    } else if (platform === "win32") {
      // Windows
      terminal = vscode.window.createTerminal("PySpy Profiler", "cmd.exe");
      terminal.sendText(
        `py-spy record -o .pyspy-profile --format raw -s python ${relativePath.replace(
          /\\/g,
          "/"
        )} && exit`
      );
    } else {
      vscode.window.showErrorMessage("Unsupported platform");
      return;
    }
    terminal.show();

    vscode.window.showInformationMessage(
      "Profiler started. The profile will be registered when finished."
    );

    // Wait for the terminal to finish
    const disposable = vscode.window.onDidCloseTerminal(
      async (closedTerminal) => {
        if (closedTerminal === terminal) {
          disposable.dispose();

          // Check if .pyspy-profile exists
          const profileUri = vscode.Uri.file(
            path.join(workspaceFolder.uri.fsPath, ".pyspy-profile")
          );
          try {
            await vscode.workspace.fs.stat(profileUri);
            // File exists, register the profile
            await registerProfile(context, profileUri);
            context.workspaceState.update("profileUri", profileUri);
            context.workspaceState.update("profileVisible", true);

            // open the flamegraph
            vscode.commands.executeCommand("flamegraph.showFlamegraph");
          } catch {
            vscode.window.showErrorMessage(
              "Profile file not found after profiling."
            );
          }
        }
      }
    );
  });
}
