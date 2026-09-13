// @vitest-environment jsdom
/**
 * View registration acceptance on the real framework stack: the plugin fiber
 * registers the Graph tab into a real SlotRegistry view ring after chat,
 * tabs switch inside the ConversationSession skeleton, the derived forest
 * renders Branch edges and accessible Canvas Session buttons with folded Subagent
 * badges, selection stays local until explicit navigation, and fiber
 * disposal removes the tab.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FC, ReactNode } from 'react'
import { bindSnapshotSelector, stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  WorkspaceSnapshot, WorkspaceView,
} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TypertRemoteMap } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { EMPTY_CONVERSATION_SNAPSHOT } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  ConvViewProps, InputActions, InputState, ViewTab,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  ConversationSession, ConversationSessionHeader,
  type ConversationSessionHeaderProps, type ConversationSessionProps,
} from '@deepseek-ai/dsh-client-ui-conversation/src/client/skeleton/ConversationSession.tsx'
import { createConversationStore } from '@deepseek-ai/dsh-client-ui-conversation/src/client/stores.ts'
import { zh as conversationZh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { apply as localeApply, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import type { LocaleKeysOf } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '@benz-ai-x/dsh-research-graph/client'
import packageMetadata from '../package.json'
import { zh, type SessionGraphKey } from '../src/client/locales.ts'
import { researchTopicFixture } from './fixtures/research-topics.ts'
import { topicHost } from './fixtures/research-topics-host.ts'
import { knowledgeContent, knowledgeSource } from './fixtures/knowledge-client.ts'
import { loadWorkingPosition, saveWorkingPosition, workingPositionKey } from '../src/client/working-position.ts'
import type { KnowledgeCard, KnowledgeSave } from '../src/knowledge.ts'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ExtractionPreparation } from '../src/knowledge-extraction.ts'
import type { ResearchReuseRecord } from '../src/research-reuse.ts'

const id = (value: string): SessionId => value as SessionId

describe('registered historical branch actions', () => {
  it('retains the original turn focus when delayed topic membership arrives after returning from a branch', async () => {
    const b = await bench({ a: session('a'), b: session('b') })
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'b', turns: knowledgeSource(2).source.turns, hasEarlier: false, hasLater: false } })
    const topic = { topicId: 'research', title: '研究主题', references: [{ sessionId: 'b', title: '讨论 B', cwd: '/w' }], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    const source = { sessionId: 'b', title: '讨论 B', cwd: '/w', archived: false, status: 'listed' as const }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [source] } })
    b.prepareBranch.mockImplementation(async request => ({ ok: true, value: { ...request, targetSessionId: 'branch-child', title: '讨论 B · 2', sourceTitle: '讨论 B',
      firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'prepared' } }))
    const pendingList = Promise.withResolvers<Awaited<ReturnType<TypertRemoteMap['sessionGraphTopics/list']>>>()
    const pendingRead = Promise.withResolvers<Awaited<ReturnType<TypertRemoteMap['sessionGraphTopics/read']>>>()
    const child = { sessionId: 'branch-child', title: '讨论 B · 2', cwd: '/w', parentSessionId: 'b' }
    const updated = { ...topic, references: [...topic.references, child] }
    b.submitBranch.mockImplementation(async () => {
      b.listTopics.mockReturnValue(pendingList.promise)
      b.readTopic.mockReturnValue(pendingRead.promise)
      return { ok: true, value: { ...b.prepareBranch.mock.calls[0]![0], targetSessionId: child.sessionId, title: child.title, sourceTitle: source.title,
        firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'ready' } }
    })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelector('[data-node-id="b"]')).not.toBeNull() })
    fireEvent.click(nodeButton('b'))
    fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
    const trigger = await screen.findByRole('button', { name: '从此处分支' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: '确认并创建分支' }))
    await screen.findByRole('button', { name: '打开分支继续讨论' })
    fireEvent.click(screen.getByRole('button', { name: '返回图谱' }))
    await waitFor(() => { expect(document.activeElement).toBe(trigger) })
    pendingList.resolve({ ok: true, value: [updated] })
    pendingRead.resolve({ ok: true, value: { topic: updated, sources: [source, { ...child, archived: false, status: 'unavailable' }] } })
    await waitFor(() => { expect(document.querySelector('[data-node-id="branch-child"]')).not.toBeNull() })
    expect(trigger.isConnected).toBe(true)
    expect(document.activeElement).toBe(trigger)
    await b.fiber.dispose()
  })

  it.each(['workspace', 'topic'] as const)('uses the separately injected branch Remote with the exact turn in a %s', async scope => {
    const b = await bench({ a: session('a'), b: session('b') })
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'b', turns: knowledgeSource(2).source.turns, hasEarlier: false, hasLater: false } })
    const topic = { topicId: 'research', title: '研究主题', references: [{ sessionId: 'b', title: '讨论 B', cwd: '/w' }], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [{ sessionId: 'b', title: '讨论 B', cwd: '/w', archived: false, status: 'listed' }] } })
    b.prepareBranch.mockImplementation(async request => ({ ok: true, value: { ...request, targetSessionId: 'branch-child', title: '讨论 B · 2', sourceTitle: '讨论 B',
      firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'prepared' } }))
    b.submitBranch.mockImplementation(async () => ({ ok: true, value: { ...b.prepareBranch.mock.calls[0]![0], targetSessionId: 'branch-child', title: '讨论 B · 2', sourceTitle: '讨论 B',
      firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'ready' } }))
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    if (scope === 'topic') {
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      await waitFor(() => { expect(document.querySelector('[data-node-id="b"]')).not.toBeNull() })
    }
    fireEvent.click(nodeButton('b'))
    if (scope === 'topic') fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
    else fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    fireEvent.click(await screen.findByRole('button', { name: '从此处分支' }))
    await screen.findByText('继承第 1–2 轮；原讨论保持不变。')
    expect(b.prepareBranch.mock.calls[0]![0]).toMatchObject({ sessionId: 'b', startSeq: 20, endSeq: 24, ...(scope === 'topic' ? { topicId: topic.topicId } : {}) })
    expect(b.submitBranch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并创建分支' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开分支继续讨论' }))
    expect(b.open).toHaveBeenCalledWith('branch-child')
    expect(b.fork).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })
})

describe('reading and capture continuity', () => {
  it.each(['workspace', 'topic'] as const)('keeps Markdown, source position and focus through capture and refresh in a %s', async scope => {
    const b = await bench({ a: session('a', { displayTitle: '正在聊天的讨论' }), b: session('b', { displayTitle: '正在阅读的讨论' }) })
    const markdown = '## 可以复用的发现\n\n**结论**需要条件。\n\n| 指标 | 观察 |\n| --- | --- |\n| 延迟 | P95 |\n\n```txt\n保留原始内容\n```'
    const turn = { turn: 2, startSeq: 20, endSeq: 29, startedAt: 1000,
      messages: [{ role: 'assistant' as const, seq: 25, text: markdown }] }
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'b', turns: [turn], hasEarlier: false, hasLater: false } })
    b.saveKnowledge.mockImplementation(async request => ({ ok: true, value: { cardId: request.cardId, topicIds: [], revisions: [{
      revisionId: request.revisionId, requestHash: 'a'.repeat(64), number: 1, savedAt: 1000, content: request.content,
      sources: [{ sessionId: 'b', title: '正在阅读的讨论', source: { startSeq: 20, endSeq: 29, turns: [turn] } }],
    }] } }))
    const topic = { topicId: 'research', title: '研究主题', references: [{ sessionId: 'b', title: '正在阅读的讨论', cwd: '/w' }], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    const snapshot = { topic, sources: [{ sessionId: 'b', title: '正在阅读的讨论', cwd: '/w', archived: false, status: 'listed' as const }] }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: snapshot })
    const pendingRefresh = Promise.withResolvers<Awaited<ReturnType<TypertRemoteMap['sessionGraphTopics/read']>>>()
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    expect(screen.getByRole('button', { name: '知识库', exact: true })).toBeTruthy()
    if (scope === 'topic') {
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      await waitFor(() => { expect(document.querySelector('[data-node-id="b"]')).not.toBeNull() })
      b.readTopic.mockReturnValueOnce(pendingRefresh.promise)
    }
    fireEvent.click(nodeButton('b'))
    if (scope === 'topic') fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
    else fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByRole('heading', { name: '可以复用的发现' })
    expect(screen.getByRole('table').textContent).toContain('P95')
    expect(screen.getByText('结论', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('保留原始内容', { selector: 'code' })).toBeTruthy()
    expect(screen.getByText('输入会话 · 正在聊天的讨论')).toBeTruthy()
    const scrollId = scope === 'topic' ? 'topic-source-panel-scroll' : 'session-graph-panel-scroll'
    const scroller = screen.getByTestId(scrollId)
    scroller.scrollTop = 320
    fireEvent.scroll(scroller)
    const capture = screen.getAllByRole('button', { name: '将第 2 轮保存为知识' }).at(-1)!
    capture.focus()
    fireEvent.click(capture)
    const dialog = await screen.findByRole('dialog', { name: '知识卡片' })
    const conclusion = within(dialog).getByRole('textbox', { name: '结论' }) as HTMLTextAreaElement
    await waitFor(() => { expect(conclusion.value).toBe(markdown) })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '卡片标题' }), { target: { value: '延迟需要单独测量' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存知识' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '知识卡片' })).toBeNull() })
    expect(b.saveKnowledge).toHaveBeenCalledTimes(1)
    expect(b.saveKnowledge.mock.calls[0]![0]).toMatchObject({ content: { conclusion: markdown }, sources: [{ kind: 'discussion', sessionId: 'b', startSeq: 20, endSeq: 29 }] })
    expect(screen.getByTestId(scrollId)).toBe(scroller)
    expect(scroller.scrollTop).toBe(320)
    expect(document.activeElement).toBe(capture)
    expect(screen.getByText('已保存「延迟需要单独测量」').closest('[role="status"]')?.textContent).toContain('已保存「延迟需要单独测量」来源已一起保存')
    if (scope === 'topic') {
      await act(async () => { pendingRefresh.resolve({ ok: true, value: snapshot }) })
      expect(screen.getByTestId(scrollId)).toBe(scroller)
      expect(scroller.scrollTop).toBe(320)
      expect(document.activeElement).toBe(capture)
    } else expect(screen.getByRole('tab', { name: '原文' }).getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
  })

  it('keeps reading state when expanding and isolates keyboard navigation from the canvas', async () => {
    const b = await bench({ a: session('a'), b: session('b') })
    const turn = { turn: 1, startSeq: 10, endSeq: 14, startedAt: 1000, messages: [{ role: 'user' as const, seq: 11, text: '保留阅读位置' }] }
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'a', turns: [turn], hasEarlier: false, hasLater: false } })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('保留阅读位置')
    const scroller = screen.getByTestId('session-graph-panel-scroll')
    scroller.scrollTop = 180
    fireEvent.scroll(scroller)
    fireEvent.click(screen.getByRole('button', { name: '展开阅读' }))
    chooseCanvasAction('重新布局')
    expect(screen.getByTestId('session-graph-panel-scroll')).toBe(scroller)
    expect(screen.getByRole('tab', { name: '原文' }).getAttribute('aria-selected')).toBe('true')
    expect(nodeButton('a').getAttribute('aria-selected')).toBe('true')
    expect(scroller.scrollTop).toBe(180)
    const collapse = screen.getByRole('button', { name: '收起阅读' })
    collapse.focus()
    const canvas = screen.getByRole('group', { name: '会话关系图谱' })
    const canvasStyle = canvas.getAttribute('style')
    fireEvent.keyDown(collapse, { key: 'ArrowDown' })
    fireEvent.keyDown(collapse, { key: '+' })
    expect(canvas.getAttribute('style')).toBe(canvasStyle)
    expect(document.activeElement).toBe(collapse)
    fireEvent.click(screen.getByRole('button', { name: '关闭会话详情' }))
    fireEvent.click(nodeButton('a'))
    await screen.findByText('保留阅读位置')
    expect(screen.getByRole('button', { name: '收起阅读' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('session-graph-panel-scroll').scrollTop).toBe(180)
    fireEvent.keyDown(screen.getByRole('button', { name: '收起阅读' }), { key: 'Escape' })
    expect(screen.getByRole('button', { name: '展开阅读' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('button', { name: '展开阅读' }), { key: 'Escape' })
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    expect(b.open).not.toHaveBeenCalled()
  })

  it('does not offer direct capture for an unfinished turn', async () => {
    const b = await bench({ a: session('a') })
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'a', turns: [{
      turn: 1, startSeq: 10, endSeq: null, startedAt: 1000, messages: [{ role: 'user', seq: 11, text: '仍在生成' }],
    }], hasEarlier: false, hasLater: false } })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('仍在生成')
    expect(screen.queryByRole('button', { name: '将第 1 轮保存为知识' })).toBeNull()
    expect(b.saveKnowledge).not.toHaveBeenCalled()
  })
})

describe('research workflow discovery', () => {
  it('retains an out-of-topic follow-up selection until relation recovery succeeds', async () => {
    const b = await bench({ root: session('root'), followup: session('followup', { cwd: '/b', displayTitle: '继续验证' }) })
    const topic = { topicId: 'research', title: '研究', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    const card: KnowledgeCard = { cardId: crypto.randomUUID(), topicIds: [topic.topicId], revisions: [{
      revisionId: crypto.randomUUID(), requestHash: 'a'.repeat(64), number: 1, savedAt: 1000, content: knowledgeContent(), sources: [],
    }] }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [] } })
    b.searchKnowledge.mockResolvedValue({ ok: true, value: [card] })
    const pending = Promise.withResolvers<Awaited<ReturnType<TypertRemoteMap['sessionGraphReuse/relations']>>>()
    b.relationsReuse.mockImplementation(request => request.cardIds.length ? pending.promise : Promise.resolve({ ok: true, value: [] }))
    const key = workingPositionKey('test-host', workingPositionKey('test-host', '/w'), topic.topicId)
    saveWorkingPosition(key, { selected: 'followup' })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(b.relationsReuse).toHaveBeenCalledWith({ cardIds: [card.cardId], sessionIds: [] }, expect.any(AbortSignal)) })
    await act(async () => { pending.reject(new Error('Relations unavailable')) })
    expect(screen.getByRole('alert').textContent).toContain('后续研究关系读取失败')
    expect(loadWorkingPosition(key).selected).toBe('followup')
    b.relationsReuse.mockResolvedValue({ ok: true, value: [{ operationId: crypto.randomUUID(), targetSessionId: 'followup',
      question: '继续验证', workspace: { id: 'b', title: '工作区 B', cwd: '/b' }, acceptedAt: 2000,
      materials: [{ kind: 'card', cardId: card.cardId, revisionId: card.revisions[0]!.revisionId, revisionNumber: 1, title: card.revisions[0]!.content.title }],
    }] })
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByTestId('topic-source-panel')
    expect(screen.getByRole('heading', { name: '继续验证' })).toBeTruthy()
    expect(loadWorkingPosition(key).selected).toBe('followup')
    expect(b.open).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it('opens the knowledge library directly, updates the search heading, and returns focus to its entry', async () => {
    const b = await bench({ a: session('a') })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    // Container CSS switches between the toolbar and compact More entry.
    expect(screen.getAllByRole('button', { name: '新建知识卡片' }).length).toBeGreaterThan(0)
    const entry = screen.getByRole('button', { name: '知识卡片' })
    fireEvent.click(entry)
    const search = screen.getByRole('dialog', { name: '搜索知识卡片' })
    await waitFor(() => { expect(b.searchKnowledge).toHaveBeenCalledWith({ query: '' }, expect.any(AbortSignal)) })
    expect(within(search).getByRole('heading', { name: '搜索知识卡片' })).toBeTruthy()
    fireEvent.click(within(search).getByRole('button', { name: '讨论原文' }))
    expect(screen.getByRole('dialog', { name: '搜索历史讨论' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))
    await waitFor(() => { expect(document.activeElement).toBe(entry) })
    await b.fiber.dispose()
  })

  it('restores search defaults and the original mode across scope changes after opening the card library', async () => {
    const b = await bench({ root: session('root', { cwd: '/w' }) })
    const workspaceStore = createSnapshotStore(workspacesState([]))
    const directoryKey = workingPositionKey('test-host', '/w')
    const workspaceKey = workingPositionKey('test-host', 'workspace:a')
    mount(b.slots, b.sessionsStore, 'root', workspaceStore)
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '知识卡片' }))
    await waitFor(() => { expect(b.searchKnowledge).toHaveBeenCalledTimes(1) })
    fireEvent.click(screen.getByRole('button', { name: '讨论原文' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: '原范围关键词' } })

    await act(async () => { workspaceStore.set(workspacesState([workspace('a', '/w', ['root'])])) })
    expect(screen.getByRole('dialog', { name: '搜索历史讨论' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: '正文关键词' }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('combobox', { name: '搜索范围' }) as HTMLSelectElement).value).toBe('workspace:a')
    expect(loadWorkingPosition(workspaceKey).searchType).toBe('discussion')
    expect(loadWorkingPosition(directoryKey).discussion?.query).toBe('原范围关键词')

    await act(async () => { workspaceStore.set(workspacesState([])) })
    expect(screen.getByRole('dialog', { name: '搜索历史讨论' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: '正文关键词' }) as HTMLInputElement).value).toBe('原范围关键词')
    await waitFor(() => { expect(b.searchDiscussion).toHaveBeenCalledWith({
      query: '原范围关键词', scope: { kind: 'directory', cwd: '/w' }, includeArchived: false,
    }, expect.any(AbortSignal)) })
    expect(b.searchKnowledge).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    expect(screen.getByRole('dialog', { name: '搜索历史讨论' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))
    fireEvent.click(screen.getByRole('button', { name: '知识卡片' }))
    expect(screen.getByRole('dialog', { name: '搜索知识卡片' })).toBeTruthy()
    expect(b.open).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it.each(['discussion', 'knowledge'] as const)('restores saved %s conditions in a new scope after opening the card library', async searchType => {
    const b = await bench({ root: session('root', { cwd: '/w' }) })
    const workspaceStore = createSnapshotStore(workspacesState([]))
    const workspaceKey = workingPositionKey('test-host', 'workspace:a')
    const discussion = { query: '工作区原文条件', scope: { kind: 'workspace', workspaceId: 'a' }, includeArchived: true }
    const knowledge = { query: '工作区卡片条件', inTopic: false }
    localStorage.setItem(`dsh.session-graph.position.${workspaceKey}`, JSON.stringify({ v: 1, searchType, discussion, knowledge }))
    mount(b.slots, b.sessionsStore, 'root', workspaceStore)
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '知识卡片' }))
    await waitFor(() => { expect(b.searchKnowledge).toHaveBeenCalledWith({ query: '' }, expect.any(AbortSignal)) })

    await act(async () => { workspaceStore.set(workspacesState([workspace('a', '/w', ['root'])])) })
    expect(screen.getByRole('dialog', { name: searchType === 'discussion' ? '搜索历史讨论' : '搜索知识卡片' })).toBeTruthy()
    if (searchType === 'discussion') {
      await waitFor(() => { expect(b.searchDiscussion).toHaveBeenCalledWith(discussion, expect.any(AbortSignal)) })
      expect((screen.getByRole('checkbox', { name: zh['search.includeArchived'] }) as HTMLInputElement).checked).toBe(true)
      expect(b.searchKnowledge).toHaveBeenCalledTimes(1)
    } else {
      await waitFor(() => { expect(b.searchKnowledge).toHaveBeenCalledWith({ query: knowledge.query }, expect.any(AbortSignal)) })
      expect(b.searchDiscussion).not.toHaveBeenCalled()
    }
    expect(loadWorkingPosition(workspaceKey)).toMatchObject({ searchType, discussion, knowledge })
    expect(b.open).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it('selects a fixed card revision and an original turn inside materials while retaining the question and order', async () => {
    const b = await bench({ 'session-a': session('session-a') })
    const revision = { revisionId: 'picked-revision', requestHash: 'a'.repeat(64), number: 2, savedAt: 1000,
      content: knowledgeContent('选择器中的卡片'), sources: [knowledgeSource()] }
    b.searchKnowledge.mockResolvedValue({ ok: true, value: [{ cardId: 'picked-card', topicIds: [], revisions: [revision] }] })
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'session-a',
      turns: knowledgeSource().source.turns, hasEarlier: false, hasLater: false } })
    mount(b.slots, b.sessionsStore, 'session-a', workspacesState([{ workspaceId: 'b', title: '目标 B', path: '/b', sessionIds: [], createdAt: '', updatedAt: '' }]))
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '材料（0）' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新问题' }), { target: { value: '保留这个问题' } })
    fireEvent.click(screen.getByRole('button', { name: '选择材料' }))
    fireEvent.click(await screen.findByRole('button', { name: '将此修订加入材料' }))
    expect((screen.getByRole('button', { name: '已加入材料' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '讨论原文' }))
    fireEvent.change(screen.getByRole('combobox', { name: '选择来源会话' }), { target: { value: 'session-a' } })
    fireEvent.click(await screen.findByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '将所选轮次加入材料' }))
    fireEvent.click(screen.getByRole('button', { name: '完成选择，继续填写' }))
    expect((screen.getByRole('textbox', { name: '新问题' }) as HTMLTextAreaElement).value).toBe('保留这个问题')
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      expect.stringContaining('选择器中的卡片 · 第 2 版'), expect.stringContaining('Session session-a · 第 1 轮'),
    ])
    expect(b.prepareReuse).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('combobox', { name: '目标工作区' }), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: '预览发送内容' }))
    await waitFor(() => { expect(b.prepareReuse).toHaveBeenCalled() })
    expect(b.prepareReuse.mock.calls[0]![0]).toMatchObject({ question: '保留这个问题', workspaceId: 'b', materials: [
      { kind: 'card', cardId: 'picked-card', revisionId: 'picked-revision' },
      { kind: 'turn', sessionId: 'session-a', startSeq: 10, endSeq: 14 },
    ] })
    expect(b.saveKnowledge).not.toHaveBeenCalled()
    expect(b.open).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })
})

describe('Markdown export in the registered Graph', () => {
  it('previews selected cards, retries failure, and downloads the frozen text until another preview', async () => {
    const b = await bench({ a: session('a') })
    const card = (cardId: string, title: string): KnowledgeCard => ({ cardId, topicIds: ['topic-a'], revisions: [{
      revisionId: `revision-${cardId}`, requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
      content: { title, question: '', conclusion: '结论', rationale: '', openQuestions: '', kind: 'conclusion', status: 'draft' }, sources: [],
    }] })
    const cards = [card('card-a', '成果 A'), card('card-b', '成果 B')]
    b.searchKnowledge.mockResolvedValue({ ok: true, value: cards })
    b.listTopics.mockResolvedValue({ ok: true, value: [{ topicId: 'topic-a', title: '导出主题', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic: { topicId: 'topic-a', title: '导出主题', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }, sources: [] } })
    const frozen = { filename: '成果A.md', markdown: '# 成果 A\n\n第一版\n', cards: [{ cardId: 'card-a', revisionId: 'revision-one', number: 1, title: '成果 A' }] }
    b.prepareExport.mockRejectedValueOnce(new Error('Storage temporarily unavailable'))
    b.prepareExport.mockResolvedValue({ ok: true, value: frozen })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelector('[data-node-id="card:card-a"]')).not.toBeNull() })
    chooseCanvasAction('导出 Markdown')
    fireEvent.click(screen.getByRole('checkbox', { name: '成果 B' }))
    expect(b.prepareExport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '预览 Markdown' }))
    await screen.findByText('Storage temporarily unavailable')
    expect((screen.getByRole('button', { name: '下载 Markdown' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '预览 Markdown' }))
    await waitFor(() => { expect((screen.getByRole('textbox', { name: 'Markdown 预览' }) as HTMLTextAreaElement).value).toBe(frozen.markdown) })
    expect(b.prepareExport).toHaveBeenLastCalledWith({ cardIds: ['card-a'] }, expect.any(AbortSignal))
    const objectUrl = vi.fn((_blob: Blob) => 'blob:export-preview')
    vi.stubGlobal('URL', class extends URL { static createObjectURL = objectUrl; static revokeObjectURL = vi.fn() })
    let filename = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { filename = this.download })
    b.prepareExport.mockResolvedValue({ ok: true, value: { ...frozen, markdown: '# 成果 A\n\n第二版\n' } })
    fireEvent.click(screen.getByRole('button', { name: '下载 Markdown' }))
    expect(filename).toBe(frozen.filename)
    const blob = objectUrl.mock.calls[0]![0] as Blob
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => { resolve(String(reader.result)) }; reader.readAsText(blob) })
    expect(text).toBe(frozen.markdown)
    expect(b.prepareExport).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '预览 Markdown' }))
    await waitFor(() => { expect((screen.getByRole('textbox', { name: 'Markdown 预览' }) as HTMLTextAreaElement).value).toContain('第二版') })
    expect(b.saveKnowledge).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
  })
})

describe('Working position in the registered Graph', () => {
  it.each(['retained source', 'reviewed range', 'changed provenance', 'missing source'] as const)('restores long Original ranges through the real Host: %s', async scenario => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-long-original-'))
    const disposals: (() => Promise<void>)[] = [() => rm(root, { recursive: true, force: true })]
    try {
      const host = await topicHost(root, disposals)
      const discussion = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/w' } })
      for (let turn = 1; turn <= 12; turn++) {
        discussion.append('turn/start', { turn })
        discussion.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: `原文 ${turn}` }] }), { surfaceOp: 'append' })
        discussion.append('turn/end', { turn, reason: { kind: 'completed' } })
      }
      const leave = host.ctx.sessions.enter(discussion)
      host.ctx.effect(() => leave)
      const original = await host.ctx.sessionGraphHistory.read({ sessionId: discussion.id, limit: 20 }, new AbortController().signal)
      const first = original.turns[0]!
      const last = original.turns.at(-1)!
      const source = { sessionId: discussion.id, title: '长来源', source: { startSeq: first.startSeq, endSeq: last.endSeq!, turns: original.turns } }
      const b = await bench({ [discussion.id]: session(discussion.id) })
      disposals.push(async () => { await b.fiber.dispose() })
      const topic = { topicId: 'long-topic', title: '长来源研究', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
      const card: KnowledgeCard = { cardId: 'long-card', topicIds: [topic.topicId], revisions: [{
        revisionId: 'long-revision', requestHash: 'a'.repeat(64), number: 1, savedAt: 1000, content: knowledgeContent(), sources: [source],
      }] }
      b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
      b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [] } })
      b.searchKnowledge.mockResolvedValue({ ok: true, value: [card] })
      b.readHistory.mockImplementation(async (request, signal) => ({ ok: true, value: await host.ctx.typertGateway.invoke({
        namespace: 'sessionGraphHistory', method: 'read', args: { request }, signal: signal ?? new AbortController().signal,
      }) }))
      const key = workingPositionKey('test-host', workingPositionKey('test-host', '/w'), topic.topicId)
      mount(b.slots, b.sessionsStore, discussion.id)
      switchTab('Research Graph')
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      await waitFor(() => { expect(document.querySelector('[data-node-id="card:long-card"]')).not.toBeNull() })
      fireEvent.click(nodeButton(discussion.id))
      fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
      await waitFor(() => { expect((screen.getByRole('checkbox', { name: '选择第 12 轮' }) as HTMLInputElement).disabled).toBe(false) })
      if (scenario === 'reviewed range') {
        fireEvent.click(screen.getByRole('checkbox', { name: '选择第 2 轮' }))
        fireEvent.click(screen.getByRole('checkbox', { name: '选择第 12 轮' }))
        fireEvent.click(screen.getByRole('button', { name: '复核所选原文' }))
        await waitFor(() => { expect(screen.queryByRole('checkbox', { name: '选择第 1 轮' })).toBeNull() })
      }
      screen.getByTestId('topic-source-panel-scroll').scrollTop = 3000
      fireEvent.scroll(screen.getByTestId('topic-source-panel-scroll'))
      const range = { startSeq: original.turns[scenario === 'reviewed range' ? 1 : 0]!.startSeq, endSeq: last.endSeq! }
      expect(loadWorkingPosition(key).historyScroll?.[discussion.id]).toBe(3000)
      switchTab('Chat')
      if (scenario === 'missing source') leave()
      if (scenario === 'changed provenance') b.searchKnowledge.mockResolvedValue({ ok: true, value: [{ ...card,
        revisions: [...card.revisions, { ...card.revisions[0]!, revisionId: 'shorter-revision', number: 2,
          sources: [{ ...source, source: { startSeq: first.startSeq, endSeq: first.endSeq!, turns: [first] } }] }],
      }] })
      switchTab('Research Graph')
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      await waitFor(() => { expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: discussion.id, range }, expect.any(AbortSignal)) })
      if (scenario === 'missing source') {
        await screen.findByText(zh['position.unavailable'])
        expect(screen.queryByTestId('topic-source-panel')).toBeNull()
        expect(loadWorkingPosition(key)).toMatchObject({ selected: null, history: {}, historyRange: {}, historyScroll: {} })
      } else {
        await screen.findByText('原文 12')
        expect(screen.getByTestId('topic-source-panel-scroll').scrollTop).toBe(3000)
        expect(screen.getAllByRole('checkbox', { name: /^选择第/ })).toHaveLength(scenario === 'reviewed range' ? 11 : 12)
        expect(host.ctx.llm.stream).not.toHaveBeenCalled()
      }
      expect(b.open).not.toHaveBeenCalled()
    } finally {
      cleanup()
      for (const dispose of disposals.reverse()) await dispose()
    }
  })

  it.each(['available', 'transport failure', 'missing'] as const)('restores a card source Original after reopening its topic: %s', async outcome => {
    const source = knowledgeSource()
    const b = await bench({ 'session-a': session('session-a') })
    const topic = { topicId: 'source-topic', title: '来源研究', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    const card: KnowledgeCard = { cardId: 'source-card', topicIds: [topic.topicId], revisions: [{
      revisionId: 'source-revision', requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
      content: knowledgeContent(), sources: [source],
    }] }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [] } })
    b.searchKnowledge.mockResolvedValue({ ok: true, value: [card] })
    b.readKnowledge.mockResolvedValue({ ok: true, value: card })
    b.readHistory.mockImplementation(async request => {
      const later = request.anchorSeq === 20 || request.afterSeq === 10
      return { ok: true, value: { kind: 'original', sessionId: source.sessionId,
        turns: knowledgeSource(later ? 2 : 1).source.turns, hasEarlier: later, hasLater: !later } }
    })
    const key = workingPositionKey('test-host', workingPositionKey('test-host', '/w'), topic.topicId)
    mount(b.slots, b.sessionsStore, 'session-a')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelector('[data-node-id="card:source-card"]')).not.toBeNull() })
    fireEvent.click(nodeButton('session-a'))
    fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
    await screen.findByText('原文 1')
    fireEvent.click(screen.getByRole('button', { name: '加载更晚的讨论' }))
    await screen.findByText('原文 2')
    screen.getByTestId('topic-source-panel-scroll').scrollTop = 160
    fireEvent.scroll(screen.getByTestId('topic-source-panel-scroll'))
    expect(loadWorkingPosition(key)).toMatchObject({ selected: 'session-a', tab: 'history',
      history: { 'session-a': 20 }, historyScroll: { 'session-a': 160 } })
    switchTab('Chat')
    if (outcome === 'transport failure') b.readHistory.mockRejectedValueOnce(new Error('Connection lost'))
    if (outcome === 'missing') b.readHistory.mockResolvedValueOnce({ ok: true, value: {
      kind: 'unavailable', sessionId: source.sessionId, turns: [], hasEarlier: false, hasLater: false,
    } })
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'session-a', anchorSeq: 20 }, expect.any(AbortSignal)) })
    if (outcome === 'missing') {
      await screen.findByText(zh['position.unavailable'])
      expect(screen.queryByTestId('topic-source-panel')).toBeNull()
      expect(loadWorkingPosition(key)).toMatchObject({ selected: null, history: {}, historyScroll: {} })
      b.readHistory.mockResolvedValueOnce({ ok: true, value: { kind: 'excerpt', sessionId: source.sessionId,
        turns: source.source.turns, hasEarlier: false, hasLater: false } })
      fireEvent.click(nodeButton('session-a'))
      fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
      await screen.findByText(zh['history.excerptHint'])
      expect(screen.getByText('原文 1')).toBeTruthy()
      expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'session-a', source: source.source }, expect.any(AbortSignal))
    } else {
      if (outcome === 'transport failure') {
        await screen.findByRole('alert')
        expect(screen.getByText('原文 1')).toBeTruthy()
        expect(screen.getByText(zh['history.excerpt'])).toBeTruthy()
        expect(loadWorkingPosition(key).historyScroll?.['session-a']).toBe(160)
        fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
      }
      await screen.findByText('原文 2')
      expect(screen.getByTestId('topic-source-panel-scroll').scrollTop).toBe(160)
      fireEvent.doubleClick(document.querySelector('[data-node-kind="knowledge"]')!)
      const dialog = await screen.findByRole('dialog', { name: '知识卡片' })
      fireEvent.click(await within(dialog).findByRole('button', { name: /查看来源原文/ }))
      await within(within(dialog).getByRole('region', { name: '讨论原文' })).findByText('原文 1')
      expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'session-a', source: source.source }, expect.any(AbortSignal))
    }
    expect(b.open).not.toHaveBeenCalled()
  })

  it('restores an explicitly reopened topic and its unsaved arrangement, then returns to the list if it disappeared', async () => {
    const fixture = researchTopicFixture()
    const a = { ...fixture.a, sources: fixture.a.sources.slice(0, 2), topic: { ...fixture.a.topic, references: fixture.a.topic.references.slice(0, 2) } }
    const bTopic = { ...a, topic: { ...a.topic, topicId: fixture.b.topic.topicId, title: '研究 B' } }
    const b = await bench({ ...fixture.rows, viewed: session('viewed') })
    b.listTopics.mockResolvedValue({ ok: true, value: [a.topic, bTopic.topic] })
    b.readTopic.mockImplementation(async request => ({ ok: true, value: request.topicId === a.topic.topicId ? a : bTopic }))
    mount(b.slots, b.sessionsStore, 'viewed')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await screen.findByRole('combobox', { name: '选择研究主题' })
    fireEvent.change(screen.getByRole('combobox', { name: '选择研究主题' }), { target: { value: bTopic.topic.topicId } })
    await waitFor(() => { expect(document.querySelector('[data-node-id="source-0001"]')).not.toBeNull() })
    const node = nodeButton('source-0001')
    fireEvent.pointerDown(node, { pointerId: 7, clientX: 200, clientY: 200 })
    act(() => {
      fireEvent.pointerMove(node, { pointerId: 7, clientX: 320, clientY: 280 })
      fireEvent.pointerUp(node, { pointerId: 7 })
    })
    const left = nodeButton('source-0001').style.left
    fireEvent.click(nodeButton('source-0001'))
    fireEvent.click(nodeButton('source-0001'))
    expect(screen.getByTestId('topic-source-panel')).toBeTruthy()
    switchTab('Chat')
    switchTab('Research Graph')
    expect(screen.queryByRole('combobox', { name: '选择研究主题' })).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await screen.findByTestId('topic-source-panel')
    expect((screen.getByRole('combobox', { name: '选择研究主题' }) as HTMLSelectElement).value).toBe(bTopic.topic.topicId)
    expect(nodeButton('source-0001').style.left).toBe(left)
    expect((screen.getByRole('button', { name: zh['topic.saveArrangement'] }) as HTMLButtonElement).disabled).toBe(false)
    expect(b.writeTopic).not.toHaveBeenCalled()
    switchTab('Chat')
    b.listTopics.mockResolvedValue({ ok: true, value: [a.topic] })
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await screen.findByText('上次的研究主题已不可用，请从列表选择主题。')
    expect(document.querySelector('[data-node-id]')).toBeNull()
    expect(b.open).not.toHaveBeenCalled()
  })

  it('requeries restored search conditions and discards a late response after closing', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: zh['search.open'] }))
    fireEvent.change(screen.getByRole('textbox', { name: zh['search.query'] }), { target: { value: '研究结论' } })
    fireEvent.click(screen.getByRole('checkbox', { name: zh['search.includeArchived'] }))
    fireEvent.click(screen.getByRole('button', { name: zh['search.submit'] }))
    await waitFor(() => { expect(b.searchDiscussion).toHaveBeenCalledTimes(1) })
    fireEvent.click(screen.getByRole('button', { name: zh['search.close'] }))
    const late = deferred<Awaited<ReturnType<TypertRemoteMap['sessionGraphSearch/search']>>>()
    b.searchDiscussion.mockReturnValueOnce(late.promise)
    fireEvent.click(screen.getByRole('button', { name: zh['search.open'] }))
    await waitFor(() => { expect(b.searchDiscussion).toHaveBeenCalledTimes(2) })
    expect(b.searchDiscussion.mock.calls[1]![0]).toEqual({ query: '研究结论', scope: { kind: 'directory', cwd: '/w' }, includeArchived: true })
    fireEvent.click(screen.getByRole('button', { name: zh['search.close'] }))
    expect(b.searchDiscussion.mock.calls[1]![1]!.aborted).toBe(true)
    await act(async () => { late.resolve({ ok: true, value: { kind: 'results', hits: [] } }) })
    fireEvent.click(screen.getByRole('button', { name: zh['search.open'] }))
    await waitFor(() => { expect(b.searchDiscussion).toHaveBeenCalledTimes(3) })
    expect(b.open).not.toHaveBeenCalled()
  })

  it('isolates Hosts and same-directory Workspaces, clears missing selections, and tolerates corrupt browser state', async () => {
    const b = await bench(FIXTURE)
    const first = workspacesState([workspace('first', '/w', ['root'])])
    mount(b.slots, b.sessionsStore, 'root', first)
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    fireEvent.click(nodeButton('branchChild'))
    const scale = screen.getByRole('button', { name: '缩放至 100%' }).textContent
    cleanup()
    mount(b.slots, b.sessionsStore, 'root', workspacesState([workspace('second', '/w', ['root'])]))
    switchTab('Research Graph')
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    cleanup()
    const anotherHost = await bench(FIXTURE, 'another-host')
    mount(anotherHost.slots, anotherHost.sessionsStore, 'root', first)
    switchTab('Research Graph')
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    cleanup()
    const { branchChild: _, ...remaining } = FIXTURE
    b.sessionsStore.set(listState(remaining))
    mount(b.slots, b.sessionsStore, 'root', first)
    switchTab('Research Graph')
    await screen.findByText(zh['position.unavailable'])
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe(scale)
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    expect(b.open).not.toHaveBeenCalled()
    cleanup()
    localStorage.setItem('dsh.session-graph.position.["test-host","workspace:first",null]', '{broken')
    mount(b.slots, b.sessionsStore, 'root', first)
    switchTab('Research Graph')
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('restores viewport, selection and Original position after reopening without navigating', async () => {
    const b = await bench(FIXTURE)
    const turn = { turn: 8, startSeq: 80, endSeq: 89, startedAt: 1000, messages: [{ role: 'user' as const, seq: 81, text: '研究位置' }] }
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'root', turns: [turn], hasEarlier: false, hasLater: false } })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('研究位置')
    const panel = screen.getByTestId('session-graph-panel-scroll')
    panel.scrollTop = 380
    fireEvent.scroll(panel)
    const scale = screen.getByRole('button', { name: '缩放至 100%' }).textContent
    const position = screen.getByRole('group', { name: zh['canvas.description'] }).style.backgroundPosition
    switchTab('Chat')
    switchTab('Research Graph')
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe(scale)
    expect(screen.getByRole('group', { name: zh['canvas.description'] }).style.backgroundPosition).toBe(position)
    await screen.findByText('研究位置')
    expect(screen.getByTestId('session-graph-panel-scroll').scrollTop).toBe(380)
    expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'root', anchorSeq: 80 }, expect.any(AbortSignal))
    expect(b.open).not.toHaveBeenCalled()
    switchTab('Chat')
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'unavailable', sessionId: 'root', turns: [], hasEarlier: false, hasLater: false } })
    switchTab('Research Graph')
    await screen.findByText(zh['position.unavailable'])
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe(scale)
  })
})

describe('Research reuse registered Graph workflow', () => {
  it('previews one turn, stays in research after admission, and explicitly opens the same retry target', async () => {
    const b = await bench({ a: session('a') })
    const source = { sessionId: 'a', title: 'A', source: { startSeq: 10, endSeq: 14,
      turns: [{ turn: 1, startSeq: 10, endSeq: 14, startedAt: 1000, messages: [{ role: 'user' as const, seq: 11, text: '所选原文' }] }] } }
    const record: ResearchReuseRecord = { operationId: 'reuse-one', requestHash: 'a'.repeat(64), requestId: 'request-one',
      targetSessionId: 'research-target', targetCreated: false, stage: 'prepared', workspace: { id: 'b', title: '目标 B', cwd: '/b' },
      createdAt: 1000, question: '新研究问题', materials: [{ kind: 'turn', source }], promptText: '预览中的完整发送内容', budgetChars: 32_000 }
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'a', turns: source.source.turns, hasEarlier: false, hasLater: false } })
    b.prepareReuse.mockResolvedValue({ ok: true, value: record })
    b.submitReuse.mockResolvedValueOnce({ ok: true, value: { ...record, targetCreated: true, stage: 'created', error: 'Admission failed' } })
    const receipt = deferred<Awaited<ReturnType<TypertRemoteMap['sessionGraphReuse/submit']>>>()
    b.submitReuse.mockReturnValueOnce(receipt.promise)
    mount(b.slots, b.sessionsStore, 'a', workspacesState([{ workspaceId: 'b', title: '目标 B', path: '/b', sessionIds: [], createdAt: '', updatedAt: '' }]))
    switchTab('Research Graph')
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '将所选轮次加入材料' }))
    fireEvent.click(screen.getByRole('button', { name: '材料（1）' }))
    const dialog = await screen.findByRole('dialog', { name: '开始新讨论' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '新问题' }), { target: { value: '新研究问题' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: '目标工作区' }), { target: { value: 'b' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '预览发送内容' }))
    await within(dialog).findByText('预览中的完整发送内容')
    expect(b.submitReuse).not.toHaveBeenCalled()
    expect(b.prepareReuse.mock.calls[0]![0]).toMatchObject({ workspaceId: 'b', question: '新研究问题',
      materials: [{ kind: 'turn', sessionId: 'a', startSeq: 10, endSeq: 14 }] })
    fireEvent.click(within(dialog).getByRole('button', { name: '确认并开始讨论' }))
    await within(dialog).findByRole('button', { name: '打开目标会话' })
    expect(b.open).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: '重试发送' }))
    expect(b.open).not.toHaveBeenCalled()
    await act(async () => { receipt.resolve({ ok: true, value: { ...record, targetCreated: true, stage: 'accepted', acceptedAt: 2000 } }) })
    expect(b.open).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: '打开目标会话' }))
    expect(b.open).toHaveBeenCalledExactlyOnceWith(id('research-target'))
    expect(b.submitReuse.mock.calls.map(call => call[0])).toEqual([{ operationId: 'reuse-one' }, { operationId: 'reuse-one' }])
  })
})

describe('Knowledge Cards registered Graph workflow', () => {
  it('shows extraction scope, cancels late generation and keeps edited drafts when generating another batch', async () => {
    const b = await bench({ a: session('a') })
    const source = { sessionId: 'a', title: 'Discussion A', source: { startSeq: 10, endSeq: 14,
      turns: [{ turn: 1, startSeq: 10, endSeq: 14, startedAt: 1000, messages: [{ role: 'user' as const, seq: 11, text: '明确的测试证据' }] }] } }
    const preview: ExtractionPreparation = { preparationId: 'preview-one', selected: source, included: source, omitted: [], budgetChars: 20_000,
      materialText: '明确的测试证据', route: { provider: 'fixture', model: 'fixed-v1' } }
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'a', turns: source.source.turns, hasEarlier: false, hasLater: false } })
    b.prepareExtraction.mockResolvedValue({ ok: true, value: preview })
    const output = { provider: 'fixture', model: 'fixed-v1', drafts: [{ cardId: 'card-ai', revisionId: 'revision-ai', invalidCitations: 1, needsVerification: true,
      content: { title: 'AI 初稿', question: '', conclusion: '模型结论', rationale: '', openQuestions: '', kind: 'method' as const, status: 'draft' as const }, sources: [],
    }] }
    const late = deferred<Awaited<ReturnType<TypertRemoteMap['sessionGraphKnowledge/extract']>>>()
    b.extractKnowledge.mockReturnValueOnce(late.promise)
    b.extractKnowledge.mockResolvedValue({ ok: true, value: output })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '提炼知识' }))
    const dialog = await screen.findByRole('dialog', { name: '提炼知识' })
    fireEvent.click(within(dialog).getByRole('button', { name: '预览纳入材料' }))
    await within(dialog).findAllByText('明确的测试证据')
    expect(b.extractKnowledge).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: '生成知识草稿' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '取消生成' }))
    expect(b.extractKnowledge.mock.calls[0]![1]!.aborted).toBe(true)
    await act(async () => { late.resolve({ ok: true, value: output }) })
    expect(within(dialog).queryByRole('textbox', { name: '结论' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: '生成知识草稿' }))
    const conclusion = await within(dialog).findByRole('textbox', { name: '结论' }) as HTMLTextAreaElement
    fireEvent.change(conclusion, { target: { value: '人工改写，必须保留' } })
    expect(within(dialog).getByText('待验证：请核对推论并补充有效来源。')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '追加一组草稿' }))
    await waitFor(() => { expect(within(dialog).getAllByRole('textbox', { name: '结论' })).toHaveLength(2) })
    expect(conclusion.value).toBe('人工改写，必须保留')
    expect(b.saveKnowledge).not.toHaveBeenCalled()
  })
  it('finds a card through the shared search entry and draws an explicit source relation in its topic', async () => {
    const b = await bench({ a: session('a') })
    const fixture = researchTopicFixture()
    // Large-topic behavior has its own 1,000-reference acceptance below.
    const topic = { ...fixture.a.topic, references: fixture.a.topic.references.slice(0, 2) }
    const card: KnowledgeCard = { cardId: 'card-one', topicIds: [topic.topicId], revisions: [{
      revisionId: 'revision-one', requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
      content: { title: '可重用的方法', question: '', conclusion: '先核验来源', rationale: '', openQuestions: '', kind: 'method', status: 'draft' },
      sources: [{ sessionId: 'a', title: 'A', source: { startSeq: 10, endSeq: 14,
        turns: [{ turn: 1, startSeq: 10, endSeq: 14, startedAt: 1000, messages: [{ role: 'user', seq: 11, text: '证据' }] }] } }],
    }] }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: fixture.a.sources.slice(0, 2) } })
    b.searchKnowledge.mockResolvedValue({ ok: true, value: [card] })
    b.readKnowledge.mockResolvedValue({ ok: true, value: card })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelector('[data-node-kind="knowledge"]')).not.toBeNull() })
    expect(document.querySelectorAll('[data-edge-kind="source"]')).toHaveLength(1)
    b.readHistory.mockRejectedValueOnce(new Error('Transport unavailable'))
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
    const sourcePanel = within(screen.getByTestId('topic-source-panel'))
    await sourcePanel.findByRole('alert')
    expect(sourcePanel.getByText('证据')).toBeTruthy()
    expect(sourcePanel.getByText(zh['history.excerpt'])).toBeTruthy()
    fireEvent.doubleClick(document.querySelector('[data-node-kind="knowledge"]')!)
    expect(b.open).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: '知识卡片' })
    await within(dialog).findByText('先核验来源')
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭卡片' }))
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.click(within(screen.getByRole('group', { name: '搜索内容' })).getByRole('button', { name: '知识卡片' }))
    fireEvent.change(screen.getByRole('textbox', { name: '关键词' }), { target: { value: '方法' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索知识卡片' }))
    await screen.findByRole('button', { name: /可重用的方法/ })
    expect(b.searchDiscussion).not.toHaveBeenCalled()
    expect(b.searchKnowledge).toHaveBeenLastCalledWith({ query: '方法' }, expect.any(AbortSignal))
  })
  it('retains an edited draft after a failed save and retries the same card before reading the saved source', async () => {
    const b = await bench({ a: session('a') })
    const turn = { turn: 1, startSeq: 10, endSeq: 14, startedAt: 1000,
      messages: [{ role: 'user' as const, seq: 11, text: '需要保存的讨论' }] }
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'a', turns: [turn], hasEarlier: false, hasLater: false } })
    b.saveKnowledge.mockRejectedValueOnce(new Error('Connection failed'))
    b.saveKnowledge.mockImplementationOnce(async request => ({ ok: true, value: {
      cardId: request.cardId, topicIds: [], revisions: [{ revisionId: request.revisionId, requestHash: 'a'.repeat(64),
        number: 1, savedAt: 1000, content: request.content,
        sources: [{ sessionId: 'a', title: 'Source A', source: { startSeq: 10, endSeq: 14, turns: [turn] } }],
      }],
    } }))
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '保存为知识卡片' }))
    let dialog = await screen.findByRole('dialog', { name: '知识卡片' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '卡片标题' }), { target: { value: '证据方法' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '结论' }), { target: { value: '保留精确轮次' } })
    await waitFor(() => { expect((within(dialog).getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存知识' }))
    await within(dialog).findByRole('alert')
    expect((within(dialog).getByRole('textbox', { name: '结论' }) as HTMLTextAreaElement).value).toBe('保留精确轮次')
    await waitFor(() => { expect((within(dialog).getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存知识' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '知识卡片' })).toBeNull() })
    const saved = (await b.saveKnowledge.mock.results[1]!.value) as { ok: true; value: KnowledgeCard }
    b.readKnowledge.mockResolvedValue(saved)
    expect(screen.getByRole('status').textContent).toContain('已保存「证据方法」')
    fireEvent.click(screen.getByRole('button', { name: '查看知识' }))
    dialog = await screen.findByRole('dialog', { name: '知识卡片' })
    await within(dialog).findByRole('button', { name: '编辑卡片' })
    expect(b.saveKnowledge.mock.calls[1]![0]).toEqual(b.saveKnowledge.mock.calls[0]![0])
    expect(b.saveKnowledge.mock.calls[0]![0]).toMatchObject({ sources: [{ kind: 'discussion', sessionId: 'a', startSeq: 10, endSeq: 14 }] })
    expect(within(dialog).getByText('保留精确轮次')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '导出 Markdown' }))
    expect(within(screen.getByRole('dialog', { name: '导出 Markdown' })).getByRole('checkbox', { name: '证据方法' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭导出' }))
    expect(within(screen.getByRole('dialog', { name: '知识卡片' })).getByText('保留精确轮次')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /查看来源原文/ }))
    await waitFor(() => { expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'a', source: { startSeq: 10, endSeq: 14, turns: [turn] } }, expect.any(AbortSignal)) })
    expect(b.open).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑卡片' }))
    fireEvent.change(within(dialog).getByRole('textbox', { name: '结论' }), { target: { value: '丢弃的修改' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '放弃编辑' }))
    fireEvent.click(screen.getByRole('button', { name: '放弃未保存内容' }))
    expect(within(dialog).getByText('保留精确轮次')).toBeTruthy()
    expect(within(dialog).queryByText('丢弃的修改')).toBeNull()
    expect(b.saveKnowledge).toHaveBeenCalledTimes(2)
  })
})

describe('Research Topics registered Graph workflow', () => {
  describe('creation with an uncertain response', () => {
    const cleanups: (() => Promise<void>)[] = []
    let root: string
    let host: Awaited<ReturnType<typeof topicHost>>
    let b: Awaited<ReturnType<typeof bench>>
    let input: HTMLInputElement

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'session-graph-topic-retry-'))
      cleanups.push(() => rm(root, { recursive: true, force: true }))
      host = await topicHost(root, cleanups)
      b = await bench({ a: session('a') })
      cleanups.push(async () => { await b.fiber.dispose() })
      b.listTopics.mockImplementation(async signal => ({ ok: true, value: await host.invoke('list', undefined, signal) }))
      b.readTopic.mockImplementation(async (request, signal) => ({ ok: true, value: await host.invoke('read', request, signal) }))
      b.writeTopic.mockImplementation(async (request, signal) => ({ ok: true, value: await host.invoke('write', request, signal) }))
      b.writeTopic.mockImplementationOnce(async (request, signal) => {
        await host.invoke('write', request, signal)
        throw new Error('Connection closed after durable create')
      })
      mount(b.slots, b.sessionsStore, 'a')
      switchTab('Research Graph')
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      input = await screen.findByRole('textbox', { name: '新主题名称' }) as HTMLInputElement
      fireEvent.change(input, { target: { value: '原名称 A' } })
      fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
      await screen.findByRole('alert')
      expect(input.value).toBe('原名称 A')
      await host.ctx.fiber.dispose()
      host = await topicHost(root, cleanups)
      expect(await host.invoke('list')).toMatchObject([{ title: '原名称 A' }])
    })

    afterEach(async () => {
      cleanup()
      for (const dispose of cleanups.splice(0).reverse()) await dispose()
    })

    it('saves an amended create title after the Host restarts', async () => {
      const saved = await host.invoke('list')
      fireEvent.change(input, { target: { value: '修改后的名称 B' } })
      fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
      await screen.findByRole('option', { name: '修改后的名称 B (0)' })
      expect(screen.queryByRole('textbox', { name: '新主题名称' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '主题选项' }))
      fireEvent.click(screen.getByRole('button', { name: '重命名' }))
      expect((screen.getByRole('textbox', { name: '主题名称' }) as HTMLInputElement).value).toBe('修改后的名称 B')
      expect(screen.queryByRole('alert')).toBeNull()
      await host.ctx.fiber.dispose()
      host = await topicHost(root, cleanups)
      expect(await host.invoke('list')).toEqual([{ ...saved[0], title: '修改后的名称 B' }])
    })

    it('preserves other client changes when retrying an unchanged name', async () => {
      const [saved] = await host.invoke('list')
      await host.invoke('write', { kind: 'rename', topicId: saved.topicId, title: '另一客户端的名称' })
      const updated = await host.invoke('write', {
        kind: 'arrange', topicId: saved.topicId,
        arrangement: { positions: { source: { x: 10, y: 20 } }, collapsed: ['source'], offsets: {} },
      })
      fireEvent.change(input, { target: { value: '  原名称 A  ' } })
      fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
      await screen.findByRole('option', { name: '另一客户端的名称 (0)' })
      expect(screen.queryByRole('textbox', { name: '新主题名称' })).toBeNull()
      expect(await host.invoke('list')).toEqual([updated])
    })

    it.each([
      { failure: 'before saving', committed: false, saved: '原名称 A', retry: '修改后的名称 B' },
      { failure: 'after saving', committed: true, saved: '修改后的名称 B', retry: '原名称 A' },
    ])('retains the amended input when rename fails $failure and saves the next retry', async scenario => {
      let failRename = true
      b.writeTopic.mockImplementation(async (request, signal) => {
        if (request.kind === 'rename' && failRename) {
          failRename = false
          if (scenario.committed) await host.invoke('write', request, signal)
          throw new Error('Connection failed during rename')
        }
        return { ok: true, value: await host.invoke('write', request, signal) }
      })
      fireEvent.change(input, { target: { value: '修改后的名称 B' } })
      fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
      await screen.findByRole('alert')
      expect(input.value).toBe('修改后的名称 B')
      expect(input.disabled).toBe(false)
      const saved = await host.invoke('list')
      expect(saved).toHaveLength(1)
      expect(saved[0].title).toBe(scenario.saved)
      fireEvent.change(input, { target: { value: scenario.retry } })
      fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
      await screen.findByRole('option', { name: `${scenario.retry} (0)` })
      expect(screen.queryByRole('textbox', { name: '新主题名称' })).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(await host.invoke('list')).toEqual([{ ...saved[0], title: scenario.retry }])
    })

    it('abandons a late recovered create without renaming after the view closes', async () => {
      const response = deferred<void>()
      const received = deferred<void>()
      b.writeTopic.mockImplementationOnce(async (request, signal) => {
        const value = await host.invoke('write', request, signal)
        received.resolve()
        await response.promise
        return { ok: true, value }
      })
      fireEvent.change(input, { target: { value: '修改后的名称 B' } })
      fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
      await received.promise
      expect(input.disabled).toBe(true)
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'workspace' } })
      await act(async () => { response.resolve() })
      expect(screen.queryByRole('textbox', { name: '新主题名称' })).toBeNull()
      expect((await host.invoke('list')).map(topic => topic.title)).toEqual(['原名称 A'])
    })
  })

  it('keeps an open topic reference when the live Workspace feed archives its source', async () => {
    const b = await bench({ a: session('a') })
    const reference = { sessionId: 'a', title: 'Source A' }
    const topic = { topicId: 'topic-a', title: '研究 A', references: [reference], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [{ ...reference, status: 'listed', archived: false }] } })
    const workspaces = createSnapshotStore(workspacesState())
    mount(b.slots, b.sessionsStore, 'a', workspaces)
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelectorAll('[data-node-id]')).toHaveLength(1) })
    fireEvent.click(nodeButton('a'))
    await act(async () => { workspaces.set({ ...workspacesState(), archivedSessionIds: [id('a')] }) })
    expect(nodeButton('a').textContent).toContain('已归档')
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('已归档')
    expect((screen.getByRole('button', { name: '打开会话' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.doubleClick(nodeButton('a'))
    expect(b.open).not.toHaveBeenCalled()
    expect(b.readHistory).not.toHaveBeenCalled()
    expect(b.writeTopic).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it('switches 1,000 references, selects and locates sources, cancels reads, and rejects late results after switching or closing', async () => {
    const fixture = researchTopicFixture()
    const b = await bench({ ...fixture.rows, viewed: session('viewed') })
    b.listTopics.mockResolvedValue({ ok: true, value: [fixture.a.topic, fixture.b.topic] })
    const lateA = deferred<Awaited<ReturnType<TypertRemoteMap['sessionGraphTopics/read']>>>()
    b.readTopic.mockImplementationOnce(() => lateA.promise)
    b.readTopic.mockResolvedValue({ ok: true, value: fixture.b })
    const ui = mount(b.slots, b.sessionsStore, 'viewed', {
      ...workspacesState(), archivedSessionIds: fixture.b.sources.filter(source => source.archived).map(source => id(source.sessionId)),
    })
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(b.readTopic).toHaveBeenCalledTimes(1) })
    const topicSelect = screen.getByRole('combobox', { name: '选择研究主题' })
    const switchStarted = performance.now()
    fireEvent.change(topicSelect, { target: { value: fixture.b.topic.topicId } })
    await waitFor(() => { expect(document.querySelectorAll('[data-node-id]')).toHaveLength(1_000) })
    const switched = performance.now()
    expect(b.readTopic.mock.calls[0]![1]!.aborted).toBe(true)
    await act(async () => { lateA.resolve({ ok: true, value: fixture.a }) })
    expect(document.querySelectorAll('[data-node-id]')).toHaveLength(1_000)
    expect(b.readHistory).not.toHaveBeenCalled()
    fireEvent.click(nodeButton('source-0990'))
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('研究工作区 2')
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('已归档')
    const selected = performance.now()
    const lateOriginal = deferred<Awaited<ReturnType<TypertRemoteMap['sessionGraphHistory/read']>>>()
    b.readHistory.mockImplementationOnce(() => lateOriginal.promise)
    const sourcePanel = within(screen.getByTestId('topic-source-panel'))
    fireEvent.click(sourcePanel.getByRole('button', { name: '阅读原文' }))
    await waitFor(() => { expect(b.readHistory).toHaveBeenCalledTimes(1) })
    fireEvent.click(sourcePanel.getByRole('button', { name: '取消读取' }))
    expect(b.readHistory.mock.calls[0]![1]!.aborted).toBe(true)
    expect((sourcePanel.getByRole('button', { name: '打开会话' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(nodeButton('source-0991'))
    fireEvent.click(screen.getByRole('button', { name: '打开会话' }))
    expect(b.open).toHaveBeenCalledWith('source-0991')
    const located = performance.now()
    fireEvent.click(nodeButton('source-0999'))
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('来源不可用')
    await act(async () => { lateOriginal.resolve({ ok: true, value: { kind: 'unavailable', sessionId: 'source-0990' } }) })
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('资料 0999')
    const closing = deferred<Awaited<ReturnType<TypertRemoteMap['sessionGraphTopics/read']>>>()
    b.readTopic.mockImplementationOnce(() => closing.promise)
    fireEvent.change(topicSelect, { target: { value: fixture.a.topic.topicId } })
    await waitFor(() => { expect(b.readTopic).toHaveBeenCalledTimes(3) })
    ui.unmount()
    expect(b.readTopic.mock.calls[2]![1]!.aborted).toBe(true)
    await act(async () => { closing.resolve({ ok: true, value: fixture.a }) })
    expect(document.querySelectorAll('[data-node-id]')).toHaveLength(0)
    if (process.env.SESSION_GRAPH_PERFORMANCE_REPORT) writeFileSync(process.env.SESSION_GRAPH_PERFORMANCE_REPORT, JSON.stringify({
      references: 1000, archived: 200, missing: 100,
      switchMs: switched - switchStarted, selectMs: selected - switched, readCancelLocateMs: located - selected,
    }, null, 2))
    await b.fiber.dispose()
  }, 30_000)

  it('adds a cross-Workspace archived search result without changing Viewed Session', async () => {
    const b = await bench({ viewed: session('viewed') })
    const topic = { topicId: 'topic-a', title: '研究 A', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.searchDiscussion.mockResolvedValue({ ok: true, value: { kind: 'results', hits: [{
      sessionId: 'outside', title: '跨工作区资料', archived: true, eventSeq: 2, turnStartSeq: 0, time: 1000, snippet: 'needle',
    }] } })
    b.writeTopic.mockResolvedValue({ ok: true, value: { ...topic, references: [{ sessionId: 'outside', title: '跨工作区资料' }] } })
    mount(b.slots, b.sessionsStore, 'viewed')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '查看原文：跨工作区资料' }))
    fireEvent.click(screen.getByRole('button', { name: '加入研究主题' }))
    await screen.findByRole('option', { name: '研究 A (0)' })
    fireEvent.click(screen.getByRole('button', { name: '加入所选主题' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '加入研究主题' })).toBeNull() })
    expect(b.writeTopic.mock.calls[0]![0]).toEqual({ kind: 'add', topicId: topic.topicId, sessionIds: ['outside'] })
    expect(screen.getByRole('dialog', { name: zh['search.title'] })).toBeTruthy()
    expect(b.open).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it('keeps each topic arrangement and retains an unsaved reset across switches and a failed retry', async () => {
    const b = await bench({ a: session('a') })
    const references = [{ sessionId: 'a', title: 'Source A' }]
    const topics = ['a', 'b'].map((key, index) => ({
      topicId: `topic-${key}`, title: `研究 ${key}`, references,
      arrangement: { positions: { a: { x: 100 + index * 400, y: 200 } }, collapsed: [], offsets: {} },
    }))
    b.listTopics.mockResolvedValue({ ok: true, value: topics })
    b.readTopic.mockImplementation(async request => ({ ok: true, value: {
      topic: topics.find(topic => topic.topicId === request.topicId)!,
      sources: [{ ...references[0]!, status: 'listed', archived: false }],
    } }))
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(nodeButton('a').style.left).toBe('100px') })
    chooseCanvasAction('重新布局')
    expect(nodeButton('a').style.left).toBe('0px')
    expect(b.writeTopic).not.toHaveBeenCalled()
    chooseCanvasAction('撤销重新布局')
    expect(nodeButton('a').style.left).toBe('100px')
    expect(b.writeTopic).not.toHaveBeenCalled()
    chooseCanvasAction('重置布局')
    const resetPosition = nodeButton('a').style.left
    expect(resetPosition).not.toBe('100px')
    fireEvent.change(screen.getByRole('combobox', { name: '选择研究主题' }), { target: { value: 'topic-b' } })
    await waitFor(() => { expect(nodeButton('a').style.left).toBe('500px') })
    fireEvent.change(screen.getByRole('combobox', { name: '选择研究主题' }), { target: { value: 'topic-a' } })
    await waitFor(() => { expect(nodeButton('a').style.left).toBe(resetPosition) })
    b.writeTopic.mockRejectedValueOnce(new Error('Storage unavailable'))
    fireEvent.click(screen.getByRole('button', { name: '保存排列' }))
    await screen.findByRole('alert')
    expect(nodeButton('a').style.left).toBe(resetPosition)
    const arrangement = { positions: {}, collapsed: [], offsets: {} }
    b.writeTopic.mockResolvedValueOnce({ ok: true, value: { ...topics[0]!, arrangement } })
    screen.getByRole('button', { name: '保存排列' }).focus()
    fireEvent.click(screen.getByRole('button', { name: '保存排列' }))
    await waitFor(() => { expect(screen.queryByRole('button', { name: '保存排列' })).toBeNull() })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '主题选项' }))
    expect(b.writeTopic.mock.calls.map(([request]) => request)).toEqual([
      { kind: 'arrange', topicId: 'topic-a', arrangement }, { kind: 'arrange', topicId: 'topic-a', arrangement },
    ])
    expect(document.querySelectorAll('[data-node-id]')).toHaveLength(1)
    expect(localStorage.getItem('dsh.session-graph.layout.topic:topic-a')).toBeNull()
    await b.fiber.dispose()
  })

  it('adds the Selected Session to a chosen topic and preserves the selection after a failed save', async () => {
    const b = await bench({ a: session('a') })
    const topic = { topicId: 'topic-a', title: '研究 A', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('button', { name: '加入研究主题' }))
    await screen.findByRole('option', { name: '研究 A (0)' })
    b.writeTopic.mockRejectedValueOnce(new Error('Storage unavailable'))
    fireEvent.click(screen.getByRole('button', { name: '加入所选主题' }))
    await screen.findByRole('alert')
    expect((screen.getByRole('combobox', { name: '选择研究主题' }) as HTMLSelectElement).value).toBe(topic.topicId)
    b.writeTopic.mockResolvedValueOnce({ ok: true, value: { ...topic, references: [{ sessionId: 'a', title: 'Session a' }] } })
    fireEvent.click(screen.getByRole('button', { name: '加入所选主题' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '加入研究主题' })).toBeNull() })
    expect(b.writeTopic.mock.calls.map(([request]) => request)).toEqual([
      { kind: 'add', topicId: 'topic-a', sessionIds: ['a'] }, { kind: 'add', topicId: 'topic-a', sessionIds: ['a'] },
    ])
    expect(b.open).not.toHaveBeenCalled()
    expect(document.querySelector('[data-node-id="a"]')?.getAttribute('aria-selected')).toBe('true')
    await b.fiber.dispose()
  })

  it('shows cross-Workspace, archived and missing references, and reads a selected source only on demand', async () => {
    const b = await bench({ a: session('a'), b: session('b', { cwd: '/other' }) })
    const references = [
      { sessionId: 'a', title: 'Source A', workspace: { id: 'a', title: 'Workspace A' } },
      { sessionId: 'b', title: 'Source B', workspace: { id: 'b', title: 'Workspace B' } },
      { sessionId: 'missing', title: 'Missing source', workspace: { id: 'old', title: 'Old Workspace' } },
    ]
    const topic = { topicId: 'topic-a', title: '跨工作区调查', references, arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: references.map(reference => ({
      ...reference, status: reference.sessionId === 'missing' ? 'unavailable' : 'listed', archived: reference.sessionId === 'b',
    })) } })
    mount(b.slots, b.sessionsStore, 'a', { ...workspacesState(), archivedSessionIds: [id('b')] })
    fireEvent.click(screen.getByRole('tab', { name: 'Research Graph' }))
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelectorAll('[data-node-id]')).toHaveLength(3) })
    expect(document.querySelectorAll('[data-edge-kind]')).toHaveLength(0)
    expect(b.readHistory).not.toHaveBeenCalled()
    fireEvent.click(nodeButton('b'))
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('Workspace B')
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('已归档')
    expect(b.readHistory).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '阅读原文' }))
    await waitFor(() => { expect(b.readHistory).toHaveBeenCalledTimes(1) })
    expect(b.readHistory.mock.calls[0]![0]).toEqual({ sessionId: 'b' })
    expect(b.open).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: '打开会话' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('无法打开归档会话')
    fireEvent.doubleClick(nodeButton('b'))
    expect(b.open).not.toHaveBeenCalled()
    fireEvent.click(nodeButton('a'))
    fireEvent.click(screen.getByRole('button', { name: '打开会话' }))
    expect(b.open).toHaveBeenCalledWith('a')
    fireEvent.click(nodeButton('missing'))
    expect(screen.getByTestId('topic-source-panel').textContent).toContain('来源不可用')
    expect((screen.getByRole('button', { name: '打开会话' }) as HTMLButtonElement).disabled).toBe(true)
    expect(b.fork).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
    expect(b.submitMerge).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it('retains a failed create input, retries with the same identity, and renames the saved topic', async () => {
    const b = await bench({ a: session('a') })
    mount(b.slots, b.sessionsStore, 'a')
    fireEvent.click(screen.getByRole('tab', { name: 'Research Graph' }))
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await screen.findByText('尚无研究主题。创建一个主题开始整理资料。')
    const input = screen.getByRole('textbox', { name: '新主题名称' })
    fireEvent.change(input, { target: { value: '跨工作区调查' } })
    b.writeTopic.mockRejectedValueOnce(new Error('Storage unavailable'))
    fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
    await screen.findByRole('alert')
    expect((input as HTMLInputElement).value).toBe('跨工作区调查')
    const request = b.writeTopic.mock.calls[0]![0]
    const topic = { topicId: request.topicId, title: '跨工作区调查', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.writeTopic.mockResolvedValueOnce({ ok: true, value: topic })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [] } })
    fireEvent.click(screen.getByRole('button', { name: '创建主题' }))
    await screen.findByRole('option', { name: '跨工作区调查 (0)' })
    expect(b.writeTopic.mock.calls[1]![0]).toEqual(request)
    fireEvent.click(screen.getByRole('button', { name: '主题选项' }))
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    const rename = screen.getByRole('textbox', { name: '主题名称' })
    fireEvent.change(rename, { target: { value: '统一主题' } })
    b.writeTopic.mockResolvedValueOnce({ ok: true, value: { ...topic, title: '统一主题' } })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))
    await screen.findByRole('option', { name: '统一主题 (0)' })
    fireEvent.click(screen.getByRole('button', { name: '主题选项' }))
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '主题名称' }))
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
    expect(screen.queryByRole('textbox', { name: '主题名称' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '主题选项' }))
    expect(b.writeTopic.mock.calls[2]![0]).toEqual({ kind: 'rename', topicId: topic.topicId, title: '统一主题' })
    expect(b.open).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })
})

function session(value: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    displayTitle: over.displayTitle ?? `Session ${value}`,
    running: over.running ?? false,
    blank: over.blank ?? false,
    updatedAt: over.updatedAt ?? 1_000,
    cwd: '/w',
    ...over,
  }
}

function listState(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function workspace(value: string, path: string, sessionIds: string[]): WorkspaceView {
  return {
    workspaceId: value as never,
    path,
    title: `Workspace ${value}`,
    sessionIds: sessionIds.map(id),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function workspacesState(items: readonly WorkspaceView[] = []): WorkspaceSnapshot {
  return {
    items, archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  }
}

interface RecordedResizeObserver {
  readonly callback: ResizeObserverCallback
  readonly targets: Element[]
}

const recordedResizeObservers: RecordedResizeObserver[] = []

function stubResizeObserver(): void {
  vi.stubGlobal('ResizeObserver', class {
    readonly record: RecordedResizeObserver

    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, targets: [] }
      recordedResizeObservers.push(this.record)
    }

    observe(target: Element): void { this.record.targets.push(target) }
    unobserve(): void {}
    disconnect(): void {}
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  localStorage.clear()
  recordedResizeObservers.length = 0
})

const tConversation: ConversationSessionHeaderProps['t'] =
  key => (conversationZh as Record<string, string>)[key] ?? key

/** Real-stack bench: root Context + real SlotRegistry ring + the plugin fiber. */
async function bench(byId: Record<string, SessionSummary>, hostId = 'test-host') {
  const ctx = new Context()
  const slots = new SlotRegistry(ctx)
  const saveKnowledge = vi.fn<(request: KnowledgeSave, signal?: AbortSignal) => Promise<{ ok: true; value: KnowledgeCard }>>()
  const searchKnowledge = vi.fn(async () => ({ ok: true as const, value: [] as readonly KnowledgeCard[] }))
  const readKnowledge = vi.fn(async () => ({ ok: true as const, value: null as KnowledgeCard | null }))
  const membershipKnowledge = vi.fn()
  const prepareExtraction = vi.fn<TypertRemoteMap['sessionGraphKnowledge/prepareExtraction']>()
  const prepareExport = vi.fn<TypertRemoteMap['sessionGraphKnowledge/prepareExport']>()
  const extractKnowledge = vi.fn<TypertRemoteMap['sessionGraphKnowledge/extract']>()
  const prepareReuse = vi.fn<TypertRemoteMap['sessionGraphReuse/prepare']>()
  const prepareBranch = vi.fn<TypertRemoteMap['sessionGraphBranch/prepare']>()
  const submitBranch = vi.fn<TypertRemoteMap['sessionGraphBranch/submit']>()
  const readBranch = vi.fn<TypertRemoteMap['sessionGraphBranch/read']>()
  const submitReuse = vi.fn<TypertRemoteMap['sessionGraphReuse/submit']>()
  const readReuse = vi.fn<TypertRemoteMap['sessionGraphReuse/read']>()
  const sessionReuse = vi.fn<TypertRemoteMap['sessionGraphReuse/forSession']>(async () => ({ ok: true, value: [] }))
  const relationsReuse = vi.fn<TypertRemoteMap['sessionGraphReuse/relations']>(async () => ({ ok: true, value: [] }))
  const sessionsStore = createSnapshotStore(listState(byId))
  const open = vi.fn()
  const fork = vi.fn(async () => id('branched'))
  const create = vi.fn(async () => id('merged'))
  const rename = vi.fn(async () => ({ ok: true as const, value: undefined }))
  const generateTitle = vi.fn<TypertRemoteMap['sessionGraphTitle/generate']>(async request => ({ ok: true, value: { kind: 'ready', sessionId: request.sessionId, title: '缓存策略的性能与一致性', sourceTitle: 'Session root', sourceRevision: '5' } }))
  const generateDigest = vi.fn(async () => ({
    ok: true as const,
    value: { kind: 'empty' as const },
  }))
  const readHistory = vi.fn<TypertRemoteMap['sessionGraphHistory/read']>(async request => ({
    ok: true,
    value: { kind: 'original', sessionId: request.sessionId, turns: [], hasEarlier: false, hasLater: false },
  }))
  const searchDiscussion = vi.fn<TypertRemoteMap['sessionGraphSearch/search']>(async () => ({ ok: true, value: { kind: 'results', hits: [] } }))
  const listTopics = vi.fn<TypertRemoteMap['sessionGraphTopics/list']>(async () => ({ ok: true, value: [] }))
  const readTopic = vi.fn<TypertRemoteMap['sessionGraphTopics/read']>(async () => { throw new Error('Unconfigured topic read') })
  const writeTopic = vi.fn<TypertRemoteMap['sessionGraphTopics/write']>(async () => { throw new Error('Unconfigured topic write') })
  const submitMerge = vi.fn(async (request: {
    readonly operationId: string
    readonly sourceIds: readonly SessionId[]
  }) => ({
    ok: true as const,
    value: {
      operationId: request.operationId,
      contextEventSeq: 8,
      sources: request.sourceIds.map((sessionId, inputIndex) => ({
        sessionId,
        capturedThroughSeq: inputIndex + 1,
      })),
    },
  }))
  ctx.provide('sessions', {
    list: sessionsStore,
    open,
    fork,
    create,
    binding: () => ({ session: { rename } }),
  })
  ctx.provide('workspaces', { list: createSnapshotStore(workspacesState()) })
  slots.register({
    name: 'root',
    children: { 'conversation.view': { kind: 'list', scope: 'session' } },
  }, (_p: { renderSlot?: unknown }) => null)
  const chatBody = vi.fn(() => <div data-testid="chat-body" />)
  slots.register(
    { name: 'conversation.view', id: 'chat', order: 0, label: 'Chat' } as never, chatBody as never)
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  class RemoteStub extends Service {
    constructor(remoteCtx: Context) { super(remoteCtx, 'remote') }
    $on(): () => void { return () => {} }
    async $mount(): Promise<() => Promise<void>> { return async () => {} }
  }
  new RemoteStub(ctx)
  // The real Gateway creates a separately injectable service for every
  // mounted namespace; mirror that boundary instead of hanging it off the
  // root Remote stub.
  ctx.provide('remote.sessionGraphDigest', { generate: generateDigest } as never)
  ctx.provide('remote.sessionGraphTitle', { generate: generateTitle } as never)
  ctx.provide('remote.sessionGraphMerge', { submit: submitMerge } as never)
  ctx.provide('remote.sessionGraphHistory', { read: readHistory } as never)
  ctx.provide('remote.sessionGraphSearch', { search: searchDiscussion } as never)
  ctx.provide('remote.sessionGraphTopics', { list: listTopics, read: readTopic, write: writeTopic } as never)
  ctx.provide('remote.sessionGraphKnowledge', { save: saveKnowledge, read: readKnowledge, search: searchKnowledge,
    hostIdentity: async () => ({ ok: true, value: { hostId } }),
    membership: membershipKnowledge, prepareExtraction, prepareExport, extract: extractKnowledge } as never)
  ctx.provide('remote.sessionGraphReuse', { prepare: prepareReuse, submit: submitReuse, read: readReuse, forSession: sessionReuse, relations: relationsReuse } as never)
  ctx.provide('remote.sessionGraphBranch', { prepare: prepareBranch, submit: submitBranch, read: readBranch } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  const localeFiber = ctx.plugin({ inject: [...localeInject], apply: localeApply })
  await localeFiber
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber
  return {
    ctx, slots, fiber, sessionsStore, open, fork, create, rename, generateDigest, generateTitle, submitMerge, readHistory, searchDiscussion,
    listTopics, readTopic, writeTopic, saveKnowledge, searchKnowledge, readKnowledge, membershipKnowledge,
    prepareExtraction, extractKnowledge, prepareExport,
    prepareReuse, submitReuse, readReuse, sessionReuse, relationsReuse, prepareBranch, submitBranch, readBranch,
  }
}

/** Tab projection twin of apply's viewTabs (the render-side consumption path). */
function tabsOf(slots: SlotRegistry): ViewTab[] {
  return slots.entries('conversation.view')
    .map(e => ({ id: e.options.id!, label: resolveSlotLabel(e.options.label) ?? e.options.id! }))
}

/**
 * Mount the strict Session header/body over the ring ledger with an
 * outlet-faithful render twin: standard kit + the entry's inject face and
 * locale seat.
 */
function mount(
  slots: SlotRegistry,
  sessionsStore: SnapshotStore<SessionListState>,
  viewed: string,
  workspaces: WorkspaceSnapshot | SnapshotStore<WorkspaceSnapshot> = workspacesState(),
  pendingInteractions: SessionPendingInteractionSnapshot = new Map(),
) {
  const SID = id(viewed)
  const useSessions = bindSnapshotSelector(sessionsStore)
  const useSessionPendingInteraction = bindSnapshotSelector(
    createSnapshotStore<SessionPendingInteractionSnapshot>(pendingInteractions),
  )
  const useWorkspaces = bindSnapshotSelector('getSnapshot' in workspaces ? workspaces : createSnapshotStore(workspaces))
  const useSession = bindSnapshotSelector(createSnapshotStore({ blank: false } as never))
  const useConversation = bindSnapshotSelector(createSnapshotStore(EMPTY_CONVERSATION_SNAPSHOT))
  const useConversationViews = bindSnapshotSelector(createSnapshotStore(tabsOf(slots)))
  const conversation = createConversationStore().create()
  // Harness 0.1.2-alpha.3 routes tab selection and view-focus requests
  // through injected callbacks (selectView/openView) that also activate the
  // ConversationController binding; earlier alphas read the same state through
  // `actions`. The bench mounts no controller, so the store action is the
  // whole observable effect, and passing both shapes keeps the bench running
  // across every matrix Harness (extra props are ignored on older alphas).
  const selectView = (view: string): void => { conversation.actions.setView(view) }
  const openView = (view: string, focus: string): void => {
    conversation.actions.openView(view, focus)
  }
  const useInput = bindSnapshotSelector(createSnapshotStore<InputState>({
    draft: '', imageIds: [], draftRev: 0, phase: 'plain', occurrences: [], queue: [],
  }))
  const inputActions: InputActions = {
    setDraft: vi.fn(),
    addImages: vi.fn(() => false),
    removeImage: vi.fn(),
    pruneImages: vi.fn(),
    submit: vi.fn(),
  }
  const siblingViewStandardProps = {
    useChat: () => { throw new Error('graph bench does not render Chat consumers') },
    useTrajectory: () => { throw new Error('graph bench does not render Trajectory consumers') },
  }
  const t = (key: LocaleKeysOf<'sessionGraph'>, params?: Record<string, unknown>): string => {
    const value = (key: string, params?: Record<string, unknown>): string =>
      (zh[key as SessionGraphKey] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) => {
        const param = params?.[name]
        return typeof param === 'number' || typeof param === 'string' ? String(param) : `{${name}}`
      })
    return value(key, params)
  }
  const renderSlot = ((key: string, owner: object, opts?: { only?: string }): ReactNode => {
    const entry = slots.entries('conversation.view').find(e => e.options.id === opts?.only)
    if (entry === undefined) return null
    const View = entry.component as FC<ConvViewProps>
    const injectEntry = entry.inject as ((sessionId: SessionId) => object) | undefined
    const injected = injectEntry === undefined ? {} : injectEntry(SID)
    return (
      <View
        {...injected}
        {...({
          ...owner,
          sessionId: SID,
          useSession,
          useSessions,
          useSessionPendingInteraction,
          useWorkspaces,
          useConversation,
          useConversationViews,
          t,
        } as unknown as ConvViewProps)}
        key={key}
      />
    )
  }) as unknown as ConversationSessionProps['renderSlot']
  return render(
    <>
      <ConversationSessionHeader
        {...siblingViewStandardProps}
        sessionId={SID}
        SessionProvider={({ children }) => children}
        useSession={useSession}
        useSessions={useSessions}
        useSessionPendingInteraction={useSessionPendingInteraction}
        useWorkspaces={useWorkspaces}
        useConversation={useConversation}
        useConversationViews={useConversationViews}
        useProjection={(() => undefined)}
        useStore={bindSnapshotSelector(conversation)}
        actions={conversation.actions}
        renderSlot={() => null}
        useInput={useInput}
        inputActions={inputActions}
        open={vi.fn()}
        selectView={selectView}
        t={tConversation}
      />
      <ConversationSession
        {...siblingViewStandardProps}
        sessionId={SID}
        SessionProvider={({ children }) => children}
        useSession={useSession}
        useSessions={useSessions}
        useSessionPendingInteraction={useSessionPendingInteraction}
        useWorkspaces={useWorkspaces}
        useConversation={useConversation}
        useConversationViews={useConversationViews}
        useProjection={(() => undefined)}
        useStore={bindSnapshotSelector(conversation)}
        actions={conversation.actions}
        renderSlot={renderSlot}
        bindDraftMirror={() => () => {}}
        openView={openView}
        useInput={useInput}
        inputActions={inputActions}
      />
    </>,
  )
}

