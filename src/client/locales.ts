/** `sessionGraph` namespace dictionaries (view tab label + graph chrome strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'sessionGraph'

/** The session-graph dictionary key set (the source of truth for both locales). */
export type SessionGraphKey =
  | 'view.graph'
  | 'scope.workspaceCount'
  | 'scope.directoryCount'
  | 'node.newSession'
  | 'node.running'
  | 'node.subagents'
  | 'node.branchedFrom'
  | 'time.now'
  | 'time.minutes'
  | 'time.hours'
  | 'time.days'
  | 'time.months'
  | 'time.years'
  | 'cluster.expand'
  | 'cluster.collapse'
  | 'toolbar.zoomIn'
  | 'toolbar.zoomOut'
  | 'toolbar.zoomLevel'
  | 'toolbar.label'
  | 'toolbar.fit'
  | 'toolbar.relayout'
  | 'toolbar.reset'
  | 'toolbar.locate'
  | 'toolbar.merge'
  | 'canvas.minimap'
  | 'filter.placeholder'
  | 'filter.clear'
  | 'filter.matches'
  | 'filter.none'
  | 'legend.derivation'
  | 'legend.branch'
  | 'legend.merge'
  | 'merge.title'
  | 'merge.close'
  | 'merge.intro'
  | 'merge.selectedCount'
  | 'merge.instruction'
  | 'merge.referenceInstruction'
  | 'merge.defaultInstruction'
  | 'merge.remove'
  | 'merge.cancel'
  | 'merge.submit'
  | 'merge.submitting'
  | 'merge.retry'
  | 'merge.openTarget'
  | 'merge.targetKept'
  | 'merge.errorValidation'
  | 'merge.errorCreating'
  | 'merge.errorNaming'
  | 'merge.errorSubmitting'
  | 'merge.errorOpening'
  | 'merge.errorUnknown'
  | 'panel.title'
  | 'panel.close'
  | 'panel.open'
  | 'panel.branch'
  | 'panel.branchError'
  | 'panel.subagents'
  | 'panel.mergeSources'
  | 'panel.mergeUnavailable'
  | 'panel.mergeCapturedThrough'
  | 'panel.mergeCompleteSnapshot'
  | 'digest.title'
  | 'digest.intro'
  | 'digest.generate'
  | 'digest.generating'
  | 'digest.refreshing'
  | 'digest.refresh'
  | 'digest.regenerate'
  | 'digest.retry'
  | 'digest.stale'
  | 'digest.snapshot'
  | 'digest.empty'
  | 'digest.error'
  | 'digest.errorRoute'
  | 'digest.errorOutput'
  | 'digest.outcomes'
  | 'digest.openItems'
  | 'digest.turns'
  | 'preview.status.running'
  | 'preview.status.pending'
  | 'preview.status.completed'
  | 'canvas.description'
  | 'empty.outside'
  | 'empty.none'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The session-graph view tab label and graph chrome strings. */
    'sessionGraph': SessionGraphKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<SessionGraphKey, string> = {
  'view.graph': '图谱',
  'scope.workspaceCount': '{name} · {count} 个会话',
  'scope.directoryCount': '目录范围 · {count} 个会话',
  'node.newSession': '新会话',
  'node.running': '{count} 运行中',
  'node.subagents': '{count} 子代理',
  'node.branchedFrom': '分支自：{name}',
  'time.now': '刚刚',
  'time.minutes': '{n}分钟',
  'time.hours': '{n}小时',
  'time.days': '{n}天',
  'time.months': '{n}个月',
  'time.years': '{n}年',
  'cluster.expand': '展开会话簇',
  'cluster.collapse': '收起会话簇',
  'toolbar.zoomIn': '放大',
  'toolbar.zoomOut': '缩小',
  'toolbar.zoomLevel': '缩放至 100%',
  'toolbar.label': '画布工具',
  'toolbar.fit': '适应',
  'toolbar.relayout': '重新布局',
  'toolbar.reset': '重置布局',
  'toolbar.locate': '定位',
  'toolbar.merge': '汇聚会话',
  'canvas.minimap': '迷你地图',
  'filter.placeholder': '过滤会话标题',
  'filter.clear': '清除过滤',
  'filter.matches': '{count} 个匹配',
  'filter.none': '无匹配会话',
  'legend.derivation': '子代理派生',
  'legend.branch': '分支',
  'legend.merge': '汇聚',
  'merge.title': '汇聚会话',
  'merge.close': '关闭汇聚会话',
  'merge.intro': '选择 2–3 个会话作为快照来源。目标会话会独立创建，不改变原有分支。',
  'merge.selectedCount': '已选择 {count}/3',
  'merge.instruction': '汇聚指令',
  'merge.referenceInstruction': '请通过会话卡片选择来源，不要在指令中输入 dsh-session 引用。',
  'merge.defaultInstruction': '综合所选会话的上下文，提炼共识、分歧和待办，并继续完成任务。',
  'merge.remove': '移除 {name}',
  'merge.cancel': '取消',
  'merge.submit': '创建汇聚会话',
  'merge.submitting': '正在创建汇聚会话…',
  'merge.retry': '重试',
  'merge.openTarget': '打开目标会话',
  'merge.targetKept': '目标会话已保留，可以安全重试。',
  'merge.errorValidation': '所选会话无法汇聚，请检查来源和指令。',
  'merge.errorCreating': '创建目标会话失败。',
  'merge.errorNaming': '目标会话命名失败。',
  'merge.errorSubmitting': '提交源会话快照失败。',
  'merge.errorOpening': '汇聚已完成，但无法自动打开目标会话。',
  'merge.errorUnknown': '汇聚会话失败，请重试。',
  'panel.title': '会话详情',
  'panel.close': '关闭会话详情',
  'panel.open': '打开会话',
  'panel.branch': '开新分支',
  'panel.branchError': '无法创建分支，请重试',
  'panel.subagents': '{count} 子代理',
  'panel.mergeSources': '汇聚来源',
  'panel.mergeUnavailable': '不可用会话（{id}）',
  'panel.mergeCapturedThrough': '快照至事件 {seq}',
  'panel.mergeCompleteSnapshot': '完整快照',
  'digest.title': '会话摘要',
  'digest.intro': '按需生成本会话的概览、关键结论和待办。',
  'digest.generate': '生成摘要',
  'digest.generating': '正在生成摘要…',
  'digest.refreshing': '正在更新摘要…',
  'digest.refresh': '更新摘要',
  'digest.regenerate': '重新生成',
  'digest.retry': '重试',
  'digest.stale': '会话有新内容',
  'digest.snapshot': '运行中快照',
  'digest.empty': '暂无可总结的会话内容',
  'digest.error': '摘要生成失败，请重试',
  'digest.errorRoute': '此会话没有可用的模型路由，请配置兜底模型后重试',
  'digest.errorOutput': '模型返回的摘要格式无效，请重试',
  'digest.outcomes': '关键结论',
  'digest.openItems': '待处理',
  'digest.turns': '基于 {count} 轮对话',
  'preview.status.running': '运行中',
  'preview.status.pending': '等待输入',
  'preview.status.completed': '已完成',
  'canvas.description': '会话关系图谱',
  'empty.outside': '无法确定当前查看会话的工作区或工作目录',
  'empty.none': '此范围暂无画布会话',
}

