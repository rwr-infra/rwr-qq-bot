import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IRegister } from '../../types';

type PackageJson = {
    version?: unknown;
    description?: unknown;
    homepage?: unknown;
    repository?: unknown;
    bugs?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readPackageJsonFromCwd(): PackageJson | null {
    try {
        const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return null;
        }
        return parsed as PackageJson;
    } catch {
        return null;
    }
}

function pickString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function resolveRepositoryUrl(repository: unknown): string | null {
    if (typeof repository === 'string') {
        return pickString(repository);
    }
    if (isRecord(repository)) {
        return pickString(repository.url);
    }
    return null;
}

function resolveBugsUrl(bugs: unknown): string | null {
    if (typeof bugs === 'string') {
        return pickString(bugs);
    }
    if (isRecord(bugs)) {
        return pickString(bugs.url);
    }
    return null;
}

function resolveAppVersion(pkg: PackageJson | null): string {
    const envVersion =
        pickString(process.env.APP_VERSION) ??
        pickString(process.env.GITHUB_REF_NAME);
    if (envVersion) {
        return envVersion;
    }

    const pkgVersion = pkg ? pickString(pkg.version) : null;
    return pkgVersion ?? 'dev';
}

export const VersionCommandRegister: IRegister = {
    name: 'version',
    alias: 'v',
    description: '查询机器人版本信息',
    isAdmin: true,
    exec: async (ctx) => {
        const pkg = readPackageJsonFromCwd();

        const version = resolveAppVersion(pkg);
        const description =
            (pkg ? pickString(pkg.description) : null) ?? 'rwr-imba-qq-bot';
        const repositoryUrl = pkg ? resolveRepositoryUrl(pkg.repository) : null;
        const homepage = pkg ? pickString(pkg.homepage) : null;
        const bugsUrl = pkg ? resolveBugsUrl(pkg.bugs) : null;

        let outputStr = `当前版本: ${version}\n`;
        outputStr += `${description}\n`;
        outputStr += `源码地址: ${repositoryUrl ?? 'unknown'}\n`;
        outputStr += `项目主页: ${homepage ?? 'unknown'}\n`;
        outputStr += `Bug 上报: ${bugsUrl ?? 'unknown'}`;

        await ctx.reply(outputStr);
    },
};
