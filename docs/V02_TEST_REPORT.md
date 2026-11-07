# THRESHOLD V0.2 实测验收报告

生成时间：2026-11-07T12:08:02.015777+00:00。总体 **PARTIALLY VERIFIED**。

代码、正式资产、完整双向章节及可执行自动化已交付；真实Android/桌面GPU性能未验证；全GI与摄影精修仍有明确限制，不能称为V0.2全面PASSED。

## 工作区与实际结果

工程 `/workspace/threshold-v02`，独立分支 `threshold-v02`，起点G0 commit `b8d9311`。36个原始源码文件与输入包逐字节相同后才扩展。主目录/在线G0没有被覆盖，未推送远程。完整工作区审计见INPUT_AUDIT_V02。

默认VESTIBULE/INVERT两个独立Three Scene与同一Rapier世界的分离区域。正式Blender/GLB/PBR、真实旋转胶囊、局部支持重力、动态见证物、手动终端和原路返回可运行；G0数学/分段传送/渲染和LAB仍被实际使用。

## 环境与精确依赖

Debian GNU/Linux 13；Linux-6.18.57-x86_64-with-glibc2.41；Node 24.22.1 / npm 11.9.0；Chrome for Testing 158.0.8127.18；Blender 4.3.2。

浏览器测试在headless Chromium的ANGLE SwiftShader软件WebGL2运行。容器CPU配额2核、可见CPU affinity 0–2；无真实GPU/手机。HERO为1920×1080、DPR1；触控模拟1170×540与1200×540、DPR1；生产真实录屏640×360。

| Package | 实际安装版本 |
| --- | --- |
| @dimforge/rapier3d-compat | 0.21.0 |
| @react-three/fiber | 9.8.2 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| three | 0.187.0 |
| @eslint/js | 10.0.1 |
| @playwright/test | 1.65.0 |
| @types/node | 26.6.6 |
| @types/pngjs | 6.0.5 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| @types/three | 0.187.0 |
| @vitejs/plugin-react | 6.2.1 |
| eslint | 10.14.0 |
| eslint-plugin-react-hooks | 7.1.1 |
| globals | 17.14.0 |
| pngjs | 7.0.0 |
| typescript | 6.0.3 |
| typescript-eslint | 8.72.1 |
| vite | 8.3.6 |
| vitest | 5.1.0 |

