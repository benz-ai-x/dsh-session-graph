# DSH Session Graph 项目交接

> 历史快照：当前唯一有效的动态交接入口是仓库根目录 [`HANDOFF.md`](../HANDOFF.md)。本文保留用于查询早期项目背景，不再作为当前状态依据。

最后核对：2026-08-30（Asia/Shanghai）

## 1. 当前状态

项目已经具备可安装、可测试、可发布的完整链路。当前稳定版本为 `0.1.3`：

- 默认分支：`main`
- 写本文档前的 `main`：`64773ecc3395ce23c2fcff25a14b61ea6da645e2`
- 稳定标签：`v0.1.3`，指向发布提交 `64773ecc3395ce23c2fcff25a14b61ea6da645e2`
- GitHub Release：[v0.1.3](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.3)
- npm 包：[`@benz-ai-x/dsh-client-ui-session-graph`](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph)
- npm `latest`：`0.1.3`
- Harness 兼容基线：`deepseek-ai/deepseek-harness@dsh-v0.1.2-alpha.1`
- `main` 最新 CI：[成功](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33305157582)
- `v0.1.3` npm 发布：[成功](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33305228265)

`v0.1.2` 标签之后，`main` 包含发布流水线修复和 `v0.1.3` 的项目可发现性更新：

- `ea364fd`：修复 Trusted Publishing 认证环境。
- `6a43b63`：保留 npm 发布诊断日志。
- `1fcd678`：更新双语项目首页、包搜索元数据和视觉素材。
- `64773ec`：发布 `v0.1.3`。

当前源代码还包含一组基于架构审查的 post-`v0.1.3` hardening 变更，尚未发布，也没有修改 `package.json` 的 `0.1.3` 版本号：

- 配置改为对外导出的 Standard Schema，统一校验 route 配对、整数限制与默认值。
- Digest single-flight 具有独立 caller cancellation；插件卸载停止接单、取消自有请求并等待已接收工作静止。
- Merge eligibility 改由 Host 日志与 Workspace Registry 权威复核；持久提交开始后所有权由 Remote caller 转移给 Host。
- 每个 JavaScript export 都带 TypeScript declarations，package 测试会检查归档映射和真实文件。
- graph derivation 使用一次性 Branch 索引；`GraphCanvas` 的 Arrangement 顺序下沉到纯 `canvas-presentation` 模块。
- 浏览器 localStorage 拒绝、损坏或 quota failure 均 fail soft，不再破坏实时图谱。

以上变更当前已通过 166 项 package tests 与 96 项 Harness tests。交接或发布前仍应重新运行第 6 节的完整命令；若要发布，必须先选择新版本号并按第 8 节执行，不能覆盖 `v0.1.3`。

不要移动现有标签。下一个版本应从当前 `main` 开始，先修改 `package.json` 的版本号，再创建新的不可移动标签。

## 2. 名称与安装标识

这里有三个不同层级的名称，不要混用：

| 层级 | 标识 | 用途 |
| --- | --- | --- |
| GitHub 仓库 | `benz-ai-x/dsh-session-graph` | 源码、Issue、Release |
| npm 包 / Cordis 包名 | `@benz-ai-x/dsh-client-ui-session-graph` | `dsh plugin add/remove` 的依赖标识 |
| Cordis 实例 ID | `ui-session-graph` | profile patch 覆盖和运行时配置 |

从 npm 安装：

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

从 GitHub 固定版本安装：

```sh
dsh plugin --profile web add github:benz-ai-x/dsh-session-graph#v0.1.3
```

`dsh plugin add` 接收的是依赖包规格，因此 npm 安装命令必须使用 `package.json` 中的包名，而不是仓库名。npm 不能原地重命名已发布的包；如果产品决定采用 `@benz-ai-x/dsh-session-graph`，需要发布新包、迁移 `cordis.patch.yml`、Trusted Publisher、工作流和文档，并为旧包制定弃用或兼容策略。

## 3. 已交付能力

### Session Graph

