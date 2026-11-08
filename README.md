# THRESHOLD / 门界 — Orbital

可自由探索的实时空间作品：轨道舱与行星观测前厅 → 双向传送门 → INVERT 异常重力弧面 → 墙面终端 → 原路返回与装置共鸣。保留 G0-LAB 作为数学、透视和碰撞回归场景。

本次改造加入原创建筑区块、真实 PBR 材质、11 个三维天体、门内视野参与的异步分区加载、触屏转向加速、可关闭诊断、摄影、声音和本地偏好/安全检查点。所有设备首次进入默认最高预设；用户可手动调整并保存选择。

验收状态与真实证据见 [Orbital 验收](docs/ORBITAL_ACCEPTANCE.md) 和 [技术报告](docs/ORBITAL_TECHNICAL_REPORT.md)。没有接入实体 Android/iPhone 或代表性桌面 GPU，真实设备性能与十分钟热稳定性尚未通过验证。当前不宣称已经达到全面商业验收。

## 启动

需要 Node.js 24 / npm 11 和 WebGL 2 浏览器。模型、贴图、WASM 解码器均随工程提供；正常构建无需 Blender、外部资产服务或云后端。

```sh
npm ci
npm run dev -- --port 5180
```

打开 `http://localhost:5180/`。局域网手机可访问主机 IP:5180，云工作区需使用平台端口转发。浏览器需通过 HTTP(S) 加载，不能直接打开文件。

```sh
npm run build
npm run preview -- --port 4180
```

`dist/` 是完整静态站点。默认相对资源路径，支持 GitHub Pages 仓库子路径；也可使用 `VITE_BASE=/repository/ npm run build`。

## 操作

- 桌面：WASD/方向键移动，鼠标拖动观察，双击锁定鼠标；Esc 退出，R 安全复位，E 激活终端，F3 诊断，P 摄影。
- 触屏：左侧摇杆移动，右侧另一个手指观察；快滑加速，可在设置中调整或关闭。支持 Pointer ID、取消、失焦、旋转屏幕后清理输入。
- 右上角：声音、摄影、安全复位、设置。设置提供灵敏度、加速、反转、FOV、画质、音量、减少镜头运动和帮助；诊断具有自己的关闭按钮。
- 舱内可打开轨道观测台；INVERT 入口附近可释放真实物理样本，观察它沿局部 +X 重力下落。
- 靠近墙面终端后激活，沿原路返回；前厅装置会回应。随时可以停下、倒退或回头，无强制过场。

摄影模式暂停模拟，隐藏普通界面，导出当前真实画布 PNG；退出后恢复之前的暂停状态。声音由首次真实交互解锁，支持静音与后台暂停。偏好和经过校验的安全检查点只存于本机，恢复位置还必须通过支撑与胶囊空间检查。

## 模式与诊断

| 入口 | 用途 |
| --- | --- |
| `/` | 默认 Orbital 章节 |
| `/?debug=1` | 章节与诊断 |
| `/?mode=lab` | 原 G0 回归房间 |
| `/?mode=chapter&test=1` | 仅开发/e2e 构建提供确定性输入适配器 |
| `/?test=1` | 兼容旧测试，进入 LAB |

正式构建只提供读取真实状态的 `window.__THRESHOLD_V02__()`；不会暴露角色放置和强制步进接口。诊断包括物理/事件、帧时间、Draw Calls、门内分辨率、分区请求/驻留/回收与纹理格式。GPU 总显存与 GPU 时间没有测量时不会用 CPU 指标替代。

## 测试

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run test:production
npm run test:subpath
npm run verify
```

浏览器首次安装：`npx playwright install --with-deps chromium`。开发浏览器测试验证真实 WebGL、像素投影、双端输入、双向传送、旋转角色、加载失败回退、诊断与摄影。生产测试运行普通构建，通过真实键盘和鼠标完成章节，不依赖开发瞬移接口。测试失败会返回非零状态。

```sh
npm run capture:orbital
node scripts/measure-orbital.mjs
```

上面两项需先运行 5180 开发服务器；云环境 SwiftShader 数据只用于如实诊断，不能视为真实手机数据。截图、命令日志、运行状态与验证报告保存在 `evidence/`。

## 资产与架构

- [架构与实现](docs/ORBITAL_TECHNICAL_REPORT.md)
- [参考过的 GitHub 实现及明确边界](docs/ORBITAL_REFERENCES.md)
- [真实 PBR 来源、许可、KTX2 管线与字节数据](docs/ORBITAL_MATERIAL_SOURCES.md)
- [行星贴图来源及署名](docs/ORBITAL_SPACE_ASSETS.md)
- [原创 Blender 工程和压缩前源资产](assets/source/orbital/README.md)
- [原始重力架构](docs/ARCHITECTURE_V02.md)

新建筑按十个区块延后请求；轮廓和安全碰撞常驻。兴趣区域同时考虑主相机和门内映射相机，使用受限并发、距离优先、短期缓存和几何回收。它不等同于硬件遮挡查询，也不会卸载脚下的物理地面。

原创模型可通过 `npm run assets:orbital` 重建（需 Blender）；Meshopt 编码工具通过 lockfile 锁定。贴图的抓取、KTX2 编码和来源验证脚本位于 `scripts/`。复用资产均有独立来源与许可记录，不把开源代码许可当成任意模型的使用许可。

## 当前限制

一对门、两个主要世界，无递归多门、多人或账户。天空是艺术化轨道构图，非真实太阳系比例。建筑静态阴影与选定 PBR 资产不等同于完整离线 GI 或电影级写实渲染。实体设备兼容性、最高预设性能、长时热稳定性和最终人工美术验收仍需独立完成。

源码发布在仓库 `threshold-v02` 分支；受当前仓库 Pages 模式限制，`main` 保存编译后的静态站点，防止把 `/src/main.tsx` 当成线上入口。
