# DSH Research Graph · 研图

Research Graph is a visual research space for turning human–AI discussions into knowledge that people can revisit, reuse, and connect to develop further ideas. Research Topics organize discussions and Knowledge Cards; the Session Graph remains a derived projection of DeepSeek Harness, which is authoritative for Sessions, Workspaces, Session Lineage, and activity.

Research Topics are separate Host-owned collections of references. The plugin owns their names, membership, and arrangements; it does not take ownership of the Sessions those references address.

Knowledge Cards are Host-owned, editable research results with immutable revisions and retained discussion sources. They participate in Topic Graphs without becoming Sessions or creating Session Lineage.

## Language

### Scope

**Viewed Session**:
The session whose conversation hosts the Graph view. It anchors the graph's scope and is the session treated as current by the view.
_Avoid_: Current session, active session

**Selected Session**:
A Canvas Session chosen inside the graph for inspection or an explicit action. Selecting it does not change the Viewed Session.
_Avoid_: Current session, opened session

**Workspace**:
A named Harness grouping with a canonical working directory and an accounted set of sessions.
_Avoid_: Project, directory, Workspace Scope

**Workspace Scope**:
The named graph scope resolved for the Viewed Session, preferring formal Workspace membership over a matching working directory. It contains non-archived sessions accounted to that Workspace or sharing its working directory.
_Avoid_: Project scope, current directory

**Directory Scope**:
The unnamed fallback scope containing non-archived sessions that share the Viewed Session's working directory when no Workspace matches.
_Avoid_: Untitled Workspace, loose Workspace

**Unscoped Session**:
A Viewed Session for which neither a Workspace nor a working directory can be resolved, so no Session Graph can be formed.
_Avoid_: Outside-Workspace Session

### Sessions and relationships

**Session Graph**:
The scope-bound projection of Canvas Sessions, Branches, Session Clusters, and Subagent Summaries. It is not a separately owned source of session data.
_Avoid_: Stored graph, global graph, message graph

**Canvas Session**:
A non-subagent session eligible to appear individually in the Session Graph. Archived sessions and blank sessions other than the Viewed Session are not Canvas Sessions in that graph.
_Avoid_: Ordinary session, normal session, row

**Blank Session**:
A session whose conversation has no established content. It is included only when it is also the Viewed Session.
_Avoid_: Empty node, placeholder

**Display Status**:
The single activity label presented for a Canvas Session. When activity facts overlap, Running takes precedence over Waiting for Input, which takes precedence over Completed.
_Avoid_: Session lifecycle state, combined status

**Session Lineage**:
Parent-child ancestry among sessions, encompassing both Branches and Subagent Derivations.
_Avoid_: Branch tree, derivation tree

**Branch**:
A directed lineage relation from one Canvas Session to a child Canvas Session. Creating a Branch produces a distinct session without changing the source session.
_Avoid_: Fork, Subagent Derivation

**Historical Branch**:
A Branch created from the completed history through an explicitly selected Discussion Turn. Its preview records the actual inherited range and reserves one child identity for recovery. Continuing the child starts with a new question rather than pending work inherited from the source; the source history remains intact.
_Avoid_: Reuse Relation, copied Knowledge Card

**Merge Session**:
An independent Canvas Session with no parent Session, initialized from an explicit instruction and immutable snapshots of two or three source sessions. At capture time it is either blank or already bound to the exact same ordered Merge Sources by its first Merge marker, which makes retry idempotent. It is not a Branch, and its creation does not change its sources.
_Avoid_: Aggregated session, merged branch, combined thread

**Merge Source**:
A non-blank, non-archived Canvas Session on the connected Host selected to contribute an immutable snapshot to a Merge Session. Merge Sources can belong to different Workspaces; the Merge Session has one explicitly chosen destination Workspace, whose files and execution environment remain separate from the source discussions.
_Avoid_: Parent session, input branch

**Session Snapshot**:
An immutable view of one Merge Source through a recorded event boundary. Later source activity does not alter the snapshot already used by a Merge Session.
_Avoid_: Live reference, copied session

**Merge Relation**:
A directed many-to-one relationship from each Merge Source to its Merge Session. It records provenance without creating Session Lineage or changing Session Cluster membership.
_Avoid_: Branch, parent relation, Subagent Derivation

**Subagent Derivation**:
A directed lineage relation whose child is a Subagent Session. It is summarized under a Canvas Session rather than represented as a Branch.
_Avoid_: Branch, fork

**Subagent Session**:
A session created with subagent origin to perform delegated work. It does not appear individually in the Session Graph.
_Avoid_: Agent node, hidden Branch

**Subagent Summary**:
The total number of Subagent Sessions, including the running subset, reachable from one Canvas Session through an uninterrupted chain of Subagent Derivations. A Branch boundary starts a separate summary for the branch session.
_Avoid_: Subagent node, branch count