/** Switch the mounted tab ring to one view id. */
function switchTab(name: string): void {
  fireEvent.click(screen.getByRole('tab', { name }))
}

/** One graph node button by its data-node-id (titles also appear in the session header). */
function nodeButton(key: string): HTMLElement {
  const button = document.querySelector(`[data-node-id="${key}"]`)
  if (button === null) throw new Error(`node "${key}" not rendered`)
  return button as HTMLElement
}

/** The Branch action exposed by the Selected Session panel. */
function branchActionButton(): HTMLButtonElement {
  const panel = screen.getByTestId('session-graph-panel')
  const button = [...panel.querySelectorAll('button')]
    .find(candidate => candidate.textContent === '开新分支')
  if (button === undefined) throw new Error('Selected Session Branch action not rendered')
  return button
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve })
  return {
    promise,
    resolve: value => { resolvePromise?.(value) },
  }
}

function digestSuccess(sessionId: string, over: {
  readonly overview?: string
  readonly generatedWhileRunning?: boolean
  readonly sourceRevision?: string
  readonly sourceTurnCount?: number
  readonly generatedAt?: number
  readonly keyOutcomes?: readonly string[]
  readonly openItems?: readonly string[]
} = {}) {
  return {
    ok: true as const,
    value: {
      kind: 'ready' as const,
      cached: false as const,
      digest: {
        sessionId,
        sourceRevision: over.sourceRevision ?? '1',
        sourceTurnCount: over.sourceTurnCount ?? 1,
        generatedAt: over.generatedAt ?? 2_000,
        generatedWhileRunning: over.generatedWhileRunning ?? false,
        overview: over.overview ?? `Digest for ${sessionId}`,
        keyOutcomes: over.keyOutcomes ?? [],
        openItems: over.openItems ?? [],
      },
    },
  }
}

