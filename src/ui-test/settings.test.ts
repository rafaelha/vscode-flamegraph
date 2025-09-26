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
import { retryOnError } from './helpers';

describe('Settings Editor sample tests', () => {
    let settings: SettingsEditor;
    let bottomBar: BottomBarPanel;
    let view: TerminalView;

    beforeEach(async () => {
        await new EditorView().closeAllEditors();
        settings = await new Workbench().openSettings();
        bottomBar = new BottomBarPanel();
        await bottomBar.toggle(true);
        view = await bottomBar.openTerminalView();
    });

    after(async () => {
        await bottomBar.toggle(false);
    });

    const testCases = [
        { profiler: 'Py-spy', settingName: 'Gil', commandFlag: '--gil', defaultSetting: false },
        { profiler: 'Py-spy', settingName: 'Subprocesses', commandFlag: '--subprocesses', defaultSetting: true },
        { profiler: 'Py-spy', settingName: 'Native', commandFlag: '--native', defaultSetting: false },
        { profiler: 'Py-spy', settingName: 'Idle', commandFlag: '--idle', defaultSetting: false },
        { profiler: 'Py-spy', settingName: 'Nonblocking', commandFlag: '--nonblocking', defaultSetting: false },
        { profiler: 'Memray', settingName: 'Native', commandFlag: '--native', defaultSetting: false },
        {
            profiler: 'Memray',
            settingName: 'Trace Python Allocators',
            commandFlag: '--trace-python-allocators',
            defaultSetting: false,
        },
    ];

    testCases.forEach(({ profiler, settingName, commandFlag, defaultSetting }) => {
        it(`Manipulate setting and verify command flag: Flamegraph > ${profiler} > ${settingName}`, async () => {
            const setting = await settings.findSetting(settingName, 'Flamegraph', profiler);
            const simpleDialogSetting = setting as CheckboxSetting;
            const value = await simpleDialogSetting.getValue();
            expect(value).to.equal(defaultSetting);

            const runAndAssert = async (newValue: boolean) => {
                await simpleDialogSetting.setValue(newValue);

                await VSBrowser.instance.openResources(
                    path.join('src', 'ui-test', 'resources', 'test-project', 'empty_file.py')
                );
                await new Workbench().executeCommand(`Flamegraph: Profile file with ${profiler}`);

                const text = await retryOnError(() => view.getText());
                if (newValue) expect(text).to.contain(commandFlag);
                else expect(text).not.to.contain(commandFlag);

                await retryOnError(() => view.killTerminal());
                await new EditorView().closeEditor('empty_file.py');
            };

            await runAndAssert(!defaultSetting);
            await runAndAssert(defaultSetting);
        });
    });
});
