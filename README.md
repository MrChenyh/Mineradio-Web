# Mineradio Web

Mineradio Web 是一个可以直接部署到 GitHub Pages 的视觉音乐播放器。

在线页面：[https://mrchenyh.github.io/Mineradio-Web/](https://mrchenyh.github.io/Mineradio-Web/)

当前版本默认支持本地歌曲播放、iTunes 30 秒试听、歌词兜底、队列、封面、可视化和主题效果。网页登录平台能力由浏览器扩展 **Mineradio Connector** 提供，不再使用独立本地后端。

## 安装 Connector 插件

插件适用于 Microsoft Edge 和 Google Chrome。

1. 下载插件包：[mineradio-connector.zip](https://mrchenyh.github.io/Mineradio-Web/downloads/mineradio-connector.zip)。
2. 解压到一个固定文件夹，例如 `D:\Apps\Mineradio Connector`。后续不要随手删除这个文件夹。
3. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
4. 打开右上角“开发人员模式”。
5. 点击“加载解压缩的扩展”，选择刚刚解压出来的插件文件夹。
6. 打开 [网易云音乐网页版](https://music.163.com/) 或 [酷狗音乐网页版](https://www.kugou.com/) 并登录。
7. 打开或刷新 [Mineradio Web](https://mrchenyh.github.io/Mineradio-Web/)，搜索歌曲即可看到 Connector 音源结果。

插件图标弹窗里有“打开播放器”“打开网易云”“打开酷狗”“刷新状态”按钮，方便确认网页是否已经检测到登录态。

更新插件时，重新下载 zip，解压覆盖原文件夹，然后在扩展管理页点击该扩展的“重新加载”。

## 使用方式

- 不安装插件：可以导入本地歌曲播放，也可以使用首页 iTunes 试听推荐。
- 安装插件：可以尝试使用已登录的网易云、酷狗网页会话搜索、获取封面、歌词和可播放地址。
- 当某个平台结果不可播放时，网页会尝试同名歌曲的其它 Connector 音源，最后用 iTunes 试听兜底。

## Tampermonkey 能否替代插件

不建议把当前 Connector 改成 Tampermonkey 作为主方案。

Tampermonkey 可以做页面按钮、跳转、简单同站请求等辅助能力，但它不能稳定替代浏览器扩展：

- 不能像扩展一样使用 `chrome.cookies` 安全读取指定音乐站登录态。
- 不能使用 `declarativeNetRequest` 修改音乐媒体请求需要的 Referer、Origin 等头。
- 不能提供常驻后台 Service Worker，跨标签页状态和请求转发不稳定。
- GitHub Pages 页面仍会遇到跨域、媒体防盗链和浏览器安全限制。

所以 v1 保留 Manifest V3 插件方案。后续可以额外做一个 Tampermonkey 辅助脚本，用来快速打开播放器、提示登录状态或在音乐站页面内复制歌曲信息，但它不适合作为完整音源连接层。

## 本地开发

```powershell
npm install
npm run build:web
npm run preview:web
npm run package:extension
```

本地 Edge 插件测试：

```powershell
npm run build:web
npm run preview:web
npm run test:edge-extension
```

## 项目结构

```text
web/public/              GitHub Pages 静态播放器
web/public/downloads/    Pages 可下载文件
extension/               Chrome/Edge MV3 Connector 插件源码
scripts/build-web.js     构建 Pages 静态文件
scripts/package-extension.js  打包插件 zip
```

## 已测试音源

- iTunes Search API：默认首页试听和播放兜底，只提供 30 秒 preview。
- LRCLIB：可从浏览器直接请求的歌词兜底。
- 网易云 Connector：基于 `music.163.com` 网页登录态测试搜索、封面、歌词和播放地址探测。
- 酷狗 Connector：基于 `www.kugou.com` 网页登录态测试搜索、封面、歌词和播放地址探测。

QQ 音乐、Apple Music、汽水音乐暂未作为可用源开启。QQ 音乐网页播放还需要更稳定的当前会话校验；Apple Music 官方接口不向普通网页播放器暴露完整音频 URL；汽水音乐目前没有在本项目中验证出稳定的浏览器可调用完整播放链路。

## 隐私说明

Connector 不会把音乐站 Cookie 直接发送给 Mineradio Web 页面。扩展在后台请求音乐站接口，返回给页面的是连接状态、歌曲元数据、歌词和播放地址探测结果。

## 来源与授权

本项目基于 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) 改造，保留 GPL-3.0 授权和来源说明。相关文件见 `LICENSE`、`NOTICE.md`、`UPSTREAM_README.md`、`PRIVACY.md`、`SECURITY.md`。

Mineradio Web 不是网易云音乐、QQ 音乐、腾讯音乐娱乐、酷狗音乐、Apple Music 或其它第三方平台的官方客户端。本项目不提供付费内容、会员限制、音质限制或版权限制的绕过能力。
