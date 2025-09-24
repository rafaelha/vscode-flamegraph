import { expect } from 'chai';
import { Workbench, VSBrowser, EditorView } from 'vscode-extension-tester';
import * as path from 'path';
import * as fs from 'fs';
import { cleanUpProfileFiles, PYSPY_PROFILE_PATH, MEMRAY_PROFILE_PATH } from './helpers';

describe('Run profilers', () => {
    beforeEach(async () => {
        await cleanUpProfileFiles();
        await new EditorView().closeAllEditors();
    });

    it('Run py-spy on Python fileand verify profile file was created', async () => {
        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.false;
        await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project', 'main.py'));
        await new Workbench().executeCommand('Flamegraph: Profile file with py-spy');
        await VSBrowser.instance.driver.sleep(2000);

        expect(fs.existsSync(PYSPY_PROFILE_PATH)).to.be.true;
    });

    it('Run memray on Python file and verify profile file was created', async () => {
        expect(fs.existsSync(MEMRAY_PROFILE_PATH)).to.be.false;
        await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project', 'main.py'));

        await new Workbench().executeCommand('Flamegraph: Profile file with memray');
        await VSBrowser.instance.driver.sleep(4000);

        expect(fs.existsSync(MEMRAY_PROFILE_PATH)).to.be.true;
    });
});
