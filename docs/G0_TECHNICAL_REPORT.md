# G0 技术验收报告

**总体结果：PARTIALLY VERIFIED。** 最终验证日期：2026-11-06。

数学、实时视觉、双向穿越、物理稳定、自动化和生产构建已实际验证。真实移动浏览器和真实Android手机未连接，完整Gate E与手机性能Gate仍为BLOCKED，因此不宣布G0全部通过。

## 实际交付

初始 `/workspace` 没有既有项目或Git仓库，仅有系统辅助目录。工程直接建立在该目录，未覆盖其他项目，未推送未知远程仓库或覆盖正式部署。

交付包括两个独立Three Scene、单个实时离屏Render Target、出口裁剪和屏幕空间采样、Rapier运动学胶囊、分段双向穿越、出口胶囊重叠与路径扫掠、空间/方向重武装、桌面与双区触控输入、诊断/JSON导出、资源释放与上下文恢复、完整测试和静态构建。没有递归门、局部重力或正式世界扩展。

| 关键源码 | 实际职责 |
| --- | --- |
| `PortalMath.ts` / `PortalTypes.ts` / `PortalRegistry.ts` | 严格刚体数学、映射、平面交点、胶囊门洞边界和双向拓扑。 |
| `PortalRenderer.ts` / `PortalGeometry.ts` | 映射相机、实时RT、目标出口裁剪、门面屏幕采样、单pass及图形生命周期。 |
| `RoomLayout.ts` / `RoomA.tsx` / `RoomB.tsx` | 图形/物理同源建筑，独立冷灰与暖砂房间、可识别标记和运动参考物。 |
| `PhysicsRuntime.ts` / `CollisionQueries.ts` | 单一Rapier World的两个区域、胶囊运动约束、出口重叠及剩余路径查询。 |
| `PortalTransfer.ts` / `PlayerController.ts` / `PlayerState.ts` | 实际有效轨迹跨面、原子映射、唯一事件、目标剩余运动和输入/重力。 |
| `ExperienceLoop.ts` / `Experience.tsx` | 单一R3F调度，固定1/60s、每帧最多5步追赶、相机与两次绘制。 |
| `DesktopInput.ts` / `TouchInput.ts` / `InputManager.ts` | WASD、拖动/指针锁、双Pointer ID移动/观察、取消/失焦/方向变化恢复。 |
| `DebugOverlay.tsx` / `DebugGeometry.ts` / `PerformanceMonitor.ts` | 低频观察、深拷贝快照、帧时间分位数、资源/context与开发几何检查。 |

## 技术决策

A门位于 `(0,1.45,-8)`，B门位于 `(32,1.45,0)` 且yaw=90°。两个Scene使用统一但不重叠的物理坐标。核心变换为 `T_AB=M_B·Ry(π)·inverse(M_A)`，速度与输入只使用旋转，重力始终为-Y。门姿态拒绝缩放、倾斜、反射、奇异矩阵、NaN和Infinity。

虚拟相机复制主投影，门面通过屏幕像素坐标采样RT。目标出口平面裁掉背面几何，离屏期间隐藏目标门表面以禁止递归。RT保持视口宽高比，质量选项为100/85/50/25%。近门5mm时仍在眼前的门面通过clip-depth限制保持可见。离屏绘制在finally恢复renderer状态。

Rapier胶囊半径0.30m、圆柱半高0.57m，总高1.74m。Transfer先按无限门平面对raw desired切分，Rapier源查询只处理平面前段，并复核实际交点与胶囊门洞。剩余原始位移只在目标世界查询和求解，不会被源门后障碍削减。近门查询预先排除完全源背面的cuboid，门框与跨平面形状保留；目标完整overlap/sweep不放松。若剩余路径会碰到非地面障碍，G0保守拒绝整次传送。穿越位置由真实交点映射，未使用固定出生点。

传送状态由空间和方向重武装，出口离开距离至少0.4m且朝外；不用固定冷却。同一物理步最多一次提交，事件编号跨reset仍单调递增。跨世界重定位和普通运动学位移分开提交；没有跨40m的普通位置插值。诊断快照深拷贝事件，防止后续状态污染已采集证据。

官方文档与实际安装类型核查见 `API_REVIEW.md`；完整模块边界见 `ARCHITECTURE.md`。

## 精确版本与环境

