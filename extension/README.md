# Mineradio Connector

Mineradio Connector 是给 Mineradio Web 使用的 Chrome/Edge Manifest V3 插件。

它会在扩展后台使用浏览器里的音乐网站登录态，请求搜索、封面、歌词和播放地址探测结果。插件不会把 Cookie 原文发送给 Mineradio Web 页面。

## 安装

1. 下载 `mineradio-connector.zip`。
2. 解压到固定文件夹。
3. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
4. 开启“开发人员模式”。
5. 点击“加载解压缩的扩展”，选择解压后的文件夹。
6. 打开或刷新 Mineradio Web。

## 使用

- 插件弹窗可直接打开播放器、网易云、QQ 音乐和酷狗网页。
- 先在对应音乐网页版登录，再回到 Mineradio Web 搜索。
- 如果更新了插件文件，需要在扩展管理页点“重新加载”。
- QQ 音乐如果只显示“账号已检测到”，请先在 `y.qq.com` 网页播放任意一首歌，再刷新插件状态。扩展会把“账号登录态”和“播放授权 Cookie”分开显示。
- Apple Music、汽水音乐等渠道正在加入中；稳定前不会显示为可用音源。

## 当前测试源

- 网易云音乐：`music.163.com`
- QQ 音乐：`y.qq.com`
- 酷狗音乐：`www.kugou.com`
