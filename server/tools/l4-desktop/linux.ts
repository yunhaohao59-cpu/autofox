import { spawn } from "node:child_process";
import type { Tool, ToolResult } from "../../tools/platform";

const XDOTOOL_TIMEOUT = 5000;

function xdotoolExec(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("xdotool", args, { timeout: XDOTOOL_TIMEOUT });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("close", (code) => resolve({ stdout, exitCode: code ?? 1 }));
    proc.on("error", () => resolve({ stdout, exitCode: 1 }));
  });
}

function screenshot(command: string, args: string[], outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, [...args, outputPath], { timeout: XDOTOOL_TIMEOUT });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

export function createDesktopScreenshotTool(): Tool {
  return {
    definition: {
      name: "desktop_screenshot",
      description: "Take a screenshot of the current screen. Saves as PNG to /tmp/autofox_screenshot.png.",
      parameters: {},
    },
    async execute(): Promise<ToolResult> {
      try {
        const ok = await screenshot("import", ["-window", "root"], "/tmp/autofox_screenshot.png");
        if (ok) {
          try {
            const file = Bun.file("/tmp/autofox_screenshot.png");
            const buf = Buffer.from(await file.arrayBuffer());
            const b64 = buf.toString("base64");
            return {
              ok: true,
              summary: `Screenshot captured: ${buf.length} bytes`,
              detail: b64.slice(0, 200),
            };
          } catch {
            return { ok: true, summary: "Screenshot saved to /tmp/autofox_screenshot.png" };
          }
        }

        const gnomeOk = await screenshot("gnome-screenshot", ["-f"], "/tmp/autofox_screenshot.png");
        if (gnomeOk) {
          try {
            const file = Bun.file("/tmp/autofox_screenshot.png");
            const buf = Buffer.from(await file.arrayBuffer());
            return { ok: true, summary: `Screenshot captured via gnome-screenshot: ${buf.length} bytes` };
          } catch {
            return { ok: true, summary: "Screenshot saved to /tmp/autofox_screenshot.png" };
          }
        }

        return { ok: false, summary: "No screenshot tool available. Install ImageMagick (import) or gnome-screenshot." };
      } catch (e) {
        return { ok: false, summary: `Screenshot failed: ${e}` };
      }
    },
  };
}

export function createDesktopMoveTool(): Tool {
  return {
    definition: {
      name: "desktop_move",
      description: "Move the mouse cursor to the specified screen coordinates.",
      parameters: {
        x: { type: "number", description: "X coordinate (pixels)", required: true },
        y: { type: "number", description: "Y coordinate (pixels)", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const x = Math.round(Number(args.x));
      const y = Math.round(Number(args.y));
      if (isNaN(x) || isNaN(y)) return { ok: false, summary: "Invalid coordinates" };

      const result = await xdotoolExec(["mousemove", String(x), String(y)]);
      if (result.exitCode === 0) {
        return { ok: true, summary: `Mouse moved to (${x}, ${y})` };
      }
      return { ok: false, summary: "xdotool not available. Install xdotool for desktop control." };
    },
  };
}

export function createDesktopClickTool(): Tool {
  return {
    definition: {
      name: "desktop_click",
      description: "Click the mouse at the current position. Specify button number (1=left, 2=middle, 3=right).",
      parameters: {
        button: { type: "number", description: "Mouse button: 1=left, 2=middle, 3=right. Default: 1" },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const button = Math.round(Number(args.button || 1));
      const result = await xdotoolExec(["click", String(button)]);
      if (result.exitCode === 0) {
        return { ok: true, summary: `Mouse button ${button} clicked` };
      }
      return { ok: false, summary: "xdotool not available." };
    },
  };
}

export function createDesktopTypeTool(): Tool {
  return {
    definition: {
      name: "desktop_type",
      description: "Type the given text using the keyboard.",
      parameters: {
        text: { type: "string", description: "The text to type", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const text = String(args.text || "");
      if (!text) return { ok: false, summary: "No text provided" };

      const result = await xdotoolExec(["type", "--", text]);
      if (result.exitCode === 0) {
        return { ok: true, summary: `Typed: ${text}` };
      }
      return { ok: false, summary: "xdotool not available." };
    },
  };
}

export function createDesktopKeysTool(): Tool {
  return {
    definition: {
      name: "desktop_keys",
      description: "Press a key combination. Example: ctrl+c, alt+Tab, super+d.",
      parameters: {
        keys: { type: "string", description: "Key combination (e.g., ctrl+c, alt+Tab)", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const keys = String(args.keys || "");
      if (!keys) return { ok: false, summary: "No keys provided" };

      const parts = keys.toLowerCase().split("+").map((k) => k.trim());
      const result = await xdotoolExec(["key", "--", ...parts]);
      if (result.exitCode === 0) {
        return { ok: true, summary: `Pressed: ${keys}` };
      }
      return { ok: false, summary: "xdotool not available." };
    },
  };
}

export function createLinuxDesktopTools(): Tool[] {
  return [
    createDesktopScreenshotTool(),
    createDesktopMoveTool(),
    createDesktopClickTool(),
    createDesktopTypeTool(),
    createDesktopKeysTool(),
  ];
}