## 实际命令与结果

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run assets:build` | PASS，真实Blender导出 | evidence/v02/asset-generation.log |
| `npm run typecheck` | PASS | verify-final.log |
| `npm run lint` | PASS | verify-final.log |
| `npm run test:unit` | PASS 62/62，无skip | evidence/vitest.json |
| `npm run test:e2e` | PASS 28/28，637.20s，无skip/retry | evidence/playwright.json |
| `npm run test:production` | PASS 2/2，462.72s，包含普通生产build | evidence/production.json、production-journey.json/webm |
| `PLAYWRIGHT_JSON_OUTPUT_FILE=evidence/v02/resonator-test-report.json npx playwright test src/tests/e2e/v02.spec.ts --grep complete --reporter=list,json` | PASS 1/1（加强同一开发用例） | resonator-test-report.json/log、resonator-response.json/png |
| `npm run test:subpath` | PASS，正式相对子路径及2个GLB实际请求 | evidence/subpath-smoke.json/log |
| `npm run verify` | PASS，exit 0 | evidence/v02/verify-final.log、verify-result.json |
| 独立目录 `npm ci` / `npm run build` | PASS，与最终dist匹配 | repro-install-build.log、repro-build-match.json |
| `npm run measure:v02` | 已执行，仅软件渲染测量 | performance-software.json、build-byte-budget.json |

62项=保留G0 34项 + 重力17项 + 本章物理路径10项 + GLB/像素/闭壳资产1项。随机属性1000组属于一个Vitest用例内的1000次可复现输入，不虚增为1000个测试。28项开发浏览器=保留22项 + 新增6项；生产2项=保留1项 + 新增完整章节1项。

## 逐项验收

| 验收 | 状态 | 实际证据与范围 |
| --- | --- | --- |
| G0数学/碰撞/状态机 | PASS | 原34项保留；1000随机组seed=0x54485245、100个完整往返/200事件 |
| 原G0浏览器及生产回归 | PASS | 22开发 + 1生产均实际执行；没有删除原用例 |
| 9个CR1角度的实际胶囊/眼睛/重力 | PASS | 0/5/15/30/45/60/75/85/90°，真实WASM quaternion与支持法线 |
| 旋转扫掠与无穿模 | PASS | 完整胶囊分段cast/overlap；端点安全而中途障碍的回归 |
| 双向可控弧面/墙行 | PASS | 30弧面往返、100墙行往返、停住/倒退/斜向、P4→P4A开口 |
| 同源实体厚度和场景边界 | PASS | 528顶点/1052面闭合支持壳；背侧、主门外墙、入口背墙新增真实碰撞回归 |
| 玻璃/护栏/台阶/桥 | PASS | 物理阻挡或真实通行，异常后可回到有效检查点 |
| 真实局部受力 | PASS | 零全局重力；dynamic witness横向加速并撞击；玩家支持/失去支持落体 |
| 完整章节与前厅反馈 | PASS | 实际出生点→门→弧面→墙行→主动激活→原路返回，事件恰好[1,2]；追加走到庭院验证实际材质b6a087/尺寸1.3与可见网格 |
| 桌面真实键鼠生产输入 | PASS | 正式包无修改接口；真实WASD/E、墙上拖动观察与恢复，整段实录 |
| 双区触控与19.5:9/20:9 | PASS | 原生Pointer Events与独立捕获；45°期间停住/观察/退回；两比例完成章节；仅模拟 |
| 失焦/取消/方向变化 | PASS | 复用InputManager，原输入回归与章节resize/复位/减少运动检查 |
| 实时透视、动画、裁剪 | PASS | 原G0独立矩阵/真实像素断言；实测可定位中心最大误差0.288px；0.005m/斜角/跨面均验证 |
| 三机位实际网格可见性 | PASS | 表面首命中加32×18屏幕射线；C3两轴各≥8、实际支撑≥6、旧楼梯≥8样本；无假图片背景 |
| 连续探索证据 | PASS | 固定步3100、52帧；另有种子自由路线与434.44s真实录屏 |
| GPU生命周期 | PASS | 固定镜头不重分配RT、resize资源有界、context restore重建环境/阴影、释放后几何/纹理0 |
| 严格类型/Lint/构建/子路径 | PASS | verify非零即失败；dist模型/JSON与public逐字节相同；子路径正式包无修改适配器 |
| 干净安装与重建 | PASS | 独立临时目录npm ci + build；与最终dist逐文件hash一致 |
| 建筑美术与C3方向叙事 | PASS | 新增真实旧重力楼梯和廊台；C3实际支撑/两件旧轴线/转横楼梯同屏。间接光与摄影润色限制另行说明 |
| 真实桌面GPU与Android性能 | BLOCKED | 没有连接硬件；不能将SwiftShader当真机，P95≤33.3ms目标未通过 |
| Android真机10分钟/温升/后台 | BLOCKED | 设备未连接；DEVICE_TEST_V02提供入口、操作与JSON导出方法 |
| 远程GitHub Actions/Pages部署 | NOT RUN | 仅本地branch/worktree，CI与手动Pages配置交付；没有推送/执行远程部署 |
| 实际GPU耗时/完整显存 | NOT RUN | GPU query未采集；显示N/A，纹理计数不冒充显存字节 |

## 浏览器生产旅程与截图

正式bundle读取真实输入，轨迹记录12个阶段/观察记录，terminal与returned均true、最终Up=[0, 1, 0]、传送事件[1,2]、浏览器错误0、运行时错误0。没有window.__V02_TEST__；无固定出生点场景切换。

录屏 `evidence/v02/production-journey.webm`：19,915,607字节，434.44秒，由Playwright直接连续捕获，无剪辑/加速/图片替换。软件渲染下墙钟时间显著长于模拟时间：最终模拟elapsed=54.62s；这是最大补偿步预算限制的真实结果，不能宣传实时60FPS。

- [THE ARRIVAL](../evidence/v02/ARRIVAL-1920.png)
- [THE CROSSING](../evidence/v02/CROSSING-1920.png)
- [THE INVERSION](../evidence/v02/C3-1920.png)
- [CAM-01](../evidence/v02/C1-1920.png) / [CAM-02](../evidence/v02/C2-1920.png)
- [连续物理步和全部动作](../evidence/v02/continuous-path.json) / [自由种子路线](../evidence/v02/seeded-free-route.json)
- [碰撞资源释放](../evidence/v02/lifecycle.json) / [真实网格可见性](../evidence/v02/camera-visibility.json)

测试没有只断言DOM文字；它读取真实WASM身体/接触/传送事件、渲染像素与实体射线。测试机位定位只用于构图；完整路径与生产旅程都从真实起点输入驱动。

## 性能与资产体积

测量环境：ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)；1280×720、DPR1；每视角预热3秒、随后实际约15秒采集。各采样窗口含真实浏览器调度，样本数照实列出。GPU timer扩展支持=True，GPU时间未采集。

| 视角 | 采集秒数 | 帧样本 | FPS | P50 ms | P95 ms | P99 ms | 主/门Draw Calls | RT像素 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARRIVAL | 15.00 | 5 | 0.32 | 2448.50 | 6304.20 | 6304.20 | 9 / 13 | 448×252 |
| CROSSING | 15.04 | 7 | 0.50 | 1999.70 | 2197.20 | 2197.20 | 6 / 11 | 960×540 |
| C3 | 15.00 | 6 | 0.38 | 1935.20 | 6026.50 | 6026.50 | 11 / 0 | 960×540 |

**这些软件数据不达到实时目标，也不证明真实桌面GPU或Android失败/通过。真实硬件30/60FPS仍是未验收目标。** 10分钟真机连续运行未执行，不能用这三个短软件窗口替代。帧样本很少时P95/P99接近窗口最大值，不足以推断长期稳定性。

| 世界 | 资产模块 | 三角面 | GLB原始字节 |
| --- | --- | --- | --- |
| VESTIBULE | 174 | 15432 | 1,708,224 |
| INVERT | 181 | 18356 | 1,814,852 |

全部静态dist实际大小 9,623,674字节；普通生产浏览器Resource Timing实测encodedBodySize合计5,537,834字节（冷上下文、当前本地preview；不含HTTP头，实际传输见production-journey.json）。源贴图18张；运行时嵌入GLB，不重复按独立PNG计算网络。build-byte-budget内gzip仅是估算，未冒充实测压缩比。

预算：每个GLB<2MB、每场景<20k三角面、常规主/门各<20 draw calls、一个活跃离屏pass；实际数值如上。完整dist以10MB原始静态预算跟踪；JS/WASM共享块较大，构建有chunk size提示，构建成功不代表体积已最优。源.blend、参考图和测试截图不进入网站dist。

## 发现的问题、修复与失败记录

1. 最初生产回归45秒未走出走廊：真实输入有效但软件长帧使模拟推进慢；同时发现RT每帧扩大再缩小，改为覆盖率分档/固定尺寸无重建断言；软件生产验证使用640×360并允许150秒阶段超时，任何实际超时仍失败。
2. Blender normal/roughness文件存在但像素全黑：设Non-Color后写像素并update，重新导出；GLB内PNG通道值现在直接断言。没有把schema存在当成材质正确。
3. 背侧视觉厚壳无碰撞：实际复现走到x约2.60、y约-2.86后才发现落出支持；改为焊接闭合528顶点/1052面壳并验证外周边、背侧接近与主路线。
4. 前厅门外墙距门户过远与走廊开放尾端：新增两项回归，移动三段外墙到门框深度、增加真实背墙，阻止从门后或出生点背侧落出模型。CR1_DEVIATIONS记录坐标。
5. 桥入口被长玻璃挡住、低台阶无法上行、出口合法floor padding被拒绝：拆分真实桥口；使用真实KCC下压/autostep；只豁免合法地面接触且增加地下胶囊拒绝回归。
6. 诊断阶段移动1170测试受源代码热更新重建runtime干扰；触控CDP驱动曾错误结束另一指针，修正为结束实际Pointer ID。最终冻结源/资产后全量运行，无skip或catch伪绿。
7. 资产生成与构建同时发生的候选运行已主动中断并排除，避免模型与collider版本混杂；最终public/dist资产逐字节一致。diagnosis内为历史定位日志，不计入最终PASS。

诊断日志保留在evidence/v02/diagnosis；只有verify-final及其最终JSON统计被用于本次验收。实际主门/背壳修复没有删除原测试或使用黑屏、固定冷却、脚本路线代替物理。

## 补充核对

全量verify后加强同一章节用例并实际重跑：装置可见屏幕样本35/576，材质/尺寸均来自Three网格，未强改returned标记。补充用例无新增测试计数；普通构建已校对V0.2 HTML标题并独立重建。

## 判断

可作为继续开发的可玩首章和门户/局部重力工程基础。尚不应冻结为正式V1性能与完整摄影品质基线，也不能声称已经通过中端Android目标。ECHO/DRIFT的工程扩展可复用世界/资产/门户边界，发布前仍需真实硬件覆盖与更精细的光照/摄影完成度。完整边界见V02_LIMITATIONS；真机入口见DEVICE_TEST_V02。
