import { expect } from 'chai';
import * as path from 'path';
import {
    BottomBarPanel,
    CheckboxSetting,
    EditorView,
    SettingsEditor,
    TerminalView,
    VSBrowser,
    Workbench,
} from 'vscode-extension-tester';

describe('Settings Editor sample tests', () => {
    let settings: SettingsEditor;
    let bottomBar: BottomBarPanel;
    let view: TerminalView;
    before(async () => {
        settings = await new Workbench().openSettings();
        bottomBar = new BottomBarPanel();
        await bottomBar.toggle(true);
        view = await bottomBar.openTerminalView();
    });

    const testCases = [
        { settingName: 'Gil', commandFlag: '--gil', defaultSetting: false },
        { settingName: 'Subprocesses', commandFlag: '--subprocesses', defaultSetting: true },
        { settingName: 'Native', commandFlag: '--native', defaultSetting: false },
        { settingName: 'Idle', commandFlag: '--idle', defaultSetting: false },
        { settingName: 'Nonblocking', commandFlag: '--nonblocking', defaultSetting: false },
    ];

    testCases.forEach(({ settingName, commandFlag, defaultSetting }) => {
        it(`Manipulate setting and verify command flag: ${settingName}`, async () => {
            const setting = await settings.findSetting(settingName, 'Flamegraph', 'Py-spy');
            const simpleDialogSetting = setting as CheckboxSetting;
            const value = await simpleDialogSetting.getValue();
            expect(value).to.equal(defaultSetting);

            const runAndAssert = async (newValue: boolean) => {
                await simpleDialogSetting.setValue(newValue);

                await VSBrowser.instance.openResources(
                    path.join('src', 'ui-test', 'resources', 'test-project', 'empty_file.py')
                );
                await new Workbench().executeCommand('Flamegraph: Profile file with py-spy');

                await VSBrowser.instance.driver.sleep(500);
                const text = await view.getText();
                await view.killTerminal();

                if (newValue) expect(text).to.contain(commandFlag);
                else expect(text).not.to.contain(commandFlag);

                await new EditorView().closeEditor('empty_file.py');
            };

            await runAndAssert(true);
            await runAndAssert(false);
        });
    });
});
