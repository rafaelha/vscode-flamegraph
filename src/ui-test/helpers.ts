import * as path from 'path';
import * as fs from 'fs';
import { By, VSBrowser, WebView } from 'vscode-extension-tester';

export const PYSPY_PROFILE_PATH = path.join('src', 'ui-test', 'resources', 'test-project', 'profile.pyspy');
export const MEMRAY_PROFILE_PATH = path.join('src', 'ui-test', 'resources', 'test-project', 'profile.memray');

export async function cleanUpProfileFiles() {
    // Clean up any existing profile files before each test
    const filesToClean = [PYSPY_PROFILE_PATH, MEMRAY_PROFILE_PATH];

    await Promise.all(
        filesToClean.map(async (filePath) => {
            try {
                await fs.promises.unlink(filePath);
            } catch (error) {
                // File might not exist, which is fine
            }
        })
    );
}

export async function waitForFlamegraphWebView() {
    return VSBrowser.instance.driver.wait(
        async () => {
            const view = new WebView();
            try {
                await view.switchToFrame();
                // Wait for a known element inside the webview to confirm it has loaded
                await view.findWebElement(By.className('codicon-code'));
                view.switchBack();
                return true;
            } catch (err) {
                try {
                    await view.switchBack();
                } catch (e) {
                    /* noop */
                }
                return false;
            }
        },
        5_000,
        'Timed out waiting for Flamegraph WebView to load'
    );
}

/**
 * Retries an async operation with retry logic for ElementNotInteractableError or TimeoutError
 * @param operation The async function to retry
 * @param timeoutMs Maximum time to retry in milliseconds (default: 3000)
 * @param retryDelayMs Delay between retries in milliseconds (default: 100)
 * @returns Promise that resolves to the operation result
 */
export async function retryOnError<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 10_000,
    retryDelayMs: number = 100
): Promise<T> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        await VSBrowser.instance.driver.sleep(retryDelayMs);
        try {
            // eslint-disable-next-line no-await-in-loop
            return await operation();
        } catch (error) {
            if (
                error instanceof Error &&
                (error.name === 'ElementNotInteractableError' || error.name === 'TimeoutError')
            ) {
                continue;
            }
            throw error;
        }
    }

    // Final attempt after timeout
    return operation();
}
