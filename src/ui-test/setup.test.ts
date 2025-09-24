import { VSBrowser } from 'vscode-extension-tester';
import * as path from 'path';

// Global setup that runs once before all UI tests
before(async () => {
    await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project'), async () => {
        await VSBrowser.instance.driver.sleep(1_000); // give vscode workbench some more time to load properly
    });
});
