# THRESHOLD / G0 — 门界

两个独立三维房间之间的双向实时传送门实验。目标是验证空间映射、视角相关实时画面、胶囊碰撞与固定物理步穿越，不包含正式游戏世界或多人系统。

验收结论以 [G0 验收表](docs/G0_ACCEPTANCE.md) 和 [实际技术报告](docs/G0_TECHNICAL_REPORT.md) 为准。核心数学、实时渲染和真实Rapier穿越已实现；真实 Android 设备性能尚未验证，因此总体结论为 PARTIALLY VERIFIED。

## 环境与技术栈

Node.js 24，npm 11；支持 WebGL 2 的桌面或移动浏览器。运行时依赖精确锁定为 React 19.3.1、Three.js 0.187.0、React Three Fiber 9.8.2、Rapier 0.21.0。构建与测试使用 Vite 8.3.6、TypeScript 6.0.3、Vitest 5.1.0、Playwright 1.65.0。完整版本见 `package-lock.json` 与技术报告。

## 安装与运行

```bash
npm ci
npx playwright install chromium
npm run dev
```

打开终端输出的本地地址，默认 `http://localhost:5173`。`dev` 绑定 `0.0.0.0`，同一局域网设备可使用主机 IP 访问；实际网络和浏览器权限由运行环境决定。首次安装浏览器系统依赖的 Linux CI 可执行 `npx playwright install --with-deps chromium`。

## 操作

桌面：WASD 移动；按住鼠标拖动观察，或双击画布请求指针锁定；Esc 释放，R 重置。F3 或右上角 DATA 按钮切换诊断。

手机：左半区单指拖动摇杆移动，右半区另一个手指滑动观察，两区可以同时使用；转身后可自然返回。右上角 RESET 重置，DATA 查看简化诊断；横屏优先，也支持尺寸变化。页面禁止滚动并处理取消、失焦和方向变化。自动化覆盖的是 Chromium 触控模拟，真实手机覆盖见限制文档。

右上角 RT 菜单可选择 100%、85%、50%、25% 离屏分辨率。它只降低实时渲染采样分辨率，保持主视口比例和真实透视，不改变模拟速度。

A 是冷灰色房间，B 是暖砂色房间。A 门位于 `(0,1.45,-8)`，B 门位于 `(32,1.45,0)` 并绕 Y 旋转 90°，因此穿越包含真正的方向变换。红色立方体、黑色立柱、方向地标与 B 房间运动物体帮助判断空间连续性。

## 测试与构建

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run test:production
npm run verify
npm run test:subpath
npm run measure:software
npm run build
npm run preview
```

`test:unit` 包含数学与物理集成测试。`test:e2e` 启动 Vite 开发服务器并使用真实 Chromium。`test:production` 先构建普通生产版本，再对 `vite preview` 执行浏览器冒烟，使用真实键鼠输入完成双向穿越。`test:subpath` 构建 `/threshold-g0/` base 并在本地子路径进行浏览器冒烟。`verify` 组合类型检查、Lint、Vitest、浏览器测试和生产构建/冒烟，任一步失败会返回非零退出码。

构建产物位于 `dist/`。默认相对 `base` 便于根目录及静态子目录部署；明确的 GitHub Pages 仓库路径也可使用 `VITE_BASE=/repository/ npm run build`。当前未部署到任何远程地址。

## 诊断与证据

使用 `?debug=1` 开启诊断；F3 切换面板。面板包含物理状态、传送事件、Render Target、帧时间与 GPU 资源数量，并支持 JSON 导出。GPU 计时当前未采集，面板显示 N/A；测试环境检测到计时扩展也不代表已执行 GPU query，不能用 CPU 时间代替。

开发服务器使用 `?test=1` 启用确定性输入、角色定位和强制步进适配器 `window.__THRESHOLD__`。`npm run build:test` 创建明确的 e2e 模式构建，也允许该入口。普通 `npm run build` 产物即使传入 `?test=1` 也不会暴露修改接口。`?debug=1` 仅提供只读 `window.__THRESHOLD_DIAGNOSTICS__()`，正式UI仍可操作。开发诊断的“几何”按钮显示胶囊、碰撞体、门平面和最近穿越交点；普通生产UI不提供该几何开关。

`npm run measure:software` 在另一个终端已有开发服务器时，使用1280×720、DPR1的SwiftShader Chromium预热3秒并采集15秒；可传入URL与1–600秒时长，例如 `npm run measure:software -- http://127.0.0.1:5173/?test=1 30`。结果写入 `evidence/performance-software-chromium.json`，只代表云端软件渲染器，不代表真实桌面GPU或手机。

实际日志和截图位于 `evidence/`；Playwright 失败截图与 trace 位于 `test-results/`，HTML 报告位于 `playwright-report/`。CI 配置为 `.github/workflows/ci.yml`，失败时上传测试产物。

## 进一步阅读

- [架构](docs/ARCHITECTURE.md)
- [验收状态](docs/G0_ACCEPTANCE.md)
- [技术报告](docs/G0_TECHNICAL_REPORT.md)
- [限制与真实设备覆盖](docs/G0_LIMITATIONS.md)
- [真实手机十分钟采集流程](docs/DEVICE_TEST.md)
- [已核查的实际官方 API](docs/API_REVIEW.md)
- [可复现验证协议](docs/VALIDATION_PROTOCOL.md)

G0 只支持一对固定、无缩放、绕竖直轴旋转的门；没有递归传送门、物体跨门模拟、局部重力或正式音频系统。真实手机十分钟测试尚未执行。