**Root Session**:
A Canvas Session with no Canvas Session parent in the current graph. Root status is scope-relative, so a session whose parent is a Subagent Session or is absent from the graph is also a Root Session.
_Avoid_: Original session, first session

**Session Cluster**:
A Root Session together with every Canvas Session reachable from it through Branches. Every Canvas Session belongs to exactly one Session Cluster, including a Root Session with no branches.
_Avoid_: Workspace, derivation tree, group

**Branch Lineage**:
A Canvas Session together with its Branch ancestors and Branch descendants. Sibling branches are outside one another's Branch Lineage.
_Avoid_: Session Cluster, neighborhood

### Arrangement and discovery

**Knowledge Card**:
A conclusion, method, hypothesis, or question that a person chooses to retain and reuse, with a durable identity, editable content, and discussion sources when supplied. Its Research Topic membership is explicit and independent of source location; retaining a card does not establish the correctness of its claims.
Its latest revision is searchable by title and body. Removing topic membership, Reset, or layout cleanup does not delete the card.
_Avoid_: Session Digest, Canvas Session, copied session

**Card Revision**:
One immutable saved version of a Knowledge Card's text, type, draft/confirmed status, and sources. Editing appends a revision; retrying the identical save identity is idempotent. Historical references retain the addressed revision even after later edits.
_Avoid_: Mutable draft, Session Snapshot, latest content

**Knowledge Source**:
A Discussion Source captured by the Host at exact completed turn boundaries when a Card Revision is saved. It retains Session identity, display labels, event boundaries, dates, and readable user/assistant excerpts. Original reading prefers those exact boundaries and clearly distinguishes retained excerpts when the original is unavailable.
_Avoid_: Verified conclusion, tool evidence, similar text

**Source Relation**:
A directed provenance link from an addressed Session to a Knowledge Card. Its saved revision records the precise Knowledge Sources. It does not create a Branch or Merge Relation, add model context, or imply that the source is a member of the Research Topic.
_Avoid_: Branch, Merge Relation, Topic Reference

**Extraction Snapshot**:
The Host-retained selection and exact included direct discussion text shown before an explicit AI extraction. A character budget admits only whole completed turns and lists omitted ranges. Generated drafts and corrected citations can address this frozen material across Host restart; the snapshot does not itself create a Knowledge Card or claim that its statements are true.
_Avoid_: Full-session summary, verified tool evidence, saved card

**Research Material**:
An explicitly selected saved Card Revision or a continuous range of completed Discussion Turns, frozen for further research. A card contributes its own content and source labels; original discussion must be selected separately. One new discussion uses one to three ordered materials; a Synthesis uses two or three within the visible message budget.
_Avoid_: Whole Research Topic, inherited context, Session Snapshot

**Synthesis**:
A reviewed comparison of two or three frozen Research Materials, retained as an independent Knowledge Card. Its editable claims distinguish agreements, disagreements, conditions/evidence and open questions. A claim can remain unsupported and marked for verification. Later changes to sources do not alter the frozen material in a saved Card Revision.
_Avoid_: Merge Session, automatic summary, verified conclusion

**Synthesis Citation**:
An exact quotation from one frozen Research Material supporting an addressed claim. Card citations address a specific Card Revision; discussion citations address the selected original turn range. A source label alone cannot establish a quotation of original text. Validity establishes traceable provenance, not factual or logical correctness.
_Avoid_: Source label, model confidence, truth guarantee

**Synthesis Relation**:
A directed provenance link from a cited source Knowledge Card to an independent Synthesis card, labeled with the cited source revision. Selected but uncited inputs do not establish the relation. Cited discussion ranges retain their Source Relations; neither relation creates Session Lineage.
_Avoid_: Branch, Merge Relation, similarity edge

**Reuse Relation**:
A durable provenance record from selected Research Materials to an independent target Session, created only after Harness acknowledges native prompt admission. It retains the exact material, versions, boundaries and message shown in preview. Prepared and created attempts recover uncertain submissions without claiming usage. Admission does not mean the model has answered.
_Avoid_: Branch, Merge Relation, generated answer, preview

**Research Topic**:
A named collection with a stable identity on one Host, containing references to Sessions across Workspaces. One Session can belong to several topics. Topic membership and arrangement survive Host restart without changing Session ownership, archive state, lineage, or model context.
_Avoid_: Workspace, Session Cluster, merged context

**Topic Reference**:
A durable Session identity within a Research Topic, with display labels retained for unavailable sources. Archiving or losing access to the source does not remove this reference. Original discussion remains in Harness and is read on demand.
_Avoid_: Session Snapshot, copied discussion, knowledge card

**Topic Graph**:
The projection of a Research Topic's references, including archived and unavailable sources. It shows only Branch and Merge relations supported by Harness facts. Being visible here does not make a source a Canvas Session in a Workspace Scope.
_Avoid_: Global graph, Workspace Scope, Session Cluster

