# 输入与工作区审计

2026-11-07。本轮从用户提供的THRESHOLD V0.2任务包开始，已安全解压并阅读master、原G0源码、空间baseline、CR1审计/manifest与三张美术参考。

- 输入ZIP SHA-256：`b6d3af3126658d8084f10660a59e9a9beb99d041825924d746d20064c6216578`。
- 对照原包与本地基线commit `b8d9311`：36个原始`src/`文件逐字节相同，差异0；可检查 `evidence/v02/input-audit.json`。
- 原有项目已经是Git仓库中的G0。新建独立worktree `/workspace/threshold-v02` 与 `threshold-v02` 分支，不清空主目录，不覆盖历史及用户附件/未提交证据。
- 修改前实际重新执行原34项Vitest，基线日志为 `evidence/v02-g0-baseline.log`。旧22项浏览器与1项生产测试保留，在最终版本全部重跑。
- `docs/input/CR1`、`docs/input/baseline`、`assets/reference`保留原输入；冲突以master/CR1为准。源G0文件说明另留README_G0_ORIGINAL。
- 依赖保持原精确版本，使用现有安装进行开发，交付依赖由lockfile复现。新增可玩章节、资产管线与测试，不新增无关服务。
- 本轮没有推送、创建未知远程仓库或覆盖在线G0。V0.2的Pages workflow改为显式手动触发，原workflow文本保存在docs/input；本轮没有执行该远程流程。

最后交付的本地分支、archive清单与真实验收结果见V02_TEST_REPORT；旧报告和诊断失败日志不能替代本轮最终验证。
