import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { getPythonPath, getPySpyPath } from './utilities/fsUtils';
import { escapeSpaces } from './utilities/pathUtils';

export const PROFILE_FILENAME = 'profile.pyspy';
export const MEMRAY_PROFILE_FILENAME = 'profile.memray';

/**
 * Task definition for the flamegraph profiler tasks. This will be used to execute the py-spy command
 * `{py-spy-path} <py-spy-args, i.e. --subprocesses --native> {record|top} -- {python-path} {file} {args}`
 * or
 * `{py-spy-path} <py-spy-args, i.e. --subprocesses --native> {record|top} --pid {pid}`
 */
export interface FlamegraphTaskDefinition extends vscode.TaskDefinition {
    /**
     * The type of the task (should be 'flamegraph')
     */
    type: 'flamegraph';

    /**
     * The mode of the task (should be 'record' or 'top')
     */
    mode?: 'record' | 'top';

    /**
     * The python file to profile (optional)
     */
    file?: string;

    /**
     * The process ID to attach to, should only be provided if file is not provided (optional)
     */
    pid?: string;

    /**
     * Profile subprocesses of the original process
     */
    subprocesses?: boolean;

    /**
     * Record native stack traces. This will include stack traces of compiled code.
     */
    native?: boolean;

    /**
     * Only include traces that are holding on to the GIL
     */
    gil?: boolean;

    /**
     * Include stack traces for idle threads
     */
    idle?: boolean;

    /**
     * Don't pause the python process when collecting samples.
     * Setting this option will reduce the performance impact of sampling, but may lead to inaccurate results
     */
    nonblocking?: boolean;

    /**
     * The arguments to pass to the profiler (optional).
     */
    args?: string[];

    /**
     * The path to the Python interpreter (optional)
     */
    pythonPath?: string;

    /**
     * The path to the profiler (optional)
     */
    profilerPath?: string;

    /**
     * Whether to run the task with sudo (optional)
     */
    sudo?: boolean;
}

export interface FlamegraphMemrayTaskDefinition extends vscode.TaskDefinition {
    /**
     * The type of the task (should be 'flamegraph')
     */
    type: 'flamegraph';

    /**
     * The mode of the task (should be 'record' or 'top')
     */
    mode?: 'run' | 'attach' | 'detach' | 'transform';

    /**
     * The process ID to attach to, should only be provided if file is not provided (optional)
     */
    pid?: string;

    /**
     * The python file to profile (optional)
     */
    file?: string;

    /**
     * The path to the Python interpreter (optional)
     */
    pythonPath: string;

    /**
     * Whether to wait for a key press before detaching the profiler
     */
    waitForKeyPress?: boolean;
}

/**
 * Creates a profiling task based on the task definition
 *
 * @param workspaceFolder - The workspace folder to run the task in
 * @param definition - The task definition
 * @param name - The name of the task
 * @param silent - Whether to run the task silently
 * @param pythonPath - The path to the Python interpreter
 * @param profilerPath - The path to the profiler
 * @returns The flamegraph profiling task
 */
export function createProfileTask(
    workspaceFolder: vscode.WorkspaceFolder,
    definition: FlamegraphTaskDefinition,
    name: string = 'Flamegraph',
    silent: boolean = false,
    pythonPath: string | undefined = undefined,
    profilerPath: string | undefined = undefined
): vscode.Task {
    const config = vscode.workspace.getConfiguration('flamegraph.py-spy');
    let command = '';

    const sudo =
        definition.sudo || os.platform() === 'darwin' || config.get<boolean>('alwaysUseSudo', false) ? 'sudo ' : '';
    const ampersand = os.platform() === 'win32' ? '& ' : '';
    const mode = definition.mode || 'record';

    const subprocesses = definition.pid
        ? definition.subprocesses || config.get<boolean>('subprocessesAttach', true)
        : definition.subprocesses || config.get<boolean>('subprocesses', true);
    const native = definition.pid
        ? definition.native || config.get<boolean>('nativeAttach', false)
        : definition.native || config.get<boolean>('native', false);
    const gil = definition.gil || config.get<boolean>('gil', false);
    const idle = definition.idle || config.get<boolean>('idle', false);
    const nonblocking = definition.nonblocking || config.get<boolean>('nonblocking', false);

    const pySpyArgs = [
        `${ampersand}${sudo}"${profilerPath || definition.profilerPath}" ${mode}`,
        mode === 'record' ? `--output ${PROFILE_FILENAME}` : '',
        mode === 'record' ? '--format raw' : '',
        mode === 'record' ? '--full-filenames' : '',
        subprocesses ? '--subprocesses' : '',
        native ? '--native' : '',
        gil ? '--gil' : '',
        idle ? '--idle' : '',
        nonblocking ? '--nonblocking' : '',
        definition.pid ? `--pid ${definition.pid}` : '',
        definition.pythonPath || pythonPath ? `-- "${definition.pythonPath || pythonPath}"` : '',
        definition.file ? `"${definition.file}"` : '',
    ]
        .filter(Boolean)
        .join(' ');

    const argsStr = definition.args ? definition.args.map((arg) => `"${arg}"`).join(' ') : '';
    command = escapeSpaces(`${pySpyArgs} ${argsStr}`);

    const task = new vscode.Task(
        definition,
        workspaceFolder,
        name,
        'Flamegraph',
        new vscode.ShellExecution(command, {
            executable: os.platform() === 'win32' ? 'powershell.exe' : undefined,
        }),
        []
    );

    if (silent) {
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Never,
            panel: vscode.TaskPanelKind.Shared,
            clear: false,
        };
    }

    return task;
}