- 在 Harness 对话视图中提供 Graph 标签。
- 按 Workspace Scope 或 Directory Scope 派生画布范围。
- Branch 相连的 Canvas Session 组成可拖动、可折叠的 Session Cluster。
- 节点具有稳定的顶部 Input Terminal 和底部 Output Terminal，当前仅作为后续图编辑能力的视觉接口。
- Branch 使用中性实线，Merge Relation 使用品牌色实线，Subagent Derivation 使用虚线。
- 支持节点与簇拖动、吸附参考线、缩放、平移、适应、100%、重新布局、重置、定位 Viewed Session、标题过滤和 minimap。
- Session Arrangement 按 scope identity 存入浏览器本地存储；切换 Workspace 时不会错误复用同目录下另一 Workspace 的布局。
- 本地存储读取被拒绝、记录损坏或写入超出配额时会降级为实时自动布局，不影响图谱使用。

### Session Inspector 与 Digest

- 单击 Canvas Session 打开持久详情面板；双击打开会话。
- 详情正文可上下滚动，并支持鼠标按住拖动滚动。
- 摘要必须由用户显式触发，不会自动产生模型费用。
- Host 从目标 Session 日志恢复最近模型路由，执行一次无工具的辅助模型请求。
- 摘要只包含概览、关键结论和待处理事项，不写回 Session 日志，不改变 Session Lineage。
- 结果按 Session revision 缓存在 Host 内存；来源更新后旧摘要会标为 stale，Host 重启会清空缓存。
- 同一 revision 的并发请求共享一次模型调用，但每个 caller 独立取消；Host 卸载会等待已接收工作静止。

### Session Merge（Issue #1）

- 用户可按顺序选择 2～3 个同 scope 的 Canvas Session。
- 可编辑汇聚指令；指令不能自行包含保留的 `dsh-session:` 引用。
- 创建独立目标 Session，不复用 Branch parent，也不修改任何来源 Session。
- Host 使用规范 Session references 捕获每个来源的不可变、有界快照。
- Host 在提交时从真实 Session header/log 与 Workspace Registry 重新确认目标的独立性，以及来源、归档、origin、空白状态和工作目录，不信任浏览器资格判断。
- Merge marker 与实际 `session-reference` context 必须在同一步精确配对，普通多会话 `@` 引用不会被误判为 Merge。
- Merge Relation 从目标日志的版本化 projection 恢复，并在成功返回前写入 Harness Projection Cache。
- 捕获一旦进入 Projection Cache durability commit，浏览器断开不再取消提交；提交失败仍稳定报告 `persistence-failed`。
- 命名、提交、持久化或打开失败时保留目标；重试复用原目标，避免重复创建。
- 目标 Session 保持独立 Session Cluster，来源只通过跨簇 Merge edge 表达 provenance。

