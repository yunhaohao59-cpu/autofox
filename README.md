# autofox

**AI Desktop Agent** — a self-contained app that puts an AI assistant directly on your desktop. Chat, run shell commands, manage files, browse the web — all through a clean desktop UI.

> 一个自包含的 AI 桌面助手，双击即可运行。对话、执行命令、管理文件、浏览网页，都在一个桌面窗口里完成。

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-%23fbf0df?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey" alt="Platform">
  <img src="https://img.shields.io/github/license/autofox/autofox" alt="License">
</p>

---

## Features

- **Desktop App** — one binary, double-click to run. Opens a frameless app window. No terminal needed.
- **First-Run Wizard** — picks your provider, API key, model name, desktop shortcut, and auto-start (recommended for Windows).
- **Multiple Agents** — create agents with distinct personas, rules, and conversation styles
- **Rich Toolset** — 7 built-in tools: file read/write/list, shell commands, HTTP GET/POST, Live Preview
- **Persistent Chat** — messages stored in SQLite, survive refreshes and restarts
- **Vision** — ask the AI to "look at" a screenshot or web page (bridge mode)
- **Skill Marketplace** — install community skills to extend capabilities
- **Memory** — long-running context compaction keeps conversations within token limits
- **5 Color Themes** — dark-orange, dark-blue, dark-green, light-warm, midnight-purple

## Install

### Windows
Download `autofox.exe` from [Releases](https://github.com/autofox/autofox/releases), double-click to run.

### macOS
Download `autofox` from [Releases](https://github.com/autofox/autofox/releases), open Terminal:
```bash
chmod +x autofox && ./autofox
```

### Linux
```bash
curl -L https://github.com/autofox/autofox/releases/latest/download/autofox -o autofox
chmod +x autofox && ./autofox
```

## Build from Source

Requires [Bun](https://bun.sh) ≥ 1.0.

```bash
git clone https://github.com/autofox/autofox.git
cd autofox
bun install
bun run build          # → dist/autofox (or autofox.exe on Windows)
```

## Development

```bash
bun run dev            # start dev server with hot reload
bun test               # run 69 tests
bun run typecheck      # TypeScript check
```

## Architecture

```
server/
├── agent/          # Agent runtime, system prompt, tool registry
├── config/         # TOML config loading, validation, merging
├── context/        # Context file loading
├── gateway/        # HTTP + WebSocket server, API routes
├── memory/         # SQLite (sessions, messages, agents), vector store
├── model/          # LLM providers (DeepSeek, OpenAI, Claude)
├── skill/          # Skill marketplace, installed skills, agent profiles
├── tools/          # Layered tool architecture
│   ├── l1-filesystem/  # fs_read, fs_write, fs_list, fs_exists
│   ├── l2-shell/       # shell command execution (bash/pwsh)
│   ├── l3-network/     # http_get, http_post
│   ├── l4-desktop/     # screenshot, etc.
│   └── l5-browser/     # CDP-based browser control
└── vision/         # Vision pipeline (bridge, edge, providers)
```

## Supported Providers

| Provider | Model |
|:---|:---|
| DeepSeek | deepseek-chat, deepseek-reasoner |
| OpenAI | gpt-4o, gpt-4o-mini |
| Zhipu | glm-4-plus |
| Kimi | moonshot-v1-32k |
| Qwen | qwen-plus |
| Doubao | doubao-pro-32k |

## License

MIT
