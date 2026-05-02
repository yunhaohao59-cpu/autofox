import type { Tool, ToolDefinition, ToolResult } from "../../tools/platform";

export interface FileSystemAdapter {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

export function createFsReadTool(adapter: FileSystemAdapter): Tool {
  return {
    definition: {
      name: "fs_read",
      description: "Read the contents of a file at the given path.",
      parameters: {
        path: { type: "string", description: "The file path to read", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const content = await adapter.read(args.path as string);
        return { ok: true, summary: content };
      } catch (e) {
        return { ok: false, summary: `Error reading file: ${e}` };
      }
    },
  };
}

export function createFsWriteTool(adapter: FileSystemAdapter): Tool {
  return {
    definition: {
      name: "fs_write",
      description: "Write content to a file at the given path.",
      parameters: {
        path: { type: "string", description: "The file path to write to", required: true },
        content: { type: "string", description: "The content to write", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        await adapter.write(args.path as string, args.content as string);
        return { ok: true, summary: `File written: ${args.path}` };
      } catch (e) {
        return { ok: false, summary: `Error writing file: ${e}` };
      }
    },
  };
}

export function createFsListTool(adapter: FileSystemAdapter): Tool {
  return {
    definition: {
      name: "fs_list",
      description: "List the contents of a directory.",
      parameters: {
        path: { type: "string", description: "The directory path to list", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const list = await adapter.list(args.path as string);
        return { ok: true, summary: list.join("\n") };
      } catch (e) {
        return { ok: false, summary: `Error listing directory: ${e}` };
      }
    },
  };
}

export function createFsExistsTool(adapter: FileSystemAdapter): Tool {
  return {
    definition: {
      name: "fs_exists",
      description: "Check if a file or directory exists at the given path.",
      parameters: {
        path: { type: "string", description: "The path to check", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const exists = await adapter.exists(args.path as string);
      return { ok: true, summary: exists ? "true" : "false" };
    },
  };
}

export function createFileSystemTools(adapter: FileSystemAdapter): Tool[] {
  return [
    createFsReadTool(adapter),
    createFsWriteTool(adapter),
    createFsListTool(adapter),
    createFsExistsTool(adapter),
  ];
}
