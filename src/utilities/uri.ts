// Smart wrapper that automatically switches based on NODE_ENV
// eslint-disable-next-line import/no-mutable-exports
let URI: any;

if (process.env.NODE_ENV === 'development') {
    // In development, use vscode.Uri
    // eslint-disable-next-line global-require
    const { URI: DevURI } = require('vscode-uri');
    URI = DevURI;
} else {
    // In development, use vscode-uri
    // eslint-disable-next-line global-require
    const vscode = require('vscode');
    URI = vscode.Uri;
}

export { URI };
