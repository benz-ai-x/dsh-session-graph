---
description: "研图：面向 DeepSeek Harness 的研究图谱插件，将 AI 讨论组织为研究主题、有出处的知识卡片和可继续沿用的研究材料。"
kind: "package-bundle"
---

# DSH Research Graph · 研图

[![CI](https://github.com/benz-ai-x/dsh-research-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/benz-ai-x/dsh-research-graph/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40benz-ai-x%2Fdsh-research-graph?logo=npm)](https://www.npmjs.com/package/@benz-ai-x/dsh-research-graph)
[![dsh-plugin](https://img.shields.io/badge/DeepSeek_Harness-dsh--plugin-4D6BFE)](https://github.com/topics/dsh-plugin)
[![GitHub release](https://img.shields.io/github/v/release/benz-ai-x/dsh-research-graph?logo=github)](https://github.com/benz-ai-x/dsh-research-graph/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

**在 DeepSeek Harness 中，将 AI 讨论沉淀为可追溯、可复用的研究知识。**

研图（Research Graph，`@benz-ai-x/dsh-research-graph`）为 DeepSeek Harness Web 对话视图添加交互式**研图**标签。将跨工作区的讨论组织为研究主题，保存有准确出处的知识卡片，审核 AI 提炼结果，并使用所选材料开始下一轮讨论。

画布同时保留 Session Lineage（会话谱系）、可移动的 Branch 会话簇、Merge 快照溯源和紧凑的 Subagent 摘要。可阅读讨论原文或按需生成 Session Digest（会话摘要），源会话日志保持原样。

<p align="center">
  <a href="docs/assets/research-graph/overview.png">
    <img src="https://raw.githubusercontent.com/benz-ai-x/dsh-research-graph/main/docs/assets/research-graph/overview.png" alt="DeepSeek Harness 研图，展示研究主题、讨论来源和知识卡片" width="100%" />
  </a>
</p>

<p align="center"><sub>从旧包升级后，使用合成研究数据渲染的真实研图界面。</sub></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@benz-ai-x/dsh-research-graph">npm</a> ·
  <a href="https://github.com/benz-ai-x/dsh-research-graph/releases">版本发布</a> ·
  <a href="https://github.com/benz-ai-x/dsh-research-graph/issues">问题反馈</a> ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

## 快速开始

```sh
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.5-rc.2.5
dsh web
```

若 `dsh web` 已在运行，请先停止再重启。打开命令打印的一次性认证 URL，进入任意非空 Session，然后选择 **研图**。不要分享或持久保存 URL 中的 token。

## 兼容性

| 插件发布 | DeepSeek Harness | Node.js | 验证方式 |
|---|---|---|---|
| `@benz-ai-x/dsh-research-graph@0.1.5-rc.2.5` | `0.1.5-rc.2` | `^22.19.0 || >=24.0.0` | 真实 Host/Client 类型检查、集成测试及打包 profile 验收 |
| `@benz-ai-x/dsh-research-graph@0.1.5-rc.2` | `0.1.5-rc.2` | `^22.19.0 || >=24.0.0` | 真实 Host/Client 类型检查、集成测试及打包 profile 验收 |
| `@benz-ai-x/dsh-research-graph@0.1.5-rc.1` | `0.1.5-rc.1` | `^22.19.0 || >=24.0.0` | 真实 Host/Client 类型检查、集成测试、打包 profile 与包名迁移验收 |
| 旧包：[`v0.1.5-rc.1`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.5-rc.1) | `0.1.5-rc.1` | `^22.19.0 || >=24.0.0` | 真实 Host/Client 类型检查、集成测试、打包 profile 启动与读写验证 |
| [`v0.1.5-alpha.1`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.5-alpha.1) | `0.1.5-alpha.1` | `^22.19.0 || >=24.0.0` | 真实 Host/Client 类型检查、集成测试、打包 profile 启动与读写验证 |
| [`v0.1.6`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.6) | `0.1.2-alpha.1`、`0.1.2-alpha.2`、`0.1.2-alpha.3` | `^22.19.0 || >=24.0.0` | CI、真实 Harness 集成、打包 profile 安装/移除 |
| [`v0.1.5`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.5) | `0.1.2-alpha.1`、`0.1.2-alpha.2` | `^22.19.0 || >=24.0.0` | CI、真实 Harness 集成、打包 profile 安装/移除 |

在与 DSH 对齐的发布线上，首次适配使用目标 DSH 的完整版本；针对同一 DSH 预发布版的后续插件发布追加一个正整数修订号。例如插件 `0.1.5-rc.2.1` 适配 DSH `0.1.5-rc.2`，下一次插件修订为 `0.1.5-rc.2.2`。直接 DSH 依赖继续固定为目标 DSH 版本。旧包为 `@benz-ai-x/dsh-client-ui-session-graph`，其历史标签与归档保留原名。研究工作流已随 `0.1.5-rc.1` 发布；`0.1.5-rc.2` 加入首轮 UI/UX 修复，包括草稿保护、直接选择材料和搜索范围恢复。`0.1.5-rc.2.1` 加入研究工作台、完整知识阅读与跨工作区汇聚。`0.1.5-rc.2.2` 修复会话摘要截断，加入可拖宽的 Markdown 阅读、就近留卡及范围栏中的图谱工具。`0.1.5-rc.2.3` 新增可编辑的会话标题建议，以及简短、突出关键信息的 Markdown 摘要。`0.1.5-rc.2.4` 统一各入口的已保存知识阅读，保留提炼批次编辑前的阅读位置，集中响应式阅读布局规则，并增强摘要高亮。`0.1.5-rc.2.5` 加入历史轮次分支、可编辑的发散提示、混合材料的审阅式综合与工作位置恢复，并修复快速拖动后的最终位置保存。验证与尚待验收的边界详见[发布验收记录](docs/reviews/release-0.1.5-rc.2.5.md)。已发布的 `0.1.5-alpha.1` 保留其原有功能。旧版 `v0.1.0`–`v0.1.6` 保留原标签；使用 DSH `0.1.2-alpha.1`–`alpha.3` 时仍应固定插件 `0.1.6`，新版源码不承诺旧宿主兼容性。不要仅按 npm `latest` 或插件版本号大小选择安装版本。

本预发布版本使用 npm `next` 标签，下方命令固定到与 DSH 匹配的精确版本。如需安装本地构建，请在本仓库运行 `pnpm install --frozen-lockfile`、`pnpm pack --pack-destination .artifacts`，再用 `dsh plugin --profile web add /绝对路径/插件归档.tgz` 安装。

## 研究工作台

进入 **研图** 后，在 **图谱 / 知识库** 之间切换。图谱用于整理关系与发散思路；知识库提供知识目录、完整正文、准确来源和后续研究。**研究范围 → 跨工作区主题** 可把同一 Host 的资料放在一起，知识库也可查看此 Host 的全部知识。

在主题中切换图谱与知识库，会保留选中的知识卡片、显示修订、展开来源、阅读滚动位置和已有画布位置。切换另一张卡片会从开头阅读。保存状态与“待核实 / 你已确认”分开展示。卡片的**继续讨论**直接带入当前展示的修订，**编辑卡片**直接编辑这一版本并另存新修订。阅读旧版本时，导出按钮明确标为“导出最新版本”；导出预览会列出实际版本。

搜索结果、**查看知识**以及人工创建或提炼后保存的卡片共用同一阅读器，展示所选修订的保存时间、准确来源，以及卡片各修订的后续讨论和对应版本。后续研究会明确显示加载与失败状态，失败时可重试。放弃原位编辑后，会返回同一修订、展开来源和阅读位置。在提炼批次中取消编辑，也会恢复该批次的阅读位置和焦点，并保留其他草稿。

主题图按依赖关系分层排列来源、知识与后续讨论，保留 Branch 簇和人工排列；选中知识时突出它的直接来源及后续研究。主题图用来源线连接讨论与知识，用“已沿用”线连接知识与后续讨论。只有 Host 已确认接收的沿用才绘制关系；新讨论不必先加入主题成员。卡片后来修改不会改写当时使用的版本，点击后续研究可核对固定材料并打开目标会话。

讨论与知识正文使用 DSH 的 Markdown 排版，支持标题、列表、引用、表格和代码。详情可**展开阅读**，标题、版本或原文切换与底部操作保持可见，仅正文滚动；展开状态与原文位置可在返回时恢复。原文允许正常选择、复制文本。范围与工作区 / 主题选择合为一条上下文栏；主题名旁的**主题选项**提供新建、重命名与说明。窄容器下，汇聚会话与新建卡片收进**更多**。研究范围栏右侧集中放置输入会话、缩放、适应和定位，**图谱选项**提供重新布局、重置布局、关系图例，以及主题的刷新来源和导出；只有排列尚未保存时显示保存提示。展开或拖宽阅读面板时，工具条仍可操作。适应、定位、工具缩放与 100% 复位共用可见画布中心；滚轮缩放仍以指针位置为中心。图谱选项向下展开；窄容器依次将适应 / 定位、缩放收进菜单，连续缩放时菜单保持打开。「输入会话 · 会话名」标明输入框所属会话，长名称可悬停查看完整提示，选择图中其他内容不会切换发送对象。

首轮正式实现见[工作台验收记录](docs/reviews/research-workbench-acceptance.md)；阅读与留卡优化见[阅读体验验收](docs/reviews/reading-ux-round.md)，共享阅读器与几何模块的验证和截图见[统一阅读与几何协同验收](docs/reviews/reading-geometry.md)。

拖动阅读面板左侧边缘，向左加宽、向右收窄。宽度按研究范围保存在本机，展开后再收起会返回你调整的宽度。聚焦边缘后可用左右键调节（Shift 加大步长），Home / End 调至最窄 / 最宽；Enter 或双击恢复默认，拖动时按 Esc 撤销。小屏保持完整宽度阅读并隐藏拖动手柄。

面板尺寸以研究容器宽度为准。容器不超过 760 px 时，面板覆盖画布，图谱命令使用完整画布中心；更宽时，为面板实际宽度预留空间。打开、展开或拖宽面板会保留画布位置，下一次适应、定位或工具缩放使用当前可用区域。

## 知识卡片

在 **研图 → 原文** 中，每个完成轮次的开头和末尾都有**保存为知识**入口；也可勾选连续轮次后点击**保存为知识卡片**。原文会预填可编辑的标题、问题和结论；载入较慢时不会覆盖你已输入或主动清空的字段。默认只展示标题和结论，其余内容按需展开，来源以讨论标题和轮次展示。超过 24,000 字符的初稿会明确标为节选，完整所选来源仍随保存保留。点击**保存知识**创建卡片，归属主题在可选字段中设置；从原文留卡成功后会回到原阅读位置，并显示卡片标题与**查看知识**入口。保存不等于事实已核实。人工创建不调用模型、不修改源会话。

主题图用独立的来源关系连接卡片与原讨论。打开卡片可查看各个已保存修订、阅读保留的摘录，并回读准确的原文轮次；原文不可用时会明确标为摘录。编辑会追加不可变修订；保存失败保留输入，重试不会重复创建卡片，关闭卡片、Esc 和放弃编辑都会在丢失未保存内容前询问，包括生成的草稿；选择“继续编辑”保留当前表单。保存进行中需等待完成后关闭。确认放弃编辑后恢复已保存内容。草稿暂存于当前界面，不会自动写入 Host。

从首页进入**知识库**或**更多 → 知识卡片**，也可在**搜索讨论与知识**中切换内容按钮，按标题或正文检索当前 Host 全部知识或所选主题。卡片归属不由来源目录推断。移出主题保留内容、修订和来源，可搜索后重新加入。卡片保存在 Host，清理浏览器缓存或重启 Host 后仍可恢复；重置与重新布局仅改变展示。每次保存最多 32 个来源、4 MB 来源文本 JSON，超限时需缩小选区。

图谱范围变化时，搜索会恢复新范围保存的内容类型与条件，没有记录则使用默认值。即使从**知识卡片**入口打开，返回原范围也会恢复该范围的上次选择。

从来源阅读器再次创建卡片或提炼知识，会打开独立编辑层；关闭后返回原卡片或草稿，保留已有编辑。

首页提供“新建知识卡片”入口。编辑时标题必填，问题、理由、类型与状态按需展开；保存栏在滚动时保持可见。主题工具栏集中展示选择与排列同步状态，新建、重命名按需展开。工作区图排列自动保留在本机，主题排列点击“保存排列”后同步到 Host。单节点簇只展示节点，长标题最多显示两行。

交互和窄窗口验证见[首轮 UI/UX 修复记录与截图](docs/reviews/ux-round-1.md)。

## 从历史轮次分支

在工作区、目录或主题的原文阅读器中，对已完成轮次点击**从此处分支**，先核对新讨论的简短标题及实际继承范围，再确认创建。例如原讨论有五轮，从第 2 轮分支只继承第 1–2 轮，原五轮保持完整。新分支使用来源工作区；从主题发起时自动加入该主题，保留真实父子关系。新分支激活前会清空继承的待处理输入，继续讨论时只执行你新输入的问题。切点缺失或已改变时需重新预览。关闭后重开同一切点可恢复同一目标，命名或主题关联失败也只重试该目标；**另建一个分支**才开始另一项创建。宿主确认子会话已创建后，即使工作区关联、命名或主题关联仍需恢复，也可以直接打开；重试会为同一目标完成剩余步骤。主题刷新会保留图谱，返回时焦点仍在原轮次。

## 对照与综合

进入主题的**图谱选项 → 对照与综合**，选择 2–3 项已保存卡片修订或连续完整原文轮次，可混合使用。预览冻结全部纳入正文，标明 32,000 字符消息预算。重复卡片、重叠范围、缺失或未完成原文、超预算材料会明确拒绝，请调整选择后再生成。卡片只带对应修订的正文和来源说明，讨论原文需要另行选择。

生成内容包含共识、分歧、条件与依据、待研究问题。逐条编辑观点及引用原句；无效生成引用会被移除并提示，无引用观点保留为待验证。再次生成会追加草稿，保留已有修改。人工确认保存为当前主题内的独立知识卡片，状态默认为草稿。有效卡片引用建立**综合自**关系，图中标明来源卡片数量，连线提示与来源阅读器可核对冻结修订；来源更新或 Host 重启后，阅读、版本、搜索、Markdown 导出及继续讨论仍保留冻结材料。来源卡片链接打开引用时的修订，原文链接明确区分可核对的原文与保留摘录。冻结的原文范围始终按保存内容展示，**核对当前原文**会另行打开原文阅读器。若保存已成功但响应丢失，修改草稿后重试会为同一综合卡片追加修订。生成文字在保存前留于当前界面；带未保存编辑关闭时会先提示确认。

## AI 提炼与审核

在原文中选择已完成轮次，点击**提炼知识**。先按会话标题、轮次与用户/助手角色预览实际纳入材料；展开“查看完整发送文本”可核对未经改写的模型输入。字符预算只纳入完整轮次，并列出省略范围。确认提供方和模型后生成草稿，逐条审核问题、结论、适用条件和待验证事项，修改文字与引用后再保存。无效引用不会进入来源，无引用草稿会标为待验证；有效出处不代表推论正确，也不代表核查过原始工具证据。

生成可取消，再次生成会追加一组草稿，保留已有编辑。提炼来源快照在 Host 重启后仍有效，打开中的草稿可继续保存相同引用；生成文字本身在保存前仅保留于当前界面。每次最多生成 5 张草稿，输出上限 4,096 token，使用配置中的超时限制。

完整研究流程及证据边界见[批次验收与浏览器截图](docs/reviews/issues-6-10-acceptance.md)和[真实模型定性审核记录](docs/reviews/issues-6-10-model-quality.md)。

## 选择材料开始新讨论

在卡片中点击**继续讨论**，或把已保存的卡片修订、连续完整的已完成轮次范围加入**更多 → 材料**。也可以在**材料 → 选择材料**中直接选择卡片修订或原文轮次，保留已经填写的问题。支持 1–3 项，可排序、移除，输入新问题并明确选择目标工作区。**预览发送内容**按问题、材料正文和卡片修订展示，标明 32,000 字符总预算；展开“查看完整发送文本”可核对确认后实际发送的完整内容。仅选卡片只带卡片内容和来源说明，原文需要另行选择；超预算材料或包含 Harness 会话引用指令的文字需要编辑或移除后再发送。

可选的**找反例 / 其他方案 / 改变假设 / 继续追问**会填入可编辑的问题。已有文字会先保留，只有明确选择替换或追加才改变；改变假设提供原假设和新假设的自由填写位置。选择提示、编辑、关闭都不会创建会话或调用模型，仍需核对材料预览并明确确认。

提交响应丢失时，材料保持锁定，研图会向 Host 核对目标记录。可点击**核对目标状态**或重新打开材料重查；重试始终复用同一次提交。关闭弹窗后，迟到响应不会触发导航。

若目标创建成功但沿用日志保存失败，研图会直接核对预留会话，保留打开和重试入口。状态核对失败时材料继续锁定；存储恢复后重试仍使用同一目标和消息。

确认后创建独立 Session，并通过 Harness 原生接口发送固定预览。成功后保留在工作台，可继续整理材料，或明确点击**打开目标会话**查看回答。创建失败保留材料；目标已建立但发送失败时，可以打开或重试相同目标与消息身份。**已发送**只表示 Host 确认接收，模型回答状态在会话中查看。新会话研图中的**本会话所用材料**可在来源更新、清理浏览器缓存或 Host 重启后核对原版本、原文范围及沿用关系，不改变来源的工作区归属和目录。

## 核心能力

| 能力 | 你可以获得 |
|---|---|
| 可视化 Session Graph | 在同一视图查看 Branch Lineage、Merge 溯源、Session Cluster 与折叠的 Subagent 活动 |
| 交互式画布 | 拖动、吸附、折叠、过滤、缩放、平移、适应、重新布局、重置、定位与 minimap |
| 跨会话工作流 | 打开任意 Canvas Session、创建 Branch，并汇聚两到三个来源的不可变快照 |
| 讨论原文 | 在 Inspector 按轮次阅读用户/助手文本，选择连续完成轮次，并复核精确来源 |
| 研究主题 | 跨工作区收集会话引用、保留归档资料，并为每个主题保存独立排列 |
| 只读 Session Digest | 按需生成简短概览、关键结论和待办，且不改变 Session 日志 |

原文分页、来源恢复、运行中轮次与会话导航的实际操作见[浏览器验收记录与截图](docs/reviews/pr-14-ui-acceptance.md)。

### 数据与模型行为

| 操作 | 持久化影响 | 模型调用 |
|---|---|---|
| 浏览或排列工作区／目录图 | 不改变 Session 日志；排列保存在浏览器存储中 | 无 |
| 整理研究主题 | 名称、会话引用和显式保存的排列写入 Host 存储；源会话保持不变 | 无 |
| 阅读或选择原文 | 仅在阅读面板打开期间保留选择与备用摘录；不改变 Session 日志 | 无 |
| 生成／应用标题 | 建议仅临时展示；应用才保存原生用户标题事件 | 仅生成时发起一次辅助请求 |
| 生成摘要 | 仅保留按 revision 区分的 Host 内存缓存；不追加消息 | 在 Session 路由或配置的兜底路由上发起一次辅助请求；完整输出过长时压缩重试一次 |
| 创建分支 | 使用 Harness 的常规 Branch 操作 | 本插件不额外发起请求 |
| 从历史轮次分支 | 预留一个原生子会话身份，继承所选完整前缀；重试恢复同一子会话 | 继续输入新问题前无调用 |
| 对照与综合 | 冻结 2–3 项材料；明确保存才创建带已审核引用的新卡片 | 每次生成发起一次辅助请求，输出上限 8,192 token |
| 汇聚会话 | 创建独立目标和持久快照溯源；来源保持不变 | 目标会话在正常路由上处理排队指令 |

## 安装

从 npm 安装已发布的包，并将其加入 `web` profile：

```sh
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.5-rc.2.5
```

确认解析后的 profile 已包含该组合包：

```sh
dsh --profile web --dump-config
```

输出应包含 `name: '@benz-ai-x/dsh-research-graph'`。

### 从旧包名升级

产品现名为 **DSH Research Graph · 研图**，仓库为 `benz-ai-x/dsh-research-graph`。npm 包名现为 `@benz-ai-x/dsh-research-graph`。如果 web profile 已安装 `@benz-ai-x/dsh-client-ui-session-graph`，先停止该 profile，再执行：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.5-rc.2.5
dsh web
```

继续使用同一个 profile 并保留其数据目录。改名保留研究主题、知识卡片、材料沿用记录和画布位置的存储身份。若有自定义插件设置，重装后在原 `ui-session-graph` patch ID 下恢复；同一 profile 只安装一个包名。

已发布的 `v0.1.5-rc.1` 及更早 Git 标签保留当时的包名。本轮包名迁移请使用上面的 npm 包，或将当前源码打成本地归档安装。

本包同时包含浏览器插件与 `cordis.patch.yml` 组合包补丁。dsh 插件管理器会把它插入 `web` profile 已提供的 Session、Workspace、locale、renderer 与 conversation 插件之后，无需手工修改 `cordis.yml`。

使用以下命令移除：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-research-graph
```

安装或移除后请重启目标 `web` profile。运行中的进程不会监视 profile 依赖列表。

Session、LLM 和浏览器运行时服务仍由所选 dsh profile 持有。插件显式声明 Typert 协议依赖，LLM 使用与 DSH 同版本的 peer dependency；离线恢复命令会打包所需格式目录与库，宿主尚未启动时也可使用；直接引用的所有 `@deepseek-ai/dsh-*` 包均锁定到目标 DSH 版本（插件 `0.1.5-rc.2.5` 对应 DSH `0.1.5-rc.2`）。

## 使用图谱

打开一个非空会话，在标准对话标签旁选择 **研图**。Viewed Session（当前查看会话）会优先解析命名 Workspace Scope（工作区范围），匹配不到时退化为 Directory Scope（目录范围）。

- 单击选择 Selected Session（选中会话）并持续强调其 Branch Lineage；可关闭的详情检查器可打开该会话或创建 Branch，并在 Harness 拒绝请求时显示错误。单击画布空白处或按 Escape 可清除选择。
- 双击会在该会话上次使用的视图中打开它。
- 在其他 Canvas Session 上停留可查看紧凑预览，不会替换 Selected Session 检查器。
- 拖动节点或整个簇框来排列画布；对齐参考线会吸附临近卡片边缘。快速拖动后重新打开图谱，也会保留松手时的最终位置。
- Session Arrangement 持久化采用 fail-soft 策略。浏览器存储不可用、被拒绝、损坏或空间耗尽时，实时图谱仍会使用自动几何继续渲染。
- 小圆点表示关系连接位置，不是拖动手柄；Branch 使用中性色带方向实线，Merge Relation 使用品牌色带方向实线，Subagent Derivation 使用虚线。
- 工作区和研究主题都按依赖关系排列：相关来源保持同排，共同结果位于下方，独立资料另行排放。Branch 簇保留树形结构，并预留折叠所需空间。圆角连线会避开卡片和簇标题，使用分开的端口和箭头；拖动、折叠后重新绕线，“适应”也会包含外侧路线和标签。
- **图谱选项 → 重新布局**清除手动节点位置和簇偏移，保留折叠及阅读状态。**撤销重新布局**可恢复上一次排列，直到后续拖动、折叠、重置或切换范围；连续点击重新布局仍保留有效撤销。主题排列仍需点击**保存排列**才会通过 Host 共享。
- 使用滚轮缩放、背景拖动平移、适应、100%、重新布局、重置、定位 Viewed Session（当前查看会话）或 minimap。内容离开可视范围时才显示 minimap；容器尺寸变化会保留当前内容中心与缩放比例。
- 按标题过滤；Enter 居中第一个匹配项，Escape 清空过滤条件。
- 悬停节点或边会强调对应的 Branch Lineage（分支谱系）。
- 查看页头徽标可确认包版本与当前本地 Build ID；悬停可查看完整包身份。

画布获得焦点时可使用键盘快捷键：`+` 和 `-` 缩放，`0` 恢复 100%，`1` 适应图谱。

## 导出 Markdown 研究成果

在已保存卡片或研究主题中选择**导出 Markdown**，勾选 1–50 张卡片，再点击**预览 Markdown**。Host 会读取所选卡片最新的已保存修订，并固定内容和准确来源范围。**下载 Markdown**写入与预览逐字一致的内容；之后的编辑只有重新预览才会纳入。未保存编辑不进入文件，打开或关闭导出不会丢失当前卡片或提炼编辑器。

文件可独立阅读，包含核心问题、结论、理由、待验证事项、类型与状态、修订身份和时间、带会话身份/标题/时间的原文摘录及来源关系清单。原文缺失或无法读取、范围不完整、原文与保存来源不同均明确标记；摘录仅覆盖所选范围。中文、多行和嵌入代码围栏按原样保留。导出不调用模型、不修改来源记录。文件最多 8 MB，失败后保留选择，可重试。

## 返回上次工作位置

重开 研图会恢复平移、缩放、排列、选中资料及仍有效的原文页和滚动位置。重开搜索时恢复条件并重新查询 Host，不缓存旧搜索结果。失效资料会清空选择并显示可关闭的提示，保留有效视口；移出最后一张卡后，空主题也会清理失效选择。失效主题会返回主题列表。

知识卡片带入主题的来源节点也会恢复上次有效的原文位置。阅读长来源或复核选区时会记住起止边界，重开不会缩短为普通一页。在卡片内点击来源时，仍精确打开该修订保存的范围。主题原文恢复遇到连接失败时，可继续阅读保留摘录；重试核验原文成功后才恢复已保存的滚动位置。

界面状态保存在同一浏览器，按持久 Host 身份、Workspace 身份（同目录也隔离）或目录范围、主题身份分别存储。新 Viewed Session 仍按自身范围打开，需明确选择**跨工作区主题**才恢复上次主题。重置和重新布局保留原有语义，不删除知识、来源或沿用记录。清理浏览器存储会丢失工作位置和未保存排列，Host 中的记录仍可读取。旧版未绑定 Host 身份的排列保留原样，不会自动归给当前 Host。

## 整理研究主题

在研图的**研究范围**中选择**跨工作区主题**，创建并命名主题。在选中会话的详情或搜索结果的原文面板中，选择**加入研究主题**，再选择主题并加入资料；也可以在选择面板中新建主题。同一 Host 内可跨工作区收集会话，同一会话可加入多个主题。

创建失败后重试会恢复同一个主题。如果重试前修改了名称，只有新名称也保存成功后才会清空输入；再次失败仍保留输入，可继续重试。

主题图显示标题和来源工作区，保留归档资料和已不可用来源的引用。Session 之间的关系线来自已确认的 Branch 和 Merge；知识卡片另外通过来源关系连接所保留的讨论来源。单击节点查看来源信息，点击**阅读原文**才加载讨论，点击**打开会话**才导航到已列出且未归档的来源。归档资料仍可在此阅读原文；匹配 Harness 不保留对归档会话的导航选择，因此禁用其会话打开入口。移出资料只影响当前主题，不删除、移动、归档、分支或汇聚源会话，也不向模型发送上下文。

拖动节点或簇、折叠、重新布局或重置后，点击**保存排列**。每个主题在 Host 中独立保存排列；重置不会删除资料关联。未保存的排列在同一浏览器重开主题后也会恢复；点击保存排列后才通过 Host 与其他客户端共享。保存失败会保留输入，支持重试。名称、关联和已保存排列会在 Host 重启后恢复，并由连接到该 Host 的客户端共享；多端同时修改同一主题排列时，以最后一次成功保存为准。

切换主题只读取会话头和已有元数据，不会加载全部原文。已列出的来源仍可能在打开原文时读取失败；阅读器会提示失败或不可用，并提供重试。切换主题、关闭视图或取消读取后，迟到响应不会覆盖当前结果。普通工作区／目录图的 Canvas Session 资格保持原有规则。

跨工作区选材、独立排列、来源恢复、重启持久化及 1,000 条引用基线见[研究主题验收记录与截图](docs/reviews/issue-5-ui-acceptance.md)。

## 搜索历史讨论

点击 研图页头的「搜索正文」，输入词句，选择工作区、Viewed Session 所在目录或当前 Host 的全部会话。「包含归档」允许只读检索归档来源，不会取消归档或让其出现在画布中。现有标题过滤仍独立强调 Canvas Session。

结果展示会话标题、工作区或目录、消息时间和片段，每个会话返回已完成用户/助手讨论中最近的一处命中，按时间倒序排列。点击结果，在搜索 Inspector 核对准确轮次；命中消息有标记，可继续加载更早、更晚的讨论。只有「打开会话」才切换 Viewed Session，暂不定位原生聊天的滚动位置。

搜索复用 Harness 的词语/短语索引，保留其标点与重音匹配规则：「foo bar」能命中「foo-bar」，「cafe」能命中「café」。含汉字的短语也遵循这些规则，例如「修复 foo bar」能命中「修复 foo-bar」。含汉字的查询还会在所选范围内核验原文子串，因此「知识卡片」能命中标题不同、正文含「通过知识卡片整理研究资料」的会话。不检索附件、工具、思考过程、插件上下文和未完成讨论。首次建立索引和跨大量会话的中文核验可能较慢，可以取消或缩小范围。

「加载更多结果」接着同一份结果快照翻页。修改词句、范围或归档选项会清空结果并取消请求，迟到响应不会覆盖新查询；搜索和翻页失败均可重试，结果过期时提示重新搜索。片段保留检索时的文字，Inspector 会重新读取原文。搜索不调用模型，也不写入源会话。

Viewed Session 的图范围身份变化时（例如目录变为具名工作区，或 Viewed Workspace 消失），搜索恢复新范围保存的条件；没有保存条件时使用默认值。原范围的关键词仍保存在原范围下。如果只是搜索中显式选择的工作区消失，而图范围没有变化，则取消待处理搜索、清空结果并回退到可用范围，同时保留当前关键词。

中文命中、准确轮次、归档阅读、翻页、重试和取消的实际操作见[正文搜索浏览器验收记录与截图](docs/reviews/pr-15-ui-acceptance.md)。

<a id="enable-discussion-search"></a>
### 启用讨论搜索

DSH `0.1.5-rc.2` 默认关闭全文索引。若提示「全文索引尚未启用」，在当前 profile 的 `cordis.patch.yml` 中加入以下覆盖项（web profile 位于 `$DSH_HOME/profiles/web/cordis.patch.yml`）：

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

保留文件里的其他条目。这会替换该行的整个配置，所以两个键都需要填写。重启 Host 后重新搜索。内存索引会在每次重启后重建；需要持久索引时，可把 `path` 改成可写的绝对文件路径。也可把片段存为 `search.patch.yml`，通过 `dsh --profile web --patch /绝对路径/search.patch.yml` 临时启用。准备中、未启用、失败和无结果分别有明确提示。

## 阅读讨论原文

点选 Canvas Session，在会话详情中切换到「原文」，默认展示最近十轮讨论。通过「加载更早的讨论」「加载更晚的讨论」翻到相邻页；没有对应内容时按钮禁用。方向键和 Home/End 也可切换详情标签。

- 已完成轮次展示直接用户文本与助手文本，并标明角色。未完成轮次显示状态，完成后点击「刷新原文」即可选择。不包含附件、工具结果、思考过程或插件注入的上下文。
- 勾选一轮，再勾选另一轮可选择连续范围，包括已加载的前后页。中间有缺口时，先加载缺失轮次；再次点击已选轮次或「清除选择」可清空范围。
- 「复核所选原文」重新读取该精确范围。来源由 Session 身份和事件边界确定，重复标题、相同句子以及后续新增轮次不会改变它。原文可读时优先展示实际原文。
- 「仅存摘录」表示暂时无法读取原文，展示本次选择时保留的文本；重试期间和连接失败后会持续显示此标记，直到重新读到原文。「来源不可用」表示原文与备用摘录均不可展示。来源身份始终可核对，可「重试读取」。可读但没有讨论的会话另有空状态。
- 可取消读取。关闭详情、切换会话或离开原文标签会取消未完成请求，迟到响应不会覆盖新选择。阅读不会改变 Viewed Session；点击「打开会话」才进入 Harness 继续工作，该操作暂不滚动到原生聊天的指定轮次。

阅读器中的选择和摘录仅临时保留：关闭面板、切换到摘要或其他会话、刷新页面都会清除。需要持久保留所选来源时，明确点击**保存为知识卡片**写入卡片修订；工作位置恢复会重新查询原文，恢复阅读位置。阅读、选择、刷新和重试不调用模型，也不写入源会话。

分页限制的是浏览器展示内容；Host 每次仍通过宿主读取单个会话的完整快照，暂不支持底层日志文件分页，因此特别大的单个会话仍可能读取较慢。

## 汇聚会话

点击工作台页头的**汇聚会话**，按来源工作区或标题筛选，依次选择 2–3 个会话。筛选切换和关闭面板会保留本次选择。输入汇聚问题，明确选择目标工作区，再预览并确认；可将 A / B 的讨论放入 A、B 或独立研究空间。

预览展示所选会话、工作区、问题与目标位置；实际讨论快照在确认时读取，长会话受 Harness 上下文预算限制。来源的文件、工具结果和运行环境不会被合并。若当前已选择主题，成功后会把来源和目标加入该主题；关联失败只重试关联，不重复提交汇聚。

画布工具栏保留**汇聚所选会话**，按卡片编号选择两三个来源；此快捷入口沿用同工作区 / 目录的规则。

- 来源必须互不重复，且为同一 Host 中非空、未归档、非 Subagent 的会话。跨工作区汇聚必须明确指定可用的目标工作区。
- 汇聚指令不能包含 `dsh-session:` 引用，因为 Harness 会把这种引用保留给精确的来源快照集合。
- Harness 会创建一个独立目标 Session，以来源标题命名，并在不可变的事件边界捕获每个来源。来源会话及其已有 Branch Lineage 都不会被修改。
- 提交时 Host 会重新检查目标与每个来源，不信任浏览器元数据。它校验目标的实际工作区成员身份、目录与来源资格，只接受没有父 Session 的空白目标或来源顺序完全一致的重试目标。未指定目标工作区的旧入口继续要求同目录。
- 目标会话的正常 agent loop 会收到编辑后的指令和 Harness 规范 Session 引用。本功能不会另选“摘要模型”；队列请求被处理时，目标会话使用其正常配置的模型路由。
- Merge Session 始终属于自己的 Session Cluster。品牌色 Merge Relation 只表达来自各来源簇的溯源关系，不会把来源变成父会话。
- 选中 Merge Session 后，Session Inspector 会列出来源标题及快照边界。汇聚溯源由目标日志投影，并写入 Harness 的持久 Projection Cache，因此重启与冷日志重放后仍能恢复。
- 若目标创建成功，但命名、快照提交、持久化或打开失败，目标会被保留。“重试”会复用该目标，不会重复创建；上一次尝试延迟完成的快照仅在有序来源集合完全一致时才会被接受。Host 一旦开始把匹配捕获提交到持久投影存储，关闭视图也不会再取消该提交。也可以直接点击“打开目标会话”恢复处理。

提交前可以取消来源选择。提交开始后，控件会锁定到成功或产生可恢复错误为止；离开该视图仍会中止浏览器请求。Host 等待快照也有时间上限，超时会作为可重试的快照提交失败呈现。

## 恢复旧版 Merge 会话

旧插件写入的 `session-graph-merge` 消息来源会被 DSH `0.1.5-alpha.1` 的 V0/V1/V2 日志迁移拒绝，导致该会话正文无法读取。新 Merge 使用宿主标准 `plugin` 来源，升级插件不会自动修复已有文件。

在本仓库安装依赖后，对明确选定的历史文件运行恢复工具。第一条仅校验，第二条在已存在的输出目录生成独立 V3 文件：

```sh
node scripts/migrate-merge-history.mjs --input /path/session.v2.jsonl.zstd
node scripts/migrate-merge-history.mjs --input /path/session.v2.jsonl.zstd --output /separate/recovered/session.v3.jsonl.zstd
```

工具支持明文 JSONL、`.zst` 和 `.zstd`；仅转换本插件可识别的旧标记，并通过 DSH 官方完整格式迁移及当前格式校验。原文件保持不变，已有输出文件不会被覆盖。默认输入及解压后数据上限为 128 MiB，可用 `--max-bytes` 调整；无法识别的字段、损坏或截断数据会被拒绝。已是 V3 或没有旧标记的会话应使用 DSH 正常读取/迁移流程。

若要让宿主使用恢复文件，先停止 DSH，再将验证后的文件以 `session.v3.jsonl` 或 `session.v3.jsonl.zstd` 放入**该会话原有目录**并保留原文件；若已有 V3 文件，先核查冲突，不能直接覆盖。工具只生成文件，不扫描或替换真实会话。安装包提供 `dsh-research-graph-migrate` 命令，并保留 `dsh-session-graph-migrate` 作为兼容别名。

## 生成会话摘要

选择任意非空 Canvas Session，在 Session Inspector（会话检查器）中点击“生成摘要”。摘要绝不会自动生成，生成期间也不会禁用“打开会话”或“开新分支”。

- Host 会检查准确的 Selected Session，即使它并非 Viewed Session。输入只保留用户直接发送的消息与 assistant 最终文本，排除推理过程、工具结果和插件注入上下文。
- 模型输入上限为 32 KiB。长会话优先保留最初用户目标、最近一次 compaction checkpoint，以及容量允许的最近对话。
- 辅助请求不开放工具，要求一句概览、最多五条关键结论和三条待处理事项。要点以无序列表呈现，使用安全 Markdown 渲染，支持**关键词高亮**、行内代码、强调和有来源依据的链接。加粗重点使用暖黄色荧光笔底色和更明确的底边，随 DSH 浅色／深色主题调整，换行后继续高亮；已有摘要无需重新生成即可使用新样式。提示词以中文约 200–350 字或英文 100–160 词为目标，并校验单条长度与总计 1,000 字符上限；不会截断句子或 Markdown。它优先使用会话日志中最近记录的 provider/model 路由；可选配置仅作为兜底。
- 会话运行中生成的结果标记为“运行中快照”。后续新活动会把可见摘要标记为“会话有新内容”，但不会隐藏旧内容；点击“更新摘要”即可替换。
- 成功结果按 Session 与源 revision 缓存在 Host 内存中。“重新生成”会绕过缓存；空内容或失败不会被当作成功摘要缓存，可继续重试。
- 同一 revision 的并发请求只执行一次模型调用，但各调用方的取消互不连带。插件关闭时会停止接收新摘要、取消自有工作，并等待已接收请求全部结束后再移除服务。

每次明确生成会进行一次额外模型请求；仅在完整摘要过长时最多再压缩一次，可能产生所选 provider 的常规费用。摘要文本只是只读投影：它不是对话消息，不进入 Session 日志，也不改变 Session Lineage。

工作区／目录图，以及来源可用的研究主题详情中，会话身份旁新增**生成标题**。它根据所选会话的讨论生成短标题，先展示可编辑建议，再由**应用标题**调用 DSH 原生重命名，侧栏、图谱和会话标题同步更新。生成、取消或关闭建议不会改名、跳转、打开 Agent 或追加对话正文；应用才写入原生用户标题事件，并防止后续自动标题覆盖。空会话不调用模型，不可用／归档的主题来源保持只读；应用前复查当前标题，保存失败保留编辑，回包丢失时可由会话列表的已更新标题确认结果。标题使用与摘要相同的内容预算、会话模型路由／兜底、超时和输出预算，属于独立的明确触发请求。

大多数会话无需配置路由，因为日志已记录模型路由。对于没有路由的旧会话或导入会话，可在 profile 的 `cordis.patch.yml` 中覆盖已安装插件条目（web profile 位于 `$DSH_HOME/profiles/web/cordis.patch.yml`）。若文件只有空数组 `[]`，用下方列表替换；已有列表则加入这一项：

```yaml
- id: ui-session-graph
  config:
    provider: deepseek-official
    model: deepseek-v4-flash
    maxOutputTokens: 4096
    timeoutMs: 60000
```

`provider` 与 `model` 必须成对提供，并且绝不会覆盖会话已记录的路由。`maxOutputTokens` 默认为 `4096`，`timeoutMs` 默认为 `60000`。插件激活会通过对外导出的 Standard Schema 校验配置，并拒绝空白路由、缺少配对字段、非整数与非正数限制。

输出上限为推理和结构化摘要留出空间；部分模型会将推理计入同一预算。用户显式设置的较低上限仍然生效。插件保留模型的默认推理设置。只有完整但过长的摘要会自动压缩重试一次；传输失败、无效 JSON 或 token 上限导致的失败不会自动重试。触及上限时界面会明确提示，可在此覆盖项中调高 `maxOutputTokens` 后重试；被截断的内容不会进入成功缓存，刷新失败会保留上一份完整摘要。

## 故障排查

| 现象 | 首先检查 |
|---|---|
| 找不到 **研图** 标签 | 重启 `dsh web`，打开非空 Session，并确认 `dsh --profile web --dump-config` 中存在本包 |
| Host 在 Remote error 导出附近启动失败 | 按兼容表安装与 DSH 匹配的插件，并确认解析后的 profile 没有保留旧包版本 |
| GitHub 源码安装报告 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` | 检查固定版本源码，把 dsh 打印的完整键加入该 profile 的 `allowBuilds`，然后重试 |
| 生成摘要时报告没有模型路由 | 使用日志中带路由的 Session，或配置 `provider` 与 `model` 兜底字段对 |
| 摘要达到生成上限 | 在当前 profile 的 `cordis.patch.yml` 中为 `ui-session-graph` 调高 `maxOutputTokens`，再重试 |
| Web URL 拒绝访问 | 打开 `dsh web` 打印的完整认证 URL；不要复用或分享被截掉 token 的地址 |

若问题仍然存在，请在 [GitHub Issue](https://github.com/benz-ai-x/dsh-research-graph/issues/new) 中附上 研图页头显示的包版本、Harness 版本以及相关 Host/浏览器错误。

## 开发与贡献

环境要求为 Node.js `^22.19.0 || >=24.0.0` 与 pnpm `11.7.0`。

```sh
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` 会检查独立包的类型、构建 Host 与浏览器入口，并运行包内测试套件。若要对已准备好的 DeepSeek Harness checkout 运行 Host 与完整交互集成测试套件：

```sh
pnpm --dir /path/to/deepseek-harness run build:native-system
pnpm --dir /path/to/deepseek-harness run build:lib
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness
```

修改 Session、Merge、Digest 或持久化行为前，请先阅读 [`CONTEXT.md`](CONTEXT.md) 的领域模型与 [`docs/adr/`](docs/adr/) 的持久设计决策。安装方式或产品行为变化时必须同时更新本文与 [`README.md`](README.md)。面向用户的工作应从 [GitHub Issue](https://github.com/benz-ai-x/dsh-research-graph/issues) 开始。

`check:harness` 要求宿主版本与 `package.json` 中 `peerDependencies["@deepseek-ai/dsh-llm"]` 固定的目标版本一致。它用该 checkout 构建的真实公开声明检查 Host/Client 源码及打包声明，不加载独立测试用的宿主声明替身；随后运行真实 Session、持久化、历史恢复与 UI 集成测试。CI 在 Node.js 22.19、24 与 26 上运行独立检查，并根据校验后的 DSH peer 依赖选择 `dsh-v<dsh-version>`，不受插件修订号影响。打包验收在临时 `web` profile 中安装归档、启动真实 Host、验证 Merge 持久化及 Digest/History 只读行为，再移除插件。History 读取还经过与浏览器相同的 RPC Gateway，覆盖传输层提供的取消信号；仅模型传输使用固定响应。

使用以下命令构建可安装归档：

```sh
pnpm pack --pack-destination .artifacts
pnpm --dir /path/to/deepseek-harness run build:web
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness
```

人工体验正式构建（要求目标 DSH 版本的 Harness 已完成 `build:native-system`、`build:lib`、`build:web`）：

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm preview:dsh
pnpm preview:dsh --stop
```

启动器打包并安装常规插件，在 `.artifacts/workbench-dsh/profile/` 中运行独立 DSH，打印本机访问地址并保留研究数据。示例包含 A / B 跨工作区讨论、知识卡片和后续研究；模型是明确标注的固定演示回答，不调用付费模型。停止后再启动会保留示例与人工操作，不影响已有 DSH profile。启动地址含本机登录凭据，不要发布原始日志或 `state.json`。

本地构建会根据 `package.json`、`tsdown.config.ts` 与 `src/` 内容生成稳定的 `local-<hash>` Build ID；发布流水线可在构建时设置 `DSH_SESSION_GRAPH_BUILD_ID` 来替换它。

### 发布

[Publish workflow](.github/workflows/publish.yml) 接受已发布的 GitHub Release 或手工提供的现有 tag。它要求 tag 等于 `v` 加包版本，重新运行 `pnpm run check`，打包归档，并把这些已验证字节发布到 npm；稳定版使用 npm tag `latest`，预发布版使用 `next`。

本包使用 [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)：organization 为 `benz-ai-x`、repository 为 `dsh-research-graph`、workflow 为 `publish.yml`、environment 为 `npm-publish`，仅允许 `npm publish` action。工作流通过 GitHub OIDC 认证，不应再接收长期 `NPM_TOKEN`；保留 GitHub environment 作为发布边界。若为其他包名或 scope 做首次发布，只在首次引导时使用权限范围尽量小、有效期尽量短的令牌，随后立即配置 trusted publishing 并吊销该令牌。

首次适配 DSH 版本时，`package.json.version` 使用目标 DSH 的完整版本。同一 DSH 预发布版下的后续发布追加一个正整数修订号，如 `0.1.5-rc.2.1`、`0.1.5-rc.2.2`；所有直接 DSH 依赖仍固定为 `0.1.5-rc.2`。`@deepseek-ai/dsh-llm` 的精确 peer 依赖是兼容目标的唯一来源。插件 tag 为 `v<plugin-version>`，上游 tag 为 `dsh-v<dsh-version>`。`check-version.mjs` 拒绝无效修订号、依赖漂移及发布 tag 不一致，`--dsh-version` 输出校验后的目标供 CI 使用；`check:harness`、打包验收和预览启动器都使用这一目标。发布前完成 `pnpm run check`、`check:harness` 和打包 profile 验收，并确认 研图页头徽标读取同一版本，再合入变更、创建不可移动的 tag 和 Release。尚未发布的本地迭代使用 Build ID 区分，不覆盖已发布版本或重命名历史标签。

本包导出两个 Node 侧入口和一个惰性加载的浏览器模块；实际打包归档中的每个 JavaScript 入口都带有匹配的 TypeScript 声明：

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
| [`src/research-topics-host.ts`](src/research-topics-host.ts) | Host 存储、串行主题写入、轻量来源元数据与生命周期取消 |
| [`src/client/ResearchTopics.tsx`](src/client/ResearchTopics.tsx) 与 [`src/client/TopicGraph.tsx`](src/client/TopicGraph.tsx) | 主题创建、选择、引用、排列草稿与来源检查 |
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope 解析、图谱推导与视图头部 |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | 画布渲染、端子、检查器、控件、手势、悬停状态与 minimap |
| [`src/config.ts`](src/config.ts) | 对外 Standard Schema、默认值与规范化 Host 配置 |
| [`src/index.ts`](src/index.ts) | Session Digest 与 Session Merge Host services、投影注册、配置和 Remote 错误 |
| [`src/session-digest.ts`](src/session-digest.ts) 与 [`src/session-digest-harness.ts`](src/session-digest-harness.ts) | 摘要输出校验、revision 缓存、并发控制与 Harness 路由重建 |
| [`src/session-merge.ts`](src/session-merge.ts)、[`src/session-merge-host.ts`](src/session-merge-host.ts) 与 [`src/session-merge-harness.ts`](src/session-merge-harness.ts) | 浏览器流程、Host 校验、规范引用提交、有界捕获、幂等重试与持久性屏障 |
| [`src/session-merge-projection.ts`](src/session-merge-projection.ts) | 版本化 Merge marker/reference 投影与严格持久状态校验 |
| [`src/session-history-host.ts`](src/session-history-host.ts) 与 [`src/session-history-codec.ts`](src/session-history-codec.ts) | 只读讨论分页、精确事件边界与共享的严格通信校验 |
| [`src/client/SessionHistory.tsx`](src/client/SessionHistory.tsx) | 原文阅读、完成轮次选择、来源状态与请求取消 |
| [`src/session-title-host.ts`](src/session-title-host.ts)、[`src/session-insight-source.ts`](src/session-insight-source.ts)、[`src/session-insight-model.ts`](src/session-insight-model.ts) | 只读标题建议及共享的限量讨论输入、模型调用 |
| [`src/client/session-digest-remote.ts`](src/client/session-digest-remote.ts) | 严格的浏览器 Remote 请求/结果契约 |
| [`src/client/session-merge-remote.ts`](src/client/session-merge-remote.ts) | 严格的浏览器 Session Merge Remote 请求/结果契约 |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | 图谱范围解析、Branch 与 Merge 边、Session Cluster 排序、Subagent Summary、Title Filter 匹配与 Branch Lineage |
| [`src/client/canvas-presentation.ts`](src/client/canvas-presentation.ts) | 有序 Session Arrangement 投影以及最终/自动内容边界 |
| [`src/client/layout.ts`](src/client/layout.ts) 与 [`src/client/clusters.ts`](src/client/clusters.ts) | Branch 坐标、依赖排列、簇框、折叠与偏移 |
| [`src/client/viewport.ts`](src/client/viewport.ts)、[`src/client/preview-placement.ts`](src/client/preview-placement.ts) 与 [`src/client/snap.ts`](src/client/snap.ts) | 缩放、平移、尺寸保持、适应、minimap/预览定位与对齐参考线 |
| [`src/client/edge-routing.ts`](src/client/edge-routing.ts) | 最终避障路由、关系端口、箭头、标签与完整路线边界 |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | 按范围的 Session Arrangement 持久化、迁移与 fail-soft 存储恢复 |

## 当前限制

- 无会话主页与全新空白会话没有对话视图环，因此无法使用研图。
- 范围图一次跟随一个工作区或目录；研究主题可跨同一 Host 内的工作区，正文搜索使用独立视图。
- 切换标签或刷新会重置平移与缩放；节点位置、簇偏移与折叠状态会持久化。
- Session Digest 只按需生成并缓存在 Host 内存中，不作为长期产物持久化；Host 重启会清空缓存。
- 没有日志模型路由的 Session 必须配置兜底路由后才能生成摘要。
- 从 Subagent Session 创建的 Branch 没有 Canvas Session 父边，因此显示为 Root Session。
- 一次 Merge 只接受两个或三个来源；可跨同一 Host 的工作区，不支持跨 Host 汇聚。
- Merge 捕获的是不可变来源快照；来源后续新增消息不会自动刷新已有 Merge Session。
- 触屏只使用指针事件回退，没有专用控件。

## 许可证

[MIT](LICENSE)