const FIXTURE: Record<string, SessionSummary> = {
  root: session('root', { updatedAt: 500 }),
  branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
  sub1: session('sub1', { parentId: id('root'), origin: 'subagent', updatedAt: 300, running: true }),
  deep: session('deep', { parentId: id('sub1'), origin: 'subagent', updatedAt: 200 }),
}

describe('Session insights in the registered Graph', () => {
  it('generates for the Selected Session and applies through its native binding without navigating', async () => {
    const b = await bench(FIXTURE)
    b.rename.mockResolvedValue({ ok: true, value: { title: '权限缓存的边界', seq: 8 } } as never)
    const binding = vi.spyOn(b.ctx.sessions, 'binding')
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('branchChild'))
    fireEvent.click(screen.getByRole('button', { name: '生成标题' }))
    const input = await screen.findByRole('textbox', { name: '建议标题' })
    expect(b.generateTitle).toHaveBeenCalledExactlyOnceWith({ sessionId: 'branchChild' }, expect.any(AbortSignal))
    expect(b.rename).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '权限缓存的边界' } })
    fireEvent.click(screen.getByRole('button', { name: '应用标题' }))
    await screen.findByText('标题已更新')
    expect(binding).toHaveBeenLastCalledWith(id('branchChild'))
    expect(b.rename).toHaveBeenCalledExactlyOnceWith('权限缓存的边界')
    expect(b.open).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
    await act(async () => { b.sessionsStore.set(listState({ ...FIXTURE,
      branchChild: session('branchChild', { parentId: id('root'), displayTitle: '权限缓存的边界' }),
    })) })
    expect(nodeButton('branchChild').textContent).toContain('权限缓存的边界')
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('权限缓存的边界')
  })

  it('renders scannable Markdown lists, emphasized facts and safe inline code in a digest', async () => {
    const b = await bench(FIXTURE)
    b.generateDigest.mockResolvedValue(digestSuccess('root', {
      overview: '比较 **缓存性能** 和 `P95`。',
      keyOutcomes: ['保留 **权限校验**，再衡量性能。', '阅读 [无效链接](javascript:alert(1))。'],
      openItems: ['**待验证**：失效通知的及时性。'],
    }))
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))
    const strong = await screen.findByText('缓存性能')
    expect(strong.tagName).toBe('STRONG')
    const digest = screen.getByTestId('session-digest-section')
    expect(digest.querySelector('code')?.textContent).toBe('P95')
    expect(digest.querySelectorAll('ul > li')).toHaveLength(3)
    expect(digest.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(digest.textContent).not.toContain('**')
  })
})

