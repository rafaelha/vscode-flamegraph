import { expect } from 'chai';
import { Workbench, VSBrowser, EditorView } from 'vscode-extension-tester';
import * as path from 'path';
import * as fs from 'fs';
import { cleanUpProfileFiles, PYSPY_PROFILE_PATH, MEMRAY_PROFILE_PATH, waitForFlamegraphWebView } from './helpers';

describe('Run profilers', () => {
    beforeEach(async () => {
        await cleanUpProfileFiles();
        await new EditorView().closeAllEditors();
    });

    it('Run py-spy on Python file and verify profile file was created', async () => {
        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.false;
        await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project', 'main.py'));
        await new Workbench().executeCommand('Flamegraph: Profile file with py-spy');
        await waitForFlamegraphWebView();

        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.true;
    });

    it('Run memray on Python file and verify profile file was created', async () => {
        expect(fs.existsSync(MEMRAY_PROFILE_PATH)).to.be.false;
        await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project', 'main.py'));

        await new Workbench().executeCommand('Flamegraph: Profile file with memray');
        await waitForFlamegraphWebView();

        expect(fs.existsSync(MEMRAY_PROFILE_PATH)).to.be.true;
    });

    it('Run VS Code py-spy task on Python file and verify profile file was created', async () => {
        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.false;
        await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project', 'main.py'));
        const prompt = await new Workbench().openCommandPrompt();
        await prompt.setText('>Tasks: Run Task');
        await prompt.selectQuickPick('Tasks: Run Task');
        await prompt.setText('flamegraph');
        await prompt.confirm();
        await prompt.setText('Flamegraph: Profile main.py');
        await prompt.confirm();
        await waitForFlamegraphWebView();

        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.true;
    });

    it('Run VS Code py-spy task on "Profile all pytests" and verify profile file was created', async () => {
        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.false;
        const prompt = await new Workbench().openCommandPrompt();
        await prompt.setText('>Tasks: Run Task');
        await prompt.selectQuickPick('Tasks: Run Task');
        await prompt.setText('flamegraph');
        await prompt.confirm();
        await prompt.setText('Flamegraph: Profile all pytests');
        await prompt.confirm();
        await waitForFlamegraphWebView();

        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.true;
    });

    it('Run VS Code py-spy task on "Profile all pytests" and verify profile file was created', async () => {
        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.false;
        await VSBrowser.instance.openResources(
            path.join('src', 'ui-test', 'resources', 'test-project', 'test', 'test_main.py')
        );
        const prompt = await new Workbench().openCommandPrompt();
        await prompt.setText('>Tasks: Run Task');
        await prompt.selectQuickPick('Tasks: Run Task');
        await prompt.setText('flamegraph');
        await prompt.confirm();
        await prompt.setText('Flamegraph: Profile pytests in test_main.py');
        await prompt.confirm();
        await waitForFlamegraphWebView();

        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.true;
    });
});
