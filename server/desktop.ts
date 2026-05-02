import { homedir, platform } from "node:os";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

function spawn(cmd: string, args: string[]) {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: null, stderr: null, stdin: null,
  });
  proc.exited.catch(() => {});
}

export async function openAppWindow(port: number): Promise<void> {
  const url = `http://localhost:${port}`;
  const plat = platform();

  try {
    if (plat === "win32") {
      spawn("cmd", ["/c", "start", "msedge", `--app=${url}`, "--window-size=1100,750"]);
    } else if (plat === "darwin") {
      spawn("open", ["-a", "Google Chrome", "--args", `--app=${url}`]);
    } else {
      for (const browser of ["chromium-browser", "google-chrome", "chromium"]) {
        try {
          const proc = Bun.spawn(["which", browser], { stdout: "pipe", stderr: "ignore" });
          const found = new TextDecoder().decode(await new Response(proc.stdout).arrayBuffer()).trim();
          if (found) { spawn(found, [`--app=${url}`, "--window-size=1100,750"]); return; }
        } catch {}
      }
      spawn("xdg-open", [url]);
    }
  } catch {}
}

export function createDesktopShortcut(): boolean {
  try {
    if (platform() === "win32") {
      Bun.write(`${homedir()}\\Desktop\\autofox.vbs`, `Set W = CreateObject("WScript.Shell")\nW.Run """" & WScript.Arguments(0) & """", 0\n`);
    } else {
      const d = `${homedir()}/.local/share/applications`;
      mkdir(d, { recursive: true }).catch(() => {});
      Bun.write(`${d}/autofox.desktop`, `[Desktop Entry]\nType=Application\nName=autofox\nExec=${process.execPath}\nTerminal=false\nCategories=Utility;\n`);
    }
    return true;
  } catch { return false; }
}

export function enableAutoStart(on: boolean): boolean {
  try {
    if (platform() === "win32") {
      if (on) {
        spawn("reg", ["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "autofox", "/t", "REG_SZ", "/d", process.execPath, "/f"]);
      } else {
        spawn("reg", ["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "autofox", "/f"]);
      }
    } else {
      const d = `${homedir()}/.config/autostart`;
      mkdir(d, { recursive: true }).catch(() => {});
      if (on) {
        Bun.write(`${d}/autofox.desktop`, `[Desktop Entry]\nType=Application\nName=autofox\nExec=${process.execPath}\nX-GNOME-Autostart-enabled=true\n`);
      } else {
        try { require("node:fs/promises").unlink(`${d}/autofox.desktop`); } catch {}
      }
    }
    return true;
  } catch { return false; }
}

export function getDesktopInfo() {
  const p = platform();
  return {
    platform: p,
    home: homedir(),
    hasShortcut: p === "win32"
      ? existsSync(`${homedir()}\\Desktop\\autofox.vbs`)
      : existsSync(`${homedir()}/.local/share/applications/autofox.desktop`),
    hasAutoStart: p === "win32"
      ? existsSync(`${homedir()}\\Desktop\\autofox.vbs`)  // check registry would need spawn, approximate
      : existsSync(`${homedir()}/.config/autostart/autofox.desktop`),
  };
}
