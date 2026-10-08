import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BUNDLE_PATH = join(__dirname, "..", "..", "dist", "speckeeper.bundle.mjs");

describe("bundle-isolation", () => {
  let tempDir: string;

  beforeAll(() => {
    if (!existsSync(BUNDLE_PATH)) {
      execSync("node esbuild.bundle.mjs", { cwd: join(__dirname, "..", "..") });
    }

    tempDir = mkdtempSync(join(tmpdir(), "speckeeper-test-"));
    cpSync(BUNDLE_PATH, join(tempDir, "speckeeper.bundle.mjs"));

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "bundle-test", version: "1.0.0", type: "module" }),
    );

    execSync("npm install @openai/agents tsx --legacy-peer-deps", {
      cwd: tempDir,
      stdio: "pipe",
    });
  }, 60_000);

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("starts without @aaac/runtime installed", () => {
    const output = execFileSync("node", ["speckeeper.bundle.mjs", "--version"], {
      cwd: tempDir,
      encoding: "utf8",
    });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("constructs LLM prompt from isolated directory (--show-prompt)", () => {
    const output = execFileSync(
      "node",
      ["speckeeper.bundle.mjs", "audit-requirements", "--adapter", "openai", "--show-prompt"],
      {
        cwd: tempDir,
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(100);
  }, 30_000);

  it("FR-1211-02 an LLM command exits 11 when the optional @aaac/runtime is not installed", () => {
    const run = spawnSync("node", ["speckeeper.bundle.mjs", "audit-requirements", "--adapter", "mock"], {
      cwd: tempDir,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(run.status).toBe(11);
    expect(run.stderr).toContain("@aaac/runtime is not installed");
  }, 40_000);

  it("runs LLM audit-requirements with openai adapter", () => {
    if (!process.env.OPENAI_API_KEY) {
      return;
    }

    execSync("npm install @aaac/runtime --legacy-peer-deps", { cwd: tempDir, stdio: "pipe" });

    const output = execFileSync(
      "node",
      ["speckeeper.bundle.mjs", "audit-requirements", "--adapter", "openai"],
      {
        cwd: tempDir,
        encoding: "utf8",
        timeout: 90_000,
        env: { ...process.env, NODE_ENV: "test" },
      },
    );
    expect(output).toBeTruthy();
  }, 100_000);
});
