import type { FileSystemAdapter } from "./adapter";
import { statSync, readdirSync } from "node:fs";

export const linuxFileSystemAdapter: FileSystemAdapter = {
  async read(path: string): Promise<string> {
    const file = Bun.file(path);
    return file.text();
  },

  async write(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  },

  async list(path: string): Promise<string[]> {
    return readdirSync(path);
  },

  async exists(path: string): Promise<boolean> {
    try {
      statSync(path);
      return true;
    } catch {
      return false;
    }
  },
};
