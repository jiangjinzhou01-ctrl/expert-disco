# G0 验收表

**最终状态：PARTIALLY VERIFIED。核心自动化已通过，真实移动浏览器与硬件性能仍受阻。** 更新日期：2026-11-06。

`PASS` 仅表示有实际执行证据；`FAIL` 表示实测失败；`BLOCKED` 表示环境/权限/硬件限制；`NOT RUN` 表示尚未执行。后三类不得统计为通过。测试方案见 `VALIDATION_PROTOCOL.md`，方案本身不是执行证据。

## 最终 Gate

| Gate | 状态 | 证据或剩余条件 |
| --- | --- | --- |
| A 数学正确 | PASS | `evidence/wp01-math.log`；M01–M07、1000 固定种子属性测试已实际通过。状态机另由 M08 验证。 |
| B 真实视觉 | PASS | Chromium真实像素、独立投影、多角度/近门/出口裁剪/实时动画；跨面before/after像素连续。 |
| C 真实双向穿越 | PASS | `browser-bidirectional.json`、`production-browser.json`；真实跨面和递增事件。 |
| D 物理稳定 | PASS | 100完整往返及34项Vitest；源门后障碍残余量缺陷已修复，4项新回归和最终浏览器复验通过。 |
| E 双端可运行 | BLOCKED | 桌面和Chromium触控仿真已有通过证据，真实移动浏览器/手机未覆盖，故完整Gate不通过。 |
| F 自动化与构建 | PASS | 修复后最终verify退出0：34 Vitest +22开发E2E +1普通生产E2E，typecheck/lint/build通过。 |
| G 可检查交付证据 | PASS | 源码、README、架构、验收、限制与技术报告，`evidence/verify.log`、JSON/截图/软件性能实测。 |
| 真实手机性能 Gate | BLOCKED | 无真实 Android 设备，不得宣称 P95≤33.3ms 或十分钟通过。 |

## 工程与 API

| 验收项 | 状态 | 实际依据 |
| --- | --- | --- |
| 检查目录、现有文件和 Git | PASS | `/workspace` 无既有项目或 Git 仓库，仅系统辅助目录；未修改其他项目。 |
| 精确依赖与 npm lockfile | PASS | `package.json`、`package-lock.json`；已实际安装。 |
| 官方文档及已安装类型核查 | PASS | `docs/API_REVIEW.md`；Three/R3F/Rapier/Playwright/Vite。 |
| TypeScript strict、Lint | PASS | 最终verify完整typecheck/lint成功。 |
| 核心单一循环与高频状态隔离 | PASS | 单一priority-1 useFrame；60Hz/max5补偿，浏览器实际步号及长帧限制。 |
| 静态部署与仓库子路径 | PASS | `subpath-smoke.json/log/png`；/threshold-g0/资源200、真实WebGL2。 |
| CI 失败即失败、报告上传 | PASS | 已审查 `.github/workflows/ci.yml` 无忽略失败；远程运行单独BLOCKED。 |

## 数学（Vitest）

| 编号 | 验收项 | 状态 | 证据 |
| --- | --- | --- | --- |
| M01 | A→B→A 位置/姿态/速度恢复 | PASS | `portal-math.test.ts` / `wp01-math.log`。 |
| M02 | 固定种子至少1000组随机变换，距离、逆变换和姿态误差 | PASS | seed `0x54485245`，1000组；位置≤1e-4m、姿态≤0.001°、相对速度误差≤1e-4断言。 |
| M03 | 速度及输入旋转、模长保持、无平移污染 | PASS | 方向与零向量断言。 |
| M04 | 门平面交点、t和剩余位移 | PASS | 正面和旋转门断言。 |
| M05 | 门洞有效边界与胶囊体积 | PASS | 左右、头、地面和过大胶囊拒绝。 |
| M06 | 平行、反向、切向与近零位移 | PASS | 无误触发或除零。 |
| M07 | NaN/Infinity/奇异/缩放/反射/倾斜输入拒绝 | PASS | 明确 RangeError 断言。 |
| M08 | 合法状态机与同一物理步最多一次提交 | PASS | `wp03-physics.log`，两个专门状态机测试。 |

