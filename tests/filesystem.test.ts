import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createFileSystemTools } from "../server/tools/l1-filesystem/adapter";
import { linuxFileSystemAdapter } from "../server/tools/l1-filesystem/linux";
import type { Tool } from "../server/tools/platform";

const TEST_DIR = "/tmp/autofox-test-fs";

describe("L1 FileSystem Tools", () => {
  let tools: Tool[];
  const testFile = `${TEST_DIR}/test.txt`;
  const testSubDir = `${TEST_DIR}/sub`;

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(testSubDir, { recursive: true });
    await writeFile(testFile, "hello autofox\nline 2");
    tools = createFileSystemTools(linuxFileSystemAdapter);
  });

  afterAll(async () => {
    try { await rm(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  test("fs_read reads file content", async () => {
    const readTool = tools.find((t) => t.definition.name === "fs_read")!;
    const result = await readTool.execute({ path: testFile });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain("hello autofox");
  });

  test("fs_read returns error for missing file", async () => {
    const readTool = tools.find((t) => t.definition.name === "fs_read")!;
    const result = await readTool.execute({ path: "/nonexistent/file.txt" });
    expect(result.ok).toBe(false);
  });

  test("fs_write writes content", async () => {
    const writeTool = tools.find((t) => t.definition.name === "fs_write")!;
    const path = `${TEST_DIR}/write-test.txt`;
    const result = await writeTool.execute({ path, content: "written content" });
    expect(result.ok).toBe(true);

    const readTool = tools.find((t) => t.definition.name === "fs_read")!;
    const readResult = await readTool.execute({ path });
    expect(readResult.summary).toContain("written content");

    try { await rm(path, { force: true }); } catch {}
  });

  test("fs_list lists directory", async () => {
    const listTool = tools.find((t) => t.definition.name === "fs_list")!;
    const result = await listTool.execute({ path: TEST_DIR });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain("test.txt");
    expect(result.summary).toContain("sub");
  });

  test("fs_list returns error for nonexistent dir", async () => {
    const listTool = tools.find((t) => t.definition.name === "fs_list")!;
    const result = await listTool.execute({ path: "/nonexistent/dir" });
    expect(result.ok).toBe(false);
  });

  test("fs_exists returns true for existing path", async () => {
    const existsTool = tools.find((t) => t.definition.name === "fs_exists")!;
    const result = await existsTool.execute({ path: testFile });
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("true");
  });

  test("fs_exists returns false for missing path", async () => {
    const existsTool = tools.find((t) => t.definition.name === "fs_exists")!;
    const result = await existsTool.execute({ path: "/tmp/nonexistent-xyz" });
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("false");
  });

  test("all tools have correct definitions", () => {
    expect(tools.length).toBe(4);
    const names = tools.map((t) => t.definition.name).sort();
    expect(names).toEqual(["fs_exists", "fs_list", "fs_read", "fs_write"]);
  });

  test("each tool has required parameters", () => {
    for (const tool of tools) {
      expect(tool.definition.parameters).toBeDefined();
      expect(Object.keys(tool.definition.parameters).length).toBeGreaterThan(0);
    }
  });
});