| 项目 | 实际版本 |
| --- | --- |
| 系统 | Debian GNU/Linux 13.6 (trixie)，Linux 6.18.57 x86_64 |
| Node.js / npm | 24.22.1 / 11.9.0 |
| React / React DOM | 19.3.1 |
| Three.js / @types/three | 0.187.0 |
| React Three Fiber | 9.8.2 |
| Rapier compat | 0.21.0 |
| Vite / TypeScript | 8.3.6 / 6.0.3 |
| Vitest / Playwright | 5.1.0 / 1.65.0 |
| ESLint / typescript-eslint | 10.14.0 / 8.72.1 |
| 浏览器 | Headless Chromium 158.0.8127.18 |
| 图形 | WebGL2；ANGLE Vulkan SwiftShader（软件渲染） |

全部直接依赖见 `evidence/dependency-versions.txt`；完整传递依赖精确锁定于 `package-lock.json`；`evidence/source-manifest.json`记录最终源码校验清单。没有为兼容旧示例降级技术栈。

## 实际执行与结果

最终 `npm run verify` 已成功退出，完整日志为 `evidence/verify.log`。没有忽略异常、统一跳过、失败重试制造绿色结果。

| 实际命令 | 结果与数量 | 证据 |
| --- | --- | --- |
| `npm install --save-exact`（初始安装） | 依赖已实际安装并精确锁定 | `package-lock.json`、依赖版本记录。 |
| `npm run typecheck` | PASS | 最终verify。 |
| `npm run lint` | PASS | 最终verify。 |
| `npm run test:unit` | PASS，5文件34测试、失败0 | `evidence/vitest.json`。 |
| `npm run test:e2e` | PASS，22测试、失败0、跳过0、重试0 | `evidence/playwright.json`。 |
| `npm run build` | PASS，静态dist完整生成 | 最终verify构建输出。 |
| `npm run test:production` | PASS，普通production 1浏览器测试 | `evidence/production.json`。 |
| `npm run verify` | PASS，以上完整串行组合 | `evidence/verify.log`。 |
| `npm run test:subpath` | PASS，`/threshold-g0/` base、资源200、真实WebGL2 | `subpath-smoke.json/log/png`。 |
| `npm run measure:software` | 已实测，性能数字见下节 | `performance-software-chromium.json`。 |

34项Vitest由8项数学、12项角色/穿越集成、7项出口/源轨迹查询、4项渲染状态与生命周期、3项帧统计测试组成。数学固定种子 `0x54485245` 的1000组随机属性检查包含在一个测试内，未冒充1000个独立测试；断言位置往返≤1e-4m、姿态≤0.001°、速度相对误差≤1e-4。失败输入包含seed/index和完整输入。

P03实际完成100次完整A→B→A自然运动循环，恰好200个唯一递增事件、200个不同物理步；每次验证世界ID、有限位置/速度、单位姿态、合法区域和胶囊body一致性。真实门框、出口实体障碍、解除阻塞恢复、高速剩余运动、非法dt与reset均实际运行。浏览器额外验证长帧追赶最多5步。

CI文件 `.github/workflows/ci.yml` 安装锁定依赖、Chromium并运行verify，使用失败即失败的bash管线，always上传日志/报告/截图/dist。没有已授权远程仓库，GitHub Actions远程执行为BLOCKED；没有编造已上线地址。

## 浏览器与视觉证据

开发测试使用真实Chromium的WebGL2；视觉条件固定1920×1080、DPR1和模拟时钟。22项开发E2E包含桌面输入、双向事件、碰撞阻塞、高速/长帧、5项触控仿真、context丢失恢复、资源/resize、诊断下载、Esc、几何观察隔离和真实像素验证。触控通过CDP真实多触点产生Pointer Events，并断言不同Pointer ID与native capture；仍属于模拟而非真实手机。blur/orientationchange/visibilitychange处理测试由脚本dispatch事件，visibility的document.hidden使用临时getter模拟，不能替代真实OS前后台或真机旋转；resize则实际改变浏览器viewport并验证R3F尺寸更新。

普通production通过 `vite preview` 启动；即使URL包含 `?test=1` 也不存在修改适配器。测试使用真实W和鼠标拖动完成A→B、转身、B→A，读取真实只读诊断中的世界ID与事件 `[1,2]`。因此没有仅以DOM文字代替穿越验证。

| 视觉姿态 | 可定位标记数量 | 最大实际像素中心误差 |
| --- | --- | --- |
| 正面3m | 4 | 0.195px |
| 30°斜角 | 2 | 0.030px |
| 60°斜角 | 1 | 0.092px |
| 距门1m | 3 | 0.242px |
| 距门0.1m | 3 | 0.159px |
| 距门0.005m | 3 | 0.213px |
| 门框边缘 | 3 | 0.288px |

标记预期位置由测试独立映射/相机投影计算，再对真实截图色彩分割并求中心；所有姿态至少一个实际可见点，未全部跳过。最大误差0.288px，小于2px目标。各case同时检查出口背面紫色探针无泄漏；侧移产生视差，运动参照物图像随时间变化。

