#!/usr/bin/env node
// Usage: node scripts/syncMapImages.js --remote-url <url> --output <path>
//
// 从远程端点拉取地图图片数据，合并/覆盖到本地 map_images.json
// 远程返回格式: [{ name, path, image }, ...]
// 本地输出格式: { images: [{ path, image, name? }, ...] }

import fs from 'fs';
import path from 'path';
import https from 'node:https';
import http from 'node:http';

function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        remoteUrl: null,
        outputFile: null,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--remote-url') {
            result.remoteUrl = args[++i];
        } else if (arg === '-o' || arg === '--output') {
            result.outputFile = args[++i];
        } else if (arg === '-h' || arg === '--help') {
            showHelp();
            process.exit(0);
        }
    }

    return result;
}

function showHelp() {
    console.log(`
Usage: node scripts/syncMapImages.js [options]

Options:
  --remote-url <url>   远程 HTTP 端点 URL (必需)
  -o, --output <path>  输出文件路径 (默认: ./map_images.json)
  -h, --help           显示帮助信息

Examples:
  node scripts/syncMapImages.js --remote-url https://example.com/api/maps
  node scripts/syncMapImages.js --remote-url https://example.com/api/maps -o data/map_images.json
`);
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        client
            .get(url, (res) => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(
                        new Error(
                            `HTTP ${res.statusCode}: ${res.statusMessage}`,
                        ),
                    );
                    return;
                }

                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(
                            new Error(
                                `Failed to parse JSON: ${e.message}`,
                            ),
                        );
                    }
                });
            })
            .on('error', reject);
    });
}

async function main() {
    const args = parseArgs();

    if (!args.remoteUrl) {
        console.error('Error: --remote-url is required');
        showHelp();
        process.exit(1);
    }

    const outputFile = args.outputFile || './map_images.json';

    console.log(`Fetching data from: ${args.remoteUrl}`);
    const remoteData = await fetchJson(args.remoteUrl);

    if (!Array.isArray(remoteData)) {
        console.error('Error: Remote response is not an array');
        process.exit(1);
    }

    console.log(`Received ${remoteData.length} entries from remote`);

    // Read existing local config if file exists
    let localMap = new Map();
    if (fs.existsSync(outputFile)) {
        try {
            const localRaw = fs.readFileSync(outputFile, 'utf-8');
            const localConfig = JSON.parse(localRaw);
            if (localConfig.images && Array.isArray(localConfig.images)) {
                for (const item of localConfig.images) {
                    localMap.set(item.path, item);
                }
            }
            console.log(
                `Loaded ${localMap.size} existing entries from ${outputFile}`,
            );
        } catch (e) {
            console.warn(
                `Warning: Failed to read existing config: ${e.message}`,
            );
        }
    }

    // Merge remote entries into local map (remote overwrites local by path)
    for (const item of remoteData) {
        if (!item.path) {
            console.warn('Warning: Skipping entry without path:', item);
            continue;
        }

        const entry = {
            path: item.path,
            image: item.image || '',
        };
        if (item.name) {
            entry.name = item.name;
        }
        localMap.set(item.path, entry);
    }

    // Build output
    const output = {
        images: Array.from(localMap.values()),
    };

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 4));

    console.log(
        `Successfully wrote ${output.images.length} entries to ${outputFile}`,
    );
}

main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