**Research Export**:
A standalone Markdown artifact from an explicit set of saved Knowledge Card revisions. Preview freezes the latest selected revisions and their retained source ranges; download uses exactly those bytes. Original availability is checked and annotated without replacing saved excerpts. An export never creates knowledge, sends model context, or changes Session history.

**Working Position**:
Browser-local presentation for a persistent Host and explicit graph scope: viewport, selected identity, valid Original cursor/scroll, search conditions, and unsaved topic arrangement. It contains no source excerpts or authoritative knowledge. Restored search conditions trigger fresh reads. Opening a different Viewed Session never implicitly selects an old Research Topic.

**Session Arrangement**:
The placement and collapse choices a person applies to one graph scope; they change presentation only, never Session Lineage or activity. Each Workspace Scope owns a separate Session Arrangement even when Workspaces share a directory, while a Directory Scope owns the arrangement for its directory. Each Research Topic owns a separately saved arrangement in Host storage; Reset and Relayout affect presentation, not its Topic References.
_Avoid_: Session state, graph data

**Collapsed Cluster**:
A Session Cluster shown in compact form while retaining all of its Canvas Sessions. Collapse is not filtering, hiding, or archiving.
_Avoid_: Hidden cluster, archived cluster

**Relayout**:
The action that restores automatic positions while preserving which Session Clusters are collapsed. Its most recent placement change can be undone until another arrangement action or scope change supersedes it.
_Avoid_: Reset

**Reset**:
The action that discards the complete Session Arrangement, expands every Session Cluster, and fits the resulting graph into view.
_Avoid_: Relayout

**Title Filter**:
A case-insensitive title match that emphasizes matching Canvas Sessions without changing scope or graph membership.
_Avoid_: Search, session filter

**Session Inspector**:
The persistent detail panel for the Selected Session, or the addressed source while Discussion Search or a Research Topic is open. Selection and reading remain local to their view. A Topic's source inspector exposes original reading, explicit navigation, and reference removal. It remains authoritative while another Session is only being previewed.
_Avoid_: Hover card, current-session panel

**Session Title Suggestion**:
An explicitly requested, temporary title derived from the Selected Session's bounded discussion material. The user may edit or discard it; only Apply invokes the native Session rename and saves a user-title event. Suggesting never writes discussion text, opens an Agent, or changes the Viewed Session. A suggestion is not a Knowledge Card or a saved Session Digest.
_Avoid_: automatic rename, graph-only title

**Session Digest**:
An explicitly requested, model-generated, read-only digest of one Canvas Session at one source revision. It presents one short overview sentence, bounded unordered key outcomes and open items, with Markdown emphasis on key facts inside the Session Inspector. Complete overlong model output receives at most one compression attempt; reasoning-token capacity is independent of visible length. A newer source revision makes an existing digest stale without hiding it. Session Digests never enter the Session log or change Session Lineage.
_Avoid_: Session Summary, Subagent Summary, compaction summary, generated message

**Session Preview**:
A transient, delayed summary shown while dwelling on a Canvas Session other than the Selected Session. It never changes selection.
_Avoid_: Inspector, tooltip

**Session History**:
The read-only user/assistant discussion text of one Selected Session or addressed search result, inspected on demand through Harness and presented in the Inspector. It is neither generated nor persisted by the plugin. Its source state distinguishes available original text, a retained excerpt, and an unavailable source.
_Avoid_: Session Digest, chat replica, stored graph

**Discussion Turn**:
A discussion unit identified by its Session and `turn/start` event sequence, with a fixed `turn/end` boundary when completed. Only completed turns expose text as selectable source material; an unfinished turn exposes status until refreshed after completion. Titles and matching text are not identities.
_Avoid_: Message, model step, text match

**Discussion Search**:
An explicit, read-only keyword search over completed direct user/assistant discussion on the connected Host. Workspace or directory scope and archive inclusion constrain candidates before ranking and pagination. A result addresses its Session, matching message event, and Discussion Turn start; inspecting it does not select a Canvas Session or change the Viewed Session. Archived and cross-workspace results can be read without becoming eligible for the current graph.
_Avoid_: Title Filter, semantic search, global graph

**Discussion Source**:
A continuous selection of completed Discussion Turns from one Session, addressed by exact start/end event sequences and accompanied by a fallback excerpt. The Original reader retains it only in memory while open. Rechecking prefers the original; an unavailable original never turns the excerpt into verified source text.
_Avoid_: Session Snapshot, saved knowledge card, live reference

**Session Terminal**:
A visual connection seat on a Canvas Session card: Input Terminals receive relations and Output Terminals originate them. Relations have distinct seats along the card edge; terminals are non-interactive and do not themselves create or change Session Lineage.
_Avoid_: Branch, Subagent Derivation, connector node