describe('plugin registration', () => {
  it('registers graph after chat on the ring and labels it in the active locale', async () => {
    const b = await bench(FIXTURE)
    expect(tabsOf(b.slots)).toEqual([
      { id: 'chat', label: 'Chat' },
      { id: 'graph', label: 'Research Graph' },
    ])
    const locale = b.ctx.get('locale') as { setLocale(id: string): void }
    locale.setLocale('zh')
    expect(tabsOf(b.slots).find(tab => tab.id === 'graph')?.label).toBe('研图')
    locale.setLocale('en')
    expect(tabsOf(b.slots).find(tab => tab.id === 'graph')?.label).toBe('Research Graph')
  })

  it('fiber disposal removes the tab and leaves chat standing', async () => {
    const b = await bench(FIXTURE)
    await b.fiber.dispose()
    expect(tabsOf(b.slots).map(tab => tab.id)).toEqual(['chat'])
  })
})

describe('graph tab rendering and interaction', () => {
  it('shows the package version and Build ID in the Graph header', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    const badge = screen.getByText(`Research Graph v${packageMetadata.version} · test-build`)
    expect(badge.getAttribute('title')).toBe(
      `@benz-ai-x/dsh-research-graph v${packageMetadata.version} · build test-build`,
    )
  })

  it('renders the scope-bound forest with Viewed Session highlight, one Branch edge, and folded summaries', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(nodeButton('root').getAttribute('aria-current')).toBe('true')
    expect(nodeButton('branchChild').getAttribute('aria-current')).toBeNull()
    // Subagent rows stay off the canvas; the root card carries the chain badge.
    expect(document.querySelector('[data-node-id="sub1"]')).toBeNull()
    expect(document.querySelector('[data-node-id="deep"]')).toBeNull()
    expect(nodeButton('root').textContent).toContain('2 子代理')
    expect(nodeButton('root').textContent).toContain('1 运行中')
    // Exactly one solid Branch edge with an arrowhead between the Canvas Sessions:
    // an invisible hit path plus the visible solid path and the arrowhead.
    const edgeGroup = document.querySelectorAll('svg g')
    expect(edgeGroup).toHaveLength(1)
    const paths = document.querySelectorAll('[aria-label="会话关系图谱"] svg path')
    expect(paths).toHaveLength(3)
    const branch = document.querySelector('[data-edge-kind="branch"]')
    expect(branch?.getAttribute('stroke-dasharray')).toBeNull()
    // Folded Subagent Derivation appears on badge hover and uses the dashed line.
    const subagentBadge = screen.getByText(/2 子代理/)
    fireEvent.mouseEnter(subagentBadge)
    const derivation = document.querySelector('[data-edge-kind="subagent-derivation"]')
    expect(derivation?.getAttribute('stroke-dasharray')).toBe('6 4')
    // Node dots take the cluster palette color, not a status color.
    const dot = nodeButton('root').querySelector('span')
    expect(dot?.getAttribute('style')).toContain('var(--dsw-alias-')
    // The graph options explain the two relation kinds without a permanent row.
    fireEvent.click(screen.getByRole('button', { name: '图谱选项' }))
    expect(document.body.textContent).toContain('派生')
    expect(document.body.textContent).toContain('分支')
  })

  it('renders Merge relations as distinct solid edges without describing them as Branches', async () => {
    const b = await bench({
      sourceA: session('sourceA', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('sourceA'), updatedAt: 450 }),
      sourceB: session('sourceB', { updatedAt: 400 }),
      merged: session('merged', {
        updatedAt: 600,
        projectionValues: {
          sessionGraphMerge: {
            operationId: 'operation-1',
            contextEventSeq: 8,
            sources: [
              { sessionId: id('branchChild'), capturedThroughSeq: 3 },
              { sessionId: id('sourceB'), capturedThroughSeq: 4 },
            ],
          },
        },
      }),
    })
    mount(b.slots, b.sessionsStore, 'merged')
    switchTab('Research Graph')

    expect(document.querySelectorAll('[data-edge-kind="branch"]')).toHaveLength(1)
    const mergeEdges = document.querySelectorAll('[data-edge-kind="merge"]')
    expect(mergeEdges).toHaveLength(2)
    for (const edge of mergeEdges) {
      expect(edge.getAttribute('stroke-dasharray')).toBeNull()
      expect(edge.className.baseVal).not.toBe(
        document.querySelector('[data-edge-kind="branch"]')?.getAttribute('class'),
      )
    }
    expect(document.body.textContent).toContain('汇聚')

    fireEvent.click(nodeButton('merged'))
    const panel = screen.getByTestId('session-graph-panel')
    expect(panel.textContent).not.toContain('分支自')
    expect(panel.textContent).toContain('汇聚来源')
    expect(panel.textContent).toContain('Session branchChild')
    expect(panel.textContent).toContain('Session sourceB')
    expect(panel.textContent).toContain('快照至事件 3')
  })

  it('renders stable input and output ports on every Canvas Session', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    for (const key of ['root', 'branchChild']) {
      const node = nodeButton(key)
      const input = document.querySelector(`[data-port-id^="${key}:"][data-session-port="input"]`)
      const output = document.querySelector(`[data-port-id^="${key}:"][data-session-port="output"]`)
      expect(input?.getAttribute('data-session-port')).toBe('input')
      expect(output?.getAttribute('data-session-port')).toBe('output')
      expect(input?.getAttribute('aria-hidden')).toBe('true')
      expect(output?.getAttribute('aria-hidden')).toBe('true')
      // Ports are siblings of the button so they can become independent
      // interactive terminals later without nesting controls.
      expect(input?.parentElement).toBe(node.parentElement)
      expect(output?.parentElement).toBe(node.parentElement)
      expect(input?.parentElement).not.toBe(node)
    }
  })

  it('uses an explicit Merge mode and enables submission only for two to three sources', async () => {
    const b = await bench({
      sourceA: session('sourceA', { updatedAt: 500 }),
      sourceB: session('sourceB', { updatedAt: 400 }),
      sourceC: session('sourceC', { updatedAt: 300 }),
      sourceD: session('sourceD', { updatedAt: 200 }),
    })
    mount(b.slots, b.sessionsStore, 'sourceA')
    switchTab('Research Graph')

    chooseCanvasAction('汇聚所选会话')
    const composer = screen.getByRole('dialog', { name: '汇聚会话' })
    const submit = screen.getByRole('button', { name: '创建汇聚会话' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('textbox', { name: '汇聚指令' }) as HTMLTextAreaElement).value)
      .toBe('综合所选会话的上下文，提炼共识、分歧和待办，并继续完成任务。')

    fireEvent.click(nodeButton('sourceA'))
    expect(nodeButton('sourceA').getAttribute('data-merge-selected')).toBe('1')
    expect(composer.textContent).toContain('已选择 1/3')
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(nodeButton('sourceB'))
    expect(nodeButton('sourceB').getAttribute('data-merge-selected')).toBe('2')
    expect(composer.textContent).toContain('已选择 2/3')
    expect((submit as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(nodeButton('sourceC'))
    fireEvent.click(nodeButton('sourceD'))
    expect(composer.textContent).toContain('已选择 3/3')
    expect(nodeButton('sourceD').getAttribute('data-merge-selected')).toBeNull()
  })

  it('keeps Session references in the source picker instead of the free-form instruction', async () => {
    const b = await bench({
      sourceA: session('sourceA', { updatedAt: 500 }),
      sourceB: session('sourceB', { updatedAt: 400 }),
    })
    mount(b.slots, b.sessionsStore, 'sourceA')
    switchTab('Research Graph')

    chooseCanvasAction('汇聚所选会话')
    fireEvent.click(nodeButton('sourceA'))
    fireEvent.click(nodeButton('sourceB'))
    fireEvent.change(screen.getByRole('textbox', { name: '汇聚指令' }), {
      target: { value: '同时比较 dsh-session:source-c。' },
    })

    expect((screen.getByRole('button', { name: '创建汇聚会话' }) as HTMLButtonElement).disabled)
      .toBe(true)
    expect(screen.getByRole('alert').textContent)
      .toContain('请通过会话卡片选择来源，不要在指令中输入 dsh-session 引用。')
    expect(b.create).not.toHaveBeenCalled()
  })

  it('shows Merge progress and submits the edited instruction through the browser workflow', async () => {
    const b = await bench({
      sourceA: session('sourceA', { updatedAt: 500 }),
      sourceB: session('sourceB', { updatedAt: 400 }),
    })
    const gate = deferred<{
      readonly ok: true
      readonly value: {
        readonly operationId: string
        readonly contextEventSeq: number
        readonly sources: readonly {
          readonly sessionId: SessionId
          readonly capturedThroughSeq: number
        }[]
      }
    }>()
    b.submitMerge.mockImplementationOnce(async () => await gate.promise)
    mount(b.slots, b.sessionsStore, 'sourceA')
    switchTab('Research Graph')

    chooseCanvasAction('汇聚所选会话')
    fireEvent.click(nodeButton('sourceA'))
    fireEvent.click(nodeButton('sourceB'))
    fireEvent.change(screen.getByRole('textbox', { name: '汇聚指令' }), {
      target: { value: '比较两个方案并给出最终建议。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '创建汇聚会话' }))

    await waitFor(() => { expect(b.submitMerge).toHaveBeenCalledTimes(1) })
    expect(screen.getByRole('status').textContent).toBe('正在创建汇聚会话…')
    expect((screen.getByRole('textbox', { name: '汇聚指令' }) as HTMLTextAreaElement).disabled)
      .toBe(true)
    expect((screen.getByRole('button', { name: '关闭汇聚会话' }) as HTMLButtonElement).disabled)
      .toBe(true)
    expect((screen.getByRole('button', { name: '取消' }) as HTMLButtonElement).disabled)
      .toBe(true)

    const request = b.submitMerge.mock.calls[0]?.[0] as {
      readonly operationId: string
      readonly targetSessionId: SessionId
      readonly sourceIds: readonly SessionId[]
      readonly instruction: string
    }
    expect(request).toMatchObject({
      targetSessionId: id('merged'),
      sourceIds: [id('sourceA'), id('sourceB')],
      instruction: '比较两个方案并给出最终建议。',
    })
    gate.resolve({
      ok: true,
      value: {
        operationId: request.operationId,
        contextEventSeq: 8,
        sources: [
          { sessionId: id('sourceA'), capturedThroughSeq: 3 },
          { sessionId: id('sourceB'), capturedThroughSeq: 4 },
        ],
      },
    })

    await waitFor(() => { expect(b.open).toHaveBeenCalledWith(id('merged')) })
    expect(b.create).toHaveBeenCalledWith({ cwd: '/w' })
    expect(b.rename).toHaveBeenCalledWith('Merge: Session sourceA + Session sourceB')
    expect(screen.queryByRole('dialog', { name: '汇聚会话' })).toBeNull()
  })

  it('keeps the target on Merge failure and retries without creating a duplicate Session', async () => {
    const b = await bench({
      sourceA: session('sourceA', { updatedAt: 500 }),
      sourceB: session('sourceB', { updatedAt: 400 }),
    })
    b.submitMerge.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'persistence-failed',
        message: 'projection cache unavailable',
        details: { stage: 'persisting' },
      },
    })
    mount(b.slots, b.sessionsStore, 'sourceA')
    switchTab('Research Graph')
    chooseCanvasAction('汇聚所选会话')
    fireEvent.click(nodeButton('sourceA'))
    fireEvent.click(nodeButton('sourceB'))
    fireEvent.click(screen.getByRole('button', { name: '创建汇聚会话' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('提交源会话快照失败')
    expect(alert.textContent).toContain('目标会话已保留')
    expect(screen.getByRole('button', { name: '打开目标会话' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(b.submitMerge).toHaveBeenCalledTimes(2) })
    await waitFor(() => { expect(b.open).toHaveBeenCalledWith(id('merged')) })
    expect(b.create).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: '汇聚会话' })).toBeNull()
  })

  it('presents each Canvas Session title before its secondary metadata', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    expect(nodeButton('branchChild').textContent?.startsWith('Session branchChild')).toBe(true)
    expect(nodeButton('root').textContent?.startsWith('Session root')).toBe(true)
  })

  it('connects Branches at the bottom terminal of the 56px Canvas Session card', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    expect(document.querySelector('[data-edge-kind="branch"]')?.getAttribute('d'))
      .toMatch(/^M 120 56 /)
  })

  it('selects on single click and opens the target session on double click', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    const child = nodeButton('branchChild')
    fireEvent.click(child, { detail: 1 })
    expect(child.getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()

    const root = nodeButton('root')
    fireEvent.click(root, { detail: 1 })
    fireEvent.click(root, { detail: 2 })
    fireEvent.doubleClick(root, { detail: 2 })
    expect(b.open).toHaveBeenCalledWith(id('root'))
    expect(b.open).toHaveBeenCalledTimes(1)
  })

  it('explains why an Unscoped Session has no Session Graph', async () => {
    const loose = { ...session('loose') }
    delete (loose as Partial<SessionSummary>).cwd
    const b = await bench({ loose })
    mount(b.slots, b.sessionsStore, 'loose')
    switchTab('Research Graph')
    expect(screen.getByText('无法确定当前查看会话的工作区或工作目录')).toBeTruthy()
  })

  it('labels a Directory Scope without presenting it as a Workspace', async () => {
    const b = await bench({ loose: session('loose', { cwd: '/loose' }) })
    mount(b.slots, b.sessionsStore, 'loose')
    switchTab('Research Graph')
    expect(screen.getByRole('combobox', { name: '研究范围' }).textContent).toContain('当前目录')
    expect(screen.getByRole('combobox', { name: '研究范围' }).textContent).not.toContain('当前工作区')
    expect(document.body.textContent).toContain('1 条讨论')
  })
})

