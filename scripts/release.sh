#!/usr/bin/env bash
# 构建 autofox 发行包
# 用法: bash scripts/release.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

echo "🦊 构建 autofox 发行包..."
echo ""

# 清理
rm -rf "$DIST"
mkdir -p "$DIST/win"

# 编译 (先打包资源再编译)
echo "  [1] 打包资源 + 编译..."
cd "$ROOT"
bun run build
echo "       $DIST/autofox ($(du -h "$DIST/autofox" | cut -f1))"

# 编译 Windows（需要在 Windows 环境或 Wine 中运行）
# 如果有 Windows 环境:
#   bun build --compile --target=windows-x64 ./server/index.ts --outfile dist/win/autofox.exe

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "  [2] 编译 Windows 二进制..."
    bun build --compile --target=windows-x64 ./server/index.ts --outfile "$DIST/win/autofox.exe"
    echo "       $DIST/win/autofox.exe ($(du -h "$DIST/win/autofox.exe" | cut -f1))"
else
    echo "  [2] 跳过 Windows 编译（需要在 Windows 上单独执行）"
    echo "      在 Windows 上运行: bun build --compile ./server/index.ts --outfile dist/win/autofox.exe"
    echo "      然后将 autofox.exe 放入 dist/win/ 目录"
    # 放置一个占位说明
    cat > "$DIST/win/编译说明.txt" << 'EOF'
在 Windows 上编译 autofox.exe:
  1. 安装 Bun: https://bun.sh
  2. 打开 PowerShell, cd 到项目根目录
  3. 执行: bun build --compile ./server/index.ts --outfile dist/win/autofox.exe
  4. 将生成的 dist/win/autofox.exe 放到 dist/win/ 下
  5. 双击 dist/install.bat 或右键 install.ps1 → 使用 PowerShell 运行
EOF
fi

# 复制前端资源
echo "  [3] 复制前端资源..."
cp -r "$ROOT/app" "$DIST/app"
echo "       app/"

# 复制图片
if [ -d "$ROOT/图片" ]; then
    cp -r "$ROOT/图片" "$DIST/图片"
    echo "       图片/"
fi

# 复制技能仓库
if [ -d "$ROOT/skills-repo" ]; then
    cp -r "$ROOT/skills-repo" "$DIST/skills-repo"
    echo "       skills-repo/"
fi

# 安装脚本
echo "  [4] 复制安装脚本..."
# Linux/Mac
[ -f "$DIST/install.sh" ] && chmod +x "$DIST/install.sh"
# Windows (.bat 双击安装, .ps1 右键运行)
# 已由之前的步骤生成
echo "       install.sh (Linux/macOS)"
echo "       install.bat (Windows 双击)"
echo "       install.ps1 (Windows PowerShell)"

echo ""
echo "========================================"
echo "  autofox 发行包构建完成"
echo "  $DIST/"
echo "========================================"
echo ""
echo "安装方式:"
echo "  Linux/macOS:   cd dist && ./install.sh"
echo "  Windows 双击:   dist\install.bat"
echo "  Windows PS:    右键 dist\install.ps1 → 使用 PowerShell 运行"
echo ""
echo "包大小: $(du -sh "$DIST" | cut -f1)"
echo "文件列表:"
find "$DIST" -type f | sed "s|$DIST/|  |" | sort
