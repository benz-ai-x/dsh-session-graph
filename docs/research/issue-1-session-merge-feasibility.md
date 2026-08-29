# Issue #1：多会话快照汇聚可行性研究

- 研究日期：2026-08-29
- 本仓库基线：`be71c12508d41e587d10924d5cfe7303bac171b9`
- DeepSeek Harness 基线：`cd5ef8148158c3a752a658978873241fdf8e2bbc`（`0.1.2-alpha.1`）
- 研究对象：[Issue #1「支持将多个会话快照汇聚为新会话」](https://github.com/benz-ai-x/dsh-session-graph/issues/1)；截至研究时没有评论。

## 结论

**可以实现，而且不需要修改 DeepSeek Harness 上游。** Harness 已经具备完整的底层能力：在指定 Workspace/目录创建普通会话、为目标会话生成规范的 `dsh-session:` mention、在模型步骤开始时捕获 1～3 个来源的有界只读快照、把来源与捕获序号写入目标会话日志、提交消息、重命名和打开会话。Session Graph 需要补齐的是工作流编排、显式多选 UI、一个 Host Remote、一个宿主 Session Projection，以及 `merge` 图边和跨簇布局。

建议将其作为一个中等规模、可分层交付的功能，而不是改造现有 `fork()`：目标仍由 `sessions.create()` 创建，所以没有 `parentSession`，自然保持独立 Session Cluster；来源关系由实际落盘的 session-reference context 推导，不污染 Branch 血缘。

有两个必须在实现里正面处理的约束：

1. prompt 被接受只代表消息已进入 Agent；真正的来源读取发生在稍后的 `agent/pre-step`。因此工作流不能在提交返回后立刻宣告“快照已捕获”，而要等 marker 与 session-reference 实际配对，并在返回成功前把 Session 日志和 merge projection cache 一起持久化。
2. 新目标是最新会话，当前按“根会话最近活动”排序会把它放在来源上方。若直接添加跨簇边，箭头方向和阅读顺序会很差；布局应在保持 Branch Cluster 独立的前提下，对 Cluster 做 merge 依赖优先的稳定拓扑排序。

普通多会话 `@` 引用与显式 Merge 也可以可靠区分：显式工作流先用 `agent.inject()` 放入一条带结构化 `source.kind === 'session-graph-merge'` 的上下文标记，再以普通 `user` 来源提交含 mentions 的指令。Resolver 只展开普通 user 消息，因此最终同一步日志顺序为“merge marker → readable direct message → session-reference context”。Projection 只有在同一步内同时看到 marker 和来源完全匹配的 reference context 时才建立关系；普通 composer 的多会话引用没有 marker，不会成为 Merge Relation。

最小的事实驱动规则是“把第一条含 2～3 个来源的 `session-reference` context 视为 merge”。它不需要 marker，但无法判断请求来自 Graph UI 还是普通 composer，因此不满足“显式 merge”语义。**本报告推荐 marker + reference 精确配对**：只增加一个很小的 Host Remote，却保留可靠的操作来源、实际快照证据和跨重启恢复能力。

## 上游能力证据

### 1. 创建、寻址、提交、命名和打开均已有公开 Client API

Harness 的 `ISessions.create()` 接受 `workspaceId`、`cwd` 或预分配 `sessionId`，并保证 Promise 完成时本地 binding 已经可以寻址；`open()` 切换当前会话，`binding()` 取得目标 Session 行为面。[`ISessions` 契约](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/client/contract/sessions.ts#L20-L44)；[创建后的同步可寻址保证](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/client/sessions/service.ts#L395-L411)

目标 binding 的 `session.prompt()` 可发送普通 text prompt，`session.rename()` 可写入用户固定标题。[`ISession` prompt/rename 契约](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/client/contract/session.ts#L58-L115) 创建请求在 Host 端会解析 Workspace、使用其路径创建会话并附加到该 Workspace；传入 `cwd` 时直接创建在该目录。[Host create 实现](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/commands.ts#L67-L110)

这意味着最小工作流不需要私有 Host API：

```text
校验来源 → create(workspaceId 或 cwd) → rename(目标标题)
         → Merge Remote 精确解析 mentions、注入 marker 并提交指令
         → 等待来源 projection 或错误 → open(目标)
```

### 2. Web profile 已提供规范 mention 和 1～3 来源快照

`sessionReferenceResolver/candidates` 是浏览器可调用的 Remote；返回项自带 Host 生成的规范 `@[label](dsh-session:…)` mention。现有 Web 引用插件也是通过该 Remote 获取 session mention，而不是在浏览器自行编码 URI。[Remote 导出](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/context/session-reference/src/index.ts#L235-L255)；[Web 的现有调用方式](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/client/ui-reference/src/client/index.ts#L45-L78)

服务的硬上限正好是 3 个 distinct sources，默认每个来源最多保留 65,536 UTF-8 bytes，并提供自引用、超限、读取失败、预算失败和取消等稳定错误分类。[配置和错误码](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/context/session-reference/src/config.ts#L3-L39)

当消息进入 `agent/pre-step` 时，Resolver 会解析直接用户消息里的 mention，并行读取各来源的当前 surface，生成只读、不可信、有界的聚合上下文；来源记录包含 `sessionId`、`label`、`capturedThroughSeq`、压缩/截断统计和输入顺序。[准备与来源记录](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/context/session-reference/src/index.ts#L257-L312) 来源之后的变化不会改变已经生成的 context，且被引用会话只被读取，不被写入。

### 3. 汇聚关系有持久事实来源

Resolver 把可读的直接消息和紧随其后的 `source.kind === 'session-reference'` context 一起交给 Agent Loop；Loop 会将 decision 中的每条消息依次追加为 `user/message` 事件。[Resolver 的消息顺序](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/context/session-reference/src/index.ts#L121-L153)；[Agent Loop 的日志追加](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/agent-loop/src/agent.ts#L270-L300)

因此 `references[]` 和每个来源的 `capturedThroughSeq` 已存在于目标会话日志中。它比浏览器 `localStorage` 更适合作为 Merge Relation 的事实源，也能证明“边出现时快照确实已经捕获”，而不是仅证明 UI 曾点击提交。

### 4. 显式 Merge 可使用已知事件内的插件 MessageSource 标记

`MessageSourceMap` 明确是插件可扩展的 sum type；插件可声明自己的 `kind`，而 `createUserMessage()` 会把整个 source 作为消息的一部分冻结下来。[MessageSource 扩展契约](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/llm/llm/src/message.ts#L101-L127)；[消息构造](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/llm/llm/src/message.ts#L193-L203)

`agent.inject()` 会把上下文先持久放入 next-step inbox，但不唤醒 Agent；随后 `agent.steer()` 可同步放入同一个 next-step 队列并唤醒新目标。Inbox 在步骤边界先完整领取 next-step，因此 marker 稳定排在直接指令之前。[Agent 注入语义](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/agent/src/runtime-types.ts#L140-L154)；[Inbox 领取顺序](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/agent/src/inbox.ts#L44-L75) Session Controller 又公开了面向其他 Host API domain 的 `resolveAgent()`，所以插件 Remote 不需要私有字段即可取得目标 Agent。[Host Agent 解析入口](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/index.ts#L176-L183)

不要新增 `session-graph/*` Session event。Harness 的持久化读取器只接受仓库构建时生成的已知事件集合，明确说明 out-of-repo 事件会在重启读取时被拒绝。[已知事件守卫](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/core/session/src/known-event-types.ts#L1-L17)；[上游决策说明](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/.agents/notes/implemented/simplification/2026-08-25-fail-closed-session-event-vocabulary.md#L13-L31) 推荐方案只写 Harness 已知的 `agent/inbox/spliced` 和 `user/message`；插件 marker 是它们 JSON payload 内的 MessageSource，不是新事件类型，因此可安全重放。

### 5. 可用 Session Projection 廉价恢复关系

Harness 的 Session Projection 允许领域插件注册“初始状态 + 同步纯 fold + 可选 wire view”；框架负责逐事件推进、校验和客户端分发。[ProjectionDefinition 契约](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/session/session-projection/src/index.ts#L34-L83) Projection Cache 会在 `turn/end`、Session disposal 和节流点持久化投影，并可在冷会话列表中零 I/O 读取缓存值。[缓存职责与写入点](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/session/session-projection-cache/src/index.ts#L68-L75)；[冷缓存读取](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/session/session-projection-cache/src/index.ts#L115-L142)

Session Controller 已把所有当前可用的 wire projection 放入列表项，客户端又原样保留为 `SessionSummary.projectionValues`。[Host 列表投影](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/list.ts#L328-L343)；[Client 列表映射](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/api/session-controller/src/client/sessions/service.ts#L576-L599)

所以新 projection 可以在刷新浏览器或重启 Web profile 后恢复 Merge Relation，而不需要扫描每个完整日志。

## 本仓库缺口

当前 Graph 模型只有单一 `branchFrom` 和无 kind 的 `GraphEdge`，Session Cluster 也完全由 Branch forest 分区。[当前节点、边和 Cluster 模型](https://github.com/benz-ai-x/dsh-session-graph/blob/be71c12508d41e587d10924d5cfe7303bac171b9/src/client/graph-model.ts#L48-L97) `deriveSessionGraph()` 只遍历 `parentId` 创建 Branch edge。[当前 Branch 派生](https://github.com/benz-ai-x/dsh-session-graph/blob/be71c12508d41e587d10924d5cfe7303bac171b9/src/client/graph-model.ts#L216-L292)

浏览器注入面目前也只封装了 open、fork 和 digest，没有 create、mention resolve、prompt 或 rename 工作流。[当前 Client 注入](https://github.com/benz-ai-x/dsh-session-graph/blob/be71c12508d41e587d10924d5cfe7303bac171b9/src/client/index.ts#L26-L64)

这些都是插件内缺口，不是 Harness 能力缺口。

## 最小可行架构

### A. Host：原子提交 Remote + 只读派生 projection

新增 `sessionGraphMerge/submit` Remote，接收 `targetSessionId`、2～3 个 `sourceIds`、`instruction` 和 `operationId`。Host 端负责：

1. 通过 `sessionController.resolveAgent()` 取得刚创建、空闲的普通目标会话。
2. 用 `sessionReferenceResolver` 精确解析来源，校验 distinct、同目录以及 2～3 上限，并生成规范 mentions；不信任浏览器传入的 label 或 URI。
3. 预先构造 marker 与 direct message，然后在无 `await` 间隔的同步区间依次调用 `agent.inject(marker)`、`agent.steer(direct)`。Marker source 至少保存 `kind: 'session-graph-merge'`、`version: 1`、`operationId` 和有序 `sourceIds`；可使用 `form: 'notice'` 提供折叠显示。
4. 等待同一 `operationId` 的 projection 完成或目标 Agent 报错；完成后调用公开的 `sessionProjectionCache.write(targetSession)`。该写入会先 flush Session 日志，再持久化 projection checkpoint，因此 Remote 的成功结果本身就是跨进程重启的 durability barrier。[Projection Cache 显式写入](https://github.com/deepseek-ai/deepseek-harness/blob/cd5ef8148158c3a752a658978873241fdf8e2bbc/packages/session/session-projection-cache/src/index.ts#L170-L191)

不应使用“先调用普通 `session.prompt()`，再注入 marker”：prompt 会立刻唤醒 Agent，存在 marker 错过本步骤的竞态。也不应让 Client 分两次调用 Host，因为网络中断会放大这个窗口。

同时新增 `session-merge-projection.ts`，注册例如 `sessionGraphMerge`：

```ts
interface MergeProjection {
  readonly operationId: string
  readonly sources: readonly {
    readonly sessionId: SessionId
    readonly capturedThroughSeq: number
  }[]
  readonly contextEventSeq: number
}
```

Fold 规则：在 `step/start` 后记录合法 merge marker；只在同一步随后的 `session-reference` context 含 2～3 个 distinct references、且其按 `inputIndex` 排列的 source ids 与 marker 完全匹配时形成关系；在 `step/end` 清除未配对 marker。一旦形成就保持不变。Marker-only、reference-only、来源不匹配、后续普通引用和 `agent/inbox/spliced` 中尚未进入步骤的 marker 都不能形成 Merge Relation。客户端只读 `SessionSummary.projectionValues.sessionGraphMerge`。

这同时满足两个要求：普通多会话 `@` 引用不会误报为显式 merge；边只在 Resolver 已实际捕获快照后出现。Projection 仍然是日志事实的纯派生，不需要插件 KV、`localStorage` 或第二份关系数据库。

### B. Client：`mergeSessions` 工作流控制器

不要把整个事务直接塞进 `GraphCanvas.tsx`。新增独立控制器/纯工作流模块，向 React 暴露可观察状态：

```ts
type MergeStage =
  | 'validating' | 'creating' | 'resolving'
  | 'naming' | 'submitting' | 'capturing'
  | 'ready' | 'failed'

mergeSessions(
  sourceIds: readonly [SessionId, SessionId, ...SessionId[]],
  instruction: string,
  scope: GraphScope,
): Promise<SessionId>
```

失败对象必须携带 `stage`，并在创建成功后携带 `targetSessionId`。这样 Resolver、rename 或 prompt 失败时，UI 可以重用同一目标重试，也可以打开已创建的空/失败目标，不会静默遗留不可理解状态。

具体流程：

1. 校验 2～3 个 distinct Canvas Sessions，全部属于当前 Graph Scope，且 instruction 非空。
2. Workspace Scope 调用 `sessions.create({ workspaceId })`；Directory Scope 调用 `sessions.create({ cwd: scope.path })`。为此 `WorkspaceGraphScope` 需保留现有 `workspaceId`。
3. 生成简洁目标标题并 `rename()`；调用 `sessionGraphMerge/submit`，由 Host 精确解析 sources、注入 marker，并把 instruction 与规范 mentions 组成同一步 direct message。
4. Remote 只在 `sessionGraphMerge` 匹配预期 `operationId` 与 sources、且 durability barrier 完成后返回成功。若先出现来源解析/捕获错误或目标 Agent 报错，返回带 stage 与 `targetSessionId` 的失败，UI 提供“重试”和“打开目标”。
5. 打开目标会话。即使后续模型生成失败，已捕获的来源关系仍是有效事实；模型错误沿用会话自身的标准错误呈现。

### C. Graph：关系和 Cluster 分离

- `GraphNode.mergeSources: readonly SessionId[]`
- `GraphEdge.kind: 'branch' | 'merge'`
- Branch 继续独占 `children`、`branchFrom`、Branch Lineage 和 Cluster 分区。
- Merge edge 只连接当前 scope 内可见的 Canvas Session；目标仍是自己的 Root/Cluster。
- Inspector 显示来源标题与捕获序号；来源已归档/缺失时显示不可用项，不伪造边。
- `branchSource`、Branch inspector 文案和 Branch 样式必须按 `edge.kind === 'branch'` 过滤，避免把最后一条 merge 入边误报成 Branch parent。

### D. Layout/UI

1. 进入显式“汇聚模式”，而不是复用普通单选状态；节点点击切换来源，顶部或侧边显示最多 3 个 source chips、数量和移除按钮。
2. 选择少于 2 个时禁用提交，第 4 个选择直接给出可理解反馈；默认 instruction 覆盖结论、分歧、风险和后续事项，且允许编辑。
3. Cluster 仍按 Branch 分区，但显示顺序使用 merge 依赖的稳定拓扑排序，recency/id 作为无依赖项的稳定 tiebreak；异常循环时回落到现有顺序。
4. Merge edge 使用独立样式和 legend。Branch 保持实线，Subagent Derivation 保持虚线；Merge 建议用品牌色实线/双线或带汇聚标识的箭头，不要复用虚线。
5. 修正 Cluster 拖动和折叠逻辑：跨簇 edge 在 source 或 target 任一 Cluster 移动时都必须重算；折叠只能隐藏 Cluster 内部 Branch edge，不能误删跨簇 Merge edge。

## 风险与边界

| 风险 | 影响 | 建议 |
|---|---|---|
| prompt admission 与快照捕获是两个时点 | RPC 成功后仍可能出现来源读取/预算错误 | 以 projection 或 `lastAgentError` 结束 capture 阶段 |
| 每源默认上限 65,536 bytes，三源总量仍可能很大 | 小上下文模型可能在请求阶段失败 | 保留 2～3 上限、显示 Host 错误；任意数量来源另做分层总结 |
| 新 projection 安装前已存在的历史多引用会话没有该 key 的缓存行 | 初次列表不会主动扫描大日志，旧关系可能要打开一次才回填 | Issue #1 新建目标不受影响；若要求历史迁移，增加显式、限流的 backfill，不在 Graph 打开时无界扫描 |
| 插件卸载期间若 Host 重写了 projection cache | 关系事实仍在日志，但列表缓存可能缺 key | 固定 projection key/stateVersion，并测试卸载/重装；必要时提供按目标会话的恢复动作 |
| Host 在 marker inbox append 后、steer append 前崩溃 | 留下 orphan marker | Remote 内预构造两条消息并同步连续写入；Projection 只认同一步成功配对，orphan 本身不建边；加入 crash/retry 测试 |
| 快照已捕获但模型回复完成前进程崩溃 | Session 日志已有事实，但冷列表中的 projection cache 可能仍是旧 cut | Remote 在报告成功前显式 `sessionProjectionCache.write()`，把日志 flush 与 projection checkpoint 作为一个 durability barrier |
| 错把插件 marker 实现成自定义 Session event | 重启后 Harness 拒绝读取整个会话 | 只扩展 MessageSource，事件类型限定为已知 `agent/inbox/spliced` / `user/message` |
| 普通多会话 `@` 引用被误判为显式 merge | 图中出现用户未创建的关系 | 必须要求同一步 marker + reference 精确配对；禁止仅折叠“第一条多引用” |
| 手写 Harness 声明可能随上游 API 漂移 | 编译通过但运行时能力缺失 | 更新 `types/deepseek-harness.d.ts`，启动时做 capability 检查，并由 Harness 集成测试钉住 |

## 测试策略

### 纯逻辑 Vitest

- 选择校验：2/3 成功；1/4、重复、Subagent、scope 外、已归档和空 instruction 失败。
- 工作流：Workspace 与 Directory create 参数；精确 candidate 匹配；mention 顺序；默认/自定义 instruction；rename、prompt、capture、open 的调用顺序。
- 每一阶段失败：create 前失败无目标；create 后失败保留同一个 `targetSessionId`；Retry 不重复创建；Open Target 始终可用。
- Projection fold：同一步 marker + 精确匹配的 2～3 来源 context 才成功；保存 `operationId` 与 `capturedThroughSeq`；marker-only、reference-only、错序、跨 step、来源不匹配、普通首条多引用、重复/恶意 payload 均 fail-soft。
- Graph：Merge target 保持独立 Cluster；多条 `kind: 'merge'` 入边；Branch children、Branch Lineage 和 Subagent Summary 不变；不可见来源不画悬空边。
- Layout：拓扑顺序、跨簇路径、单节点拖动、整簇拖动、折叠/展开、Reset 和 persisted arrangement。

### 真实 Harness 集成

- 创建两个来源和一个目标，经真实 Merge Remote 提交，断言目标日志同一步包含 marker、readable direct message、`session-reference` context，references/capture seq 正确，来源日志逐字节不变；再用普通 composer 提交同样两个 mentions，断言没有 merge projection。
- 断言 Merge Remote 在 projection cache 写入失败时不报告成功；成功后立即重建 Client/Host Context，再从冷 Session list 读取，证明无需等待模型完成也能跨 Web profile restart 恢复。
- 在 marker append 与 steer append 之间模拟失败/重启，并覆盖 retry，证明 orphan 不建边且会话仍可读取；另加守卫测试确保插件从不写 out-of-repo Session event type。
- 注入 source read failure、budget failure、candidate Remote failure、prompt rejection、rename failure 和 Agent error，断言 UI 显示阶段、原因、Retry 与 Open Target。
- React Harness 测试键盘/鼠标多选、2～3 上限、可编辑 instruction、禁用态、进度态、错误态、成功后打开，以及 Merge/Branch/Subagent 三种关系的 DOM 标识和线型。
- 最终运行 `pnpm run check` 与 `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness`。

## 推荐交付顺序

1. Merge marker/Projection + graph model/layout 纯逻辑（先让显式关系能正确派生和绘制）。
2. Host submit Remote、`mergeSessions` 工作流及逐阶段错误模型。
3. 显式多选 UI、instruction 编辑和重试面板。
4. Harness 冷启动/失败集成测试、README 与中英文 locale。

最终判断：**Issue #1 在现有 Harness 能力上可完整实现，不需要修改 Harness core。** 可靠区分的关键不是“折叠第一条 session-reference”，也不是新增插件 Session event，而是以 package-owned Host Remote 把自定义 MessageSource marker 和含规范 mentions 的 user message 编入同一步，再由 Projection 对 marker 与实际捕获记录做精确配对。真正的工程重点是把异步 capture 当成事务阶段、覆盖两次 inbox append 之间的微小故障窗口，以及让跨簇布局/折叠/拖动正确处理多入边。
