---
description: "DeepSeek Harness 可视化 Web 插件：在交互式图谱画布中浏览会话谱系、排列分支、汇聚快照并生成摘要。"
kind: "package-bundle"
---

# DeepSeek Harness Session Graph

[![CI](https://github.com/benz-ai-x/dsh-session-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/benz-ai-x/dsh-session-graph/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40benz-ai-x%2Fdsh-client-ui-session-graph?logo=npm)](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

**无需离开 DeepSeek Harness，即可可视化、浏览、分支、汇聚并总结相关 AI Agent 会话。**

`@benz-ai-x/dsh-client-ui-session-graph` 为 DeepSeek Harness Web 对话视图添加交互式 **Graph** 标签，把 Session Lineage（会话谱系）变成自由画布：Branch 连接的 Canvas Session 组成可移动会话簇，Merge Session 保留快照溯源，Subagent Session 折叠为紧凑摘要，并可按需生成 Session Digest。浏览、排列与生成摘要都不会修改 Session 日志。

<p align="center">
  <a href="docs/assets/session-graph-overview.png">
    <img src="https://raw.githubusercontent.com/benz-ai-x/dsh-session-graph/main/docs/assets/session-graph-overview.png" alt="DeepSeek Harness Session Graph，展示分支、汇聚关系、子代理摘要、标题过滤和画布控制" width="100%" />
  </a>
</p>

<p align="center"><sub>使用合成演示会话渲染的真实 Session Graph 界面。</sub></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph">npm</a> ·
  <a href="https://github.com/benz-ai-x/dsh-session-graph/releases">版本发布</a> ·
  <a href="https://github.com/benz-ai-x/dsh-session-graph/issues">问题反馈</a> ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

## 快速开始

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

重启 `web` profile，打开任意非空 Session，然后选择 **Graph**。当前版本面向 DeepSeek Harness `0.1.2-alpha.1`，需要 Node.js `^22.19.0 || >=24.0.0`。

## 核心能力

| 能力 | 你可以获得 |
|---|---|
| 可视化 Session Graph | 在同一视图查看 Branch Lineage、Merge 溯源、Session Cluster 与折叠的 Subagent 活动 |
| 交互式画布 | 拖动、吸附、折叠、过滤、缩放、平移、适应、重新布局、重置、定位与 minimap |
| 跨会话工作流 | 打开任意 Canvas Session、创建 Branch，并汇聚两到三个来源的不可变快照 |
| 只读 Session Digest | 按需生成简短概览、关键结论和待办，且不改变 Session 日志 |

## 安装

从 npm 安装已发布的包，并将其加入 `web` profile：

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

若要直接从 GitHub 安装已打 tag 的源码：

```sh
dsh plugin --profile web add github:benz-ai-x/dsh-session-graph#v0.1.3
```

profile 显式授权前，pnpm 会阻止 git 依赖执行 `prepare` 脚本。首次 GitHub 安装会以 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 退出；把 dsh 打印的完整键复制到 `$DSH_HOME/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds` 下，再次执行命令。这项权限允许包代码在 agent 沙箱之外执行，因此应先检查源码，并锁定 tag 或 commit。

本包同时包含浏览器插件与 `cordis.patch.yml` 组合包补丁。dsh 插件管理器会把它插入 `web` profile 已提供的 Session、Workspace、locale、renderer 与 conversation 插件之后，无需手工修改 `cordis.yml`。

使用以下命令移除：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

安装或移除后请重启目标 `web` profile。运行中的进程不会监视 profile 依赖列表。

当前 `0.1.x` 版本线面向 DeepSeek Harness `0.1.2-alpha.1`。插件不会把该 Harness checkout 中尚未单独发布的 `@deepseek-ai/*` 包安装进自己的依赖树；Session 持久化、LLM、Remote 与浏览器运行时服务统一由所选 dsh profile 持有。

## 使用图谱

打开一个非空会话，在标准对话标签旁选择 **Graph**。Viewed Session（当前查看会话）会优先解析命名 Workspace Scope（工作区范围），匹配不到时退化为 Directory Scope（目录范围）。

- 单击选择 Selected Session（选中会话）并持续强调其 Branch Lineage；可关闭的详情检查器可打开该会话或创建 Branch，并在 Harness 拒绝请求时显示错误。单击画布空白处或按 Escape 可清除选择。
- 双击会在该会话上次使用的视图中打开它。
- 在其他 Canvas Session 上停留可查看紧凑预览，不会替换 Selected Session 检查器。
- 拖动节点或整个簇框来排列画布；对齐参考线会吸附临近卡片边缘。
- Session Arrangement 持久化采用 fail-soft 策略。浏览器存储不可用、被拒绝、损坏或空间耗尽时，实时图谱仍会使用自动几何继续渲染。
- 每个 Canvas Session 都暴露稳定的顶部输入端子与底部输出端子，为后续图编辑功能预留；Branch 使用中性色带方向实线，Merge Relation 使用品牌色带方向实线，Subagent Derivation 使用虚线。
- 使用滚轮缩放、背景拖动平移、适应、100%、重新布局、重置、定位 Viewed Session（当前查看会话）或 minimap。内容离开可视范围时才显示 minimap；容器尺寸变化会保留当前内容中心与缩放比例。
- 按标题过滤；Enter 居中第一个匹配项，Escape 清空过滤条件。
- 悬停节点或边会强调对应的 Branch Lineage（分支谱系）。
- 查看页头徽标可确认包版本与当前本地 Build ID；悬停可查看完整包身份。

画布获得焦点时可使用键盘快捷键：`+` 和 `-` 缩放，`0` 恢复 100%，`1` 适应图谱。

## 汇聚会话

点击画布工具栏中的“汇聚会话”，再按卡片上显示的编号顺序选择两个或三个 Canvas Session。检查或修改“汇聚指令”，然后点击“创建汇聚会话”。

- 来源必须互不重复，且必须是同一 Workspace 或工作目录中非空、非 Subagent 的 Canvas Session。
- 所有来源都必须在画布中选择。汇聚指令不能包含 `dsh-session:` 引用，因为 Harness 会把这种引用保留给精确的来源快照集合。
- Harness 会创建一个独立目标 Session，以来源标题命名，并在不可变的事件边界捕获每个来源。来源会话及其已有 Branch Lineage 都不会被修改。
- 提交时 Host 会重新检查目标与每个来源，不信任浏览器元数据。它只接受目标目录内非空、未归档、非 Subagent 的 Canvas Session 来源，以及没有父 Session 的空白目标或来源顺序完全一致的重试目标。
- 目标会话的正常 agent loop 会收到编辑后的指令和 Harness 规范 Session 引用。本功能不会另选“摘要模型”；队列请求被处理时，目标会话使用其正常配置的模型路由。
- Merge Session 始终属于自己的 Session Cluster。品牌色 Merge Relation 只表达来自各来源簇的溯源关系，不会把来源变成父会话。
- 选中 Merge Session 后，Session Inspector 会列出来源标题及快照边界。汇聚溯源由目标日志投影，并写入 Harness 的持久 Projection Cache，因此重启与冷日志重放后仍能恢复。
- 若目标创建成功，但命名、快照提交、持久化或打开失败，目标会被保留。“重试”会复用该目标，不会重复创建；上一次尝试延迟完成的快照仅在有序来源集合完全一致时才会被接受。Host 一旦开始把匹配捕获提交到持久投影存储，关闭视图也不会再取消该提交。也可以直接点击“打开目标会话”恢复处理。

提交前可以取消来源选择。提交开始后，控件会锁定到成功或产生可恢复错误为止；离开该视图仍会中止浏览器请求。Host 等待快照也有时间上限，超时会作为可重试的快照提交失败呈现。

## 生成会话摘要

选择任意非空 Canvas Session，在 Session Inspector（会话检查器）中点击“生成摘要”。摘要绝不会自动生成，生成期间也不会禁用“打开会话”或“开新分支”。

- Host 会检查准确的 Selected Session，即使它并非 Viewed Session。输入只保留用户直接发送的消息与 assistant 最终文本，排除推理过程、工具结果和插件注入上下文。
- 模型输入上限为 32 KiB。长会话优先保留最初用户目标、最近一次 compaction checkpoint，以及容量允许的最近对话。
- 辅助请求不开放工具，要求返回结构化的简短概览、关键结论与待处理事项。它优先使用会话日志中最近记录的 provider/model 路由；可选配置仅作为兜底。
- 会话运行中生成的结果标记为“运行中快照”。后续新活动会把可见摘要标记为“会话有新内容”，但不会隐藏旧内容；点击“更新摘要”即可替换。
- 成功结果按 Session 与源 revision 缓存在 Host 内存中。“重新生成”会绕过缓存；空内容或失败不会被当作成功摘要缓存，可继续重试。
- 同一 revision 的并发请求只执行一次模型调用，但各调用方的取消互不连带。插件关闭时会停止接收新摘要、取消自有工作，并等待已接收请求全部结束后再移除服务。

这是一次额外模型请求，可能产生所选 provider 的常规费用。摘要文本只是只读投影：它不是对话消息，不进入 Session 日志，也不改变 Session Lineage。

大多数会话无需配置，因为日志已记录模型路由。对于没有路由的旧会话或导入会话，可在 profile 的 `cordis.yml` 中覆盖已安装插件条目：

```yaml
- id: ui-session-graph
  config:
    provider: deepseek-official
    model: deepseek-v4-flash
    maxOutputTokens: 800
    timeoutMs: 60000
```

`provider` 与 `model` 必须成对提供，并且绝不会覆盖会话已记录的路由。`maxOutputTokens` 默认为 `800`，`timeoutMs` 默认为 `60000`。插件激活会通过对外导出的 Standard Schema 校验配置，并拒绝空白路由、缺少配对字段、非整数与非正数限制。

## 开发

环境要求为 Node.js `^22.19.0 || >=24.0.0` 与 pnpm `11.7.0`。

```sh
pnpm install
pnpm run check
```

`pnpm run check` 会检查独立包的类型、构建 Host 与浏览器入口，并运行包内测试套件。若要对已准备好的 DeepSeek Harness checkout 运行 Host 与完整交互集成测试套件：

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

本包使用 [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)：organization 为 `benz-ai-x`、repository 为 `dsh-session-graph`、workflow 为 `publish.yml`、environment 为 `npm-publish`，仅允许 `npm publish` action。工作流通过 GitHub OIDC 认证，不应再接收长期 `NPM_TOKEN`；保留 GitHub environment 作为发布边界。若为其他包名或 scope 做首次发布，只在首次引导时使用权限范围尽量小、有效期尽量短的令牌，随后立即配置 trusted publishing 并吊销该令牌。

每次发布 GitHub Release 前都必须先更新 `package.json`，构建并确认 Graph 页头徽标显示相同版本，再合入变更、创建匹配且不可移动的 `v<version>` tag，最后发布 Release。若要发布 `v0.1.2` 这类现有 tag，请手工运行 Publish workflow 并传入该 tag。

本包导出两个 Host 入口和一个惰性加载的浏览器模块；实际打包归档中的每个 JavaScript 入口都带有匹配的 TypeScript 声明：

| 导出 | 用途 |
|---|---|
| `.` | 用于生成 Session Digest 与持久提交 Session Merge 的 Cordis Host services |
| `./invariant` | 运行时注册不变量 |
| `./client` | 构建后的 dsh 客户端模块 |
| `./cordis.patch.yml` | profile 组合包补丁 |

## 实现

`GraphView` 读取 Viewed Session、Workspace 成员关系、会话摘要与待处理交互映射。带索引的纯 helper 推导 Session Cluster、Branch 与 Merge 边、Subagent Summary、跨簇顺序、布局、吸附、Title Filter 匹配与视口状态；独立 presentation pipeline 再按顺序应用节点位置、折叠状态和簇偏移，最后交给 `GraphCanvas` 渲染。Host 通过两个包自有 Remote 分别提供只读 Session Digest 与原子 Session Merge 捕获；Merge 提交会重新校验 Host 权威状态、排入显式 marker 与规范引用，等待匹配投影，再写入 Projection Cache，之后才报告成功。

| 文件 | 职责 |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope 解析、图谱推导与视图头部 |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | 画布渲染、端子、检查器、控件、手势、悬停状态与 minimap |
| [`src/config.ts`](src/config.ts) | 对外 Standard Schema、默认值与规范化 Host 配置 |
| [`src/index.ts`](src/index.ts) | Session Digest 与 Session Merge Host services、投影注册、配置和 Remote 错误 |
| [`src/session-digest.ts`](src/session-digest.ts) 与 [`src/session-digest-harness.ts`](src/session-digest-harness.ts) | 事件过滤、输入预算、路由重建、输出校验、revision 缓存与并发控制 |
| [`src/session-merge.ts`](src/session-merge.ts)、[`src/session-merge-host.ts`](src/session-merge-host.ts) 与 [`src/session-merge-harness.ts`](src/session-merge-harness.ts) | 浏览器流程、Host 校验、规范引用提交、有界捕获、幂等重试与持久性屏障 |
| [`src/session-merge-projection.ts`](src/session-merge-projection.ts) | 版本化 Merge marker/reference 投影与严格持久状态校验 |
| [`src/client/session-digest-remote.ts`](src/client/session-digest-remote.ts) | 严格的浏览器 Remote 请求/结果契约 |
| [`src/client/session-merge-remote.ts`](src/client/session-merge-remote.ts) | 严格的浏览器 Session Merge Remote 请求/结果契约 |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | 图谱范围解析、Branch 与 Merge 边、Session Cluster 排序、Subagent Summary、Title Filter 匹配与 Branch Lineage |
| [`src/client/canvas-presentation.ts`](src/client/canvas-presentation.ts) | 有序 Session Arrangement 投影以及最终/自动内容边界 |
| [`src/client/layout.ts`](src/client/layout.ts) 与 [`src/client/clusters.ts`](src/client/clusters.ts) | 树坐标、簇框、折叠、偏移与边路径 |
| [`src/client/viewport.ts`](src/client/viewport.ts)、[`src/client/preview-placement.ts`](src/client/preview-placement.ts) 与 [`src/client/snap.ts`](src/client/snap.ts) | 缩放、平移、尺寸保持、适应、minimap/预览定位与对齐参考线 |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | 按范围的 Session Arrangement 持久化、迁移与 fail-soft 存储恢复 |

## 当前限制

- 无会话主页与全新空白会话没有对话视图环，因此无法使用 Graph。
- 图谱一次只跟随一个 Workspace Scope 或 Directory Scope，不搜索消息内容或工作目录路径。
- 切换标签或刷新会重置平移与缩放；节点位置、簇偏移与折叠状态会持久化。
- Session Digest 只按需生成并缓存在 Host 内存中，不作为长期产物持久化；Host 重启会清空缓存。
- 没有日志模型路由的 Session 必须配置兜底路由后才能生成摘要。
- 从 Subagent Session 创建的 Branch 没有 Canvas Session 父边，因此显示为 Root Session。
- 一次 Merge 只接受两个或三个来源，且所有来源必须能在目标工作目录中解析；暂不支持跨 Workspace 汇聚。
- Merge 捕获的是不可变来源快照；来源后续新增消息不会自动刷新已有 Merge Session。
- 触屏只使用指针事件回退，没有专用控件。

## 许可证

[MIT](LICENSE)
