import { context } from 'esbuild';
import { readFileSync } from 'node:fs';

const header = readFileSync('src/header.txt', 'utf8');
const watch = process.argv.includes('--watch');

const ctx = await context({
    entryPoints: ['src/main.js'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    outfile: 'list/acfun-moment-plaza.user.js',
    banner: { js: header + '\n"use strict";' },
    legalComments: 'none',
    logLevel: 'info',
});

if (watch) {
    await ctx.watch();
    console.log('[watch] 监听 src/ 变更中...');
} else {
    await ctx.rebuild();
    await ctx.dispose();
}
