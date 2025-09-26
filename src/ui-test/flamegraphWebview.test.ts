import { expect } from 'chai';
import { Workbench, VSBrowser, EditorView, WebView, By } from 'vscode-extension-tester';
import * as path from 'path';
import { waitForFlamegraphWebView } from './helpers';

describe('Flamegraph webview', () => {
    let view: WebView;
    before(async () => {
        await new EditorView().closeAllEditors();
        await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'test-project', 'main.py'));
        await new Workbench().executeCommand('Flamegraph: Profile file with py-spy');
        await waitForFlamegraphWebView();
        view = new WebView();
        await view.switchToFrame();
    });

    after(async () => {
        await view.switchBack();
    });

    it('Test code toggle', async () => {
        const toggle = await view.findWebElement(By.className('codicon-code'));

        let elements = await view.findWebElements(By.css('div.node-label > span:first-of-type'));
        let texts = new Set(await Promise.all(elements.map((element) => element.getText())));
        const expectedCode = ['all', 'total += sqrt(i)', 'main()'];
        const expectedFunctions = ['<module>', 'main', 'all'];

        let allCodeIncluded = expectedCode.every((code) => texts.has(code));
        expect(allCodeIncluded).to.be.true;

        let allFunctionsIncluded = expectedFunctions.every((functionName) => texts.has(functionName));
        expect(allFunctionsIncluded).to.be.false;

        await toggle.click();

        elements = await view.findWebElements(By.css('div.node-label > span:first-of-type'));
        texts = new Set(await Promise.all(elements.map((element) => element.getText())));

        allCodeIncluded = expectedCode.every((code) => texts.has(code));
        expect(allCodeIncluded).to.be.false;

        allFunctionsIncluded = expectedFunctions.every((functionName) => texts.has(functionName));
        expect(allFunctionsIncluded).to.be.true;

        await toggle.click();
    });

    it('Filters module by clicking on the module name in legend', async () => {
        const toggle = await view.findWebElement(
            By.xpath(
                "//label[contains(@class,'flex items-center cursor-pointer') " +
                    "and following-sibling::span[normalize-space()='main.py']]"
            )
        );
        const expectedCode = ['total += sqrt(i)', 'main()'];
        let elements = await view.findWebElements(By.css('div.node-label > span:first-of-type'));
        let texts = new Set(await Promise.all(elements.map((element) => element.getText())));
        const allCodeIncluded = expectedCode.every((code) => texts.has(code));
        expect(allCodeIncluded).to.be.true;

        await toggle.click();

        elements = await view.findWebElements(By.css('div.node-label > span:first-of-type'));
        texts = new Set(await Promise.all(elements.map((element) => element.getText())));
        const anyCodeIncluded = expectedCode.some((code) => texts.has(code));
        expect(anyCodeIncluded).to.be.false;

        await toggle.click();
    });
});