function chooseCanvasAction(name: string): void {
  const options = screen.getByRole('button', { name: '图谱选项' })
  if (options.getAttribute('aria-expanded') !== 'true') fireEvent.click(options)
  fireEvent.click(screen.getByRole('button', { name }))
}

function stubSize(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}),
  })
}

describe('free viewport controls', () => {
  const surface = (): HTMLElement =>
    document.querySelector<HTMLElement>('[aria-label="会话关系图谱"]') as HTMLElement

  it.each(['workspace', 'topic'] as const)('keeps %s zoom anchored in the visible canvas after fitting and resizing the reader', async scope => {
    let surfaceWidth = 1774
    let readerWidth = 963
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.hasAttribute('data-reading-panel') ? readerWidth : surfaceWidth
      return { width, height: 840, x: 0, y: 0, left: 0, top: 0, right: width, bottom: 840, toJSON: () => ({}) }
    })
    const b = await bench({ root: session('root') })
    const references = [{ sessionId: 'root', title: '研究讨论', cwd: '/w' }]
    const topic = { topicId: 'research', title: '研究主题', references, arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: references.map(reference => ({ ...reference, archived: false, status: 'listed' as const })) } })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    if (scope === 'topic') {
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      await waitFor(() => { expect(document.querySelector('[data-node-id="root"]')).not.toBeNull() })
    }
    fireEvent.click(nodeButton('root'))
    const transform = (): number[] => nodeButton('root').parentElement!.style.transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const expectCentered = (x: number): void => {
      const [panX, , scale] = transform()
      expect(panX! + (parseFloat(nodeButton('root').style.left) + 120) * scale!).toBeCloseTo(x)
    }
    fireEvent.click(screen.getByRole('button', { name: '适应', exact: true }))
    expectCentered(393.5)
    for (let step = 0; step < 3; step += 1) fireEvent.click(screen.getByRole('button', { name: '放大', exact: true }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('173%')
    expectCentered(393.5)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expectCentered(393.5)
    fireEvent.click(screen.getByRole('button', { name: '缩小', exact: true }))
    expectCentered(393.5)

    // A live panel resize changes the next command's anchor without remounting.
    readerWidth = 563
    fireEvent.click(screen.getByRole('button', { name: '定位', exact: true }))
    expectCentered(593.5)
    fireEvent.keyDown(surface(), { key: '+' })
    expectCentered(593.5)
    fireEvent.keyDown(surface(), { key: '0' })
    expectCentered(593.5)

    // Wheel gestures keep their pointer anchor, rather than the toolbar center.
    const beforeWheel = transform()
    const contentX = (200 - beforeWheel[0]!) / beforeWheel[2]!
    const contentY = (300 - beforeWheel[1]!) / beforeWheel[2]!
    fireEvent.wheel(surface(), { deltaY: -100, clientX: 200, clientY: 300 })
    const afterWheel = transform()
    expect(afterWheel[0]! + contentX * afterWheel[2]!).toBeCloseTo(200)
    expect(afterWheel[1]! + contentY * afterWheel[2]!).toBeCloseTo(300)

    // Narrow reading overlays the canvas; its menu zoom retains the full center.
    surfaceWidth = 640
    readerWidth = 616
    fireEvent.keyDown(surface(), { key: '1' })
    expectCentered(320)
    fireEvent.click(screen.getByRole('button', { name: '图谱选项' }))
    const menu = screen.getByRole('group', { name: '图谱选项' })
    fireEvent.click(within(menu).getByRole('button', { name: '放大' }))
    expectCentered(320)
    fireEvent.click(within(menu).getByRole('button', { name: '缩放至 100%' }))
    expectCentered(320)
    fireEvent.keyDown(menu, { key: 'Escape' })

    surfaceWidth = 1774
    fireEvent.click(screen.getByRole('button', { name: '关闭会话详情' }))
    fireEvent.click(screen.getByRole('button', { name: '适应', exact: true }))
    expectCentered(887)
    fireEvent.click(screen.getByRole('button', { name: '放大', exact: true }))
    expectCentered(887)
  })

  it.each(['workspace', 'topic'] as const)('keeps %s tools beside the input target and isolates their keys from the canvas', async scope => {
    const b = await bench({ a: session('a', { displayTitle: '实际发送会话' }), b: session('b', { displayTitle: '正在检查的会话' }) })
    const references = [{ sessionId: 'a', title: '实际发送会话', cwd: '/w' }, { sessionId: 'b', title: '正在检查的会话', cwd: '/w' }]
    const topic = { topicId: 'research', title: '研究主题', references, arrangement: { positions: {}, collapsed: [], offsets: {} } }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: references.map(reference => ({ ...reference, archived: false, status: 'listed' as const })) } })
    mount(b.slots, b.sessionsStore, 'a')
    switchTab('Research Graph')
    if (scope === 'topic') {
      fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
      await waitFor(() => { expect(document.querySelector('[data-node-id="b"]')).not.toBeNull() })
    }
    fireEvent.click(nodeButton('b'))
    const inspector = screen.getByTestId(scope === 'topic' ? 'topic-source-panel' : 'session-graph-panel')
    const toolbar = screen.getByRole('group', { name: '画布工具' })
    expect(surface().contains(toolbar)).toBe(false)
    expect(toolbar.parentElement?.parentElement?.textContent).toContain('输入会话 · 实际发送会话')
    const readout = within(toolbar).getByRole('button', { name: '缩放至 100%' })
    const before = readout.textContent
    readout.focus()
    for (const key of ['ArrowLeft', '+', 'Escape']) fireEvent.keyDown(readout, { key })
    expect(readout.textContent).toBe(before)
    expect(document.activeElement).toBe(readout)
    expect(inspector.isConnected).toBe(true)
    fireEvent.pointerDown(within(toolbar).getByRole('button', { name: '放大' }), { pointerId: 7, button: 0 })
    fireEvent.click(within(toolbar).getByRole('button', { name: '放大' }))
    const zoomed = readout.textContent
    expect(zoomed).not.toBe(before)
    expect(inspector.isConnected).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '知识库', exact: true }))
    expect(screen.queryByRole('group', { name: '画布工具' })).toBeNull()
    expect(screen.getByText('输入会话 · 实际发送会话')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '图谱', exact: true }))
    await screen.findByRole('group', { name: '画布工具' })
    expect(screen.getAllByRole('group', { name: '画布工具' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe(zoomed)
    expect(b.open).not.toHaveBeenCalled()
  })

  it('keeps menu zoom available for repeated steps and returns focus without closing the inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    const options = screen.getByRole('button', { name: '图谱选项' })
    fireEvent.click(options)
    const menu = screen.getByRole('group', { name: '图谱选项' })
    expect(options.parentElement?.dataset.above).toBe('false')
    const zoom = within(menu).getByRole('group', { name: '图谱缩放' })
    const readout = within(zoom).getByRole('button', { name: '缩放至 100%' })
    fireEvent.click(readout)
    const plus = within(zoom).getByRole('button', { name: '放大' })
    plus.focus()
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(readout.textContent).toBe('144%')
    expect(document.activeElement).toBe(plus)
    expect(menu.isConnected).toBe(true)
    fireEvent.keyDown(plus, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: '图谱选项' })).toBeNull()
    expect(document.activeElement).toBe(options)
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
  })

  it('renders the zoom controls with a percentage readout', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    // The one-shot entry fit leaves the view at its fitted scale (clamped
    // at or below 100%); the readout reflects it truthfully.
    const readout = screen.getByRole('button', { name: '缩放至 100%' })
    expect(Number(readout.textContent?.replace('%', ''))).toBeLessThanOrEqual(100)
    expect(screen.getByRole('button', { name: '放大' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '缩小' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '适应' }).textContent).toBe('适应')
    // Clicking the readout returns to exactly 100%.
    fireEvent.click(readout)
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('names the canvas toolbar and distinguishes Relayout from Reset', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    expect(screen.getByRole('group', { name: '画布工具' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '重新布局' })).toBeNull()
    const options = screen.getByRole('button', { name: '图谱选项' })
    fireEvent.click(options)
    expect(screen.getByRole('button', { name: '重新布局' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '重置布局' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('group', { name: '图谱选项' }), { key: 'Escape' })
    expect(screen.queryByRole('button', { name: '重新布局' })).toBeNull()
    expect(document.activeElement).toBe(options)
    fireEvent.click(options)
    fireEvent.pointerDown(surface())
    expect(screen.queryByRole('button', { name: '重置布局' })).toBeNull()
  })

  it('preserves the camera through hidden surfaces and centers content on a real resize', async () => {
    let size = { width: 1000, height: 600 }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      ...size,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      toJSON: () => ({}),
    }))
    stubResizeObserver()
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))

    const surface = document.querySelector('[aria-label="会话关系图谱"]')!
    const observer = recordedResizeObservers.find(record => record.targets.includes(surface))
    expect(observer).toBeDefined()
    const content = nodeButton('root').parentElement!
    const transform = (): number[] => content.style.transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const before = transform()

    // Hidden Host views can briefly report zero dimensions. They must not
    // shift the camera or replace its last visible size for the next resize.
    size = { width: 0, height: 0 }
    act(() => { observer?.callback([], {} as ResizeObserver) })
    expect(transform()).toEqual(before)
    size = { width: 1000, height: 600 }
    act(() => { observer?.callback([], {} as ResizeObserver) })
    expect(transform()).toEqual(before)

    size = { width: 480, height: 700 }
    act(() => { observer?.callback([], {} as ResizeObserver) })
    const after = transform()

    expect(after[2]).toBe(before[2])
    expect(after[0]).toBeCloseTo(before[0]! - 260)
    expect(after[1]).toBeCloseTo(before[1]! + 50)
  })

  it('zooms in and out from the controls and resets to 100% on the readout', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    // Anchor at 100% first: the entry fit may leave the view below identity.
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('120%')
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('83%')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('wheel zooms toward the cursor anchor', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    fireEvent.wheel(surface(), { deltaY: -100, clientX: 400, clientY: 300 })
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('120%')
  })

  it('pans on background drag without stealing node clicks', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    const beforeMatch = before.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\)/)!
    fireEvent.pointerDown(surface(), { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 160, clientY: 130 })
    fireEvent.pointerUp(surface(), { pointerId: 1 })
    const after = content().style.transform
    const afterMatch = after.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\)/)!
    expect(after).not.toBe(before)
    expect(Number(afterMatch[1]) - Number(beforeMatch[1])).toBeCloseTo(60)
    expect(Number(afterMatch[2]) - Number(beforeMatch[2])).toBeCloseTo(30)
    // Node clicks still select after the pan gesture.
    fireEvent.click(nodeButton('branchChild'))
    expect(nodeButton('branchChild').getAttribute('aria-selected')).toBe('true')
  })

  it('fits the content into the surface on the fit button', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    fireEvent.click(screen.getByRole('button', { name: '适应' }))
    // Content 520x44 fits inside 904x504 at 100%; fit caps at identity.
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('fits persisted negative positions after the entry surface settles', async () => {
    localStorage.setItem('dsh.session-graph.layout.["test-host","/w",null]', JSON.stringify({
      v: 1,
      positions: { branchChild: { x: -1_000, y: -1_000 } },
      collapsed: [],
      offsets: {},
    }))
    let viewHeight = 480
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: 1000,
      height: viewHeight,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: viewHeight,
      toJSON: () => ({}),
    }))
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    viewHeight = 600

    expect(nodeButton('branchChild').style.left).toBe('-1000px')
    expect(nodeButton('branchChild').style.top).toBe('-1000px')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('45%')
    })
    const edgeLayer = document.querySelector('[data-edge-id="branch:root->branchChild"]')?.closest('svg')
    expect(edgeLayer?.getAttribute('viewBox')).toBe('-1000 -1000 1240 1056')
    expect(edgeLayer?.style.left).toBe('-1000px')
    expect(edgeLayer?.style.top).toBe('-1000px')
    // Fit hides the minimap while all content is visible; one zoom step
    // makes the tall manual arrangement exceed the surface again.
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    for (const mark of screen.getByTestId('session-graph-minimap').querySelectorAll('rect:not([data-testid])')) {
      const x = Number(mark.getAttribute('x'))
      const y = Number(mark.getAttribute('y'))
      const width = Number(mark.getAttribute('width'))
      const height = Number(mark.getAttribute('height'))
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + width).toBeLessThanOrEqual(180)
      expect(y + height).toBeLessThanOrEqual(120)
    }
  })
})

describe('node drag and position persistence', () => {
  const drag = (key: string, dx: number, dy: number): void => {
    const node = nodeButton(key)
    const start = { clientX: 200, clientY: 200 }
    fireEvent.pointerDown(node, { pointerId: 7, ...start })
    fireEvent.pointerMove(node, { pointerId: 7, clientX: start.clientX + dx, clientY: start.clientY + dy })
    fireEvent.pointerUp(node, { pointerId: 7 })
  }

  it.each(['node', 'cluster'] as const)('persists the final %s drag sample before a batched release', async target => {
    const b = await bench({ root: session('root'), child: session('child', { parentId: id('root') }) })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const handle = target === 'node' ? nodeButton('root') : document.querySelector<HTMLElement>('[data-cluster-title="root"]')!
    fireEvent.pointerDown(handle, { pointerId: 7, clientX: 200, clientY: 200 })
    // A browser can deliver the final movement and release before React commits a frame.
    act(() => {
      fireEvent.pointerMove(handle, { pointerId: 7, clientX: 240, clientY: 225 })
      fireEvent.pointerMove(handle, { pointerId: 7, clientX: 280, clientY: 250 })
      fireEvent.pointerUp(handle, { pointerId: 7 })
    })
    expect(nodeButton('root').style.left).toBe('80px')
    expect(nodeButton('root').style.top).toBe('50px')
    const saved = JSON.parse(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')!)
    expect(target === 'node' ? saved.positions.root : saved.offsets.root)
      .toEqual(target === 'node' ? { x: 80, y: 50 } : { dx: 80, dy: 50 })
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(nodeButton('root').style.left).toBe('80px')
    expect(nodeButton('root').style.top).toBe('50px')
    expect(b.open).not.toHaveBeenCalled()
    await b.fiber.dispose()
  })

  it('drags a node, persists its position, and suppresses the click', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const before = nodeButton('branchChild').style.left
    drag('branchChild', 120, 80)
    const after = nodeButton('branchChild').style.left
    expect(after).not.toBe(before)
    // The drag landed in the Directory Scope's Session Arrangement.
    const stored = localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')
    expect(stored).toBeTruthy()
    expect(stored).toContain('branchChild')
    // The drag gesture did not select or navigate.
    expect(nodeButton('branchChild').getAttribute('aria-selected')).toBe('false')
    expect(b.open).not.toHaveBeenCalled()
  })

  it('accepts the first deliberate click after a completed drag', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    drag('branchChild', 120, 80)

    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 8, clientX: 240, clientY: 240 })
    fireEvent.pointerUp(node, { pointerId: 8, clientX: 240, clientY: 240 })
    fireEvent.click(node)
    expect(node.getAttribute('aria-selected')).toBe('true')
  })

  it('restores persisted positions on remount and falls back on corruption', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    drag('branchChild', 120, 80)
    const moved = nodeButton('branchChild').style.left
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(nodeButton('branchChild').style.left).toBe(moved)
    cleanup()
    localStorage.setItem('dsh.session-graph.layout.["test-host","/w",null]', '{corrupt')
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    // Corrupt storage falls back to the auto layout's depth row.
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(nodeButton('branchChild').style.top).toBe('120px')
  })

  it('keeps sub-threshold pointer movement a click', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 9, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 9, clientX: 202, clientY: 201 })
    fireEvent.pointerUp(node, { pointerId: 9 })
    fireEvent.click(node)
    expect(node.getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')).toBeNull()
  })

  it('rolls back a node drag when the pointer sequence is canceled', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')
    const before = { left: node.style.left, top: node.style.top }
    fireEvent.pointerDown(node, { pointerId: 10, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 10, clientX: 320, clientY: 280 })
    expect(nodeButton('branchChild').style.left).not.toBe(before.left)
    fireEvent.pointerCancel(node, { pointerId: 10 })
    expect(nodeButton('branchChild').style.left).toBe(before.left)
    expect(nodeButton('branchChild').style.top).toBe(before.top)
    expect(document.querySelector('[data-testid^="session-graph-guide-"]')).toBeNull()
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')).toBeNull()
  })

  it('keeps Session Arrangements separate for Workspaces that share a directory', async () => {
    const b = await bench(FIXTURE)
    mount(
      b.slots,
      b.sessionsStore,
      'root',
      workspacesState([workspace('first', '/w', ['root'])]),
    )
    switchTab('Research Graph')
    drag('branchChild', 120, 80)
    expect(nodeButton('branchChild').style.left).not.toBe('0px')

    cleanup()
    mount(
      b.slots,
      b.sessionsStore,
      'root',
      workspacesState([workspace('second', '/w', ['root'])]),
    )
    switchTab('Research Graph')
    expect(nodeButton('branchChild').style.left).toBe('0px')
  })

  it('leaves layouts without a Host identity untouched instead of assigning them to a Workspace', async () => {
    localStorage.setItem('dsh.session-graph.layout./w', JSON.stringify({
      v: 1,
      positions: { branchChild: { x: 160, y: 200 } },
      collapsed: [],
      offsets: {},
    }))
    const b = await bench(FIXTURE)
    const namedScope = workspacesState([workspace('stable', '/w', ['root'])])
    mount(b.slots, b.sessionsStore, 'root', namedScope)
    switchTab('Research Graph')
    expect(nodeButton('branchChild').style.left).toBe('0px')

    cleanup()
    localStorage.removeItem('dsh.session-graph.layout./w')
    mount(b.slots, b.sessionsStore, 'root', namedScope)
    switchTab('Research Graph')
    expect(nodeButton('branchChild').style.left).toBe('0px')
  })
})

