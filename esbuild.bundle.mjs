#!/usr/bin/env node
import { build } from "esbuild";
import { readFileSync, statSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const minify = process.argv.includes("--minify");

// tsx resolves loader paths via import.meta.url relative to its package
// directory and cannot be inlined into a single-file bundle.
const externalSdks = [
  "@anthropic-ai/claude-agent-sdk",
  "@anthropic-ai/sdk",
  "@google/adk",
  "@openai/agents",
  "@google/genai",
  "better-sqlite3",
  "tsx",
];

const resolveRuntimeDynamicImports = {
  name: "resolve-runtime-dynamic-imports",
  setup(_build) {},
};

const inlineBuildTimeConstants = {
  name: "inline-build-time-constants",
  setup(build) {
    build.onLoad({ filter: /cli[\\/]index\.ts$/ }, async (args) => {
      let contents = readFileSync(args.path, "utf8");
      // Strip shebang
      contents = contents.replace(/^#!.*\n/, "");
      // Replace getVersion() function with constant
      contents = contents.replace(
        /function getVersion\(\): string \{[\s\S]*?return '0\.0\.0';\s*\}\s*\}/,
        `function getVersion(): string { return ${JSON.stringify(pkg.version)}; }`,
      );
      return { contents, loader: "ts" };
    });
  },
};

const result = await build({
  entryPoints: ["src/cli/index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: "dist/speckeeper.bundle.mjs",
  minify,
  sourcemap: true,
  external: externalSdks,
  mainFields: ["module", "main"],
  conditions: ["import", "node"],
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __banner_createRequire } from 'module';",
      "const require = __banner_createRequire(import.meta.url);",
    ].join("\n"),
  },
  plugins: [resolveRuntimeDynamicImports, inlineBuildTimeConstants],
  logLevel: "info",
});

if (result.errors.length > 0) process.exit(1);
const stat = statSync("dist/speckeeper.bundle.mjs");
const sizeKB = (stat.size / 1024).toFixed(1);
const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
console.log(`\n✓ dist/speckeeper.bundle.mjs  ${sizeKB} KB (${sizeMB} MB)`);
