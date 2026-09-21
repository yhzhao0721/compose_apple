# 合成苹果乐

基于 https://github.com/guguguing/compose_qu 的本地独立衍生版本，保留原始 Git 历史。原版目录不受影响；尚未创建远程 GitHub fork 或发布网页。

## 运行

电脑可直接打开 `index.html`，图片与 Matter.js 0.20.0 都在本地，不需要 CDN。也可在此目录运行 `python3 -m http.server 8080`，然后打开 http://localhost:8080 。手机、微信试玩需通过能访问的 HTTP/HTTPS 地址打开，不能访问电脑上的文件路径；对外分享建议使用 HTTPS 静态托管并上传完整目录。

## 规则

- 每局从 `assets/characters/` 的 15 位普通角色中，无放回随机抽取 10 位，顺序也随机。
- 第 11 级固定为 `苹果乐.jpg`；两枚第 10 级合成苹果乐，苹果乐不再升级。
- 直接投放仅生成本局前 3 级。合成得分按新等级计，最佳分保存在 `composeAppleBest`，与原游戏独立。
- 首次开始、确认换一局、结束后再来一局会重新抽选；暂停、缩放、旋转不换阵容。
- 图片在 Canvas 与预览中等比例居中裁圆，不拉伸。全部图片加载完成才能开局。

## 跨端处理

- 固定 520 × 700 游戏坐标，CSS 根据可用屏幕适配，支持小一点／自动／大一点；显示比例不改变物理难度。
- 手机单列、桌面双列、横屏紧凑布局；安全区留白，Visual Viewport 地址栏高度变化处理，保留页面缩放与游戏区外滚动。
- Pointer Events 拖动、捕获和取消处理；旧内核 Touch Events 回退，抑制重复点击。键盘左右瞄准、空格或 Enter 投放。
- 固定 60 Hz 物理步长，危险线按模拟时间判定，限制后台恢复时补算；切后台暂停并需手动继续。
- 高分屏 Canvas 像素倍率限制在 2，降低手机绘制成本。图片预加载、错误反馈与存储异常容错。
- 合成队列在物理求解后处理，防止同一物体重复参与合成。

微信使用系统或内置网页内核；这里按能力检测提供通用适配，不依赖微信 SDK。浏览器模拟不能代替 Android、iOS 微信真机测试。

## 文件

- `index.html`：界面与入口。
- `style.css`：布局、移动端、安全区及控件。
- `game.js`：随机抽选、物理、绘制、输入和生命周期。
- `assets/characters/`：本版本 16 张原始用户图片；旧 `fruit-*` 仅保留为上游素材，不参与游戏。
- `vendor/matter.min.js`、`vendor/LICENSE`：固定版本物理引擎与 MIT 许可证。

适配参考：[MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)、[MDN pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)、[WebKit 安全区](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)。