## 实时渲染与视觉

| 验收项 | 状态 | 证据或判定 |
| --- | --- | --- |
| 两个真正独立的 Three Scene | PASS | 两个Scene构造及真实不同房间画面、主/离屏draws。 |
| 实时 RT、映射相机、屏幕空间采样 | PASS | `visual-*.json/png` 的独立投影与真实像素，多视角改变位置。 |
| 正面已知标记像素误差约≤2px | PASS | `visual-front.json/png`，固定1920×1080 DPR1。 |
| 30°斜角 | PASS | `visual-oblique-30.json/png`。 |
| 60°斜角 | PASS | `visual-oblique-60.json/png`，至少一个真实可见标记通过像素断言。 |
| 距门1m | PASS | `visual-distance-1m.json/png`。 |
| 距门0.1m | PASS | `visual-distance-0.1m.json/png`；另有5mm近裁剪回归。 |
| 门框边缘遮挡 | PASS | `visual-frame-edge.json/png`，门洞有效视线及遮挡断言。 |
| 相机经过门平面瞬间 | PASS | `visual-cross-plane.json`及before/after截图，5mm前→真实固定步跨面，green/cyan像素误差≤2px、移动<5px。 |
| 出口背后几何被正确裁剪 | PASS | 各视觉case同时验证背面紫色sentinel无像素泄漏。 |
| B 运动物体在门中实时运动且穿越后状态连续 | PASS | `visual-animation.json`及before/after截图；统一模拟时间更新。 |
| 离屏隐藏目标表面且最多1 pass | PASS | renderer-state测试与实际snapshot passes=1。 |
| renderer 状态完整恢复，异常分支也恢复 | PASS | `renderer-state.test.ts` 注入离屏异常后检查完整状态。 |
| Resize/DPR/RT宽高比与质量控制 | PASS | resize多尺寸、quality50%、DPR单元检查，`resize-resources.json`。 |
| 无逐帧RT/材质/几何大量创建，卸载释放 | PASS | 重复resize资源数量有界，dispose后几何/纹理/程序均0。 |
| WebGL上下文丢失/恢复 | PASS | 真实WEBGL_lose_context触发并恢复，`context-restoration.json`。 |

## 物理集成

| 编号 | 验收项 | 状态 | 证据 |
| --- | --- | --- | --- |
| P01 | 正常A→B穿越 | PASS | `wp03-physics.log`，真实Rapier状态/速度/胶囊一致。 |
| P02 | 正常B→A穿越 | PASS | 空间重武装后的真实反向运动。 |
| P03 | 100次完整A→B→A，200事件，无重复/NaN/非法区域 | PASS | 100完整循环/200唯一事件，每次检查世界、区域、姿态、body一致。 |
| P04 | 门框碰撞，不允许穿越 | PASS | 两项实际frame/擦边滑动测试；有效穿越交点须满足胶囊边界。 |
| P05 | 门洞有效区域通过 | PASS | 偏心0.5m实际入口保持映射坐标。 |
| P06 | 实体出口障碍阻塞时拒绝，源状态可恢复 | PASS | 真collider阻塞/移除后继续通过。 |
| P07 | 高速跨面无漏检，剩余位移进入目标碰撞 | PASS | 严格仅源prefix查询；源门后box回归实际B.x=33.80049896，预期33.8005，误差1.04e-6m。4项新回归覆盖近/远背面、高速/步行和目标阻塞。 |
| P08 | 极端时间步和长帧不重复提交 | PASS | 非法dt拒绝、源路径修正及`browser-fast-longframe.json`最大5步无重复。 |
| P09 | 异常后重置有效检查点 | PASS | 注入NaN/Infinity后reset恢复，事件编号保持递增。 |
| 胶囊半高换算/地面/滑墙 | PASS | .57/.30实际capsule，地面状态及门框擦边滑动集成测试。 |
| 位置/方向/速度/输入向量/相机原子映射 | PASS | P01/P02/P03 +浏览器事件前后旋转/速度/胶囊body一致性。 |
| 不将跨世界重定位变成巨大运动学速度 | PASS | source→anchor瞬移与target残余运动分开commit，真实位置/速度断言。 |
| 空间与方向重新武装，无固定冷却 | PASS | M08两case与100往返；离开≥0.4m且朝外才重武装。 |

