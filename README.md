# Mineradio Web

Mineradio Web 是一个基于 [Mineradio](https://github.com/XxHuberrr/Mineradio) 视觉方向整理出的浏览器版本尝试。它可以直接部署到 GitHub Pages，以本地优先的方式播放音乐，并通过浏览器 Connector 扩展连接网易云音乐、QQ 音乐和酷狗音乐的网页登录态。

这个项目不是为了替代原 Electron 客户端，而是提供一个更轻量的 Web 入口：打开网页即可体验 Mineradio 的视觉播放器、粒子歌词、DIY 效果、歌单架和多平台歌单导入。

在线体验：[https://mrchenyh.github.io/Mineradio-Web/](https://mrchenyh.github.io/Mineradio-Web/)

## 项目亮点

- **静态 Web 版**：可部署到 GitHub Pages，不需要用户自己启动本地 Node 服务。
- **本地优先播放**：本地音乐和试听推荐无需登录即可使用。
- **浏览器 Connector**：通过 Chrome / Edge MV3 扩展读取用户本机已授权的网页登录态。
- **三平台接入**：支持网易云、QQ 音乐、酷狗的搜索、播放探测和歌单能力，按真实可播状态排序。
- **外链歌单导入**：支持网易云歌单链接、QQ 音乐歌单链接、酷狗分享歌单链接。
- **视觉体验迁移**：保留 DIY 模式、粒子歌词、本地节拍分析、3D 歌单架、自定义歌词和封面流程。

## 快速开始

### 只体验 Web 页面

直接打开在线页面即可：

[https://mrchenyh.github.io/Mineradio-Web/](https://mrchenyh.github.io/Mineradio-Web/)

未安装 Connector 时，仍可使用：

- 本地音乐导入
- 歌曲试听推荐
- 基础播放器和视觉效果
- DIY / 粒子 / 歌词等本地能力

### 安装 Connector 扩展

如需使用网易云、QQ 音乐、酷狗的账号歌单、搜索和播放探测，请安装浏览器扩展。

1. 下载扩展包：页面启动页的“下载 Connector 插件”，或仓库内的 `web/public/downloads/mineradio-connector.zip`。
2. 解压到一个固定文件夹，不要放在临时目录。
3. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
4. 开启“开发人员模式”。
5. 点击“加载解压缩的扩展”，选择刚才解压后的文件夹。
6. 打开或刷新 Mineradio Web。
7. 在浏览器中登录 `music.163.com`、`y.qq.com`、`www.kugou.com` 后，回到 Mineradio Web 使用。

当前 Connector 版本：`0.5.6`。扩展更新后，需要在扩展管理页点击“重新加载”。

## 功能状态

| 能力 | 无扩展 | 网易云 | QQ 音乐 | 酷狗 |
| --- | --- | --- | --- | --- |
| 本地音乐播放 | 可用 | 可用 | 可用 | 可用 |
| 歌曲试听推荐 | 可用 | 可用 | 可用 | 可用 |
| 平台搜索 | 不可用 | 可用 | 可用 | 可用，按播放探测结果降权 |
| 平台歌单 | 不可用 | 我的歌单 / 每日推荐 | 我的歌单 / 歌单详情 | 暂不做账号歌单 |
| 外链歌单导入 | 不可用 | 可用 | 可用 | 可用，受酷狗 H5 接口开放数量限制 |
| 播放地址探测 | 不可用 | 可用 | 可用 | 可用但更依赖网页授权和接口返回 |
| VIP 显示 | 不显示 | 仅在能确认时显示 | 仅在能确认时显示 | 仅在能确认时显示 |

酷狗分享歌单如果官方 H5 页面只返回部分歌曲，Mineradio Web 会显示部分导入数量，而不会伪装成完整导入。

## 歌单导入

顶部输入框现在只保留两个主要动作：`搜索` 和 `导入歌单`。

支持粘贴：

- 网易云音乐歌单链接
- QQ 音乐歌单链接
- 酷狗分享文本或 `gcid_...` 歌单链接

最近导入的歌单会显示在首页歌单区域最前面，也会进入歌单面板和 3D 歌单架。

## 视觉与 DIY

Web 版目前保留并适配了原项目中可以直接在浏览器运行的视觉能力：

- DIY 模式
- 视觉控制台
- 粒子歌词
- 本地节拍分析
- 3D 歌单架
- 自定义歌词
- 自定义封面
- 默认 FX 档案

以下能力属于 Electron 桌面端专属，本仓库暂不迁移到 GitHub Pages 版本：

- 桌面歌词独立窗口
- 壁纸窗口
- 全局快捷键
- Electron 主进程 API
- 系统级窗口管理

## 网络与代理建议

音乐平台请求会跟随浏览器或系统网络环境。如果你使用代理，建议把以下域名设置为国内直连：

- `music.163.com`
- `*.music.126.net`
- `y.qq.com`
- `u.y.qq.com`
- `c.y.qq.com`
- `*.qqmusic.qq.com`
- `*.kugou.com`

海外出口可能触发平台地区限制或风控，表现为“已登录但无法返回播放地址”。

## Tampermonkey 辅助脚本

仓库提供一个可选油猴脚本：`tampermonkey/mineradio-helper.user.js`。

安装后，网易云、QQ 音乐、酷狗网页上会出现 Mineradio 浮动按钮。点击按钮会打开 Mineradio Web，并把当前网页标题作为搜索词带过去。

油猴脚本只是快捷入口，不能替代 Connector 扩展。原因是油猴脚本没有 MV3 扩展级的 cookies、跨站请求和媒体请求头权限。

## 本地开发

```bash
npm install
npm run check
npm run package:extension
npm run build:web
```

本地预览：

```bash
npm run preview:web
```

Edge 扩展测试：

```bash
npm run test:edge-extension
```

GitHub Pages 会通过 `.github/workflows/pages.yml` 自动执行 `npm run build:web`，并发布 `web/dist`。

## 目录结构

```text
web/public/          Web 页面源码和静态资源
extension/           Chrome / Edge Connector 扩展源码
tampermonkey/        可选油猴辅助脚本
scripts/             构建、打包和本地预览脚本
bridge/              本地桥接实验代码
release/             本地打包产物目录
```

根目录下的 `manifest.json`、`service-worker.js`、`popup.js`、`popup.html`、`content-script.js` 是扩展副本，用于兼容误加载根目录扩展的场景；正式维护时请与 `extension/` 保持同步。

## 隐私与声明

- 本项目不会内置任何平台账号、Cookie 或播放凭据。
- 平台会话信息只保存在用户本机浏览器和 Connector 扩展环境中。
- 本项目不提供、不分发任何版权音频资源。
- 音乐平台内容、账号权益、播放权限归各平台所有。
- 本仓库仅用于个人学习、Web 化迁移实验和本地测试。

## 与原项目的关系

本项目基于 Mineradio 的视觉与产品方向做 Web 化探索，保留原项目 GPL-3.0 授权与来源说明。原项目地址：

[https://github.com/XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

如果后续向原项目提交 PR，建议把 Web 版作为可选入口、独立目录或实验性分支接入，不影响原 Electron 桌面端主线。
