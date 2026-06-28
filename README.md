# Mineradio Web

Mineradio Web 是一个可部署到 GitHub Pages 的静态网页播放器。默认支持本地音乐导入和歌曲试听推荐；安装浏览器 Connector 插件后，可以使用浏览器里已登录的音乐网页会话做搜索、歌词、封面和播放地址探测。

在线页面：[https://mrchenyh.github.io/Mineradio-Web/](https://mrchenyh.github.io/Mineradio-Web/)

## 使用方式

1. 打开在线页面，未安装插件也可以导入本地歌曲或播放歌曲试听推荐。
2. 下载插件包：页面启动页的“下载 Connector 插件”，或仓库里的 `web/public/downloads/mineradio-connector.zip`。
3. 解压到一个固定文件夹。
4. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
5. 开启“开发人员模式”，选择“加载解压缩的扩展”，选中刚才解压后的文件夹。
6. 在浏览器里登录 `music.163.com`、`y.qq.com` 或 `www.kugou.com`。
7. 刷新 Mineradio Web，插件弹窗显示账号状态后即可搜索和播放。

插件更新后，需要在扩展管理页点击“重新加载”。新版插件版本应显示为 `0.4.3`。

## 当前音源策略

- 本地文件：不需要插件，直接导入播放。
- 歌曲试听推荐：不需要插件，默认作为未登录托底渠道。
- 网易云扩展：读取浏览器网页登录态，用于账号状态、首页收藏/推荐、搜索、歌词和播放探测。
- QQ 音乐扩展：读取 QQ 音乐网页登录态，用于 QQ-X 搜索和播放探测；建议保持 `y.qq.com` 标签页打开，并先在 QQ 音乐网页播放任意歌曲刷新播放授权。
- 酷狗扩展：已接入状态检测、搜索/播放探测和分享歌单导入。把酷狗分享文本或 `t1.kugou.com/gcid_...` 链接粘到 Mineradio 搜索框即可导入公开 H5 能读取到的歌曲。
- Apple Music、汽水音乐等渠道仍标记为“正在加入中”，稳定前不作为默认可用音源。

播放失败时，播放器会先自动查找同名同歌手的其他音源；收藏/歌单播放时，如果当前歌曲不可播，会继续尝试下一首。最后由歌曲试听推荐托底。

## 油猴脚本

辅助脚本在 `tampermonkey/mineradio-helper.user.js`。

安装方式：
1. 安装 Tampermonkey。
2. 新建脚本，把 `tampermonkey/mineradio-helper.user.js` 内容粘贴进去并保存。
3. 在网易云、QQ 音乐、酷狗网页上会出现一个 Mineradio 浮动按钮。
4. 点击按钮会打开 Mineradio Web，并把当前网页标题作为搜索词带过去。

油猴脚本只是快捷入口和搜索辅助，不能完整替代浏览器扩展。原因是它没有 MV3 扩展级的 cookies、跨站请求和媒体请求头权限，不能稳定接管各音乐平台的登录态和播放地址探测。

## 开发

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

Edge 插件测试：

```bash
npm run test:edge-extension
```

## 授权与声明

本项目来自 Mineradio Web 迁移实验，保留原项目 GPL-3.0 授权与来源说明。音乐平台内容、账号和播放权限归各平台所有，本项目仅做个人学习和本地测试用途。
