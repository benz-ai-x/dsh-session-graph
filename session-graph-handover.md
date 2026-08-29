# Session Graph 插件交接文档

> 工作文档，暂不进入 git；完成接管或首次发布后可刷新或删除。
> 状态快照：2026-08-28，分支 `main`，HEAD `93a04a494e266b2f88b4e98b9e9643c63b0c484b`。
> 本文负责接管基线、开发入口、兼容性维护和发布待办；用户行为、安装方式与产品限制以 [README.zh.md](README.zh.md) 为准。

## Summary

`@benz-ai-x/dsh-client-ui-session-graph` 是独立维护的 DeepSeek Harness Web 插件，它在对话视图中增加工作区会话图谱。开发、测试、打包和发布均在 `benz-ai-x/dsh-session-graph` 仓库完成；DeepSeek Harness 单体仓库不是本插件的源码来源。当前代码和 CI 可以继续开发；唯一需要账号凭据的待办是首次 npm 发布。

## Table of Contents

- [接管基线](#接管基线)
- [产品与集成模型](#产品与集成模型)
- [代码地图](#代码地图)
- [开发与验证](#开发与验证)
- [兼容性维护](#兼容性维护)
- [安装与界面调试](#安装与界面调试)
- [发布](#发布)
- [故障定位](#故障定位)
- [Dev Note](#dev-note)

-----

## 接管基线

以下状态用于确认接管起点。后续提交或发布改变其中任一项时，应同步更新本文。

| 项目 | 当前值 |
|---|---|
| 本地仓库 | `/Users/pc2026/Dev-Space/dsh-session-graph` |
| GitHub | [benz-ai-x/dsh-session-graph](https://github.com/benz-ai-x/dsh-session-graph) |
| 默认分支 | `main` |
| 当前 HEAD | `93a04a4` |
| npm 包名 | `@benz-ai-x/dsh-client-ui-session-graph` |
| 包版本 | `0.1.0` |
| Git tag | `v0.1.0` → `3cb3d61`；不要移动已有 tag |
| DSH 兼容基线 | `deepseek-ai/deepseek-harness` 的 `dsh-v0.1.2-alpha.1` |
| Node.js | `^22.19.0 || >=24.0.0` |
| pnpm | `11.7.0` |
| 最近 CI | [run 33170596632](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33170596632)，全部成功 |
| npm 状态 | 尚未发布；registry 查询返回 `E404` |

GitHub 当前没有开放 issue、开放 PR 或 Release。`npm-publish` environment 已创建，但没有 protection rule；GitHub repository 与该 environment 均未配置 secret。

开发必须从本独立仓库开始。DeepSeek Harness 下的旧 `session-graph` worktree 只保留迁移前上下文，不是构建或发布来源。

-----

## 产品与集成模型

插件是一个 package bundle。Host 入口不提供业务 service；浏览器入口注册 `conversation.view` 的 `graph` 标签，并通过 DSH profile 注入 Session、Workspace、locale、renderer 与 conversation 能力。

- 图谱只读取工作区、会话摘要和待处理交互状态，不写会话日志，也不改变模型请求。
- 普通会话组成派生树和簇；子代理后代折叠为节点徽标。
- 浏览器按工作区保存节点位置、簇偏移和折叠状态。
- `cordis.patch.yml` 把插件作为一个 profile 层插入；用户不需要手工编辑 `cordis.yml`。
- 用户交互和产品限制由 [README.zh.md](README.zh.md#使用图谱) 与 [README.zh.md](README.zh.md#当前限制) 维护。

构建生成两个 Node ESM 入口和一个 DSH 惰性浏览器模块：

- `lib/index.js`：package bundle 的 Host no-op 入口。
- `lib/invariant.js`：注册没有运行时检查的 invariant companion，并返回 disposer。
- `lib/client.js`：由 `window.__ModuleLoader__` 装载的 CommonJS 浏览器模块。

浏览器构建将 `clsx` 打进包内，将 React、Cordis 和 DSH UI 共享模块留给目标 profile。CSS Modules 由 `tsdown.config.ts` 中的插件编译，并在浏览器模块物化时注入一个带 package 标识的 `<style>` 元素。

-----

## 代码地图

先从下表入口定位改动；具体 API 和用户行为以源码及测试为准。

| 文件 | 责任 |
|---|---|
| [`package.json`](package.json) | 包名、版本、exports、Node/pnpm 基线、DSH bundle 与 client inject 元数据 |
| [`cordis.patch.yml`](cordis.patch.yml) | `web` profile 的插件插入层 |
| [`src/client/index.ts`](src/client/index.ts) | locale 注册、`conversation.view` 注册、打开会话与创建分支 |
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | 工作区范围、数据推导、空状态与画布入口 |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | 节点、簇、视口、过滤、悬停卡、键盘、minimap 和全部手势 |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | 工作区范围、节点、边、簇、子代理徽标、过滤与邻域推导 |
| [`src/client/layout.ts`](src/client/layout.ts) | 纵向树布局、节点位置和边路径 |
| [`src/client/clusters.ts`](src/client/clusters.ts) | 簇框、折叠、偏移和颜色 |
| [`src/client/viewport.ts`](src/client/viewport.ts) | 缩放、平移、适应和 minimap 投影 |
| [`src/client/snap.ts`](src/client/snap.ts) | 节点拖拽吸附和参考线 |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | `localStorage` 布局记录与损坏记录回退 |
| [`src/client/locales.ts`](src/client/locales.ts) | `sessionGraph` 中英文 UI 字典 |
| [`src/client/GraphView.module.css`](src/client/GraphView.module.css) | 画布与控件样式 |
| [`types/deepseek-harness.d.ts`](types/deepseek-harness.d.ts) | 独立类型检查使用的最小 DSH 类型桥接 |
| [`tsdown.config.ts`](tsdown.config.ts) | Node 入口、浏览器包装器、共享依赖和 CSS Modules 构建 |
| [`vitest.config.ts`](vitest.config.ts) | 独立纯模块测试；排除真实 DSH React 视图测试 |
| [`vitest.harness.config.ts`](vitest.harness.config.ts) | 从准备好的 DSH checkout 解析真实 UI 模块和 React 运行时 |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Node 矩阵、固定 DSH 集成测试和 profile 打包烟测 |
| [`.github/workflows/publish.yml`](.github/workflows/publish.yml) | tag 校验、重新测试、打包和 npm 发布 |

-----

## 开发与验证

日常开发在独立仓库运行。锁文件已提交，CI 与接管验证均使用冻结安装。

```sh
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` 先运行 TypeScript 类型检查，再构建三个入口并执行独立测试。状态快照验证结果为 9 个测试文件、76 项测试全部通过。

涉及 DSH UI 类型、槽位、Session/Workspace 数据或 React 组件时，还必须运行 Harness 测试：

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

`DSH_HARNESS_ROOT` 必须指向已安装依赖的 DeepSeek Harness checkout。状态快照使用当前 Harness checkout 执行了 51 项视图交互测试，全部通过；CI 使用固定 tag `dsh-v0.1.2-alpha.1` 重新建立相同环境。

构建可安装归档：

```sh
pnpm pack --pack-destination .artifacts
```

当前归档名为 `.artifacts/benz-ai-x-dsh-client-ui-session-graph-0.1.0.tgz`，内容包括四个 `lib` 文件、bundle patch、包元数据、README 和许可证。`.artifacts/`、`lib/` 与 `node_modules/` 都由 `.gitignore` 排除。

测试归属遵循以下规则：

- 纯数据推导、布局、视口、吸附和存储逻辑放入默认 Vitest 配置。
- 需要真实 DSH slot、组件 props 或 React runtime 的行为放入 `tests/views.client.spec.tsx`，由 Harness 配置运行。
- 公开行为改变时，同时更新中英文 locale、相关测试和 README。
- DSH 类型改变时，先修改真实集成代码，再把 `types/deepseek-harness.d.ts` 收敛到独立类型检查所需的最小声明。

-----

## 兼容性维护

独立开发依赖两层证据：Node 矩阵证明包本身可构建，固定 DSH checkout 证明插件仍适配真实宿主。只更新其中一层会留下未验证的版本组合。

CI 在 Node.js 22.19、24 和 26 上运行 `pnpm run check`，并在 Node.js 24 上打包。Harness job 另外完成以下操作：

1. 检出 `deepseek-ai/deepseek-harness@dsh-v0.1.2-alpha.1`。
2. 安装两边的冻结依赖。
3. 运行 `pnpm test:harness`。
4. 打包插件并安装到隔离的 `web` profile。
5. 用 `--dump-config` 确认插件出现。
6. 卸载插件并确认 resolved config 与 profile 依赖均不再包含它。

升级 DSH 兼容基线时，应在同一变更中完成以下事项：

1. 修改 [`.github/workflows/ci.yml`](.github/workflows/ci.yml) 的 `DSH_REF`。
2. 用目标 DSH checkout 运行 Harness 测试。
3. 检查 `types/deepseek-harness.d.ts` 与真实 DSH API 是否一致。
4. 检查 React 主版本和 DSH 浏览器 loader 约定。
5. 更新 README 中的目标 DSH 版本。
6. 通过归档安装烟测后再合入。

插件的 React 和 React DOM 只用于独立编译与测试；目标 DSH profile 提供运行时实例。Harness 配置显式复用宿主 React 并执行 dedupe，避免测试环境出现两个 React 实例。

-----

## 安装与界面调试

GitHub tag 安装与 `allowBuilds` 恢复步骤通过状态快照验证，命令及安全说明由 [README.zh.md 的安装章节](README.zh.md#安装) 维护。安装或卸载后必须重启目标 `web` profile。

本地 UI 改动应先打包，再安装到隔离 profile，避免污染日常 DSH 配置：

```sh
DSH_HOME=/tmp/dsh-session-graph-home \
pnpm --dir /path/to/deepseek-harness dsh plugin --profile web add \
  /path/to/dsh-session-graph/.artifacts/benz-ai-x-dsh-client-ui-session-graph-0.1.0.tgz
```

安装后可用以下命令确认最终配置包含插件：

```sh
DSH_HOME=/tmp/dsh-session-graph-home \
pnpm --dir /path/to/deepseek-harness dsh --profile web --dump-config
```

输出应包含 `name: '@benz-ai-x/dsh-client-ui-session-graph'`。完成测试后从同一 `DSH_HOME` 移除：

```sh
DSH_HOME=/tmp/dsh-session-graph-home \
pnpm --dir /path/to/deepseek-harness dsh plugin --profile web remove \
  @benz-ai-x/dsh-client-ui-session-graph
```

-----

## 发布

发布工作流可用，但 npm registry 尚无该包。首次发布需要具有 `@benz-ai-x` scope 发布权限的 npm 凭据；本文和仓库都不保存凭据值。

当前浏览器 bundle 的 CSS 虚拟模块 region 注释包含构建机绝对路径。状态快照的归档包含 `/Users/pc2026/Dev-Space/dsh-session-graph/...`；GitHub 构建会写入对应 runner 路径。source map 的 `sources` 字段保持相对路径，因此该问题不影响运行，但会使 `lib/client.js` 依赖构建目录。建议首次 npm 发布前规范化 `tsdown.config.ts` 的 CSS 虚拟模块 id，并使用新的版本和 tag；不要移动 `v0.1.0`。

### 首次发布 `v0.1.0`

若维护者接受上述绝对路径注释，`v0.1.0` 仍可按现有 tag 发布。该 tag 指向包源码提交 `3cb3d61`，但不包含 Publish workflow；应从 `main` 手工运行 [Publish workflow](.github/workflows/publish.yml)，并把输入 `tag` 设为 `v0.1.0`。

执行顺序：

1. 在 GitHub 仓库中添加权限范围尽量小的 `NPM_TOKEN` secret。
2. 在 Actions 页面手工运行 Publish workflow，输入 `v0.1.0`。
3. 确认工作流通过 tag/版本校验、测试、归档和 npm 发布步骤。
4. 确认 npm 页面和 `npm view @benz-ai-x/dsh-client-ui-session-graph version` 返回 `0.1.0`。
5. 在 npm 配置 trusted publisher：organization `benz-ai-x`、repository `dsh-session-graph`、workflow `publish.yml`、environment `npm-publish`、allowed action `npm publish`。
6. trusted publishing 验证成功后删除 `NPM_TOKEN`。

这些发布步骤没有在状态快照中执行，因为 npm 发布会改变外部 registry 且需要维护者凭据。首次发布的人工验证责任属于持有 npm scope 权限的维护者。

### 后续版本

后续发布先更新 `package.json` 版本并合入 `main`，等待 CI 全部成功，再创建新的不可移动 `v<version>` tag 和 GitHub Release。`release.published` 会触发 Publish workflow；稳定版本发布到 npm tag `latest`，带预发布后缀的版本发布到 `next`。

工作流会校验 tag 等于 `v` 加包版本，并确认 checkout HEAD 是 tag 指向的提交。它重新运行 `pnpm run check`，发布刚生成的归档，并请求 npm provenance。

-----

## 故障定位

以下检查按依赖顺序缩小问题范围，不替代具体失败日志。

| 现象 | 首先检查 |
|---|---|
| Graph 标签没有出现 | 重启 `web` profile；运行 `--dump-config`；确认 profile 中存在包名 |
| GitHub 安装报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` | 按 README 把 dsh 输出的完整键加入该 profile 的 `allowBuilds`，检查源码后重试 |
| 独立类型检查失败但 Harness 测试能解析 | 检查 `types/deepseek-harness.d.ts` 是否缺少当前源码使用的最小声明 |
| Harness 测试无法解析模块 | 确认 `DSH_HARNESS_ROOT` 指向已安装依赖且含 `tsconfig.base.json` 的 checkout |
| React 报 invalid hook call | 确认测试从 Harness 解析 React/React DOM，并保留 `vitest.harness.config.ts` 的 alias 与 dedupe |
| 页面存在但没有样式 | 运行 `pnpm run build`，确认 `lib/client.js` 含 package CSS 标识，并检查浏览器中的 `style[data-plugin-css]` |
| 打包物缺文件 | 检查 `package.json#files`、exports 和 `pnpm pack` 输出，不要手工复制 `lib/` |
| 创建分支没有反馈 | `branchSession` 当前吞掉 controller rejection；这是 README 已记录的产品限制，不要先假定分支成功 |

-----

## Dev Note

<details>
<summary>非权威的当前待办</summary>

1. 规范化 CSS 虚拟模块 id，消除 `lib/client.js` 中的构建机绝对路径；使用新版本和新 tag，不移动 `v0.1.0`。
2. 完成首次 npm 发布。
3. 首次发布后配置 npm trusted publisher，并删除长期 token。
4. 根据维护要求为 `npm-publish` environment 增加 reviewer 或其他 protection rule。
5. 为 GitHub 仓库补充 description，并按需要配置 `main` 分支保护。
6. 先用本仓库完成至少一轮后续开发和发布，再决定是否抽取 `dsh-plugin-template`；模板不应复制 Session Graph 专用类型桥接和 UI 逻辑。

本文应在首次 npm 发布、DSH 兼容 tag 更新或开发目录变化后刷新。稳定的用户行为继续写入 README，不要把本文变成第二份产品手册。

</details>