/**
 * Creates a profiling task for memray
 *
 * @param workspaceFolder - The workspace folder to run the task in
 * @param definition - The task definition
 * @param name - The name of the task. Defaults to 'Flamegraph'
 * @param silent - Whether to run the task silently
 * @param pythonPath - The path to the Python interpreter
 * @returns The memray profiling task
 */
export function createMemrayProfileTask(
    workspaceFolder: vscode.WorkspaceFolder,
    definition: FlamegraphMemrayTaskDefinition,
    name: string = 'Flamegraph',
    silent: boolean = false
): vscode.Task {
    const config = vscode.workspace.getConfiguration('flamegraph.memray');
    let command = '';

    const sudo = config.get<boolean>('alwaysUseSudo', false) ? 'sudo ' : '';
    const mode = definition.mode || 'run';
    const transformBin = definition.mode === 'transform' || definition.mode === 'detach' || definition.waitForKeyPress;

    const python = definition.pythonPath;
    const tempBin = `temp-memray-profile.bin`;
    const pySpyArgs = [
        definition.mode !== 'transform' ? `${sudo}"${python}" -m memray ${mode}` : '',
        definition.mode !== 'detach' && definition.mode !== 'transform' ? `--aggregate -f -o ${tempBin}` : '',
        definition.file ? `"${definition.file}"` : '',
        definition.mode === 'attach' || definition.mode === 'detach' ? `${definition.pid}` : '',
        definition.waitForKeyPress
            ? `; echo "Memray attached to process ${definition.pid}. Press <Enter> to detach and show results..." && read -n 1; "${python}" -m memray detach ${definition.pid}`
            : '',
        transformBin ? `; "${python}" -m memray transform csv ${tempBin} -o profile.memray -f; rm ${tempBin}` : '',
    ]
        .filter(Boolean)
        .join(' ');

    const argsStr = definition.args ? definition.args.map((arg: string) => `"${arg}"`).join(' ') : '';
    command = escapeSpaces(`${pySpyArgs} ${argsStr}`);

    const task = new vscode.Task(
        definition,
        workspaceFolder,
        name,
        'Flamegraph',
        new vscode.ShellExecution(command),
        []
    );

    if (silent) {
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Never,
            panel: vscode.TaskPanelKind.Shared,
            clear: false,
        };
    }

    return task;
}

/**
 * Task provider for flamegraph profiling tasks
 */
export class FlamegraphTaskProvider implements vscode.TaskProvider {
    static taskType = 'flamegraph';

    /**
     * Provides the flamegraph profiling tasks
     *
     * @returns The flamegraph profiling tasks
     */
    public async provideTasks(): Promise<vscode.Task[]> {
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }
        const pythonPath = await getPythonPath();
        if (!pythonPath) {
            return [];
        }
        const profilerPath = await getPySpyPath();
        if (!profilerPath) {
            return [];
        }

        const tasks = [];

        // Get active editor to suggest profiling the current file
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath.endsWith('.py')) {
            const filePath = editor.document.uri.fsPath;
            const fileName = path.basename(filePath);

            // Add profile current file task as the only example task
            tasks.push(
                createProfileTask(
                    workspaceFolder,
                    {
                        type: 'flamegraph',
                        file: filePath,
                        subprocesses: true,
                        pythonPath,
                        profilerPath,
                    },
                    `Profile ${fileName}`
                )
            );

            tasks.push(
                createProfileTask(
                    workspaceFolder,
                    {
                        type: 'flamegraph',
                        args: ['-m', 'pytest', `${filePath}`],
                        pythonPath,
                        profilerPath,
                    },
                    `Profile pytests in ${fileName}`
                )
            );
        }
        tasks.push(
            createProfileTask(
                workspaceFolder,
                { type: 'flamegraph', args: ['-m', 'pytest'], pythonPath, profilerPath },
                `Profile all pytests`
            )
        );

        return tasks;
    }

    /**
     * Resolves a task from a task definition
     *
     * @param task - The task to resolve
     * @returns The resolved task
     */
    public async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
        const definition = task.definition as FlamegraphTaskDefinition;

        if (definition.type !== FlamegraphTaskProvider.taskType) {
            return undefined;
        }

        const workspaceFolder = task.scope as vscode.WorkspaceFolder;
        if (!workspaceFolder) {
            return undefined;
        }

        return createProfileTask(
            workspaceFolder,
            definition,
            task.name,
            false,
            definition.pythonPath || (await getPythonPath()),
            definition.profilerPath || (await getPySpyPath())
        );
    }
}