## 浏览器、输入与构建

| 验收项 | 状态 | 证据 |
| --- | --- | --- |
| 应用加载、WebGL2上下文和真实场景建立 | PASS | Chromium真实WebGL2/context/draw calls断言。 |
| WASD与鼠标/指针锁或可靠拖动，Esc | PASS | production真实W/鼠标拖动双向；diagnostics定向测试真实Esc清除输入。 |
| 桌面真实输入双向穿越，世界/事件正确 | PASS | 普通production实际W/鼠标拖动，events=[1,2]，`production-browser.json`。 |
| R重置、F3诊断与首次说明 | PASS | 实际键盘R、真实F3和UI初始操作说明。 |
| 左摇杆+右滑动，多Pointer ID并发 | PASS | Chromium CDP原生多触点、不同Pointer ID和捕获断言；`mobile-multitouch.json`。 |
| pointercancel/捕获/焦点丢失/方向变化 | PASS | CDP触控与cancel/capture通过；blur/visibility/orientation由脚本dispatch模拟，非真实OS切后台/真机旋转；实际viewport尺寸变化另验证。 |
| 移动输入完成接近/观察/正向/转身/反向/重置/诊断 | PASS | Chromium触控仿真完成A→B→A、手势转身、按钮reset及portrait resize；真实手机另BLOCKED。 |
| 诊断字段、拒绝原因、RT、FPS/avg/P95/P99、资源、context | PASS | DebugOverlay实际字段与runtime JSON，统计专门单元测试。 |
| 诊断JSON导出 | PASS | 真实下载并解析schema/room/physics/render字段；`diagnostics-export.json`。 |
| GPU计时未采集明确N/A | PASS | 扩展存在但未执行query；gpuMs=null，UI显示N/A，无CPU冒充。 |
| 测试修改接口从普通生产隔离 | PASS | `production-browser.json`与subpath即使?test=1也无mutation adapter。 |
| TypeScript与ESLint | PASS | `evidence/verify.log`。 |
| 全部Vitest | PASS | 5文件34测试，失败0；`evidence/vitest.json`。 |
| 全部Playwright E2E/视觉 | PASS | 开发22测试，失败/跳过/重试0；`evidence/playwright.json`。 |
| Vite生产构建 | PASS | 最终verify构建成功，完整静态产物`dist/`；有bundle体积warning，见限制。 |
| 生产产物浏览器冒烟 | PASS | 普通生产1测试成功，真实W/拖动双向；`evidence/production.json`。 |
| CI远程执行 | BLOCKED | 无已授权GitHub仓库与远程运行。配置可本地审查。 |
| 未授权远程推送/覆盖部署 | PASS | 未进行。 |

## 真实性能与设备

| 验收项 | 状态 | 说明 |
| --- | --- | --- |
| Linux Chromium实际帧时间采样 | PASS | 独占SwiftShader：3秒预热+15.099秒/216帧；14.36FPS、P95 147.10ms，`performance-software-chromium.json`。仅采样通过，未达到60FPS。 |
| 主流桌面真实GPU 60FPS | BLOCKED | 当前仅云端自动化环境，无代表性真实桌面GPU。 |
| 中端Android稳定30FPS，P95≤33.3ms | BLOCKED | 未连接设备。 |
| 高性能Android争取60FPS | BLOCKED | 未连接设备。 |
| 真机连续10分钟多次往返/转动/前后台/尺寸变化/资源趋势 | BLOCKED | 未执行，不计通过。 |
| 可运行采集入口和操作说明 | PASS | `DEVICE_TEST.md`、实际JSON下载、`measure:software`脚本，硬件执行仍BLOCKED。 |

最终结论：Gate A/B/C/D/F/G通过；Gate E及真实手机性能Gate受阻。最后发现的源残余运动缺陷已修复并完成34+22+1全量回归，没有剩余核心自动化失败；硬件与真实移动浏览器未执行项仍不能统计为PASS。现有核心可作为G1工程开发基础，不能宣称全部G0或正式V1生产验收通过。