GitHub [Issue #1](https://github.com/benz-ai-x/dsh-session-graph/issues/1) 的功能已在 `v0.1.2` 中实现，Issue 已关闭。若后续补充发布包的人工验收证据，可继续记录在该 Issue 或对应 Release/PR 中。

## 4. 领域与架构约束

开始修改前先读：

1. [`AGENTS.md`](../AGENTS.md)：仓库结构、编码、测试、提交与发布规范。
2. [`CONTEXT.md`](../CONTEXT.md)：唯一规范术语表。
3. [`docs/adr/`](adr/)：已经确定的架构决策。
4. [`README.md`](../README.md) 与 [`README.zh.md`](../README.zh.md)：对外行为与运维契约。
5. [`docs/research/issue-1-session-merge-feasibility.md`](research/issue-1-session-merge-feasibility.md)：Merge 的上游能力证据、风险和测试设计。

以下约束不可在没有新 ADR 的情况下静默改变：

- Harness 是 Session、Workspace、Lineage、事件日志和持久化的权威来源；Session Graph 只是派生投影。
- Branch、Merge Relation 与 Subagent Derivation 是三种不同关系。
- Session Cluster 只由 Branch forest 决定；Merge edge 不能把来源簇和目标簇合并。
- Merge 必须创建独立 Session，并使用不可变 Session Snapshot。
- 不要新增 `session-graph/*` Session event。Harness 对未知事件类型 fail closed；Merge marker 必须留在已知事件的 MessageSource payload 内。
- 浏览器不能自行实现 Host domain fold，也不能持有 Host runtime 对象；完整投影由 Host 通过 Remote/Session Projection 提供。
- Session Digest 永远在 Session 日志之外，且只能显式生成。
- Session Arrangement 按 scope identity 持久化；Workspace Scope 以 Workspace identity 为键，Directory Scope 才以目录为键。
- Cordis 配置必须由 Loader 可执行的 Standard Schema 验证；不能只依赖 TypeScript interface 或运行后手工检查。
- Host service 卸载必须先停止接单并等待其自有异步工作静止；Remote caller 不能取消已经转移给 Host 的 durability commit。

核心数据流：

```text
Harness Session/Workspace truth
        -> Host projection / package Remote
        -> browser-safe client model
        -> GraphView adapter
        -> GraphCanvas React UI
```

Merge 提交链路：

```text
validate sources
  -> create independent target
  -> rename target
  -> Host resolves canonical references
  -> queue merge marker + direct instruction
  -> Harness captures snapshots
  -> projection matches marker/references
  -> Projection Cache durability barrier
  -> open target
```

## 5. 代码导航

### Host 与共享领域逻辑

| 文件 | 责任 |
| --- | --- |
| [`src/config.ts`](../src/config.ts) | 对外 Standard Schema、默认值与 Host 配置规范化 |
| [`src/index.ts`](../src/index.ts) | Cordis Host 入口、配置、Digest/Merge services、projection 注册和 Remote 错误映射 |
| [`src/invariant.ts`](../src/invariant.ts) | 运行时注册不变量 |
| [`src/session-digest.ts`](../src/session-digest.ts) | Digest 输入预算、输出校验、revision cache 与并发控制 |
| [`src/session-digest-harness.ts`](../src/session-digest-harness.ts) | Harness 日志、模型路由和辅助请求适配 |
| [`src/session-merge.ts`](../src/session-merge.ts) | 浏览器侧 Merge 工作流、阶段错误与目标复用 |
| [`src/session-merge-host.ts`](../src/session-merge-host.ts) | Host 校验、规范引用解析、marker/direct message 原子排队与幂等提交 |
| [`src/session-merge-harness.ts`](../src/session-merge-harness.ts) | Harness Agent、Session Projection Cache 和超时适配 |
| [`src/session-merge-projection.ts`](../src/session-merge-projection.ts) | Merge marker/reference 纯 fold、wire state 与持久缓存校验 |

### Browser UI

| 文件 | 责任 |
| --- | --- |
| [`src/client/index.ts`](../src/client/index.ts) | Client Remote 挂载、Host service 注入、Slot/视图注册及卸载 |
| [`src/client/GraphView.tsx`](../src/client/GraphView.tsx) | scope 解析、Session 数据订阅、graph derivation 和页面头部 |
| [`src/client/GraphCanvas.tsx`](../src/client/GraphCanvas.tsx) | 卡片、端子、边、Inspector、Merge UI、手势、工具栏和 minimap |
| [`src/client/canvas-presentation.ts`](../src/client/canvas-presentation.ts) | 按 node positions、collapse、cluster offsets 顺序投影 Arrangement 并计算 bounds |
| [`src/client/graph-model.ts`](../src/client/graph-model.ts) | Canvas Session、Branch/Merge edge、Cluster、Subagent Summary 和 lineage 派生 |
| [`src/client/layout.ts`](../src/client/layout.ts) | 自动布局、跨簇顺序和 edge path |
| [`src/client/clusters.ts`](../src/client/clusters.ts) | Cluster frame、折叠、节点/簇偏移 |
| [`src/client/layout-store.ts`](../src/client/layout-store.ts) | Session Arrangement 存储、迁移与 fail-soft 存储降级 |
| [`src/client/viewport.ts`](../src/client/viewport.ts) | 缩放、平移、fit 与 resize 中心保持 |
| [`src/client/preview-placement.ts`](../src/client/preview-placement.ts) | Preview/Inspector 位置计算 |
| [`src/client/snap.ts`](../src/client/snap.ts) | 对齐吸附与参考线 |
| [`src/client/session-digest-remote.ts`](../src/client/session-digest-remote.ts) | Digest Remote 严格 wire contract |
| [`src/client/session-merge-remote.ts`](../src/client/session-merge-remote.ts) | Merge Remote 严格 wire contract |
| [`src/client/GraphView.module.css`](../src/client/GraphView.module.css) | CSS Modules 视觉样式 |

`types/deepseek-harness.d.ts` 是本包对未独立发布 Harness API 的本地声明。上游升级时它是高风险漂移点：不能只满足 TypeScript，应同时运行真实 Harness 集成测试。

## 6. 开发与自动化验证

环境要求：

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

安装锁定依赖：

```sh
pnpm install --frozen-lockfile
```

常用验证：

```sh
pnpm run typecheck
pnpm run build
pnpm test
pnpm run check
```

`pnpm run check` 是提交前最低门槛，顺序执行类型检查、构建和独立 Vitest。当前 hardening 基线为 18 个独立测试文件、166 项测试。

对真实 Harness checkout 运行集成测试：

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

当前 hardening 基线为 2 个 Harness 测试文件、96 项测试。涉及 Host service、Remote、Projection、React interaction、Harness API 声明或 profile 组合的改动必须运行这一层，不能只跑 package tests。

检查实际发布内容：

```sh
pnpm pack --dry-run
pnpm pack
```

不要提交 `lib/`、`coverage/`、压缩包或 `.artifacts/`。仓库没有 formatter/linter；遵循相邻代码风格，并依赖严格 TypeScript 与测试兜底。

仓库当前没有以下约束文件或脚本：

- `docs/agent/PROJECT_CONTRACT.md`
- `TODO.md`
- `dsh-reference.lock.json`
- `pnpm context:check`

如果后续新增，应把它们纳入接手和 CI 流程，而不是继续依赖本交接快照。

## 7. 本地交互测试

### 使用发布包

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
dsh web --port 3080
```

安装、升级或移除插件后必须重启 Web profile；运行中的进程不会监听 profile 依赖变化。

### 使用本地源码 checkout

先构建，再把仓库绝对路径加入 profile：

```sh
pnpm run build
dsh plugin --profile web add /absolute/path/to/dsh-session-graph
dsh web --port 3080
```

若没有全局 `dsh`，可通过 Harness checkout 执行：

```sh
pnpm --dir /path/to/deepseek-harness dsh plugin --profile web add /absolute/path/to/dsh-session-graph
pnpm --dir /path/to/deepseek-harness dsh web --port 3080
```

`dsh web` 会打印带一次性浏览器认证信息的 URL。若页面提示 `dsh web authentication required`，应重新打开终端刚打印的完整 URL；不要分享、提交或记录其中的认证参数。

本文档写入时，本机 `web` profile 使用本仓库的 link 依赖，且有实例监听 `127.0.0.1:3080`，启动命令为：

```sh
pnpm --dir ../deepseek-harness dsh web --port 3080 --no-open
```

这是临时运行状态，接手时先验证，不要假定它仍然存在：

```sh
lsof -nP -iTCP:3080 -sTCP:LISTEN
```

优先在启动它的终端按 `Ctrl-C` 停止。若终端已经丢失，先用上述命令确认准确 PID，再对该 PID 执行普通 `kill`。

### 人工验收清单

1. 打开一个非空 Session，确认 Conversation 旁出现 Graph 标签，页头版本为 `0.1.3`。
2. 检查每张会话卡上下端子尺寸、描边、选中态与边连接位置。
3. 检查 Branch 为中性实线、Merge 为品牌色实线、Subagent Derivation 为虚线。
4. 拖动节点和 Cluster，折叠/展开，再刷新页面，确认 Session Arrangement 恢复。
5. 打开 Session Inspector，生成 Digest，确认正文可滚轮滚动和按住拖动滚动，且会话仍可正常打开/分支。
6. 进入 Merge 模式，选择两个来源并创建目标；确认目标独立成簇、两条 Merge 入边可见、Inspector 显示来源与 capture boundary。
7. 重启 Web profile，确认 Merge Relation 仍能从 Projection Cache/日志恢复。
8. 注入或复现一次可恢复失败，确认目标被保留，并可“重试”或“打开目标会话”。

## 8. 发布流程

每次 GitHub Release 都必须执行以下顺序：

1. 修改 `package.json` 的 `version`，不要在源码中维护第二份版本字符串。
2. 若行为、安装或配置改变，同时更新 `README.md` 与 `README.zh.md`。
3. 运行 `pnpm run build`，在实际 Graph 页头确认版本徽标与 `package.json` 一致。
4. 运行 `pnpm run check`。
5. 运行真实 Harness 测试和 packed profile smoke；UI 变化附截图或录屏。
6. 提交并推送版本变更。
7. 创建匹配的不可移动标签 `v<version>`。
8. 创建 GitHub Release。Publish workflow 会校验 tag、版本和 checkout commit，重新测试并发布已打包字节。
9. 验证 npm dist-tag 与 GitHub Actions 结果。

验证命令：

```sh
npm view @benz-ai-x/dsh-client-ui-session-graph version dist-tags --json
gh run list --workflow publish.yml --limit 5
```

npm Trusted Publisher 的有效配置是：

| 字段 | 值 |
| --- | --- |
| Publisher | GitHub Actions |
| Organization/user | `benz-ai-x` |
| Repository | `dsh-session-graph` |
| Workflow | `publish.yml` |
| Environment | `npm-publish` |
| Allowed action | `npm publish` |

发布使用 GitHub OIDC，工作流需要 `id-token: write`，不应配置长期 `NPM_TOKEN`。此前用于首次发布的 npm token 已吊销；不要尝试恢复或复用。若再次出现 `ENEEDAUTH`，先检查 npm Publisher 卡片、GitHub environment 名称和 workflow 文件名是否完全一致，再查看 verbose publish log。

## 9. 已知限制与下一步

已知产品限制：

- 无会话主页与全新空白 Session 没有 Graph 视图入口。
- 图谱一次只展示一个 Workspace Scope 或 Directory Scope。
- 平移和缩放不持久化；节点、簇偏移与折叠状态会持久化。
- Digest 只存在 Host 内存，Host 重启后需重新生成。
- 没有日志模型路由的旧 Session 需要显式 fallback provider/model。
- 一次 Merge 只支持 2～3 个来源，不支持跨 Workspace Merge。
- Merge 使用不可变快照；来源的新消息不会自动同步到既有目标。
- 触屏只有 pointer-event fallback，没有专用交互。

建议按优先级处理：

1. 对 npm `0.1.3` 完成人工验收，并在对应 Release 或后续 PR 中保留验证证据。
2. 决定是否真的要迁移为较短 npm 包名；这属于发布身份迁移，不是简单改字符串。
3. 任何 Harness 升级先更新兼容基线和本地声明，并运行完整 Harness/packed-profile 测试。
4. 若要支持四个以上来源，另行设计分批或层级汇聚以及上下文预算，不要直接放宽现有上限。
5. 若要支持历史 Merge 关系回填，提供显式且限流的 backfill；不要在 Graph 打开时无界扫描所有日志。

## 10. 十分钟接手路径

```sh
git status --short --branch
git log --oneline --decorate -10
pnpm install --frozen-lockfile
pnpm run check
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
npm view @benz-ai-x/dsh-client-ui-session-graph version dist-tags --json
gh issue view 1 --comments
```

之后按第 7 节启动 Web profile，执行人工验收。任何新的领域术语或与现有 ADR 冲突的设计都应先更新 `CONTEXT.md` 或新增 ADR，再进入 TDD 实现。