describe('cluster frames', () => {
  it('renders a titled frame around the Session Cluster', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const frame = document.querySelector('[data-cluster-id="root"]')
    expect(frame).not.toBeNull()
    expect(frame?.querySelector('[class*="frameLabel"]')?.textContent).toBe('Session root')
    expect(frame?.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelectorAll('[data-cluster-id]')).toHaveLength(1)
  })

  it('keeps the singleton node without repeating its title in a cluster frame', async () => {
    const b = await bench({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(document.querySelectorAll('[data-cluster-id]')).toHaveLength(1)
    const lone = document.querySelector('[data-cluster-id="lone"]')
    expect(lone).toBeNull()
    expect(nodeButton('lone')).toBeTruthy()
  })

  it('collapses a cluster into its compact column, drops its edge, and persists', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(document.querySelectorAll('[aria-label="会话关系图谱"] svg path')).toHaveLength(3)
    fireEvent.click(document.querySelector('[data-cluster-id="root"] button')!)
    const toggle = document.querySelector('[data-cluster-id="root"] button')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // The Branch edge vanished with the Collapsed Cluster.
    expect(document.querySelectorAll('svg g')).toHaveLength(0)
    // Members stack into one compact column.
    const root = nodeButton('root')
    const branchChild = nodeButton('branchChild')
    expect(root.style.left).toBe('0px')
    expect(branchChild.style.left).toBe('0px')
    expect(parseFloat(branchChild.style.top) - parseFloat(root.style.top)).toBe(64)
    const stored = localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')
    expect(stored).toContain('"collapsed":["root"]')
    // A collapsed member still selects normally.
    fireEvent.click(branchChild)
    expect(branchChild.getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()
  })

  it('restores the collapsed state from storage on remount', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(document.querySelector('[data-cluster-id="root"] button')!)
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(document.querySelector('[data-cluster-id="root"] button')?.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('cluster drag', () => {
  const frameTitle = (clusterId: string): HTMLElement =>
    document.querySelector(`[data-cluster-title="${clusterId}"]`) as HTMLElement

  it('drags a whole cluster by its frame title and persists the offset', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const transformBefore = content().style.transform
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 21, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 21, clientX: 360, clientY: 140 })
    fireEvent.pointerUp(title, { pointerId: 21 })
    // Every member moved by the same (60, 40) delta.
    expect(nodeButton('root').style.left).toBe('60px')
    expect(nodeButton('root').style.top).toBe('40px')
    expect(nodeButton('branchChild').style.left).toBe('60px')
    expect(nodeButton('branchChild').style.top).toBe('160px')
    // The title-band gesture never falls through to a background pan: in
    // the real browser the surface would steal the pointer capture and the
    // cluster drag would arrive dead (jsdom has no setPointerCapture, so
    // the no-pan assertion is the regression's proxy).
    expect(content().style.transform).toBe(transformBefore)
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]'))
      .toContain('"offsets":{"root":{"dx":60,"dy":40}}')
    expect(b.open).not.toHaveBeenCalled()
  })

  it('restores the cluster offset on remount', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 22, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 22, clientX: 340, clientY: 130 })
    fireEvent.pointerUp(title, { pointerId: 22 })
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(nodeButton('root').style.left).toBe('40px')
    expect(nodeButton('root').style.top).toBe('30px')
  })

  it('stores node drags in the cluster-local frame so offsets never double-apply', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 23, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 23, clientX: 360, clientY: 140 })
    fireEvent.pointerUp(title, { pointerId: 23 })
    // The cluster sits at +60/+40; dragging the child 10px right stores the
    // cluster-relative (10, 120), not the shown (70, 160).
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 24, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 24, clientX: 210, clientY: 200 })
    fireEvent.pointerUp(node, { pointerId: 24 })
    const stored = JSON.parse(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')!) as {
      positions: Record<string, { x: number; y: number }>
    }
    expect(stored.positions['branchChild']).toEqual({ x: 10, y: 120 })
  })

  it('never starts a cluster drag from the collapse toggle', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const toggle = document.querySelector('[data-cluster-id="root"] button')!
    fireEvent.pointerDown(toggle, { pointerId: 25, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(toggle, { pointerId: 25, clientX: 360, clientY: 140 })
    fireEvent.pointerUp(toggle, { pointerId: 25 })
    expect(nodeButton('root').style.left).toBe('0px')
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')).toBeNull()
  })

  it('rolls back a cluster drag when the pointer sequence is canceled', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 28, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 28, clientX: 360, clientY: 140 })
    expect(nodeButton('root').style.left).toBe('60px')
    fireEvent.pointerCancel(title, { pointerId: 28 })
    expect(nodeButton('root').style.left).toBe('0px')
    expect(nodeButton('root').style.top).toBe('0px')
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')).toBeNull()
  })

  it('raises the grabbed cluster frame above overlapping frames', async () => {
    const b = await bench({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      lone: session('lone', { updatedAt: 200 }),
      child: session('child', { parentId: id('lone'), updatedAt: 100 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(document.querySelector('[data-cluster-id="root"]')?.className).not.toContain('Raised')
    fireEvent.pointerDown(frameTitle('root'), { pointerId: 26, clientX: 300, clientY: 100 })
    expect(document.querySelector('[data-cluster-id="root"]')?.className).toContain('Raised')
    fireEvent.pointerUp(frameTitle('root'), { pointerId: 26 })
    // Bring-to-front survives the drop, until another cluster is grabbed.
    expect(document.querySelector('[data-cluster-id="root"]')?.className).toContain('Raised')
    fireEvent.pointerDown(frameTitle('lone'), { pointerId: 27, clientX: 300, clientY: 400 })
    expect(document.querySelector('[data-cluster-id="root"]')?.className).not.toContain('Raised')
    expect(document.querySelector('[data-cluster-id="lone"]')?.className).toContain('Raised')
    fireEvent.pointerUp(frameTitle('lone'), { pointerId: 27 })
  })
})

describe('relayout button', () => {
  it('clears manual positions and returns nodes to the auto layout', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 5, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 5, clientX: 340, clientY: 260 })
    fireEvent.pointerUp(node, { pointerId: 5 })
    expect(nodeButton('branchChild').style.left).not.toBe('0px')
    const movedLeft = nodeButton('branchChild').style.left
    const movedTop = nodeButton('branchChild').style.top
    chooseCanvasAction('重新布局')
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')).toContain('"positions":{}')
    chooseCanvasAction('重新布局')
    chooseCanvasAction('撤销重新布局')
    expect(nodeButton('branchChild').style.left).toBe(movedLeft)
    expect(nodeButton('branchChild').style.top).toBe(movedTop)
    chooseCanvasAction('重新布局')
    // A new collapse supersedes Undo; collapsed choices survive Relayout.
    fireEvent.click(document.querySelector('[data-cluster-id="root"] button')!)
    chooseCanvasAction('重新布局')
    fireEvent.click(screen.getByRole('button', { name: '图谱选项' }))
    expect(screen.queryByRole('button', { name: '撤销重新布局' })).toBeNull()
    expect(localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')).toContain('"collapsed":["root"]')
  })
})

describe('reset and minimap', () => {
  it('reset clears manual layout and collapse, then fits the view', async () => {
    localStorage.setItem('dsh.session-graph.layout.["test-host","/w",null]', JSON.stringify({
      v: 1,
      positions: {},
      collapsed: ['root'],
      offsets: { lone: { dx: 0, dy: 2_000 } },
    }))
    stubSize(1000, 600)
    const b = await bench({
      ...FIXTURE,
      lone: session('lone', { updatedAt: 100 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).not.toBe('100%')
    })
    expect(nodeButton('lone').style.top).toBe('2000px')
    chooseCanvasAction('重置布局')
    // Manual position and collapse both cleared; node returns to the auto grid.
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(nodeButton('branchChild').style.top).toBe('120px')
    const stored = localStorage.getItem('dsh.session-graph.layout.["test-host","/w",null]')
    expect(stored).toContain('"positions":{}')
    expect(stored).toContain('"collapsed":[]')
    // The cleared graph, rather than the previous far-away graph, owns Fit.
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    expect(nodeButton('root').parentElement?.style.transform).toBe('translate(224px, 228px) scale(1)')
  })

  it('renders the minimap with node marks and the live viewport rectangle', async () => {
    // A wide tree (four Branch children spread over 1080px) lets the zoomed-in
    // viewport cover less than the full map, so the rectangle appears.
    const b = await bench({
      root: session('root', { updatedAt: 500 }),
      c1: session('c1', { parentId: id('root'), updatedAt: 400 }),
      c2: session('c2', { parentId: id('root'), updatedAt: 300 }),
      c3: session('c3', { parentId: id('root'), updatedAt: 200 }),
      c4: session('c4', { parentId: id('root'), updatedAt: 100 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const minimap = screen.getByTestId('session-graph-minimap')
    expect(minimap).toBeTruthy()
    // Five canvas nodes project to five node marks plus the cluster frame.
    expect(minimap.querySelectorAll('rect').length).toBeGreaterThanOrEqual(6)
    // At a fitted viewport below identity the rect hides (it would cover
    // the whole minimap); zoom in past identity so the visible region
    // shrinks below the content and the rect appears, then pan and assert
    // it tracks.
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: '放大' }))
    const view = screen.getByTestId('session-graph-minimap-viewport')
    expect(view).toBeTruthy()
    // Panning the surface moves the projected viewport rectangle.
    const before = view.getAttribute('x')
    const surface = document.querySelector('[role="group"][aria-label="会话关系图谱"]') as HTMLElement
    fireEvent.pointerDown(surface, { pointerId: 4, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { pointerId: 4, clientX: 220, clientY: 160 })
    fireEvent.pointerUp(surface, { pointerId: 4 })
    expect(view.getAttribute('x')).not.toBe(before)
  })

  it('hides the minimap while the whole graph fits and restores it when content leaves the view', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)

    fireEvent.click(screen.getByRole('button', { name: '适应' }))
    expect(screen.queryByTestId('session-graph-minimap')).toBeNull()

    const surface = document.querySelector('[role="group"][aria-label="会话关系图谱"]') as HTMLElement
    fireEvent.pointerDown(surface, { pointerId: 31, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(surface, { pointerId: 31, clientX: 900, clientY: 50 })
    fireEvent.pointerUp(surface, { pointerId: 31 })
    expect(screen.getByTestId('session-graph-minimap')).toBeTruthy()
  })

  it('pointing the minimap recenters the surface', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    const minimap = screen.getByTestId('session-graph-minimap')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 180, height: 120, x: 0, y: 0, top: 0, left: 0, right: 180, bottom: 120, toJSON: () => ({}),
    })
    fireEvent.pointerDown(minimap, { pointerId: 8, clientX: 30, clientY: 30 })
    expect(content().style.transform).not.toBe(before)
  })
})

describe('discussion search through the registered Graph view', () => {
  it('resets a deleted search Workspace and abandons its pending page and inspected original', async () => {
    const b = await bench(FIXTURE)
    const a = workspace('a', '/w', ['root'])
    const workspaceStore = createSnapshotStore(workspacesState([a, workspace('b', '/b', [])]))
    const hit = (title: string) => ({ sessionId: title, title, archived: false, eventSeq: 2, turnStartSeq: 0, time: 1000, snippet: title })
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'results', hits: [hit('B 资料')], nextCursor: '1f627a35-bb71-4ce5-9c56-1ca4bca83cc6:20' } })
    let release!: () => void
    b.searchDiscussion.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve })
      return { ok: true, value: { kind: 'results', hits: [hit('B 迟到结果')] } }
    })
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'results', hits: [hit('A 资料')] } })
    mount(b.slots, b.sessionsStore, 'root', workspaceStore)
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.change(screen.getByRole('combobox', { name: '搜索范围' }), { target: { value: 'workspace:b' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '查看原文：B 资料' }))
    fireEvent.click(screen.getByRole('button', { name: '加载更多结果' }))
    const oldSignal = b.searchDiscussion.mock.calls[1]![1]!
    await act(async () => { workspaceStore.set(workspacesState([a])) })
    const abandoned = oldSignal.aborted
    await act(async () => { release() })
    expect(abandoned).toBe(true)
    expect(screen.queryByRole('button', { name: '查看原文：B 资料' })).toBeNull()
    expect(screen.queryByRole('button', { name: '查看原文：B 迟到结果' })).toBeNull()
    expect(screen.queryByRole('button', { name: '打开会话', exact: true })).toBeNull()
    expect((screen.getByRole('combobox', { name: '搜索范围' }) as HTMLSelectElement).value).toBe('workspace:a')
    expect((screen.getByRole('textbox', { name: '正文关键词' }) as HTMLInputElement).value).toBe('needle')
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    await screen.findByRole('button', { name: '查看原文：A 资料' })
    expect(b.searchDiscussion.mock.lastCall![0]).toEqual({ query: 'needle', scope: { kind: 'workspace', workspaceId: 'a' }, includeArchived: false })
    expect(b.open).not.toHaveBeenCalled()
  })

  it('offers all-Host discussion search even when the Viewed Session has no graph scope', async () => {
    const b = await bench({ loose: session('loose', { cwd: undefined }) })
    mount(b.slots, b.sessionsStore, 'loose')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    await screen.findByText('所选范围内没有匹配的讨论。')
    expect(b.searchDiscussion).toHaveBeenCalledWith({ query: 'needle', scope: { kind: 'all' }, includeArchived: false }, expect.any(AbortSignal))
  })

  it.each(['register', 'remove'])('keeps the visible scope and request aligned when Workspaces %s the Viewed Session scope', async action => {
    const b = await bench({ root: session('root', { cwd: action === 'remove' ? undefined : '/w' }) })
    const a = workspace('a', '/w', ['root'])
    const workspaceStore = createSnapshotStore(workspacesState(action === 'remove' ? [a] : []))
    mount(b.slots, b.sessionsStore, 'root', workspaceStore)
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    await act(async () => { workspaceStore.set(workspacesState(action === 'register' ? [a] : [])) })
    const expected = action === 'register' ? { kind: 'workspace', workspaceId: 'a' } : { kind: 'all' }
    expect((screen.getByRole('combobox', { name: '搜索范围' }) as HTMLSelectElement).value).toBe(action === 'register' ? 'workspace:a' : 'all')
    // A different scope identity restores its own conditions, not the previous scope's draft.
    expect((screen.getByRole('textbox', { name: '正文关键词' }) as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    await screen.findByText('所选范围内没有匹配的讨论。')
    expect(b.searchDiscussion).toHaveBeenCalledWith({ query: 'needle', scope: expected, includeArchived: false }, expect.any(AbortSignal))
  })

  it('keeps keyboard focus within search and restores the entry after Escape', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const entry = screen.getByRole('button', { name: '搜索讨论与知识' })
    fireEvent.click(entry)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '正文关键词' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    const close = screen.getByRole('button', { name: '关闭搜索' })
    const submit = screen.getByRole('button', { name: '搜索', exact: true })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(submit)
    fireEvent.keyDown(submit, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(entry))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('restarts an expired page without keeping old hits or an obsolete inspected source', async () => {
    const b = await bench(FIXTURE)
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'results', hits: [{
      sessionId: 'expired', title: '过期结果', archived: false, eventSeq: 2, turnStartSeq: 0, time: 1000, snippet: 'needle',
    }], nextCursor: '1f627a35-bb71-4ce5-9c56-1ca4bca83cc6:20' } })
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'stale' } })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '查看原文：过期结果' }))
    fireEvent.click(screen.getByRole('button', { name: '加载更多结果' }))
    await screen.findByText('结果已过期或范围已变化，请重新搜索。')
    expect(screen.queryByRole('button', { name: '查看原文：过期结果' })).toBeNull()
    expect(screen.queryByRole('button', { name: '打开会话', exact: true })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重新搜索' }))
    await screen.findByText('所选范围内没有匹配的讨论。')
    expect(b.searchDiscussion.mock.calls[2]![0].cursor).toBeUndefined()
  })

  it('appends the next page and retries a failed page without losing the inspected source', async () => {
    const b = await bench(FIXTURE)
    const hit = (title: string) => ({ sessionId: title, title, archived: false, eventSeq: 2, turnStartSeq: 0, time: 1000, snippet: title })
    const cursor = '1f627a35-bb71-4ce5-9c56-1ca4bca83cc6:20'
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'results', hits: [hit('第一页')], nextCursor: cursor } })
    b.searchDiscussion.mockResolvedValueOnce({ ok: false, error: { code: 'failed', message: 'Interrupted', details: {} } } as never)
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'results', hits: [hit('第二页')] } })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '查看原文：第一页' }))
    fireEvent.click(screen.getByRole('button', { name: '加载更多结果' }))
    fireEvent.click(await screen.findByRole('button', { name: '重试搜索' }))
    await screen.findByRole('button', { name: '查看原文：第二页' })
    expect(screen.getByRole('button', { name: '查看原文：第一页' }).getAttribute('aria-pressed')).toBe('true')
    expect(b.searchDiscussion.mock.calls.slice(1).map(([request]) => request)).toEqual([
      { query: 'needle', scope: { kind: 'directory', cwd: '/w' }, includeArchived: false, cursor },
      { query: 'needle', scope: { kind: 'directory', cwd: '/w' }, includeArchived: false, cursor },
    ])
    expect(screen.queryByRole('button', { name: '加载更多结果' })).toBeNull()
    expect(b.open).not.toHaveBeenCalled()
  })

  it.each(['query', 'scope', 'archive', 'cancel', 'close'])('ignores a late search after changing %s and preserves the newer result', async action => {
    const b = await bench(FIXTURE)
    const hit = (title: string) => ({ sessionId: title, title, archived: false, eventSeq: 2, turnStartSeq: 0, time: 1000, snippet: title })
    let release!: () => void
    b.searchDiscussion.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve })
      return { ok: true, value: { kind: 'results', hits: [hit('旧查询结果')] } }
    })
    // Reopening now performs a fresh search before the next explicit submission.
    b.searchDiscussion.mockResolvedValue({ ok: true, value: { kind: 'results', hits: [hit('新查询结果')] } })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'old' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    expect(screen.getByText('正在准备索引并检索讨论…')).toBeTruthy()
    const signal = b.searchDiscussion.mock.calls[0]![1]!
    if (action === 'query') fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'new' } })
    if (action === 'scope') fireEvent.change(screen.getByRole('combobox', { name: '搜索范围' }), { target: { value: 'all' } })
    if (action === 'archive') fireEvent.click(screen.getByRole('checkbox', { name: '包含归档' }))
    if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: '取消搜索' }))
    if (action === 'close') {
      fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))
      fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    }
    const wasAborted = signal.aborted
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'newer' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    await act(async () => { release() })
    expect(wasAborted).toBe(true)
    await screen.findByRole('button', { name: '查看原文：新查询结果' })
    expect(screen.queryByRole('button', { name: '查看原文：旧查询结果' })).toBeNull()
    expect(b.open).not.toHaveBeenCalled()
  })

  it('explains how to enable a disabled index and can search again after enabling it', async () => {
    const b = await bench(FIXTURE)
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'disabled' } } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    await screen.findByText('全文索引尚未启用。')
    expect(screen.getByText(/first-search/).textContent).toContain('cordis.patch.yml')
    expect(screen.getByRole('link', { name: '查看启用步骤' }).getAttribute('href')).toContain('README.zh.md')
    fireEvent.click(screen.getByRole('button', { name: '重新搜索' }))
    await screen.findByText('所选范围内没有匹配的讨论。')
    expect(screen.queryByText('全文索引尚未启用。')).toBeNull()
  })

  it('keeps the query after failure and retries through the public search remote', async () => {
    const b = await bench(FIXTURE)
    b.searchDiscussion.mockResolvedValueOnce({ ok: false, error: { code: 'failed', message: 'Index unavailable', details: {} } } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: 'needle' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '重试搜索' }))
    await screen.findByText('所选范围内没有匹配的讨论。')
    expect((screen.getByRole('textbox', { name: '正文关键词' }) as HTMLInputElement).value).toBe('needle')
    expect(b.searchDiscussion).toHaveBeenCalledTimes(2)
  })

  it('finds an archived cross-workspace source and reads the exact turn before explicit navigation', async () => {
    const b = await bench(FIXTURE)
    b.searchDiscussion.mockResolvedValueOnce({ ok: true, value: { kind: 'results', hits: [{
      sessionId: 'archived-source', title: '外部研究讨论', archived: true,
      workspace: { id: 'other', title: '其他工作区' }, cwd: '/other',
      eventSeq: 38, turnStartSeq: 36, time: 1000, snippet: '以知识卡片保存讨论结论。',
    }] } } as never)
    b.readHistory.mockResolvedValueOnce({ ok: true, value: {
      kind: 'original', sessionId: 'archived-source', hasEarlier: true, hasLater: true,
      turns: [{ turn: 7, startSeq: 36, endSeq: 41, startedAt: 1000,
        messages: [{ role: 'user', seq: 38, text: '原文：以知识卡片保存讨论结论。' }],
      }],
    } })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '搜索讨论与知识' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正文关键词' }), { target: { value: '知识卡片' } })
    fireEvent.change(screen.getByRole('combobox', { name: '搜索范围' }), { target: { value: 'all' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '包含归档' }))
    fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '查看原文：外部研究讨论' }))
    await screen.findByText('原文：以知识卡片保存讨论结论。')
    expect(b.searchDiscussion).toHaveBeenCalledWith({
      query: '知识卡片', scope: { kind: 'all' }, includeArchived: true,
    }, expect.any(AbortSignal))
    expect(b.readHistory).toHaveBeenCalledWith({ sessionId: 'archived-source', anchorSeq: 36 }, expect.any(AbortSignal))
    expect(screen.getByRole('complementary', { name: '搜索原文' })).toBeTruthy()
    expect(screen.getByText('第 7 轮')).toBeTruthy()
    expect(b.open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '打开会话', exact: true }))
    expect(b.open).toHaveBeenCalledWith(id('archived-source'))
  })
})

