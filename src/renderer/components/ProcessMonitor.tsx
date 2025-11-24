import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, X, Activity } from 'lucide-react';
import type { Session, Group, Theme } from '../types';

interface ProcessMonitorProps {
  theme: Theme;
  sessions: Session[];
  groups: Group[];
  onClose: () => void;
}

interface ProcessNode {
  id: string;
  type: 'group' | 'session' | 'process';
  label: string;
  emoji?: string;
  sessionId?: string;
  pid?: number;
  processType?: 'ai' | 'terminal';
  isAlive?: boolean;
  expanded?: boolean;
  children?: ProcessNode[];
}

export function ProcessMonitor(props: ProcessMonitorProps) {
  const { theme, sessions, groups, onClose } = props;
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Build the process tree
  const buildProcessTree = (): ProcessNode[] => {
    const tree: ProcessNode[] = [];

    // Group sessions by group
    const sessionsByGroup = new Map<string, Session[]>();
    const ungroupedSessions: Session[] = [];

    sessions.forEach(session => {
      if (session.groupId) {
        const existing = sessionsByGroup.get(session.groupId) || [];
        sessionsByGroup.set(session.groupId, [...existing, session]);
      } else {
        ungroupedSessions.push(session);
      }
    });

    // Add grouped sessions
    groups.forEach(group => {
      const groupSessions = sessionsByGroup.get(group.id) || [];
      const groupNode: ProcessNode = {
        id: `group-${group.id}`,
        type: 'group',
        label: group.name,
        emoji: group.emoji,
        expanded: expandedNodes.has(`group-${group.id}`),
        children: groupSessions.map(session => buildSessionNode(session))
      };
      tree.push(groupNode);
    });

    // Add ungrouped sessions (root level)
    if (ungroupedSessions.length > 0) {
      const rootNode: ProcessNode = {
        id: 'group-root',
        type: 'group',
        label: 'No Group',
        emoji: '📁',
        expanded: expandedNodes.has('group-root'),
        children: ungroupedSessions.map(session => buildSessionNode(session))
      };
      tree.push(rootNode);
    }

    return tree;
  };

  const buildSessionNode = (session: Session): ProcessNode => {
    const sessionNode: ProcessNode = {
      id: `session-${session.id}`,
      type: 'session',
      label: session.name,
      sessionId: session.id,
      expanded: expandedNodes.has(`session-${session.id}`),
      children: []
    };

    // Add AI process
    if (session.aiPid) {
      sessionNode.children!.push({
        id: `process-${session.id}-ai`,
        type: 'process',
        label: `AI Agent (${session.toolType})`,
        pid: session.aiPid,
        processType: 'ai',
        sessionId: session.id,
        isAlive: session.state !== 'idle' || session.inputMode === 'ai'
      });
    }

    // Add Terminal process
    if (session.terminalPid) {
      sessionNode.children!.push({
        id: `process-${session.id}-terminal`,
        type: 'process',
        label: 'Terminal Shell',
        pid: session.terminalPid,
        processType: 'terminal',
        sessionId: session.id,
        isAlive: session.state !== 'idle' || session.inputMode === 'terminal'
      });
    }

    return sessionNode;
  };

  const renderNode = (node: ProcessNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = depth * 20 + 16; // 20px per depth level + 16px base

    if (node.type === 'group') {
      return (
        <div key={node.id}>
          <button
            onClick={() => toggleNode(node.id)}
            className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-opacity-5"
            style={{
              paddingLeft: `${paddingLeft}px`,
              backgroundColor: 'transparent',
              color: theme.colors.textMain
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.accent}15`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {hasChildren && (
              isExpanded ?
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} /> :
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} />
            )}
            {!hasChildren && <div className="w-4 h-4 flex-shrink-0" />}
            <span className="mr-2">{node.emoji}</span>
            <span className="font-medium">{node.label}</span>
            {hasChildren && (
              <span className="text-xs ml-auto" style={{ color: theme.colors.textDim }}>
                {node.children!.length} {node.children!.length === 1 ? 'session' : 'sessions'}
              </span>
            )}
          </button>
          {isExpanded && hasChildren && (
            <div>
              {node.children!.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (node.type === 'session') {
      return (
        <div key={node.id}>
          <button
            onClick={() => toggleNode(node.id)}
            className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-opacity-5"
            style={{
              paddingLeft: `${paddingLeft}px`,
              backgroundColor: 'transparent',
              color: theme.colors.textMain
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.accent}15`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {hasChildren && (
              isExpanded ?
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} /> :
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} />
            )}
            {!hasChildren && <div className="w-4 h-4 flex-shrink-0" />}
            <Activity className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.accent }} />
            <span>{node.label}</span>
            <span className="text-xs ml-auto" style={{ color: theme.colors.textDim }}>
              Session: {node.sessionId?.substring(0, 8)}...
            </span>
          </button>
          {isExpanded && hasChildren && (
            <div>
              {node.children!.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (node.type === 'process') {
      const statusColor = node.isAlive ? theme.colors.success : theme.colors.textDim;
      const statusText = node.isAlive ? 'Running' : 'Idle';

      return (
        <div
          key={node.id}
          className="px-4 py-2 flex items-center gap-2"
          style={{
            paddingLeft: `${paddingLeft}px`,
            color: theme.colors.textMain
          }}
        >
          <div className="w-4 h-4 flex-shrink-0" />
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-sm">{node.label}</span>
          <span className="text-xs ml-auto font-mono" style={{ color: theme.colors.textDim }}>
            PID: {node.pid}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: node.isAlive ? `${theme.colors.success}20` : `${theme.colors.textDim}20`,
              color: statusColor
            }}
          >
            {statusText}
          </span>
        </div>
      );
    }

    return null;
  };

  const processTree = buildProcessTree();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-[700px] max-h-[80vh] rounded-xl shadow-2xl border overflow-hidden flex flex-col outline-none"
        style={{ backgroundColor: theme.colors.bgActivity, borderColor: theme.colors.border }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: theme.colors.border }}
        >
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h2 className="text-lg font-semibold" style={{ color: theme.colors.textMain }}>
              System Processes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-opacity-10"
            style={{ color: theme.colors.textDim }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.accent}20`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Process tree */}
        <div className="overflow-y-auto flex-1">
          {processTree.length === 0 ? (
            <div
              className="px-6 py-8 text-center"
              style={{ color: theme.colors.textDim }}
            >
              No active sessions
            </div>
          ) : (
            <div className="py-2">
              {processTree.map(node => renderNode(node, 0))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between text-xs"
          style={{
            borderColor: theme.colors.border,
            color: theme.colors.textDim
          }}
        >
          <div>
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} • {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.success }} />
            <span>Running</span>
            <div className="w-2 h-2 rounded-full ml-3" style={{ backgroundColor: theme.colors.textDim }} />
            <span>Idle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
