import * as path from 'path';
import * as fs from 'fs';

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