describe('node selection, double-click, and keyboard navigation', () => {
  it('keeps the existing selection when a refresh skips discussion turns that have not been loaded', async () => {
    const b = await bench(FIXTURE)
    const page = (number: number) => ({ ok: true, value: {
      kind: 'original', sessionId: 'root', hasEarlier: number > 1, hasLater: false,
      turns: [{
        turn: number, startSeq: (number - 1) * 6, endSeq: number * 6 - 1,
        startedAt: 1000, messages: [{ role: 'user', seq: (number - 1) * 6 + 2, text: `Discussion ${number}` }],
      }],
    } })
    b.readHistory.mockResolvedValueOnce(page(1) as never)
    b.readHistory.mockResolvedValueOnce(page(3) as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('Discussion 1')
    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '刷新原文' }))
    await screen.findByText('Discussion 3')
    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 3 轮' }))
    expect(screen.getByText('已选择第 1–1 轮')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('中间还有未加载或未完成的轮次')
    expect((screen.getByRole('checkbox', { name: '选择第 3 轮' }) as HTMLInputElement).checked).toBe(false)
  })

  it('switches Inspector tabs with the keyboard without moving the Selected Session', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    const digest = screen.getByRole('tab', { name: '会话摘要' })
    digest.focus()
    fireEvent.keyDown(digest, { key: 'ArrowRight' })
    const original = screen.getByRole('tab', { name: '原文' })
    expect(original.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(original)
    expect(nodeButton('root').getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(original, { key: 'Home' })
    expect(digest.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(digest)
  })

  it('refreshes an unfinished discussion so its completed original becomes selectable', async () => {
    const b = await bench(FIXTURE)
    const page = (endSeq: number | null) => ({ ok: true, value: { kind: 'original', sessionId: 'root', hasEarlier: false, hasLater: false,
      turns: [{ turn: 1, startSeq: 0, endSeq, startedAt: 1000,
        messages: endSeq === null ? [] : [{ role: 'user', seq: 2, text: 'A discussion in progress' }],
      }],
    } })
    b.readHistory.mockResolvedValueOnce(page(null) as never)
    b.readHistory.mockResolvedValueOnce(page(5) as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('尚未完成，不可选作固定来源')
    expect((screen.getByRole('checkbox', { name: '选择第 1 轮' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '刷新原文' }))
    await waitFor(() => expect((screen.getByRole('checkbox', { name: '选择第 1 轮' }) as HTMLInputElement).disabled).toBe(false))
    expect(screen.queryByText('尚未完成，不可选作固定来源')).toBeNull()
  })

  it('keeps every completed turn when a selected discussion range crosses a loaded page boundary', async () => {
    const b = await bench(FIXTURE)
    const turns = [
      { turn: 1, startSeq: 0, endSeq: 5, startedAt: 1000, messages: [{ role: 'user', seq: 2, text: 'One' }] },
      { turn: 2, startSeq: 6, endSeq: 11, startedAt: 2000, messages: [{ role: 'user', seq: 8, text: 'Two' }] },
      { turn: 3, startSeq: 12, endSeq: 17, startedAt: 3000, messages: [{ role: 'user', seq: 14, text: 'Three' }] },
    ]
    const page = (items: typeof turns, hasEarlier: boolean, hasLater: boolean) => ({ ok: true, value: { kind: 'original', sessionId: 'root', turns: items, hasEarlier, hasLater } })
    b.readHistory.mockResolvedValueOnce(page(turns.slice(1), true, false) as never)
    b.readHistory.mockResolvedValueOnce(page(turns.slice(0, 1), false, true) as never)
    b.readHistory.mockResolvedValueOnce(page(turns, false, false) as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('Three')
    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 3 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '加载更早的讨论' }))
    await screen.findByText('One')
    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 1 轮' }))
    expect(screen.getByText('已选择第 1–3 轮')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '复核所选原文' }))
    await waitFor(() => expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'root', source: { startSeq: 0, endSeq: 17, turns } }, expect.any(AbortSignal)))
    expect(await screen.findByText('Two')).toBeTruthy()
  })

  it.each(['cancel', 'close', 'switch'] as const)('abandons a discussion read on %s and ignores its late reply after a newer read', async action => {
    const b = await bench(FIXTURE)
    const pending = deferred<Awaited<ReturnType<typeof b.readHistory>>>()
    const reply = (sessionId: string, text: string) => ({ ok: true, value: {
      kind: 'original', sessionId, hasEarlier: false, hasLater: false,
      turns: [{ turn: 1, startSeq: 0, endSeq: 5, startedAt: 1000, messages: [{ role: 'user', seq: 2, text }] }],
    } })
    b.readHistory.mockReturnValueOnce(pending.promise)
    b.readHistory.mockResolvedValueOnce(reply(action === 'switch' ? 'branchChild' : 'root', 'Newer discussion') as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    const signal = b.readHistory.mock.calls[0]![1] as AbortSignal
    if (action === 'cancel') {
      fireEvent.click(screen.getByRole('button', { name: '取消读取' }))
      expect(screen.getByText('已取消读取')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    } else if (action === 'close') {
      fireEvent.click(screen.getByRole('button', { name: '关闭会话详情' }))
      expect(screen.queryByRole('region', { name: '讨论原文' })).toBeNull()
      fireEvent.click(nodeButton('root'))
    } else fireEvent.click(nodeButton('branchChild'))
    expect(signal.aborted).toBe(true)
    expect(await screen.findByText('Newer discussion')).toBeTruthy()
    await act(async () => {
      pending.resolve(reply('root', 'Obsolete late discussion') as never)
      await pending.promise
    })
    expect(screen.queryByText('Obsolete late discussion')).toBeNull()
    expect(screen.getByText('Newer discussion')).toBeTruthy()
  })

  it('keeps a retained excerpt labelled while retrying and after a transport failure', async () => {
    const b = await bench(FIXTURE)
    const pending = deferred<Awaited<ReturnType<typeof b.readHistory>>>()
    const turns = [{ turn: 1, startSeq: 0, endSeq: 5, startedAt: 1000,
      messages: [{ role: 'user' as const, seq: 2, text: 'Retained discussion evidence.' }],
    }]
    const original = { ok: true as const, value: {
      kind: 'original' as const, sessionId: 'root', hasEarlier: false, hasLater: false, turns,
    } }
    b.readHistory.mockResolvedValueOnce(original)
    b.readHistory.mockResolvedValueOnce({ ...original, value: { ...original.value, kind: 'excerpt' } })
    b.readHistory.mockReturnValueOnce(pending.promise)
    b.readHistory.mockResolvedValueOnce(original)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('Retained discussion evidence.')
    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '复核所选原文' }))
    await screen.findByText('仅存摘录')

    const expectExcerpt = (): void => {
      expect(screen.getByText('Retained discussion evidence.')).toBeTruthy()
      expect.soft(screen.queryByText('仅存摘录')).not.toBeNull()
      expect(screen.getByRole('region', { name: '讨论原文' }).textContent).toContain('事件 0–5')
      expect((screen.getByRole('checkbox', { name: '选择第 1 轮' }) as HTMLInputElement).disabled).toBe(true)
    }
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    expect(screen.getByText('正在读取原文…')).toBeTruthy()
    expectExcerpt()
    await act(async () => {
      pending.resolve({ ok: false, error: { code: 'offline', message: 'Host disconnected' } } as never)
      await pending.promise
    })
    await screen.findByText('读取失败，请重试。')
    expectExcerpt()

    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    await waitFor(() => expect((screen.getByRole('checkbox', { name: '选择第 1 轮' }) as HTMLInputElement).disabled).toBe(false))
    expect(screen.queryByText('仅存摘录')).toBeNull()
    expect(b.open).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
  })

  it('labels a retained selection as excerpt-only when its original disappears and can retry that exact source', async () => {
    const b = await bench(FIXTURE)
    const turns = [{ turn: 1, startSeq: 0, endSeq: 5, startedAt: 1000,
      messages: [{ role: 'user', seq: 2, text: 'Keep this evidence.' }],
    }]
    const original = { ok: true, value: { kind: 'original', sessionId: 'root', hasEarlier: false, hasLater: false, turns } }
    b.readHistory.mockResolvedValueOnce(original as never)
    b.readHistory.mockResolvedValueOnce({ ...original, value: { ...original.value, kind: 'excerpt' } } as never)
    b.readHistory.mockResolvedValueOnce(original as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('Keep this evidence.')
    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 1 轮' }))
    fireEvent.click(screen.getByRole('button', { name: '复核所选原文' }))
    expect(await screen.findByText('仅存摘录')).toBeTruthy()
    expect(screen.getByText('Keep this evidence.')).toBeTruthy()
    expect(screen.getByRole('region', { name: '讨论原文' }).textContent).toContain('事件 0–5')
    expect((screen.getByRole('checkbox', { name: '选择第 1 轮' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    await waitFor(() => expect(screen.queryByText('仅存摘录')).toBeNull())
    expect((screen.getByRole('checkbox', { name: '选择第 1 轮' }) as HTMLInputElement).disabled).toBe(false)
    expect(b.readHistory).toHaveBeenLastCalledWith({ sessionId: 'root', source: { startSeq: 0, endSeq: 5, turns } }, expect.any(AbortSignal))
  })

  it('offers retry for an unreadable discussion and distinguishes an empty original', async () => {
    const b = await bench(FIXTURE)
    b.readHistory.mockResolvedValueOnce({ ok: false, error: { code: 'offline', message: 'Host disconnected' } } as never)
    b.readHistory.mockResolvedValueOnce({ ok: true, value: { kind: 'unavailable', sessionId: 'root', turns: [], hasEarlier: false, hasLater: false } } as never)
    b.readHistory.mockResolvedValueOnce({ ok: true, value: { kind: 'original', sessionId: 'root', turns: [], hasEarlier: false, hasLater: false } } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    expect((await screen.findByRole('alert')).textContent).toContain('读取失败')
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    expect(await screen.findByText('来源不可用')).toBeTruthy()
    expect(screen.getByRole('region', { name: '讨论原文' }).textContent).toContain('root')
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    expect(await screen.findByText('此会话暂无讨论轮次')).toBeTruthy()
    expect(screen.queryByText('来源不可用')).toBeNull()
  })

  it('selects a continuous completed discussion range while the unfinished turn remains ineligible', async () => {
    const b = await bench(FIXTURE)
    const turns = [
      { turn: 1, startSeq: 0, endSeq: 5, startedAt: 1000, messages: [{ role: 'user', seq: 2, text: 'First turn' }] },
      { turn: 2, startSeq: 6, endSeq: 11, startedAt: 2000, messages: [{ role: 'user', seq: 8, text: 'Second turn' }] },
      { turn: 3, startSeq: 12, endSeq: 17, startedAt: 3000, messages: [{ role: 'user', seq: 14, text: 'Third turn' }] },
      { turn: 4, startSeq: 18, endSeq: null, startedAt: 4000, messages: [] },
    ]
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'original', sessionId: 'root', hasEarlier: false, hasLater: false, turns } } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    await screen.findByText('First turn')
    const choice = (turn: number) => screen.getByRole('checkbox', { name: `选择第 ${turn} 轮` }) as HTMLInputElement
    fireEvent.click(choice(1))
    expect(choice(1).checked).toBe(true)
    fireEvent.click(choice(3))
    expect([choice(1).checked, choice(2).checked, choice(3).checked, choice(4).disabled]).toEqual([true, true, true, true])
    expect(screen.getByText('尚未完成，不可选作固定来源')).toBeTruthy()
    expect(screen.getByText('已选择第 1–3 轮')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '复核所选原文' }))
    await waitFor(() => expect(b.readHistory).toHaveBeenLastCalledWith({
      sessionId: 'root', source: { startSeq: 0, endSeq: 17, turns: turns.slice(0, 3) },
    }, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: '清除选择' }))
    expect([choice(1).checked, choice(2).checked, choice(3).checked]).toEqual([false, false, false])
    expect(b.generateDigest).not.toHaveBeenCalled()
    expect(b.open).not.toHaveBeenCalled()
  })

  it('pages discussion turns on demand and shows loading and earlier/later availability', async () => {
    const b = await bench(FIXTURE)
    const pending = deferred<Awaited<ReturnType<typeof b.readHistory>>>()
    const turn = (number: number, startSeq: number, text: string) => ({
      turn: number, startSeq, endSeq: startSeq + 5, startedAt: 1000,
      messages: [{ role: 'user', seq: startSeq + 2, text }],
    })
    const latest = { ok: true, value: { kind: 'original', sessionId: 'root', hasEarlier: true, hasLater: false, turns: [turn(2, 6, 'Later discussion')] } }
    b.readHistory.mockReturnValueOnce(pending.promise)
    b.readHistory.mockResolvedValueOnce({ ok: true, value: {
      kind: 'original', sessionId: 'root', hasEarlier: false, hasLater: true, turns: [turn(1, 0, 'Earlier discussion')],
    } } as never)
    b.readHistory.mockResolvedValueOnce(latest as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))
    expect(screen.getByRole('status').textContent).toContain('正在读取原文')
    pending.resolve(latest as never)
    expect(await screen.findByText('Later discussion')).toBeTruthy()
    expect((screen.getByRole('button', { name: '加载更晚的讨论' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '加载更早的讨论' }))
    expect(await screen.findByText('Earlier discussion')).toBeTruthy()
    expect((screen.getByRole('button', { name: '加载更早的讨论' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '加载更晚的讨论' }))
    expect(await screen.findByText('Later discussion')).toBeTruthy()
    expect(b.readHistory.mock.calls.map(call => call[0])).toEqual([
      { sessionId: 'root' }, { sessionId: 'root', beforeSeq: 6 }, { sessionId: 'root', afterSeq: 0 },
    ])
  })

  it('reads a Selected Session completed discussion in the Inspector without navigating or generating a digest', async () => {
    const b = await bench(FIXTURE)
    b.readHistory.mockResolvedValueOnce({ ok: true, value: {
      kind: 'original', sessionId: 'branchChild', hasEarlier: false, hasLater: false, turns: [{
        turn: 1, startSeq: 10, endSeq: 14, startedAt: 1000,
        messages: [
          { role: 'user', seq: 11, text: 'Why preserve the original discussion?' },
          { role: 'assistant', seq: 13, text: 'So that a conclusion remains traceable.' },
        ],
      }],
    } } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('branchChild'))
    fireEvent.click(screen.getByRole('tab', { name: '原文' }))

    expect(await screen.findByText('Why preserve the original discussion?')).toBeTruthy()
    expect(screen.getByText('So that a conclusion remains traceable.')).toBeTruthy()
    expect(screen.getByRole('region', { name: '讨论原文' }).textContent).toContain('branchChild')
    expect(b.open).not.toHaveBeenCalled()
    expect(b.generateDigest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '打开会话' }))
    expect(b.open).toHaveBeenCalledExactlyOnceWith(id('branchChild'))
  })

  it('pressing Escape clears the Selected Session and closes its inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')

    fireEvent.click(node)
    expect(node.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()

    fireEvent.keyDown(document.querySelector('[aria-label="会话关系图谱"]')!, { key: 'Escape' })
    expect(node.getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
  })

  it('clicking the canvas background clears the Selected Session', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')
    const surface = document.querySelector('[aria-label="会话关系图谱"]')!

    fireEvent.click(node)
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()

    fireEvent.pointerDown(surface, { pointerId: 21, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(surface, { pointerId: 21, clientX: 40, clientY: 40 })
    expect(node.getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
  })

  it('keeps selection through the browser double-click sequence and opens exactly once', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')
    fireEvent.click(node, { detail: 1 })
    fireEvent.click(node, { detail: 2 })
    fireEvent.doubleClick(node, { detail: 2 })
    expect(node.getAttribute('aria-selected')).toBe('true')
    expect(b.open).toHaveBeenCalledWith(id('branchChild'))
    expect(b.open).toHaveBeenCalledTimes(1)
  })

  it('selecting a node opens the summary panel with open and branch actions', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    fireEvent.click(nodeButton('root'))
    const panel = screen.getByTestId('session-graph-panel')
    expect(panel.textContent).toContain('Session root')
    expect(panel.textContent).toContain('2 子代理')
    const openButton = [...panel.querySelectorAll('button')].find(btn => btn.textContent === '打开会话')!
    fireEvent.click(openButton)
    expect(b.open).toHaveBeenCalledWith(id('root'))
    fireEvent.click(branchActionButton())
    expect(b.fork).toHaveBeenCalledWith({ sessionId: id('root'), increaseTitle: true })
    expect(panel.isConnected).toBe(true)
  })

  it('keeps wheel gestures inside the Selected Session inspector out of canvas zoom', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    fireEvent.click(nodeButton('root'))

    fireEvent.wheel(screen.getByTestId('session-graph-panel'), {
      deltaY: 120,
      clientX: 900,
      clientY: 320,
    })

    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
  })

  it('preserves native text-selection gestures in a Session Digest without starting a canvas pan', async () => {
    const b = await bench(FIXTURE)
    b.generateDigest.mockResolvedValueOnce(digestSuccess('root', {
      overview: '可选择的长摘要。',
    }) as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))

    await waitFor(() => {
      expect(screen.getByTestId('session-digest-section').textContent).toContain('可选择的长摘要。')
    })
    const scroller = screen.getByTestId('session-digest-scroll') as HTMLDivElement
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 800 },
    })
    scroller.scrollTop = 120

    fireEvent.pointerDown(scroller, {
      pointerId: 41,
      pointerType: 'mouse',
      button: 0,
      clientY: 220,
    })
    fireEvent.pointerMove(scroller, {
      pointerId: 41,
      pointerType: 'mouse',
      clientY: 160,
    })
    fireEvent.pointerUp(scroller, { pointerId: 41, pointerType: 'mouse' })

    expect(scroller.scrollTop).toBe(120)
    expect(nodeButton('root').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
  })

  it('generates and presents a structured Session Digest without blocking navigation actions', async () => {
    const b = await bench(FIXTURE)
    const pending = deferred<{
      readonly ok: true
      readonly value: {
        readonly kind: 'ready'
        readonly cached: false
        readonly digest: {
          readonly sessionId: string
          readonly sourceRevision: string
          readonly sourceTurnCount: number
          readonly generatedAt: number
          readonly generatedWhileRunning: boolean
          readonly overview: string
          readonly keyOutcomes: readonly string[]
          readonly openItems: readonly string[]
        }
      }
    }>()
    b.generateDigest.mockImplementationOnce(() => pending.promise)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))

    const digest = screen.getByTestId('session-digest-section')
    expect(screen.getByRole('region', { name: '会话摘要' })).toBe(digest)
    expect(digest.textContent).toContain('用简短要点回顾结论、关键信息与下一步')
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))
    expect(digest.textContent).toContain('正在生成摘要')
    expect((screen.getByRole('button', { name: '打开会话' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '开新分支' }) as HTMLButtonElement).disabled).toBe(false)

    pending.resolve({
      ok: true,
      value: {
        kind: 'ready',
        cached: false,
        digest: {
          sessionId: 'root',
          sourceRevision: '12',
          sourceTurnCount: 3,
          generatedAt: 2_000,
          generatedWhileRunning: false,
          overview: '会话确定了按需生成摘要的方案。',
          keyOutcomes: ['摘要不写入会话日志。'],
          openItems: ['完成视觉验证。'],
        },
      },
    })

    await waitFor(() => {
      expect(digest.textContent).toContain('会话确定了按需生成摘要的方案。')
    })
    expect(digest.textContent).toContain('关键结论')
    expect(digest.textContent).toContain('摘要不写入会话日志。')
    expect(digest.textContent).toContain('待处理')
    expect(digest.textContent).toContain('完成视觉验证。')
    expect(digest.textContent).toContain('基于 3 轮对话')
    expect(screen.getByRole('button', { name: '重新生成' })).toBeTruthy()
    expect(b.generateDigest).toHaveBeenCalledWith(
      { sessionId: id('root'), refresh: false },
      expect.any(AbortSignal),
    )
  })

  it('marks a running digest as a snapshot, detects new Session content, and refreshes in place', async () => {
    const b = await bench(FIXTURE)
    b.generateDigest.mockResolvedValueOnce(digestSuccess('root', {
      overview: '旧摘要仍可阅读。',
      generatedWhileRunning: true,
    }) as never)
    const refresh = deferred<ReturnType<typeof digestSuccess>>()
    b.generateDigest.mockImplementationOnce(() => refresh.promise as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))

    await waitFor(() => {
      expect(screen.getByTestId('session-digest-section').textContent).toContain('旧摘要仍可阅读。')
    })
    expect(screen.getByTestId('session-digest-section').textContent).toContain('运行中快照')

    act(() => {
      b.sessionsStore.set(listState({
        ...FIXTURE,
        root: session('root', { updatedAt: 600 }),
      }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('session-digest-section').textContent).toContain('会话有新内容')
    })
    fireEvent.click(screen.getByRole('button', { name: '更新摘要' }))
    expect(screen.getByTestId('session-digest-section').textContent).toContain('正在更新摘要')
    expect(screen.getByTestId('session-digest-section').textContent).toContain('旧摘要仍可阅读。')
    expect(b.generateDigest).toHaveBeenLastCalledWith(
      { sessionId: id('root'), refresh: true },
      expect.any(AbortSignal),
    )

    refresh.resolve(digestSuccess('root', { overview: '新摘要已覆盖旧快照。' }))
    await waitFor(() => {
      expect(screen.getByTestId('session-digest-section').textContent).toContain('新摘要已覆盖旧快照。')
    })
    expect(screen.getByTestId('session-digest-section').textContent).not.toContain('会话有新内容')
  })

  it('shows an empty state for a blank Session without calling the Host', async () => {
    const b = await bench({ blank: session('blank', { blank: true }) })
    mount(b.slots, b.sessionsStore, 'blank')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('blank'))

    expect(screen.getByTestId('session-digest-section').textContent)
      .toContain('暂无可总结的会话内容')
    expect(screen.queryByRole('button', { name: '生成摘要' })).toBeNull()
    expect(b.generateDigest).not.toHaveBeenCalled()
  })

  it('reopens generation after a previously empty Session receives new content', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))
    await waitFor(() => {
      expect(screen.getByTestId('session-digest-section').textContent)
        .toContain('暂无可总结的会话内容')
    })

    act(() => {
      b.sessionsStore.set(listState({
        ...FIXTURE,
        root: session('root', { updatedAt: 600 }),
      }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成摘要' })).toBeTruthy()
    })
  })

  it('shows a retryable error when Session Digest generation fails', async () => {
    const b = await bench(FIXTURE)
    b.generateDigest.mockResolvedValueOnce({
      ok: false,
      error: { code: 'generation-failed', message: 'offline', details: {} },
    } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('摘要生成失败，请重试')
    })
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => {
      expect(screen.getByTestId('session-digest-section').textContent)
        .toContain('暂无可总结的会话内容')
    })
    expect(b.generateDigest).toHaveBeenCalledTimes(2)
  })

  it('explains the digest output limit and retains the previous digest until an explicit retry succeeds', async () => {
    const b = await bench(FIXTURE)
    b.generateDigest.mockResolvedValueOnce(digestSuccess('root', { overview: '先前的完整摘要。' }))
    b.generateDigest.mockResolvedValueOnce({
      ok: false,
      error: { code: 'output-limit', message: 'provider detail must stay private', details: {} },
    } as never)
    b.generateDigest.mockResolvedValueOnce(digestSuccess('root', { overview: '重试后的完整摘要。' }))
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))
    await waitFor(() => { expect(screen.getByText('先前的完整摘要。')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '重新生成' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('摘要达到生成上限，请提高插件的摘要输出上限后重试')
    })
    expect(screen.getByRole('alert').getAttribute('data-error-code')).toBe('output-limit')
    expect(screen.getByRole('alert').getAttribute('title')).toBeNull()
    expect(screen.getByText('先前的完整摘要。')).toBeTruthy()
    expect(b.generateDigest).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(screen.getByText('重试后的完整摘要。')).toBeTruthy() })
    expect(b.generateDigest).toHaveBeenCalledTimes(3)
  })

  it('explains when Session Digest generation has no usable model route', async () => {
    const b = await bench(FIXTURE)
    b.generateDigest.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'model-route-unavailable',
        message: 'no recorded or configured route',
        details: {},
      },
    } as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent)
        .toContain('此会话没有可用的模型路由，请配置兜底模型后重试')
    })
    expect(screen.getByRole('alert').getAttribute('data-error-code'))
      .toBe('model-route-unavailable')
    expect(screen.getByRole('alert').getAttribute('title'))
      .toBe('no recorded or configured route')
  })

  it('cancels generation on selection change and ignores the previous Session late result', async () => {
    const b = await bench(FIXTURE)
    const pending = deferred<ReturnType<typeof digestSuccess>>()
    b.generateDigest.mockImplementationOnce(() => pending.promise as never)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.click(nodeButton('root'))
    fireEvent.click(screen.getByRole('button', { name: '生成摘要' }))
    const rootSignal = b.generateDigest.mock.calls[0]?.[1] as AbortSignal

    fireEvent.click(nodeButton('branchChild'))
    await waitFor(() => { expect(rootSignal.aborted).toBe(true) })
    pending.resolve(digestSuccess('root', { overview: '不得显示的迟到摘要。' }))
    await Promise.resolve()
    await Promise.resolve()

    const panel = screen.getByTestId('session-graph-panel')
    expect(panel.textContent).toContain('Session branchChild')
    expect(panel.textContent).not.toContain('不得显示的迟到摘要。')
    fireEvent.click(nodeButton('root'))
    expect(screen.getByTestId('session-digest-section').textContent)
      .toContain('用简短要点回顾结论、关键信息与下一步')
  })

  it('exposes a named Selected Session inspector that can be closed explicitly', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const node = nodeButton('branchChild')

    fireEvent.click(node)
    const inspector = screen.getByRole('complementary', { name: '会话详情' })
    expect(inspector.textContent).toContain('Session branchChild')

    fireEvent.click(screen.getByRole('button', { name: '关闭会话详情' }))
    expect(node.getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByRole('complementary', { name: '会话详情' })).toBeNull()
  })

  it('explains the Selected Session Branch source in the inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    fireEvent.click(nodeButton('branchChild'))
    expect(screen.getByRole('complementary', { name: '会话详情' }).textContent)
      .toContain('分支自：Session root')
  })

  it('shows one Display Status on the Selected Session using the agreed priority', async () => {
    const b = await bench({
      running: session('running', { running: true, completed: true }),
      waiting: session('waiting', { completed: true }),
      completed: session('completed', { completed: true }),
    })
    mount(
      b.slots,
      b.sessionsStore,
      'running',
      workspacesState(),
      new Map([[id('running'), {}], [id('waiting'), {}]]) as SessionPendingInteractionSnapshot,
    )
    switchTab('Research Graph')

    expect(nodeButton('running').dataset.displayStatus).toBe('running')
    expect(nodeButton('running').className).not.toContain('nodePending')
    expect(nodeButton('waiting').dataset.displayStatus).toBe('waiting-input')
    expect(nodeButton('completed').dataset.displayStatus).toBe('completed')

    fireEvent.click(nodeButton('running'))
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('运行中')
    expect(screen.getByTestId('session-graph-panel').textContent).not.toContain('等待输入')
    expect(screen.getByTestId('session-graph-panel').textContent).not.toContain('已完成')

    fireEvent.click(nodeButton('waiting'))
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('等待输入')
    expect(screen.getByTestId('session-graph-panel').textContent).not.toContain('已完成')
  })

  it('shows an error when Harness rejects creating a Branch', async () => {
    const b = await bench(FIXTURE)
    b.fork.mockRejectedValueOnce(new Error('branch rejected'))
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    fireEvent.click(nodeButton('root'))
    fireEvent.click(branchActionButton())

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('无法创建分支，请重试')
    })
  })

  it('clears a previous Branch error when retry succeeds', async () => {
    const b = await bench(FIXTURE)
    b.fork.mockRejectedValueOnce(new Error('branch rejected'))
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    fireEvent.click(nodeButton('root'))
    const branchButton = branchActionButton()
    fireEvent.click(branchButton)
    await waitFor(() => { expect(screen.getByRole('alert')).toBeTruthy() })

    fireEvent.click(branchButton)
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull() })
    expect(nodeButton('root').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('Session root')
  })

  it('arrow keys move focus between nodes by layout geometry', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    nodeButton('root').focus()
    // The tree grows top to bottom: the Branch child sits one row below.
    fireEvent.keyDown(document.querySelector('[aria-label="会话关系图谱"]')!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(nodeButton('branchChild'))
    fireEvent.keyDown(document.querySelector('[aria-label="会话关系图谱"]')!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(nodeButton('root'))
  })
})

