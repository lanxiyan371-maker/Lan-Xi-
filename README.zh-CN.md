# 苍穹战机（Sky Blaster 中文版）

基于 <https://github.com/phaethix/polished-arcade-shooter> 的本地中文版本。

## 直接试玩

构建产物为 `dist/index.html`。在浏览器中打开即可进行单人游戏，页面不依赖远程字体或 CDN。双人合作仍需要原项目的房间服务器。

中文覆盖模式选择、飞机与技能、武器、难度、章节与首领、战斗提示、暂停、成就、结算和合作大厅。键盘按键保留实际键名。

常用操作：方向键或 WASD 移动，空格 / Z 射击，F 切换自动射击，X / B 使用炸弹，C / Shift 使用技能，Esc 暂停或继续。

## 开发与构建

使用 Node.js 18 以上版本及 npm：

```powershell
npm ci
npm run dev
```

构建单文件：

```powershell
npm run build
```

可在 Windows 上构建，再将 `dist/index.html` 复制到 AI Pyramid。Pyramid 上的浏览器需要安装中文字体，例如 Noto Sans CJK；字体回退名称已加入 Canvas 绘制代码。实际性能和字体可用性需连接设备后验证。

## 授权与边界

沿用原项目 MIT 许可证，见 `LICENSE`，分发时保留版权与许可文本。

本次修改仅涉及中文界面文字和字体显示，尚未接入 Laya 或 AX8850 NPU。
