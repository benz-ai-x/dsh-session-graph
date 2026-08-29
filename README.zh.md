---
description: "可安装的 dsh Web 插件，用自由画布浏览、排列相关工作区会话并创建分支。"
kind: "package-bundle"
---

# @benz-ai-x/dsh-client-ui-session-graph

[English](README.md) | 中文

本包为 DeepSeek Harness 对话视图添加 **Graph** 标签。它把通过 Branch（分支）连接的 Canvas Session（画布会话）组织成可移动、可折叠的 Session Cluster（会话簇），以有向边绘制 Branch 关系，并把 Subagent Session（子代理会话）折叠为 Subagent Summary（子代理摘要）。浏览器按图谱范围保存每份 Session Arrangement（会话排列）；图谱投影不会改变会话日志或模型请求，“开新分支”则委托 Harness 创建会话。

## 安装

本包发布到 npm 后，可将其加入 `web` profile：

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

若要直接从 GitHub 安装已打 tag 的源码：

```sh
dsh plugin --profile web add github:benz-ai-x/dsh-session-graph#v0.1.0
```

profile 显式授权前，pnpm 会阻止 git 依赖执行 `prepare` 脚本。首次 GitHub 安装会以 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 退出；把 dsh 打印的完整键复制到 `$DSH_HOME/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds` 下，再次执行命令。这项权限允许包代码在 agent 沙箱之外执行，因此应先检查源码，并锁定 tag 或 commit。

本包同时包含浏览器插件与 `cordis.patch.yml` 组合包补丁。dsh 插件管理器会把它插入 `web` profile 已提供的 Session、Workspace、locale、renderer 与 conversation 插件之后，无需手工修改 `cordis.yml`。

使用以下命令移除：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

安装或移除后请重启目标 `web` profile。运行中的进程不会监视 profile 依赖列表。

首个版本面向 DeepSeek Harness `0.1.2-alpha.1`。插件不会把尚未单独发布的 `@deepseek-ai/*` 包安装进自己的依赖树；这些服务与浏览器模块由所选 dsh profile 持有。

## 使用图谱

打开一个非空会话，在标准对话标签旁选择 **Graph**。Viewed Session（当前查看会话）会优先解析命名 Workspace Scope（工作区范围），匹配不到时退化为 Directory Scope（目录范围）。

- 单击选择 Selected Session（选中会话）并持续强调其 Branch Lineage；可关闭的详情检查器可打开该会话或创建 Branch，并在 Harness 拒绝请求时显示错误。单击画布空白处或按 Escape 可清除选择。
- 双击会在该会话上次使用的视图中打开它。
- 在其他 Canvas Session 上停留可查看紧凑预览，不会替换 Selected Session 检查器。
- 拖动节点或整个簇框来排列画布；对齐参考线会吸附临近卡片边缘。
- 每个 Canvas Session 都暴露稳定的顶部输入端子与底部输出端子，为后续图编辑功能预留；Branch 使用带方向的实线，Subagent Derivation 使用虚线。
- 使用滚轮缩放、背景拖动平移、适应、100%、重新布局、重置、定位 Viewed Session（当前查看会话）或 minimap。内容离开可视范围时才显示 minimap；容器尺寸变化会保留当前内容中心与缩放比例。
- 按标题过滤；Enter 居中第一个匹配项，Escape 清空过滤条件。
- 悬停节点或边会强调对应的 Branch Lineage（分支谱系）。
- 查看页头徽标可确认包版本与当前本地 Build ID；悬停可查看完整包身份。

画布获得焦点时可使用键盘快捷键：`+` 和 `-` 缩放，`0` 恢复 100%，`1` 适应图谱。

## 开发

环境要求为 Node.js `^22.19.0 || >=24.0.0` 与 pnpm `11.7.0`。

```sh
pnpm install
pnpm run check
```