真实固定步从门前5mm跨入B后，green/cyan标记前后像素误差均≤0.213px，实际屏幕移动分别1.461/0.767px，和独立投影一致；没有用黑屏遮挡或跨40m插值。`visual-cross-plane.json`保留交点、剩余位移、事件和像素数据。

主要截图/JSON：`visual-front`、`visual-oblique-30`、`visual-oblique-60`、`visual-distance-1m`、`visual-distance-0.1m`、`visual-pre-plane-0.005m`、`visual-frame-edge`、`visual-cross-plane-before/after`、`visual-animation-before/after`、`production-B`、`production-returned-A`、`mobile-landscape/portrait`、`diagnostics-ui`，均位于 `evidence/`。

真实 `WEBGL_lose_context` 恢复后再次产生主/离屏pass。多次resize资源数量有界；dispose后几何、纹理、程序均为0，见 `resize-resources.json`。诊断JSON真实下载见 `diagnostics-export.json`。

## 性能实测

实际独占采集命令：已有开发服务器时运行 `npm run measure:software`。脚本 `scripts/measure-performance.js` 预热3秒后清空帧统计，再采集15.099秒、216帧。视口1280×720、DPR1，RT1088×612（85%），主/离屏draw calls为13/31，几何/纹理/程序为5/1/5。

| 指标 | 实测结果 |
| --- | --- |
| 平均FPS（由平均帧间隔计算） | 14.36 |
| 平均帧时间 | 69.65ms |
| P95 / P99帧时间 | 147.10 / 170.00ms |
| 最后一次物理批次耗时 | 0.50ms（不是全程平均） |
| GPU耗时 | N/A，未执行GPU query |

渲染器为 `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。计时扩展检测存在，但未执行GPU query，绝不以物理/CPU耗时冒充。该样本在源分段修复和最终verify之后独占采集，替代早期并发样本与修复前样本。

这一云端软件渲染样本没有达到60FPS；不能外推为主流真实桌面GPU或Android性能。**真实Android设备未测试**：中端P95≤33.3ms、高性能60FPS、十分钟持续稳定性及真实前后台/旋转覆盖均BLOCKED。真机采集入口和分窗口记录流程见 `DEVICE_TEST.md`。

最终生产JS为5514.34kB，gzip1993.62kB，构建发出chunk体积warning；Rapier compat包含WASM数据，尚未专门拆包优化加载。该warning不影响构建成功，但属于移动网络加载预算限制。

## 中间问题与修复

- 最后只读审计发现源世界完整运动查询会被门后box限制：A门后z=-9的box使120m/s跨门后B.x=32.3904，而应为33.8005，错误损失约1.41m剩余位移。已改为严格平面前段源查询，原始剩余量仅在目标求解；新增远/近背面box、高速、正常步行接近及目标阻塞组合四项回归。修复后34项Vitest、22项开发E2E及1项普通生产E2E全部通过。`source-residual-regression-after.json`记录实际B.x=33.8004989624，预期33.8005，误差1.0376e-6m；未伪造修复前日志，修复前数值来自本轮真实工具复现输出。
- 近门5mm时门表面会落到主相机near之前而消失。已限制门面clip深度；5mm真实像素和跨面before/after回归通过。
- 诊断快照最初返回事件数组与指标的活动引用，后续事件会污染早期采样。已深拷贝事件/数组并复制指标，最终浏览器JSON已重跑。
- 新增诊断E2E时，第一轮组合verify的19浏览器测试通过，但build类型检查发现 `stopped.input` 为unknown。已使用明确InputDiagnostics类型并修正测试，保留 `evidence/verify-initial.log`；最后完整verify全部通过，没有忽略失败。

## 未通过项、限制与G1判断

Gate A/B/C/D/F/G通过；Gate E因真实移动浏览器/设备未覆盖而BLOCKED；真实手机性能Gate也BLOCKED。没有剩余核心自动化失败，但这些阻塞不能统计PASS。

尚未覆盖Safari、Firefox和实际移动GPU。G0仅支持单对固定yaw门、upright胶囊和单层目标画面；出口剩余路径碰障碍时选择整次保守拒绝，不包含跨门物体、递归、局部重力或移动建筑。详细限制见 `G0_LIMITATIONS.md`。

现有数学、单pass渲染与原子传送模块足以作为G1继续工程开发的可复用基础。真实移动浏览器和硬件性能缺口关闭之前，不建议把它视为THRESHOLD V1正式生产基础已完成验收；本轮交付结论保持PARTIALLY VERIFIED。
