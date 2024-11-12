import { basename } from "path";

export function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

export function getFileName(filePath: string) {
  return basename(filePath);
}

export type ProfilingEntry = {
  num_samples: number;
  function_name: string;
};

export type ProfilingResult = {
  filePath: string;
  profile: {
    [lineNumber: string]: {
      functionName: string;
      numSamples: {
        [callStack: string]: number; // num_samples
      };
    };
  };
  functionProfile: {
    [functionName: string]: {
      total_samples: number;
      max_samples: number;
    };
  };
};

export type ProfilingResults = {
  [fileName: string]: ProfilingResult[];
};

/**
 * Parses profiling data and structures it into a nested object.
 *
 * @param data - The raw profiling data as a string.
 * @returns A structured ProfilingResult object.
 */
export function parseProfilingData(data: string): ProfilingResults {
  const result: ProfilingResults = {};

  // Split the input data into lines
  const lines = data.trim().split("\n");

  lines.forEach((originalLine, lineIndex) => {
    const line = originalLine.trim();
    if (line === "") {
      return; // Skip empty lines
    }

    // Separate the call stack from the sample count
    const lastSpaceIndex = line.lastIndexOf(" ");
    if (lastSpaceIndex === -1) {
      return;
    }

    const callStackStr = line.substring(0, lastSpaceIndex);
    const numSamplesStr = line.substring(lastSpaceIndex + 1);
    const numSamples = parseInt(numSamplesStr, 10);

    if (isNaN(numSamples)) {
      console.warn(
        `Invalid number of samples: "${numSamplesStr}" in line ${
          lineIndex + 1
        }: ${line}`
      );
      return;
    }

    // Split the call stack into individual frames
    const frames = callStackStr
      .split(";")
      .map((frameStr) => frameStr.trim())
      .filter((f) => f !== "");

    // To build the call stack progressively
    let accumulatedCallStack = "";
    const processedLocations = new Set<string>();

    frames.forEach((frame, frameIndex) => {
      // Match the function name and file:line using regex
      // const regex = /\s*(\w+)\s+\(([^:]+):(\d+)\)/;
      const regex = /\s*(<\w+>|\w+)\s+\(([^:]+):(\d+)\)/;
      const matches = frame.match(regex);
      if (!matches) {
        console.warn(
          `Invalid frame format at line ${lineIndex + 1}, frame ${
            frameIndex + 1
          }: "${frame}"`
        );
        return;
      }
      const functionName = matches[1].trim();
      const filePath = matches[2].trim();
      const fileName = getFileName(filePath);
      const lineNumber = matches[3].trim();
      const locationKey = `${filePath}:${lineNumber}`;

      // Skip if the location has already been processed in the current stack trace. This happens for recursive calls
      if (processedLocations.has(locationKey)) {
        return;
      }
      processedLocations.add(locationKey);

      // Initialize the file entry if it doesn't exist
      result[fileName] ??= [];

      let profilingResults = result[fileName];

      // get index of filePath in the list of filePaths
      let filePathIndex = profilingResults.findIndex(
        (x) => x.filePath === filePath
      );

      let profilingResult: ProfilingResult;
      if (filePathIndex === -1) {
        profilingResult = {
          filePath,
          profile: {},
          functionProfile: {},
        };
        profilingResults.push(profilingResult);
      } else {
        profilingResult = profilingResults[filePathIndex];
      }

      let profile = profilingResult.profile;
      let functionProfile = profilingResult.functionProfile;

      profile[lineNumber] ??= { functionName: functionName, numSamples: {} };
      profile[lineNumber].numSamples[accumulatedCallStack] ??= 0;
      profile[lineNumber].numSamples[accumulatedCallStack] += numSamples;

      functionProfile[functionName] ??= {
        total_samples: 0,
        max_samples: 0,
      };
      functionProfile[functionName].total_samples += numSamples;
      functionProfile[functionName].max_samples = Math.max(
        functionProfile[functionName].max_samples,
        numSamples
      );

      // Update the accumulated call stack for the next frame
      accumulatedCallStack = accumulatedCallStack
        ? `${accumulatedCallStack};${functionName} (${filePath}:${lineNumber})`
        : `${functionName} (${filePath}:${lineNumber})`;
    });
  });

  return result;
}
