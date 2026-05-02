import type { DesktopAdapter } from "./adapter";

export const macosDesktopAdapter: DesktopAdapter = {
  async screenshot(): Promise<Buffer> {
    throw new Error("macOS desktop tools not yet implemented");
  },
  async move(_x: number, _y: number): Promise<void> {
    throw new Error("macOS desktop tools not yet implemented");
  },
  async click(_x: number, _y: number): Promise<void> {
    throw new Error("macOS desktop tools not yet implemented");
  },
  async type(_text: string): Promise<void> {
    throw new Error("macOS desktop tools not yet implemented");
  },
  async keys(_keys: string): Promise<void> {
    throw new Error("macOS desktop tools not yet implemented");
  },
};
