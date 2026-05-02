import type { FileSystemAdapter } from "./adapter";

export const windowsFileSystemAdapter: FileSystemAdapter = {
  async read(path: string): Promise<string> {
    const { readFile } = await import("node:fs/promises");
    return readFile(path, "utf-8");
  },
  async write(path: string, content: string): Promise<void> {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, content, "utf-8");
  },
  async list(path: string): Promise<string[]> {
    const { readdir } = await import("node:fs/promises");
    return readdir(path);
  },
  async exists(path: string): Promise<boolean> {
    const { exists } = await import("node:fs/promises");
    try {
      await exists(path);
      return true;
    } catch {
      return false;
    }
  },
};
