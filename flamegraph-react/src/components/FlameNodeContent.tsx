import React from 'react';
import { Highlight } from 'prism-react-renderer';
import { minimalTheme } from '../utilities/themes';

interface FlameNodeContentProps {
    sourceCode?: string;
    functionName: string;
    fileName?: string;
    line?: number;
}

export function FlameNodeContent({ sourceCode, functionName, fileName, line }: FlameNodeContentProps) {
    const fileInfo = fileName ? (line ? `${fileName}:${line}` : fileName) : '';

    return (
        <div className="node-label">
            <span>
                {sourceCode ? (
                    <Highlight code={sourceCode} language="python" theme={minimalTheme}>
                        {({ tokens, getTokenProps }) => (
                            <>
                                {tokens[0].map((token, i) => (
                                    <span key={i} {...getTokenProps({ token })} />
                                ))}
                            </>
                        )}
                    </Highlight>
                ) : (
                    functionName
                )}
            </span>
            <span>{fileInfo}</span>
        </div>
    );
}
