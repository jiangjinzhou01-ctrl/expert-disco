# 官方 API 核查记录

核查时间：2026-11-06。以下是实际通过 HTTPS 获取的官方文档、当前 npm metadata 和发布包 TypeScript 定义。环境 Node 24.22.1 / npm 11.9.0。工程实际锁定版本以 `package-lock.json` 为准。

## 查询版本

实际命令：`npm view three version`、`npm view @react-three/fiber version`、`npm view @dimforge/rapier3d-compat version`、`npm view vite version`、`npm view @playwright/test version`。

| npm package | 查询到的稳定版本 |
| --- | --- |
| three | 0.187.0 |
| @react-three/fiber | 9.8.2 |
| @dimforge/rapier3d-compat | 0.21.0 |
| vite | 8.3.6 |
| @playwright/test | 1.65.0 |

## Three.js

读取 [WebGLRenderer 官方文档](https://threejs.org/docs/pages/WebGLRenderer) 与 [官方 portal 示例源码](https://threejs.org/examples/webgl_portal.html)，并获取发布包 0.187.0 的 `clipping_planes_vertex.glsl.js` / `clipping_planes_fragment.glsl.js`。

- `renderer.clippingPlanes` 为世界空间全局平面。`Plane.distanceToPoint(point) < 0` 的几何会被裁掉。出口保留局部 +Z 一侧时，平面法线应为出口的世界 +Z，constant 为 `-normal.dot(exitPosition)`，再按需要加入小的数值偏置。
- `localClippingEnabled` 控制材质的局部 clipping planes；全局 clipping planes 与此开关不是同一概念。内建 Mesh 材质含 clipping chunks；自定义 ShaderMaterial 若需要接受裁剪，必须包含 clipping shader chunks 并启用相应材质能力，不能假设一个任意 shader 自动裁剪。
- 官方示例先将主相机位置变换到源门局部，翻转 X/Z，再变换到目标门世界坐标，符合 `M_destination * Ry(pi) * inverse(M_source)`。
- 示例用 `CameraUtils.frameCorners` 构造覆盖门角的非对称投影。G0 选择另一种合法策略：虚拟相机复制主相机投影，门面 fragment 通过 `gl_FragCoord.xy / drawingBufferSize` 采样目标纹理。此时 Render Target 与主画布宽高比必须一致，不能直接使用门面 UV。
- `setRenderTarget()`、`getRenderTarget()`、`getViewport()`、`setViewport()`、scissor 及 clear 状态需要在离屏 pass 的 `try/finally` 中恢复。示例也保存/恢复 `xr.enabled`、`shadowMap.autoUpdate` 并隐藏传送门 surface。
- `WebGLRenderTarget.setSize()` 会重新分配内部资源；尺寸改变时调用，不能逐帧新建。卸载时 `dispose()`，上下文恢复后重新绘制。

## React Three Fiber

读取 [官方 hooks 文档](https://r3f.docs.pmnd.rs/api/hooks) 和 9.8.2 发布包 `dist/declarations/src/core/hooks.d.ts`。

```ts
useFrame(callback: RenderCallback, renderPriority?: number): null
```

正的 `renderPriority`（例如 `1`）接管自动渲染，调用方负责 `gl.render()`。回调按 priority 从小到大执行。负 priority 只排序，不接管自动渲染。G0 的核心运行时应在单个 `useFrame` 中完成固定步、相机同步、离屏 pass、主 pass；不得另建 RAF/物理定时循环。官方明确提醒不要在 `useFrame` 中逐帧 React `setState`。

## Rapier 0.21.0

读取 [官方 character controller 文档](https://rapier.rs/docs/user_guides/javascript/character_controller/)；`npm pack @dimforge/rapier3d-compat@0.21.0` 后检查以下实际定义：

- `dist/control/character_controller.d.ts`
- `dist/pipeline/world.d.ts`
- `dist/geometry/shape.d.ts`
- `dist/geometry/collider.d.ts`

```ts
controller.computeColliderMovement(collider, desiredTranslationDelta,
  filterFlags?, filterGroups?, filterPredicate?)
controller.computedMovement(target?)
controller.computedGrounded()
world.propagateModifiedBodyPositionsToColliders()
world.intersectionWithShape(shapePos, shapeRot, shape,
  filterFlags?, filterGroups?, excludeCollider?, excludeRigidBody?, predicate?)
world.castShape(shapePos, shapeRot, shapeVel, shape,
  targetDistance, maxToi, stopAtPenetration,
  filterFlags?, filterGroups?, excludeCollider?, excludeRigidBody?, predicate?)
```

- `computedMovement()` 是位移，不是速度。`computeColliderMovement` 不会自动移动角色，应由运行时显式提交。
- `new Capsule(halfHeight, radius)` / `ColliderDesc.capsule(halfHeight,radius)` 的 halfHeight 是中间线段/圆柱半高，总高度为 `2*(halfHeight+radius)`。总高 1.74m、半径 .30m，应传 `.57,.30`。
- World 的 query filter predicate 收到 `Collider`；底层 BroadPhase 的同类 predicate 收到 handle，不要混用。
- `castShape` 的 `shapeVel` 可以直接传该步位移，并用 `maxToi=1`。`targetDistance` 是形状与障碍的安全距离，不是 ray 长度。
- 0.21.0 的 `World` **没有 `updateSceneQueries()`**。刚体瞬移后，在本步再次查询前用 `propagateModifiedBodyPositionsToColliders()` 更新附属 collider 位置。`world.step()` 也会更新；初始固定 collider 建立后应先正常步进，使广相位包含它们。
- 直接传送应使用当前位置重定位，并同步下一运动学位置，避免把跨世界坐标差解释为一步运动学速度。
- 地面合法接触应与穿入墙/障碍区别处理。查询必须过滤自身；出口重叠检查不能先传送再纠正。

## Playwright

读取 [官方截图文档](https://playwright.dev/docs/test-snapshots)。`expect(page).toHaveScreenshot()` 为官方稳定截图入口。官方提醒截图随 OS、浏览器、硬件、headless、供电等变化，基线必须在相同环境生成并比较。G0 的投影标记像素定位应增加数值断言，截图仅作为额外证据。

## Vite

读取 [官方 static deploy 文档](https://vite.dev/guide/static-deploy)。`npm run build` 产物默认在 `dist`，`vite preview` 用于本地验证产物，不应声称是生产服务器。根路径默认 `base:'/'`，GitHub Pages 仓库站应为 `base:'/<REPO>/'`；可以通过环境变量或 `vite build --base=/repo/` 选择。没有授权远程仓库时只准备静态产物与 CI，不编造部署 URL。
