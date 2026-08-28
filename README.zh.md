---
description: "可安装的 dsh Web 插件，用自由画布浏览、排列相关工作区会话并创建分支。"
kind: "package-bundle"
---

# @benz-ai-x/dsh-client-ui-session-graph

[English](README.md) | 中文

本包为 DeepSeek Harness 对话视图添加 **Graph** 标签。它把每棵普通会话派生树组织成可移动、可折叠的簇，以有向边绘制分叉关系，并把子代理后代折叠为状态徽标。浏览器按工作区保存手工节点位置、簇偏移与折叠状态；插件不会改变会话日志或模型请求。

## 安装

本包发布到 npm 后，可将其加入 `web` profile：

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

本包同时包含浏览器插件与 `cordis.patch.yml` 组合包补丁。dsh 插件管理器会把它插入 `web` profile 已提供的 Session、Workspace、locale、renderer 与 conversation 插件之后，无需手工修改 `cordis.yml`。

使用以下命令移除：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

首个版本面向 DeepSeek Harness `0.1.2-alpha.1`。插件不会把尚未单独发布的 `@deepseek-ai/*` 包安装进自己的依赖树；这些服务与浏览器模块由所选 dsh profile 持有。

## 使用图谱

打开一个非空会话，在标准对话标签旁选择 **Graph**。视图会自动限定到该会话所属的工作区。

- 单击选择节点；详情面板可打开该会话或创建分支。
- 双击会在该会话上次使用的视图中打开它。
- 拖动节点或整个簇框来排列画布；对齐参考线会吸附临近卡片边缘。
- 使用滚轮缩放、背景拖动平移、适应、100%、重新布局、重置、定位当前会话或 minimap。
- 按标题过滤；Enter 居中第一个匹配项，Escape 清空过滤条件。
- 悬停节点或边会强调相关分支。

画布获得焦点时可使用键盘快捷键：`+` 和 `-` 缩放，`0` 恢复 100%，`1` 适应图谱。

## 开发

环境要求为 Node.js `^22.19.0 || >=24.0.0` 与 pnpm `11.7.0`。

```sh
pnpm install
pnpm run check
```

`pnpm run check` 会检查独立包的类型、构建 Host 与浏览器入口，并运行 76 项包内测试。若要对已准备好的 DeepSeek Harness checkout 运行 51 项完整交互测试：

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

使用以下命令构建可安装归档：

```sh
pnpm pack
```

本包导出两个 Host 入口和一个惰性加载的浏览器模块：

| 导出 | 用途 |
|---|---|
| `.` | Cordis 浏览器入口注册 |
| `./invariant` | 运行时注册不变量 |
| `./client` | 构建后的 dsh 客户端模块 |
| `./cordis.patch.yml` | profile 组合包补丁 |

## 实现

`GraphView` 读取当前 Session、工作区成员关系、会话摘要与待处理交互映射。纯 helper 推导簇、分叉边、布局、吸附、过滤与视口状态，再由 `GraphCanvas` 渲染结果。本包不提供 Host service，也不接受配置字段。

| 文件 | 职责 |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | 工作区范围、图谱推导与视图头部 |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | 画布渲染、控件、手势、悬停状态与 minimap |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | 会话范围、派生边、子代理徽标、过滤与邻域 |
| [`src/client/layout.ts`](src/client/layout.ts) 与 [`src/client/clusters.ts`](src/client/clusters.ts) | 树坐标、簇框、折叠、偏移与边路径 |
| [`src/client/viewport.ts`](src/client/viewport.ts) 与 [`src/client/snap.ts`](src/client/snap.ts) | 缩放、平移、适应、minimap 投影与对齐参考线 |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | 按工作区的浏览器持久化与无效记录恢复 |

## 当前限制

- 无会话主页与全新空白会话没有对话视图环，因此无法使用 Graph。
- 图谱一次只跟随一个工作区，不搜索消息内容或工作区路径。
- 切换标签或刷新会重置平移与缩放；节点位置、簇偏移与折叠状态会持久化。
- 在子代理内创建的分叉没有普通会话父边，因此显示为根。
- 分支操作被拒绝时，视图内不会显示错误消息。
- 触屏只使用指针事件回退，没有专用控件。

## 许可证

[MIT](LICENSE)
