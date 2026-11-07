# THRESHOLD V0.2 / THE FIRST THRESHOLD

可自由探索的双向实时传送门章节：VESTIBULE 巨构前厅 → INVERT → 真实重力弧面 → 墙面终端 → 原路返回。保留 G0-LAB 的完整数学、传送与测试实现。

默认入口是 V0.2。工程结论为 **PARTIALLY VERIFIED**：运行与自动化证据见 [验收报告](docs/V02_TEST_REPORT.md)；没有接入真实 Android 设备，不能声称手机帧率已达标。美术表现的实际限度见 [美术审查](docs/V02_ART_REVIEW.md)。本次没有推送或覆盖 GitHub 上的 G0 部署。

## 安装与启动

需要 Node.js 24 / npm 11、WebGL 2 浏览器。交付内已包含 GLB、贴图、碰撞数据，无需先安装 Blender。

```bash
npm ci
npm run dev -- --port 5180
```

打开 `http://localhost:5180/`。`dev` 绑定全部网络接口；同一局域网手机可使用主机 IP 与端口访问。云工作区需要平台端口转发。

```bash
npm run build
npm run preview -- --port 4180
```

生产预览：`http://localhost:4180/`。可直接部署 `dist/` 到静态服务器。默认相对资源路径；仓库子路径构建示例：`VITE_BASE=/your-repository/ npm run build`。不能用 file:// 打开含模块与 WASM 的入口。

## 操作与章节路线

- 桌面：WASD 移动；鼠标拖动观察，双击画布请求指针锁定；Esc 释放，R 回到最近有效检查点，F3 切换数据。靠近终端按 E。
- 手机：左半区拖动移动，右半区另一个手指观察。右上角 ↺ 安全复位，⋯ 打开设置。靠近终端出现触控按钮；建议横屏。
- 设置：实时门内画质、减少镜头运动、诊断、返回章节起点、G0-LAB。减少运动只影响镜头 Up 过渡，身体与碰撞仍真实旋转。

从窄廊走出，绕过中央下沉庭院（桥也可通行），走进黑色大门。INVERT 中向前走进弧面入口，沿弧面向右上方行走；站到墙上后继续上行约 0.8m，再沿墙向前走到终端。激活后沿原路退回地面，从入口门返回前厅，中央装置会回应。可随时停止、倒退和转身，没有自动沿路线搬运角色的逻辑。INVERT后方另有原始重力方向的实体楼梯和观察廊台，可沿正常重力探索；站墙后可看到它们变为横向的建筑参照。

## 模式与诊断

| 入口 | 用途 |
| --- | --- |
| `/` | 完整首章 |
| `/?debug=1` | 首章与实时诊断、JSON 导出 |
| `/?mode=lab` | 原 G0 实验房间 |
| `/?mode=chapter&test=1` | 仅开发/e2e 构建开放确定性测试接口 |
| `/?test=1` | 保留旧测试链接，进入 LAB |

首章只读运行快照为 `window.__THRESHOLD_V02__()`。正式构建不会提供 `window.__V02_TEST__`，即使 URL 带 test 参数。开发设置内的“碰撞几何”可观察真实胶囊、弧面网格和独立碰撞代理，不改变模拟。G0 的只读/测试接口保持兼容。

诊断含脚底/眼睛、身体四元数、Up、重力、接触法线、θ、查询次数、事件和拒绝原因、FPS/P50/P95/P99、物理耗时、主/门内 Draw Calls、目标分辨率与资源数。GPU 时间未采集，显示 N/A；物理 CPU 耗时不冒充 GPU 时间。

## 验证

```bash
npx playwright install --with-deps chromium
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run test:production
npm run test:subpath
npm run verify
```

`verify` 顺序执行以上所有门槛。Vitest 包含原 G0 34 项与新重力/路径/资产验证；浏览器用真实 WebGL 2 与 Rapier。生产测试禁止修改接口，用真实键盘完成完整章节并录制视频。软件渲染器较慢，生产回归允许较长超时；超时仍会失败，不跳过断言。CI 安装锁定依赖与 Chromium，失败即失败并上传日志和证据。

所有测试的固定步、随机种子、断言范围与实际数量以报告为准。`evidence/` 内也有继承的 G0 历史文件，不能当作本轮新数据；本轮主日志为 `evidence/v02/verify-final.log`。

在另一个终端已有 5180 开发服务器、且没有其他图形测试运行时：

```bash
npm run measure:v02
```

它测量云端 SwiftShader 三个视角，并统计 `dist/` 实际字节数；不代表真实桌面 GPU 或 Android。真机 10 分钟操作和数据导出步骤见 [设备验证](docs/DEVICE_TEST_V02.md)。

## 可维护资产

源模型：`assets/source/threshold-v02-architecture.blend`，贴图：`assets/source/textures/`，导出：`public/assets/v02/`。资产 manifest 包含每个模块的 ID、原点、包围盒、材质与三角面数。正式模型没有使用参考图作为背景或门内纹理。

若需重新制作同源视觉/碰撞资产，安装 Blender 4.3.2（或兼容版本）后运行：

```bash
npm run assets:build
npm run test:unit
npm run build
```

生成器会替换该专用源文件和生成数据；Blender 源使用项目的 +Y 向上约定，两个世界各有命名Collection；默认隐藏INVERT以避免局部原点重叠，编辑时切换可见性。避免在源码模型中手工编辑后直接运行生成器而丢失修改。

## 工程说明

- [架构、数学和建模管线](docs/ARCHITECTURE_V02.md)
- [CR1 实测修订](docs/CR1_DEVIATIONS.md)
- [真实引擎截图与美术审查](docs/V02_ART_REVIEW.md)
- [测试、构建和验收报告](docs/V02_TEST_REPORT.md)
- [边界与限制](docs/V02_LIMITATIONS.md)
- [原始 G0 说明](docs/README_G0_ORIGINAL.md)
- [本轮完整任务书](docs/THRESHOLD_V02_CODEX_MASTER_PROMPT.md)

依赖精确锁定于 package-lock.json。没有账号、联网 API、ECHO/DRIFT、递归门或大型物体跨门模拟。
