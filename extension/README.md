# Mineradio Connector

Mineradio Connector 是给 Mineradio Web 使用的 Chrome/Edge Manifest V3 插件。它会在扩展后台读取浏览器里的音乐网页登录态，请求搜索、封面、歌词和播放地址探测结果。插件不会把 Cookie 原文发送给 Mineradio Web 页面。

## 安装

1. 下载 `mineradio-connector.zip`。
2. 解压到固定文件夹。
3. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
4. 开启“开发人员模式”。
5. 点击“加载解压缩的扩展”，选择解压后的文件夹。
6. 打开或刷新 Mineradio Web。

更新插件文件后，需要在扩展管理页点击“重新加载”。当前版本应显示为 `0.4.6`。

## 使用

- 插件弹窗可直接打开播放器、网易云、QQ 音乐和酷狗网页。
- 先在对应音乐网页版登录，再回到 Mineradio Web 搜索。
- 网易云支持首页收藏/推荐、搜索、歌词和播放探测。
- QQ 音乐支持状态检测、QQ-X 搜索和播放探测。若只显示“账号已检测到”，请先在 `y.qq.com` 网页播放任意歌曲，再刷新插件状态。弹窗会分开显示“账号登录态”“QQ 音乐标签页”和“播放授权 Cookie”是否完整。
- 酷狗支持状态检测和 KG-X 搜索/播放探测，稳定性取决于网页端返回。
- Apple Music、汽水音乐等渠道正在加入中；稳定前不显示为可用音源。

如果你启用了代理，请把 `music.163.com`、`y.qq.com`、`u.y.qq.com`、`c.y.qq.com`、`*.qqmusic.qq.com`、`*.kugou.com` 等音乐平台域名设为国内直连。扩展请求会跟随浏览器/系统网络环境，海外出口可能触发平台地区或风控拦截。
