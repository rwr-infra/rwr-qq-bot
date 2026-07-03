const { defineConfig } = require('rollup');
const typescript = require('@rollup/plugin-typescript');
const json = require('@rollup/plugin-json');
const { builtinModules } = require('node:module');
const pkg = require('./package.json');

// 运行时依赖与 Node 内置模块均不打包, 部署时由 node_modules 提供
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

module.exports = defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/app.js',
    format: 'esm',
    sourcemap: true
  },
  external,
  plugins: [
    typescript({
      tsconfig: './tsconfig.build.json',
      module: 'ESNext',
      target: 'ESNext'
    }),
    json()
  ]
});
