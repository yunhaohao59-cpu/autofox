# autofox

**AI 桌面助手** — 一个自包含的桌面应用，将 AI 助手直接放在你的桌面上。对话、执行命令、管理文件、浏览网页，都在一个窗口里完成。

> A self-contained AI desktop agent. Chat, run commands, manage files — all in a frameless desktop window.

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-%23fbf0df?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey" alt="Platform">
  <img src="https://img.shields.io/github/license/autofox/autofox" alt="License">
</p>

---

## 功能特性

- **桌面应用** — 一个二进制文件，双击即运行。自动打开无边框窗口，不需要开终端或浏览器
- **首次运行向导** — 选择模型提供商、填写 API Key、模型名称；可勾选创建桌面快捷方式和开机自启动（Windows 用户推荐勾选）
- **多 Agent 支持** — 创建不同人设、规则和对话风格的 Agent，各自独立聊天
- **丰富工具集** — 7 个内置工具：文件读写/列表、Shell 命令、HTTP GET/POST
- **消息持久化** — 聊天记录全部存入 SQLite，刷新页面或重启不会丢失
- **视觉识别** — 让 AI「看」截图或网页内容（bridge 模式）
- **技能市场** — 从社区安装技能包来扩展能力
- **上下文压缩** — 长对话自动压缩，控制在 token 限制内
- **5 套配色** — 暗夜橙、暗夜蓝、暗夜绿、暖光、深夜紫

## 安装

### Windows
从 [Releases](https://github.com/autofox/autofox/releases) 下载 `autofox.exe`，**双击运行**。首次运行会弹出安装向导。

### macOS
从 [Releases](https://github.com/autofox/autofox/releases) 下载 `autofox`，打开终端：
```bash
chmod +x autofox && ./autofox
```

### Linux
```bash
curl -L https://github.com/autofox/autofox/releases/latest/download/autofox -o autofox
chmod +x autofox && ./autofox
```

## 从源码构建

需要 [Bun](https://bun.sh) ≥ 1.0。

```bash
git clone https://github.com/yunhaohao59-cpu/autofox.git
cd autofox
bun install
bun run build          # → dist/autofox（Windows 上为 autofox.exe）
```

## 开发

```bash
bun run dev            # 启动开发服务器（热重载）
bun test               # 运行 69 个测试
bun run typecheck      # TypeScript 类型检查
```

## 架构

```
server/
├── agent/          # Agent 运行时、System Prompt、工具注册表
├── config/         # TOML 配置加载、校验、合并
├── context/        # 上下文文件加载
├── gateway/        # HTTP + WebSocket 服务、API 路由
├── memory/         # SQLite（会话、消息、Agent）、向量存储
├── model/          # 大模型适配层（DeepSeek、OpenAI、Claude）
├── skill/          # 技能市场、已安装技能、Agent 配置
├── tools/          # 分层工具架构
│   ├── l1-filesystem/  # 文件读写/列表/存在检测
│   ├── l2-shell/       # Shell 命令执行（bash/powershell）
│   ├── l3-network/     # HTTP GET/POST
│   ├── l4-desktop/     # 桌面截图
│   └── l5-browser/     # CDP 浏览器控制
└── vision/         # 视觉管线（bridge、边缘检测、多提供商）
```

## 支持的模型提供商

| 提供商 | 可用模型 |
|:---|:---|
| DeepSeek | deepseek-chat、deepseek-reasoner |
| OpenAI | gpt-4o、gpt-4o-mini |
| 智谱 GLM | glm-4-plus |
| 月之暗面 Kimi | moonshot-v1-32k |
| 通义千问 | qwen-plus |
| 豆包 | doubao-pro-32k |

## 开源协议

MIT
