# GitHub Pages 发布目标

- 账号：`yhzhao0721`
- 目标仓库：`yhzhao0721/compose_apple`
- 目标网址：`https://yhzhao0721.github.io/compose_apple/`
- 远程仓库已创建，使用 `main` 分支根目录发布静态页面。

本地 `project-pages` 远程指向新网站仓库，`pages` 保留旧站仓库，`origin` 保留原版本地仓库。更新游戏后，将经过验证的提交推送到 `project-pages` 的 `main` 分支。GitHub Pages 从该分支根目录部署，`.nojekyll` 让静态资源直接发布，无需构建。

本游戏所有运行资源均使用相对路径，也可部署到项目子路径。不要上传父级 Obsidian 库、临时浏览器测试文件或账号凭据。

发布完成后检查首页 HTTP 状态、物理引擎和 16 张图片的加载，并实际验证开局和投放。公开网址生成后再在手机微信中试玩。