/** English dictionary. */
export const en: Record<SessionGraphKey, string> = {
  'view.graph': 'Graph',
  'scope.workspaceCount': '{name} · {count} sessions',
  'scope.directoryCount': 'Directory scope · {count} sessions',
  'node.newSession': 'New session',
  'node.running': '{count} running',
  'node.subagents': '{count} subagents',
  'node.branchedFrom': 'branched from: {name}',
  'time.now': 'now',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}mo',
  'time.years': '{n}y',
  'cluster.expand': 'Expand session cluster',
  'cluster.collapse': 'Collapse session cluster',
  'toolbar.zoomIn': 'Zoom in',
  'toolbar.zoomOut': 'Zoom out',
  'toolbar.zoomLevel': 'Zoom to 100%',
  'toolbar.label': 'Canvas tools',
  'toolbar.fit': 'Fit',
  'toolbar.relayout': 'Relayout',
  'toolbar.reset': 'Reset layout',
  'toolbar.locate': 'Locate',
  'toolbar.merge': 'Merge sessions',
  'canvas.minimap': 'Minimap',
  'filter.placeholder': 'Filter session titles',
  'filter.clear': 'Clear filter',
  'filter.matches': 'Matches: {count}',
  'filter.none': 'No matching sessions',
  'legend.derivation': 'Subagent derivation',
  'legend.branch': 'Branch',
  'legend.merge': 'Merge',
  'merge.title': 'Merge sessions',
  'merge.close': 'Close Merge sessions',
  'merge.intro': 'Select 2–3 sessions as snapshot sources. The target is created independently without changing existing branches.',
  'merge.selectedCount': '{count}/3 selected',
  'merge.instruction': 'Merge instruction',
  'merge.referenceInstruction': 'Select sources on the session cards instead of entering dsh-session references in the instruction.',
  'merge.defaultInstruction': 'Synthesize the selected session contexts, extract agreements, disagreements, and open work, then continue the task.',
  'merge.remove': 'Remove {name}',
  'merge.cancel': 'Cancel',
  'merge.submit': 'Create Merge session',
  'merge.submitting': 'Creating Merge session…',
  'merge.retry': 'Try again',
  'merge.openTarget': 'Open target session',
  'merge.targetKept': 'The target session was preserved and can be retried safely.',
  'merge.errorValidation': 'These sessions cannot be merged. Check the sources and instruction.',
  'merge.errorCreating': 'The target session could not be created.',
  'merge.errorNaming': 'The target session could not be named.',
  'merge.errorSubmitting': 'The source session snapshots could not be submitted.',
  'merge.errorOpening': 'The Merge completed, but the target session could not be opened automatically.',
  'merge.errorUnknown': 'The Merge session could not be created. Try again.',
  'panel.title': 'Session details',
  'panel.close': 'Close session details',
  'panel.open': 'Open session',
  'panel.branch': 'New branch',
  'panel.branchError': "Couldn't create the branch. Try again",
  'panel.subagents': '{count} subagents',
  'panel.mergeSources': 'Merge sources',
  'panel.mergeUnavailable': 'Unavailable session ({id})',
  'panel.mergeCapturedThrough': 'Snapshot through event {seq}',
  'panel.mergeCompleteSnapshot': 'Complete snapshot',
  'digest.title': 'Session digest',
  'digest.intro': 'Generate an overview, key outcomes, and open items on demand.',
  'digest.generate': 'Generate digest',
  'digest.generating': 'Generating digest…',
  'digest.refreshing': 'Updating digest…',
  'digest.refresh': 'Update digest',
  'digest.regenerate': 'Regenerate',
  'digest.retry': 'Try again',
  'digest.stale': 'Session has new content',
  'digest.snapshot': 'Running snapshot',
  'digest.empty': 'No Session content to summarize yet',
  'digest.error': "Couldn't generate the digest. Try again",
  'digest.errorRoute': 'This Session has no usable model route. Configure a fallback model and try again',
  'digest.errorOutput': 'The model returned an invalid digest format. Try again',
  'digest.outcomes': 'Key outcomes',
  'digest.openItems': 'Open items',
  'digest.turns': 'Based on {count} turns',
  'preview.status.running': 'Running',
  'preview.status.pending': 'Waiting for input',
  'preview.status.completed': 'Completed',
  'canvas.description': 'Session relationship graph',
  'empty.outside': 'The viewed session has no resolvable workspace or working directory',
  'empty.none': 'No canvas sessions in this scope yet',
}