describe('hover preview card', () => {
  afterEach(() => { vi.useRealTimers() })

  it('replaces a Canvas Session preview with the Selected Session inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    const node = nodeButton('branchChild')

    fireEvent.mouseEnter(node)
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByTestId('session-graph-preview')).toBeTruthy()

    fireEvent.click(node)
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('does not preview the Selected Session again on hover', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    const node = nodeButton('branchChild')

    fireEvent.click(node)
    fireEvent.mouseEnter(node)
    act(() => { vi.advanceTimersByTime(400) })

    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('previews another Canvas Session without replacing the Selected Session inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()

    fireEvent.click(nodeButton('branchChild'))
    fireEvent.mouseEnter(nodeButton('root'))
    act(() => { vi.advanceTimersByTime(400) })

    expect(screen.getByTestId('session-graph-panel').textContent).toContain('Session branchChild')
    expect(screen.getByTestId('session-graph-preview').textContent).toContain('Session root')
  })

  it('shows the detail card after the hover delay and hides it on leave', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    fireEvent.mouseEnter(nodeButton('branchChild'))
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
    act(() => { vi.advanceTimersByTime(400) })
    const preview = screen.getByTestId('session-graph-preview')
    expect(preview.textContent).toContain('Session branchChild')
    expect(preview.textContent).toContain('分支自：Session root')
    expect(preview.textContent).not.toContain('单击选择 · 双击打开')
    fireEvent.mouseLeave(nodeButton('branchChild'))
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('never opens on a quick pass-through hover', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    fireEvent.mouseEnter(nodeButton('branchChild'))
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.mouseLeave(nodeButton('branchChild'))
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('hides when the node drag starts', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    fireEvent.mouseEnter(nodeButton('branchChild'))
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByTestId('session-graph-preview')).toBeTruthy()
    fireEvent.pointerDown(nodeButton('branchChild'), { pointerId: 15, clientX: 200, clientY: 200 })
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
    fireEvent.pointerUp(nodeButton('branchChild'), { pointerId: 15 })
  })
})

describe('drag alignment snapping', () => {
  it('snaps the dragged node to a sibling edge, shows the guide, and clears it on release', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 13, clientX: 200, clientY: 200 })
    // 6px shy of root's top-left corner (0, 0): inside the snap threshold
    // on both axes.
    fireEvent.pointerMove(node, { pointerId: 13, clientX: 206, clientY: 86 })
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(nodeButton('branchChild').style.top).toBe('0px')
    expect(screen.getByTestId('session-graph-guide-x')).toBeTruthy()
    expect(screen.getByTestId('session-graph-guide-y')).toBeTruthy()
    fireEvent.pointerUp(node, { pointerId: 13 })
    expect(screen.queryByTestId('session-graph-guide-x')).toBeNull()
  })

  it('leaves the position untouched beyond the snap threshold', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 14, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 14, clientX: 280, clientY: 200 })
    expect(nodeButton('branchChild').style.left).toBe('80px')
    expect(screen.queryByTestId('session-graph-guide-x')).toBeNull()
    fireEvent.pointerUp(node, { pointerId: 14 })
  })
})

describe('programmatic viewport transitions', () => {
  it('marks fit and 100% jumps with the animated class but not step zooms', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(content().className).not.toContain('animated')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(content().className).toContain('animated')
  })
})

describe('locate Viewed Session button', () => {
  it('centers the viewport on the Viewed Session after panning away', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const surface = document.querySelector('[aria-label="会话关系图谱"]')!
    fireEvent.pointerDown(surface, { pointerId: 12, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { pointerId: 12, clientX: 500, clientY: 400 })
    fireEvent.pointerUp(surface, { pointerId: 12 })
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    fireEvent.click(screen.getByRole('button', { name: '定位' }))
    const transform = content().style.transform
    expect(transform).not.toBe(before)
    // The root Canvas Session sits at (0, 0); its card center (120, 28)
    // lands on the surface center (500, 300) at 100%.
    const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\) scale\((\d+(?:\.\d+)?)\)/)!
    const [, panX, panY, scale] = match.map(Number)
    expect(panX! + 120 * scale!).toBeCloseTo(500)
    expect(panY! + 28 * scale!).toBeCloseTo(300)
  })
})

describe('low-zoom level of detail', () => {
  it('fades node card text below the zoom threshold and restores it above', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(content().className).not.toContain('lowZoom')
    // Five 1/1.2 steps land at ≈40%: below the 45% detail threshold.
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(content().className).toContain('lowZoom')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(content().className).not.toContain('lowZoom')
  })
})

describe('canvas keyboard shortcuts', () => {
  const surface = (): HTMLElement =>
    document.querySelector<HTMLElement>('[aria-label="会话关系图谱"]') as HTMLElement
  const readout = (): HTMLElement => screen.getByRole('button', { name: '缩放至 100%' })
  // Four Branch children spread the content 1080px wide: the fit scale lands
  // below 100%, so the fit key is distinguishable from the zoom-step keys.
  const WIDE: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    c1: session('c1', { parentId: id('root'), updatedAt: 400 }),
    c2: session('c2', { parentId: id('root'), updatedAt: 300 }),
    c3: session('c3', { parentId: id('root'), updatedAt: 200 }),
    c4: session('c4', { parentId: id('root'), updatedAt: 100 }),
  }

  it('zooms with + and -, returns to 100% with 0, and fits with 1', async () => {
    const b = await bench(WIDE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.keyDown(surface(), { key: '0' })
    expect(readout().textContent).toBe('100%')
    fireEvent.keyDown(surface(), { key: '+' })
    expect(readout().textContent).toBe('120%')
    fireEvent.keyDown(surface(), { key: '-' })
    expect(readout().textContent).toBe('100%')
    fireEvent.keyDown(surface(), { key: '1' })
    expect(readout().textContent).toBe('81%')
    fireEvent.keyDown(surface(), { key: '=' })
    expect(readout().textContent).toBe('98%')
    fireEvent.keyDown(surface(), { key: '0' })
    expect(readout().textContent).toBe('100%')
  })

  it('focuses the canvas on background pointer down so keys work without a node focused', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    fireEvent.pointerDown(surface(), { pointerId: 11, clientX: 50, clientY: 50 })
    fireEvent.pointerUp(surface(), { pointerId: 11 })
    expect(document.activeElement).toBe(surface())
    fireEvent.keyDown(surface(), { key: '0' })
    expect(readout().textContent).toBe('100%')
  })

  it('ignores shortcut keys coming from the filter input', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const before = readout().textContent
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })
    input.focus()
    fireEvent.keyDown(input, { key: '1' })
    fireEvent.keyDown(input, { key: '0' })
    fireEvent.keyDown(input, { key: '+' })
    expect(readout().textContent).toBe(before)
  })
})

describe('Branch Lineage highlight', () => {
  const RELATED: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
    branchChild2: session('branchChild2', { parentId: id('root'), updatedAt: 350 }),
    lone: session('lone', { updatedAt: 200 }),
  }

  it('hovering a node dims everyone outside its branch lineage and clears on leave', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    fireEvent.mouseEnter(nodeButton('branchChild'))
    expect(nodeButton('lone').className).toContain('dim')
    expect(nodeButton('branchChild2').className).toContain('dim')
    expect(nodeButton('branchChild').className).not.toContain('dim')
    expect(nodeButton('root').className).not.toContain('dim')
    // The sibling edge dims while the lineage edge stays bright.
    expect(document.querySelectorAll('svg g[class*="dim"]')).toHaveLength(1)
    fireEvent.mouseLeave(nodeButton('branchChild'))
    expect(nodeButton('lone').className).not.toContain('dim')
  })

  it('keeps the Selected Session Branch Lineage emphasized after the pointer leaves', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    fireEvent.click(nodeButton('branchChild'))

    expect(nodeButton('branchChild').className).not.toContain('dim')
    expect(nodeButton('root').className).not.toContain('dim')
    expect(nodeButton('branchChild2').className).toContain('dim')
    expect(nodeButton('lone').className).toContain('dim')
  })

  it('distinguishes contextual emphasis from Title Filter suppression', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')

    fireEvent.mouseEnter(nodeButton('branchChild'))
    expect(nodeButton('lone').className).toContain('dimContext')
    expect(document.querySelector('[data-port-id="lone:input"]')?.className).toContain('dimContext')

    fireEvent.mouseLeave(nodeButton('branchChild'))
    fireEvent.change(screen.getByRole('textbox', { name: '过滤会话标题' }), {
      target: { value: 'branchChild' },
    })
    expect(nodeButton('root').className).toContain('dimFilter')
    expect(nodeButton('root').className).not.toContain('dimContext')
  })

  it('hovering an edge dims everything except its endpoints', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const hit = document.querySelector('[data-edge-id="branch:root->branchChild"]')
    expect(hit).not.toBeNull()
    fireEvent.mouseEnter(hit!)
    expect(nodeButton('lone').className).toContain('dim')
    expect(nodeButton('branchChild2').className).toContain('dim')
    expect(nodeButton('root').className).not.toContain('dim')
    expect(nodeButton('branchChild').className).not.toContain('dim')
    fireEvent.mouseLeave(hit!)
    expect(nodeButton('lone').className).not.toContain('dim')
  })

  it('dims a cluster frame when none of its members are emphasized', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const frame = document.querySelector('[data-cluster-id="root"]')
    expect(frame?.className).not.toContain('dim')
    fireEvent.mouseEnter(nodeButton('lone'))
    expect(document.querySelector('[data-cluster-id="root"]')?.className).toContain('dim')
    fireEvent.mouseLeave(nodeButton('lone'))
    expect(document.querySelector('[data-cluster-id="root"]')?.className).not.toContain('dim')
  })
})

describe('title filter', () => {
  const RELATED: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
    branchChild2: session('branchChild2', { parentId: id('root'), updatedAt: 350 }),
    lone: session('lone', { updatedAt: 200 }),
  }

  it('announces the match count and the no-match state', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })

    fireEvent.change(input, { target: { value: 'branchChild' } })
    expect(screen.getByRole('status').textContent).toBe('2 个匹配')
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByRole('status').textContent).toBe('无匹配会话')
    fireEvent.click(screen.getByRole('button', { name: '清除过滤' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('dims non-matching nodes as the query types and restores on clear', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })
    fireEvent.change(input, { target: { value: 'branchChild' } })
    expect(nodeButton('lone').className).toContain('dim')
    expect(nodeButton('branchChild').className).not.toContain('dim')
    expect(nodeButton('branchChild2').className).not.toContain('dim')
    expect(nodeButton('root').className).toContain('dim')
    // A query with no hits dims the whole canvas.
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(nodeButton('branchChild').className).toContain('dim')
    fireEvent.click(screen.getByRole('button', { name: '清除过滤' }))
    expect(nodeButton('lone').className).not.toContain('dim')
  })

  it('locates the first match on Enter, centered in the surface', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    stubSize(1000, 600)
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })
    fireEvent.change(input, { target: { value: 'lone' } })
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    fireEvent.keyDown(input, { key: 'Enter' })
    const transform = content().style.transform
    expect(transform).not.toBe(before)
    // Locate centers the actual node, independently of component packing.
    const centerX = Number.parseFloat(nodeButton('lone').style.left) + 120
    const centerY = Number.parseFloat(nodeButton('lone').style.top) + 28
    const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\) scale\((\d+(?:\.\d+)?)\)/)!
    const [, panX, panY, scale] = match.map(Number)
    expect(panX! + centerX * scale!).toBeCloseTo(500)
    expect(panY! + centerY * scale!).toBeCloseTo(300)
  })

  it('keeps typing focus in the input: arrow keys never leave for the canvas', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Research Graph')
    const input = screen.getByRole('textbox', { name: '过滤会话标题' }) as HTMLInputElement
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(input)
    // Escape clears the query and releases focus.
    fireEvent.change(input, { target: { value: 'lone' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(document.activeElement).not.toBe(input)
  })
})


describe('Working position live updates', () => {
  it.each(['empty on entry', 'last card detached'])('clears a stale card selection when a topic is %s and preserves its viewport', async state => {
    const b = await bench({ viewed: session('viewed') })
    const topic = { topicId: 'topic-empty', title: '空主题恢复', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
    const card: KnowledgeCard = { cardId: 'removed-card', topicIds: [topic.topicId], revisions: [{
      revisionId: 'revision-one', requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
      content: { title: '临时卡片', question: '', conclusion: '保留成果', rationale: '', openQuestions: '', kind: 'method', status: 'draft' }, sources: [],
    }] }
    b.listTopics.mockResolvedValue({ ok: true, value: [topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: { topic, sources: [] } })
    b.searchKnowledge.mockResolvedValue({ ok: true, value: state === 'empty on entry' ? [] : [card] })
    const scopeKey = JSON.stringify(['test-host', '/w', null])
    const topicKey = JSON.stringify(['test-host', scopeKey, topic.topicId])
    const storageKey = 'dsh.session-graph.position.' + topicKey
    const viewport = { scale: 1.3, panX: 10, panY: 20 }
    localStorage.setItem('dsh.session-graph.position.' + scopeKey, JSON.stringify({ v: 1, topicId: topic.topicId }))
    localStorage.setItem(storageKey, JSON.stringify({ v: 1, selected: 'card:removed-card', viewport }))
    mount(b.slots, b.sessionsStore, 'viewed')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    if (state === 'last card detached') {
      await screen.findByRole('button', { name: zh['knowledge.edit'] })
      b.searchKnowledge.mockResolvedValue({ ok: true, value: [] })
      chooseCanvasAction(zh['topic.refresh'])
    }
    await screen.findByText(zh['topic.noReferences'])
    await waitFor(() => { expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({ selected: null, viewport }) })
    const notice = screen.getByText(zh['position.unavailable'])
    fireEvent.click(within(notice).getByRole('button', { name: zh['panel.close'] }))
    expect(screen.queryByText(zh['position.unavailable'])).toBeNull()
    b.searchKnowledge.mockResolvedValue({ ok: true, value: [card] })
    chooseCanvasAction(zh['topic.refresh'])
    await waitFor(() => { expect(document.querySelector('[data-node-id="card:removed-card"]')).not.toBeNull() })
    expect(screen.queryByRole('button', { name: zh['knowledge.edit'] })).toBeNull()
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({ selected: null, viewport })
  })

  it('restores the separate topic arrangement after a live Workspace identity change', async () => {
    const fixture = researchTopicFixture()
    const tiny = { ...fixture.a, sources: fixture.a.sources.slice(0, 2), topic: { ...fixture.a.topic, references: fixture.a.topic.references.slice(0, 2) } }
    const b = await bench({ ...fixture.rows, viewed: session('viewed') })
    b.listTopics.mockResolvedValue({ ok: true, value: [tiny.topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: tiny })
    const workspaceStore = createSnapshotStore(workspacesState([workspace('first', '/w', ['viewed'])]))
    const secondKey = JSON.stringify(['test-host', JSON.stringify(['test-host', 'workspace:second', null]), tiny.topic.topicId])
    localStorage.setItem('dsh.session-graph.layout.' + secondKey, JSON.stringify({ v: 1, positions: { 'source-0001': { x: 900, y: 700 } }, collapsed: [], offsets: {} }))
    mount(b.slots, b.sessionsStore, 'viewed', workspaceStore)
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(document.querySelector('[data-node-id="source-0001"]')).not.toBeNull() })
    const node = nodeButton('source-0001')
    fireEvent.pointerDown(node, { pointerId: 7, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 7, clientX: 320, clientY: 280 })
    fireEvent.pointerUp(node, { pointerId: 7 })
    const oldLeft = nodeButton('source-0001').style.left
    await act(async () => { workspaceStore.set(workspacesState([workspace('second', '/w', ['viewed'])])) })
    await waitFor(() => { expect(nodeButton('source-0001').style.left).toBe('900px') })
    expect(nodeButton('source-0001').style.left).not.toBe(oldLeft)
  })
  it('clears a restored topic source when its saved Original boundary is unavailable', async () => {
    const fixture = researchTopicFixture()
    const tiny = { ...fixture.a, sources: fixture.a.sources.slice(0, 2), topic: { ...fixture.a.topic, references: fixture.a.topic.references.slice(0, 2) } }
    const b = await bench({ ...fixture.rows, viewed: session('viewed') })
    b.listTopics.mockResolvedValue({ ok: true, value: [tiny.topic] })
    b.readTopic.mockResolvedValue({ ok: true, value: tiny })
    b.readHistory.mockResolvedValue({ ok: true, value: { kind: 'unavailable', sessionId: 'source-0001', turns: [], hasEarlier: false, hasLater: false } })
    const scopeKey = JSON.stringify(['test-host', '/w', null])
    const topicKey = JSON.stringify(['test-host', scopeKey, tiny.topic.topicId])
    localStorage.setItem('dsh.session-graph.position.' + scopeKey, JSON.stringify({ v: 1, topicId: tiny.topic.topicId }))
    localStorage.setItem('dsh.session-graph.position.' + topicKey, JSON.stringify({ v: 1, selected: 'source-0001', tab: 'history', history: { 'source-0001': 80 } }))
    mount(b.slots, b.sessionsStore, 'viewed')
    switchTab('Research Graph')
    fireEvent.change(screen.getByRole('combobox', { name: '研究范围' }), { target: { value: 'topics' } })
    await waitFor(() => { expect(b.readHistory).toHaveBeenCalled() })
    await waitFor(() => { expect(screen.queryByTestId('topic-source-panel')).toBeNull() })
    expect(screen.getByText(zh['position.unavailable'])).toBeTruthy()
  })
})
