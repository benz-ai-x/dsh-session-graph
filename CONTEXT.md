# Session Graph

Session Graph helps a person understand, navigate, arrange, and branch the lineage of DeepSeek Harness sessions related to the session they are viewing. It is a derived projection; DeepSeek Harness remains authoritative for sessions, workspaces, lineage, and activity.

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

### Sessions and lineage

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

**Session Arrangement**:
The placement and collapse choices a person applies to one graph scope; they change presentation only, never Session Lineage or activity. Each Workspace Scope owns a separate Session Arrangement even when Workspaces share a directory, while a Directory Scope owns the arrangement for its directory.
_Avoid_: Session state, graph data

**Collapsed Cluster**:
A Session Cluster shown in compact form while retaining all of its Canvas Sessions. Collapse is not filtering, hiding, or archiving.
_Avoid_: Hidden cluster, archived cluster

**Relayout**:
The action that restores automatic positions while preserving which Session Clusters are collapsed.
_Avoid_: Reset

**Reset**:
The action that discards the complete Session Arrangement, expands every Session Cluster, and fits the resulting graph into view.
_Avoid_: Relayout

**Title Filter**:
A case-insensitive title match that emphasizes matching Canvas Sessions without changing scope or graph membership.
_Avoid_: Search, session filter

**Session Inspector**:
The persistent detail panel for the Selected Session. It remains authoritative while another Canvas Session is only being previewed.
_Avoid_: Hover card, current-session panel

**Session Preview**:
A transient, delayed summary shown while dwelling on a Canvas Session other than the Selected Session. It never changes selection.
_Avoid_: Inspector, tooltip

**Session Terminal**:
A stable visual connection seat exposed above and below every Canvas Session card. The top seat is the Input Terminal and the bottom seat is the Output Terminal. Terminals are currently non-interactive and do not themselves create or change Session Lineage.
_Avoid_: Branch, Subagent Derivation, connector node
