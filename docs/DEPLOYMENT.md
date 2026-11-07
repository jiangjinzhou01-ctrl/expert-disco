# GitHub Pages

线上地址：https://jiangjinzhou01-ctrl.github.io/expert-disco/

`.github/workflows/pages.yml` 安装锁定依赖、执行生产构建，只上传 `dist/`。Vite 使用相对 base，因此资源路径位于 `/expert-disco/assets/`。

2026-11-07 排查发现：仓库启用了从 `main` 根目录发布的传统 Pages，直接发布了源码 `index.html`，其中 `/src/main.tsx` 无法在静态站点运行，导致空白页。已重新通过 Actions 发布生产产物。

当前连接不能修改仓库 Pages 的发布来源（GitHub API 返回 403）。工作流因此同时监听传统 `pages build and deployment` 的完成事件，在传统发布之后再次发布生产产物，避免后续 push 重新留下源码首页。此监听只匹配传统工作流，不会监听自身。以后如将 Settings → Pages → Source 改为 GitHub Actions，现有 push 和 workflow_dispatch 触发仍然适用。

排查时应核对线上 HTML 请求的是 `assets/*.js`，而不是 `/src/main.tsx`；仅有 GitHub Pages 成功状态不足以确认应用可以运行。
