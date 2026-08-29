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
  'preview.status.running': 'Running',
  'preview.status.pending': 'Waiting for input',
  'preview.status.completed': 'Completed',
  'canvas.description': 'Session relationship graph',
  'empty.outside': 'The viewed session has no resolvable workspace or working directory',
  'empty.none': 'No canvas sessions in this scope yet',
}