`pnpm run check` 会检查独立包的类型、构建 Host 与浏览器入口，并运行 85 项包内测试。若要对已准备好的 DeepSeek Harness checkout 运行 73 项完整交互测试：

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

CI 会在 Node.js 22.19、24 与 26 上运行独立检查。兼容性 job 会在 `dsh-v0.1.2-alpha.1` 检出 `deepseek-ai/deepseek-harness`，运行 Harness 集成测试，并验证打包归档能够干净地加入和移出临时 `web` profile。

使用以下命令构建可安装归档：

```sh
pnpm pack
```

本地构建会根据 `package.json`、`tsdown.config.ts` 与 `src/` 内容生成稳定的 `local-<hash>` Build ID；发布流水线可在构建时设置 `DSH_SESSION_GRAPH_BUILD_ID` 来替换它。

### 发布

[Publish workflow](.github/workflows/publish.yml) 接受已发布的 GitHub Release 或手工提供的现有 tag。它要求 tag 等于 `v` 加包版本，重新运行 `pnpm run check`，打包归档，并把这些已验证字节发布到 npm；稳定版使用 npm tag `latest`，预发布版使用 `next`。

发布前配置 GitHub environment `npm-publish`。如果 npm 上尚不存在本包，先添加权限范围尽量小的仓库 secret `NPM_TOKEN` 完成首次发布。随后配置 [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)：organization 为 `benz-ai-x`、repository 为 `dsh-session-graph`、workflow 为 `publish.yml`、environment 为 `npm-publish`，允许 `npm publish` action；trusted publishing 验证成功后移除长期凭据。

发布新版本时，更新 `package.json`、合入变更、创建匹配且不可移动的 `v<version>` tag，再发布 GitHub Release。若要发布 `v0.1.0` 这类现有 tag，请手工运行 Publish workflow 并传入该 tag。

本包导出两个 Host 入口和一个惰性加载的浏览器模块：

| 导出 | 用途 |
|---|---|
| `.` | Cordis 浏览器入口注册 |
| `./invariant` | 运行时注册不变量 |
| `./client` | 构建后的 dsh 客户端模块 |
| `./cordis.patch.yml` | profile 组合包补丁 |

## 实现

`GraphView` 读取 Viewed Session、Workspace 成员关系、会话摘要与待处理交互映射。纯 helper 推导 Session Cluster、Branch 边、Subagent Summary、布局、吸附、Title Filter 匹配与视口状态，再由 `GraphCanvas` 渲染结果。本包不提供 Host service，也不接受配置字段。

| 文件 | 职责 |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope 解析、图谱推导与视图头部 |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | 画布渲染、端子、检查器、控件、手势、悬停状态与 minimap |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | 图谱范围解析、Branch 边、Subagent Summary、Title Filter 匹配与 Branch Lineage |
| [`src/client/layout.ts`](src/client/layout.ts) 与 [`src/client/clusters.ts`](src/client/clusters.ts) | 树坐标、簇框、折叠、偏移与边路径 |
| [`src/client/viewport.ts`](src/client/viewport.ts)、[`src/client/preview-placement.ts`](src/client/preview-placement.ts) 与 [`src/client/snap.ts`](src/client/snap.ts) | 缩放、平移、尺寸保持、适应、minimap/预览定位与对齐参考线 |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | 按范围的 Session Arrangement 持久化、迁移与无效记录恢复 |

## 当前限制

- 无会话主页与全新空白会话没有对话视图环，因此无法使用 Graph。
- 图谱一次只跟随一个 Workspace Scope 或 Directory Scope，不搜索消息内容或工作目录路径。
- 切换标签或刷新会重置平移与缩放；节点位置、簇偏移与折叠状态会持久化。
- 从 Subagent Session 创建的 Branch 没有 Canvas Session 父边，因此显示为 Root Session。
- 触屏只使用指针事件回退，没有专用控件。

## 许可证

[MIT](LICENSE)
