// Post-tsc import extension rewritter
// tsc outputs ESM with bare imports but Node.js ESM requires explicit extensions

const fs = require('fs');
const path = require('path');

const DIST_DIR = './dist';

function hasJsExtension(specifier) {
    return /\.(js|ts|mjs|cjs|json|mts|cts)$/.test(specifier);
}

// Check if a path exists as-is or with /index.js
function resolveModule(baseDir, specifier) {
    const fullPath = path.join(baseDir, specifier);

    // Direct .js file exists
    if (fs.existsSync(fullPath + '.js')) {
        return specifier + '.js';
    }

    // Directory with index.js exists
    if (fs.existsSync(path.join(fullPath, 'index.js'))) {
        return specifier + '/index.js';
    }

    return null;
}

function rewriteFile(filePath, baseDir) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Combined pattern for both import and export-from statements
    // Matches: import ... from './path' or export ... from './path'
    const importExportPattern =
        /(?:import|export)\s+.*?\s+from\s+(['"])(\.\.?\/[^\s'"]*)\1/g;

    content = content.replace(
        importExportPattern,
        (match, quote, specifier) => {
            // Skip if already has extension or absolute/http
            if (
                hasJsExtension(specifier) ||
                specifier.startsWith('/') ||
                specifier.startsWith('http')
            ) {
                return match;
            }

            const resolved = resolveModule(baseDir, specifier);
            if (resolved) {
                // Directory import resolved to ./path/index.js OR bare import resolved to ./path.js
                const newImport = match.replace(
                    `from ${quote}${specifier}${quote}`,
                    `from ${quote}${resolved}${quote}`,
                );
                if (newImport !== match) {
                    modified = true;
                    return newImport;
                }
                return match;
            }

            // Add .js extension to bare import
            modified = true;
            return match.replace(
                `from ${quote}${specifier}${quote}`,
                `from ${quote}${specifier}.js${quote}`,
            );
        },
    );

    return { content, modified };
}

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let totalModified = 0;

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            totalModified += processDir(fullPath);
        } else if (entry.name.endsWith('.js')) {
            const baseDir = path.dirname(fullPath);
            const { content, modified } = rewriteFile(fullPath, baseDir);

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('postbuild: Rewrote imports in', fullPath);
                totalModified++;
            }
        }
    }
    return totalModified;
}

console.log('postbuild: Rewriting ESM import extensions...');
const count = processDir(DIST_DIR);
console.log(`postbuild: Rewrote imports in ${count} files`);
