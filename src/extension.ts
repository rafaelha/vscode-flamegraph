import { commands, ExtensionContext } from "vscode";
import { FlamegraphPanel } from "./panels/FlamegraphPanel";

export function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showFlamegraphCommand = commands.registerCommand(
    "flamegraph.showFlamegraph",
    () => {
      FlamegraphPanel.render(context.extensionUri);
    }
  );

  // Add command to the extension context
  context.subscriptions.push(showFlamegraphCommand);
}
