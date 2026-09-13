import { synthesisEn, synthesisZh, type SynthesisKey } from './synthesis-locales.ts'
import { explorationEn, explorationZh, type ExplorationKey } from './exploration-locales.ts'
import { titleEn, titleZh, type SessionTitleKey } from './session-title-locales.ts'
/** `sessionGraph` namespace dictionaries (view tab label + graph chrome strings). */
import { workbenchEn, workbenchZh, type WorkbenchKey } from './workbench-locales.ts'
import { readingEn, readingZh, type ReadingKey } from './reading-locales.ts'
import { knowledgeEn, knowledgeZh, type KnowledgeKey } from './knowledge-locales.ts'
import { reuseEn, reuseZh, type ReuseKey } from './research-reuse-locales.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'sessionGraph'

/** The session-graph dictionary key set (the source of truth for both locales). */
export type SessionGraphKey =
  | 'position.unavailable' | 'position.topicUnavailable'
  | SynthesisKey
  | ExplorationKey
  | SessionTitleKey
  | WorkbenchKey
  | ReadingKey
  | KnowledgeKey
  | ReuseKey
  | 'topic.title' | 'topic.back' | 'topic.description' | 'topic.loading' | 'topic.readError' | 'topic.retry'
  | 'topic.newName' | 'topic.create' | 'topic.empty' | 'topic.choose' | 'topic.name' | 'topic.rename'
  | 'topic.saving' | 'topic.saveError'
  | 'topic.noWorkspace' | 'topic.unavailable' | 'topic.noReferences' | 'topic.source'
  | 'topic.readOriginal' | 'topic.closeOriginal' | 'topic.remove'
  | 'topic.add' | 'topic.addSelected' | 'topic.close'
  | 'topic.saveArrangement' | 'topic.arrangementHint' | 'topic.unsaved'
  | 'topic.refresh' | 'topic.cancel' | 'topic.canceled' | 'topic.archivedReading'
  | 'search.disabled'
  | 'search.setup'
  | 'search.setupUrl'
  | 'search.setupLink'
  | 'search.restart'
  | 'search.retry'
  | 'search.cancel'
  | 'search.canceled'
  | 'search.more'
  | 'search.stale'
  | 'search.open'
  | 'search.title'
  | 'search.description'
  | 'search.close'
  | 'search.query'
  | 'search.placeholder'
  | 'search.scope'
  | 'search.directory'
  | 'search.all'
  | 'search.includeArchived'
  | 'search.submit'
  | 'search.loading'
  | 'search.empty'
  | 'search.count'
  | 'search.start'
  | 'search.error'
  | 'search.results'
  | 'search.read'
  | 'search.noWorkspace'
  | 'search.archived'
  | 'search.original'
  | 'search.select'
  | 'search.snapshot'
  | 'history.refresh'
  | 'history.cancel'
  | 'history.canceled'
  | 'history.excerpt'
  | 'history.excerptHint'
  | 'history.error'
  | 'history.unavailable'
  | 'history.empty'
  | 'history.retry'
  | 'history.scope'
  | 'history.selectHint'
  | 'history.incompleteRange'
  | 'history.selectTurn'
  | 'history.selected'
  | 'history.boundary'
  | 'history.review'
  | 'history.clear'
  | 'history.unfinished'
  | 'history.loading'
  | 'history.earlier'
  | 'history.later'
  | 'history.tab'
  | 'history.title'
  | 'history.turn'
  | 'history.user'
  | 'history.assistant'
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
  | 'toolbar.undoRelayout'
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
  | 'digest.errorLimit'
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
  'position.unavailable': '上次选中的资料已不可用，已保留视口并清空选择。',
  'position.topicUnavailable': '上次的研究主题已不可用，请从列表选择主题。',
  ...knowledgeZh, ...titleZh,
  ...workbenchZh, ...readingZh,
  ...reuseZh,
  ...explorationZh,
  ...synthesisZh,
  'topic.refresh': '刷新来源',
  'topic.saveArrangement': '保存排列',
  'topic.arrangementHint': '排列已同步到主题',
  'topic.unsaved': '排列已保留在本机，点击保存以同步到主题。',
  'topic.add': '加入研究主题',
  'topic.addSelected': '加入所选主题',
  'topic.close': '关闭主题选择',
  'topic.noWorkspace': '未分配工作区',
  'topic.unavailable': '来源不可用',
  'topic.noReferences': '主题中还没有资料。在会话详情或搜索结果中选择“加入研究主题”。',
  'topic.source': '主题来源',
  'topic.readOriginal': '阅读原文',
  'topic.closeOriginal': '关闭原文',
  'topic.remove': '从主题移除',
  'topic.title': '研究主题',
  'topic.back': '工作区图',
  'topic.description': '将同一 Host 中不同工作区的会话整理到主题中。关联只用于组织资料，不会改变源会话或发送模型上下文。',
  'topic.loading': '正在读取主题…',
  'topic.cancel': '取消读取',
  'topic.canceled': '已取消读取主题。',
  'topic.archivedReading': '已归档，可在此阅读原文；无法打开归档会话。',
  'topic.readError': '读取主题失败。请重试。',
  'topic.retry': '重试',
  'topic.newName': '新主题名称',
  'topic.create': '创建主题',
  'topic.empty': '尚无研究主题。创建一个主题开始整理资料。',
  'topic.choose': '选择研究主题',
  'topic.name': '主题名称',
  'topic.rename': '重命名',
  'topic.saving': '正在保存主题…',
  'topic.saveError': '保存失败，输入已保留，请重试。',
  'search.disabled': '全文索引尚未启用。',
  'search.setup': '在当前 profile 的 cordis.patch.yml 覆盖 session-query-sqlite 配置，将 openAt 设为 first-search。重启 Host 后重新搜索。',
  'search.setupUrl': 'https://github.com/benz-ai-x/dsh-research-graph/blob/main/README.zh.md#enable-discussion-search',
  'search.setupLink': '查看启用步骤',
  'search.restart': '重新搜索',
  'search.retry': '重试搜索',
  'search.cancel': '取消搜索',
  'search.canceled': '搜索已取消。',
  'search.more': '加载更多结果',
  'search.stale': '结果已过期或范围已变化，请重新搜索。',
  'search.open': '搜索讨论与知识',
  'search.title': '搜索历史讨论',
  'search.description': '查找已完成轮次中的用户与助手正文。每个会话显示最近一处命中。',
  'search.close': '关闭搜索',
  'search.query': '正文关键词',
  'search.placeholder': '输入记得的词句…',
  'search.scope': '搜索范围',
  'search.directory': '当前目录',
  'search.all': '当前 Host 的全部会话',
  'search.includeArchived': '包含归档',
  'search.submit': '搜索',
  'search.loading': '正在准备索引并检索讨论…',
  'search.empty': '所选范围内没有匹配的讨论。',
  'search.count': '已找到 {count} 个会话',
  'search.start': '选择范围并输入关键词，然后搜索。',
  'search.error': '搜索失败，请重试。',
  'search.results': '搜索结果',
  'search.read': '查看原文：{title}',
  'search.noWorkspace': '未归属工作区',
  'search.archived': '已归档',
  'search.original': '搜索原文',
  'search.select': '选择命中片段，在这里核对原文。',
  'search.snapshot': '左侧片段保留检索时的内容；下方按来源身份重新读取原文。',
  'history.refresh': '刷新原文',
  'history.cancel': '取消读取',
  'history.canceled': '已取消读取',
  'history.excerpt': '仅存摘录',
  'history.excerptHint': '原文当前无法读取，下面为本次选择时保留的摘录。',
  'history.error': '读取失败，请重试。',
  'history.unavailable': '来源不可用',
  'history.empty': '此会话暂无讨论轮次',
  'history.retry': '重试读取',
  'history.scope': '仅展示用户和助手的讨论文本；不包含附件、工具结果或思考过程。',
  'history.selectHint': '选择一轮，再点另一轮可选中连续范围；再次点击已选轮次可清除。',
  'history.incompleteRange': '中间还有未加载或未完成的轮次，请先加载或刷新后再选择。',
  'history.selectTurn': '选择第 {turn} 轮',
  'history.selected': '已选择第 {first}–{last} 轮',
  'history.boundary': '事件 {start}–{end}',
  'history.review': '复核所选原文',
  'history.clear': '清除选择',
  'history.unfinished': '尚未完成，不可选作固定来源',
  'history.loading': '正在读取原文…',
  'history.earlier': '加载更早的讨论',
  'history.later': '加载更晚的讨论',
  'history.tab': '原文',
  'history.title': '讨论原文',
  'history.turn': '第 {turn} 轮',
  'history.user': '用户',
  'history.assistant': '助手',
  'view.graph': '研图',
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
  'toolbar.undoRelayout': '撤销重新布局',
  'toolbar.reset': '重置布局',
  'toolbar.locate': '定位',
  'toolbar.merge': '汇聚所选会话',
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
  'digest.intro': '用简短要点回顾结论、关键信息与下一步。',
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
  'digest.errorLimit': '摘要达到生成上限，请提高插件的摘要输出上限后重试',
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
  'position.unavailable': 'The previously selected material is unavailable. The viewport is kept and selection is cleared.',
  'position.topicUnavailable': 'The previous research topic is unavailable. Choose a topic from the list.',
  ...knowledgeEn, ...titleEn,
  ...workbenchEn, ...readingEn,
  ...reuseEn,
  ...explorationEn,
  ...synthesisEn,
  'topic.refresh': 'Refresh sources',
  'topic.saveArrangement': 'Save arrangement',
  'topic.arrangementHint': 'Arrangement synced to topic',
  'topic.unsaved': 'Arrangement kept on this device. Save to sync to the topic.',
  'topic.add': 'Add to Research Topic',
  'topic.addSelected': 'Add to selected topic',
  'topic.close': 'Close topic picker',
  'topic.noWorkspace': 'No Workspace',
  'topic.unavailable': 'Source unavailable',
  'topic.noReferences': 'No sources yet. Choose “Add to Research Topic” in Session details or a search result.',
  'topic.source': 'Topic source',
  'topic.readOriginal': 'Read original',
  'topic.closeOriginal': 'Close original',
  'topic.remove': 'Remove from topic',
  'topic.title': 'Research Topics',
  'topic.back': 'Workspace graph',
  'topic.description': 'Organize Sessions from different Workspaces in the same Host. References do not change source Sessions or send model context.',
  'topic.loading': 'Loading topics…',
  'topic.cancel': 'Cancel reading',
  'topic.canceled': 'Topic reading canceled.',
  'topic.archivedReading': 'Archived sources can be read here; opening their Session is unavailable.',
  'topic.readError': 'Could not read topics. Please retry.',
  'topic.retry': 'Retry',
  'topic.newName': 'New topic name',
  'topic.create': 'Create topic',
  'topic.empty': 'No Research Topics yet. Create a topic to start collecting sources.',
  'topic.choose': 'Choose Research Topic',
  'topic.name': 'Topic name',
  'topic.rename': 'Rename',
  'topic.saving': 'Saving topic…',
  'topic.saveError': 'Could not save. Your input is preserved; please retry.',
  'search.disabled': 'Full-text indexing is not enabled.',
  'search.setup': 'In this profile’s cordis.patch.yml, override session-query-sqlite with openAt: first-search. Restart the Host, then search again.',
  'search.setupUrl': 'https://github.com/benz-ai-x/dsh-research-graph/blob/main/README.md#enable-discussion-search',
  'search.setupLink': 'View setup steps',
  'search.restart': 'Search again',
  'search.retry': 'Retry search',
  'search.cancel': 'Cancel search',
  'search.canceled': 'Search canceled.',
  'search.more': 'Load more results',
  'search.stale': 'Results expired or the scope changed. Search again.',
  'search.open': 'Search discussions & knowledge',
  'search.title': 'Search discussion history',
  'search.description': 'Find user and assistant text in completed turns. Each session shows its latest matching passage.',
  'search.close': 'Close search',
  'search.query': 'Discussion keywords',
  'search.placeholder': 'Words or phrases you remember…',
  'search.scope': 'Search scope',
  'search.directory': 'This directory',
  'search.all': 'All sessions on this Host',
  'search.includeArchived': 'Include archived',
  'search.submit': 'Search',
  'search.loading': 'Preparing the index and searching discussions…',
  'search.empty': 'No matching discussions in this scope.',
  'search.count': 'Found {count} sessions',
  'search.start': 'Choose a scope, enter keywords, and search.',
  'search.error': 'Search failed. Please try again.',
  'search.results': 'Search results',
  'search.read': 'Read original: {title}',
  'search.noWorkspace': 'No workspace',
  'search.archived': 'Archived',
  'search.original': 'Search original',
  'search.select': 'Select a passage to check the original here.',
  'search.snapshot': 'The result excerpt is from the search. The reader below rechecks the addressed original.',
  'history.refresh': 'Refresh discussion',
  'history.cancel': 'Cancel reading',
  'history.canceled': 'Reading canceled',
  'history.excerpt': 'Excerpt only',
  'history.excerptHint': 'The original is unavailable. This is the excerpt retained when you selected it.',
  'history.error': 'Reading failed. Please retry.',
  'history.unavailable': 'Source unavailable',
  'history.empty': 'This Session has no discussion turns yet',
  'history.retry': 'Retry reading',
  'history.scope': 'User and assistant discussion text only; attachments, tool results and reasoning are excluded.',
  'history.selectHint': 'Select a turn, then another to include the range. Select a checked turn again to clear.',
  'history.incompleteRange': 'Some turns in this range are not loaded or completed. Load or refresh them before selecting.',
  'history.selectTurn': 'Select turn {turn}',
  'history.selected': 'Selected turns {first}–{last}',
  'history.boundary': 'Events {start}–{end}',
  'history.review': 'Check selected original',
  'history.clear': 'Clear selection',
  'history.unfinished': 'Unfinished; cannot be selected as a fixed source',
  'history.loading': 'Reading discussion…',
  'history.earlier': 'Load earlier discussion',
  'history.later': 'Load later discussion',
  'history.tab': 'Original',
  'history.title': 'Discussion text',
  'history.turn': 'Turn {turn}',
  'history.user': 'User',
  'history.assistant': 'Assistant',
  'view.graph': 'Research Graph',
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
  'toolbar.undoRelayout': 'Undo relayout',
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
  'digest.intro': 'Scan the key findings and next steps in a short digest.',
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
  'digest.errorLimit': 'The digest reached its output limit. Increase the plugin’s digest output limit and try again',
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
