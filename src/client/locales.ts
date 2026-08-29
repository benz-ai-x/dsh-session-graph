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
  | 'canvas.minimap'
  | 'filter.placeholder'
  | 'filter.clear'
  | 'filter.matches'
  | 'filter.none'
  | 'legend.derivation'
  | 'legend.branch'
  | 'panel.title'
  | 'panel.close'
  | 'panel.open'
  | 'panel.branch'
  | 'panel.branchError'
  | 'panel.subagents'
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
  'canvas.minimap': '迷你地图',
  'filter.placeholder': '过滤会话标题',
  'filter.clear': '清除过滤',
  'filter.matches': '{count} 个匹配',
  'filter.none': '无匹配会话',
  'legend.derivation': '子代理派生',
  'legend.branch': '分支',
  'panel.title': '会话详情',
  'panel.close': '关闭会话详情',
  'panel.open': '打开会话',
  'panel.branch': '开新分支',
  'panel.branchError': '无法创建分支，请重试',
  'panel.subagents': '{count} 子代理',
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
  'canvas.minimap': 'Minimap',
  'filter.placeholder': 'Filter session titles',
  'filter.clear': 'Clear filter',
  'filter.matches': 'Matches: {count}',
  'filter.none': 'No matching sessions',
  'legend.derivation': 'Subagent derivation',
  'legend.branch': 'Branch',
  'panel.title': 'Session details',
  'panel.close': 'Close session details',
  'panel.open': 'Open session',
  'panel.branch': 'New branch',
  'panel.branchError': "Couldn't create the branch. Try again",
  'panel.subagents': '{count} subagents',
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
