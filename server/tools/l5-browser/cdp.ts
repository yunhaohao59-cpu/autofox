const CDP_PORT = 9222;

interface CDPTarget {
  webSocketDebuggerUrl: string;
  title: string;
  url: string;
}

export class CDPClient {
  private ws: WebSocket | null = null;
  private msgId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async connect(): Promise<void> {
    try {
      const res = await fetch(`http://localhost:${CDP_PORT}/json`);
      const targets = await res.json() as CDPTarget[];
      if (!targets.length) throw new Error("No browser tabs found");

      const page = targets.find((t) => t.url && !t.url.startsWith("devtools://") && !t.url.startsWith("chrome://")) || targets[0]!;

      this.ws = new WebSocket(page.webSocketDebuggerUrl);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("CDP connection timeout")), 5000);
        this.ws!.onopen = () => { clearTimeout(timer); resolve(); };
        this.ws!.onerror = () => { clearTimeout(timer); reject(new Error("CDP WebSocket error")); };
      });

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as { id?: number; result?: unknown; error?: { message: string } };
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };

      await this.send("Page.enable");
    } catch (e) {
      throw new Error(`Browser automation unavailable. Start Chrome with: google-chrome --remote-debugging-port=${CDP_PORT} --headless`);
    }
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP ${method} timeout`));
        }
      }, 10000);
    });
  }

  async navigate(url: string): Promise<string> {
    const result = await this.send("Page.navigate", { url }) as { frameId?: string; loaderId?: string };
    return `Navigated to ${url} (frame: ${result.frameId ?? "unknown"})`;
  }

  async screenshot(): Promise<string> {
    const result = await this.send("Page.captureScreenshot", { format: "png" }) as { data: string };
    return result.data;
  }

  async click(selector: string): Promise<string> {
    const doc = await this.send("DOM.getDocument", { depth: -1 }) as { root: { nodeId: number } };
    const node = await this.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector }) as { nodeId: number };
    if (!node.nodeId) throw new Error(`Element not found: ${selector}`);
    const box = await this.send("DOM.getBoxModel", { nodeId: node.nodeId }) as {
      model: { content: number[] };
    };
    const [x1, y1, , , x2, , , y2] = box.model.content;
    const cx = Math.round((x1! + x2!) / 2);
    const cy = Math.round((y1! + y2!) / 2);
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 1 });
    return `Clicked ${selector} at (${cx}, ${cy})`;
  }

  async fill(selector: string, value: string): Promise<string> {
    const doc = await this.send("DOM.getDocument", { depth: -1 }) as { root: { nodeId: number } };
    const node = await this.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector }) as { nodeId: number };
    if (!node.nodeId) throw new Error(`Element not found: ${selector}`);
    await this.send("DOM.focus", { nodeId: node.nodeId });
    await this.send("Input.insertText", { text: value });
    return `Filled ${selector} with "${value}"`;
  }

  async extract(selector?: string): Promise<string> {
    if (selector) {
      const result = await this.send("Runtime.evaluate", {
        expression: `document.querySelector('${selector}')?.innerText || ''`,
        returnByValue: true,
      }) as { result: { value: string } };
      return result.result.value;
    }
    const result = await this.send("Runtime.evaluate", {
      expression: "document.body?.innerText || ''",
      returnByValue: true,
    }) as { result: { value: string } };
    return result.result.value;
  }

  async close(): Promise<void> {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.pending.clear();
  }
}
