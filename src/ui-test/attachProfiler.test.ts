import { expect } from 'chai';
import { BottomBarPanel, EditorView, TerminalView, Workbench } from 'vscode-extension-tester';
import { retryOnError } from './helpers';

const PID = '999999';

describe('Attach profilers', () => {
    let bottomBar: BottomBarPanel;
    let view: TerminalView;

    before(async () => {
        await new EditorView().closeAllEditors();
        bottomBar = new BottomBarPanel();
        await bottomBar.toggle(true);
        view = await bottomBar.openTerminalView();
    });

    it(`Attach py-spy to running process`, async () => {
        const prompt = await new Workbench().openCommandPrompt();
        await prompt.setText('>Flamegraph: Attach py-spy to running process');
        await prompt.confirm();
        await retryOnError(() => prompt.setText(PID));
        await prompt.confirm();
        const text = await retryOnError(() => view.getText());
        expect(text).to.contain(
            `record --output profile.pyspy --format raw --full-filenames --subprocesses --pid ${PID}`
        );
        await retryOnError(() => view.killTerminal());
    });

    it(`Attach py-spy to running process with initially invalid pid`, async () => {
        const prompt = await new Workbench().openCommandPrompt();
        await prompt.setText('>Flamegraph: Attach py-spy to running process');
        await prompt.confirm();
        await retryOnError(() => prompt.setText('xxxxx'));
        await prompt.confirm();
        await retryOnError(() => prompt.setText(PID));
        await prompt.confirm();
        const text = await retryOnError(() => view.getText());
        expect(text).to.contain(
            `record --output profile.pyspy --format raw --full-filenames --subprocesses --pid ${PID}`
        );
        await retryOnError(() => view.killTerminal());
    });

    it(`Attach memray to running process`, async () => {
        const prompt = await new Workbench().openCommandPrompt();
        await prompt.setText('>Flamegraph: Attach memray to running process');
        await prompt.selectQuickPick('Flamegraph: Attach memray to running process');
        await retryOnError(() => prompt.setText(PID));
        await prompt.confirm();
        const text = await retryOnError(() => view.getText());
        expect(text).to.contain(`attach --aggregate -f -o temp-memray-profile.bin ${PID}`);
        await retryOnError(() => view.killTerminal());
    });
});
