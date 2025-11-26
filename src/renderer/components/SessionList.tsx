import React, { useState, useEffect } from 'react';
import {
  Wand2, Plus, Settings, ChevronRight, ChevronDown, Activity, X, Keyboard,
  Globe, Network, PanelLeftClose, PanelLeftOpen, Folder, Info, FileText, GitBranch, Bot, Clock,
  ScrollText, Cpu
} from 'lucide-react';
import type { Session, Group, Theme, Shortcut } from '../types';
import { getStatusColor, getContextColor, formatActiveTime } from '../utils/theme';
import { gitService } from '../services/git';

interface SessionListProps {
  // State
  theme: Theme;
  sessions: Session[];
  groups: Group[];
  sortedSessions: Session[];
  activeSessionId: string;
  leftSidebarOpen: boolean;
  leftSidebarWidthState: number;
  activeFocus: string;
  selectedSidebarIndex: number;
  editingGroupId: string | null;
  editingSessionId: string | null;
  draggingSessionId: string | null;
  anyTunnelActive: boolean;
  shortcuts: Record<string, Shortcut>;

  // Handlers
  setActiveFocus: (focus: string) => void;
  setActiveSessionId: (id: string) => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setLeftSidebarWidthState: (width: number) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setSettingsTab: (tab: string) => void;
  setAboutModalOpen: (open: boolean) => void;
  setLogViewerOpen: (open: boolean) => void;
  setProcessMonitorOpen: (open: boolean) => void;
  toggleGroup: (groupId: string) => void;
  handleDragStart: (sessionId: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDropOnGroup: (groupId: string) => void;
  handleDropOnUngrouped: () => void;
  finishRenamingGroup: (groupId: string, newName: string) => void;
  finishRenamingSession: (sessId: string, newName: string) => void;
  startRenamingGroup: (groupId: string) => void;
  startRenamingSession: (sessId: string) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  createNewGroup: () => void;
  addNewSession: () => void;

  // Auto mode props
  activeBatchSessionIds?: string[]; // Session IDs that are running in auto mode
}

export function SessionList(props: SessionListProps) {
  const {
    theme, sessions, groups, sortedSessions, activeSessionId, leftSidebarOpen,
    leftSidebarWidthState, activeFocus, selectedSidebarIndex, editingGroupId,
    editingSessionId, draggingSessionId, anyTunnelActive, shortcuts,
    setActiveFocus, setActiveSessionId, setLeftSidebarOpen, setLeftSidebarWidthState,
    setShortcutsHelpOpen, setSettingsModalOpen, setSettingsTab, setAboutModalOpen, setLogViewerOpen, setProcessMonitorOpen, toggleGroup,
    handleDragStart, handleDragOver, handleDropOnGroup, handleDropOnUngrouped,
    finishRenamingGroup, finishRenamingSession, startRenamingGroup,
    startRenamingSession, showConfirmation, setGroups, createNewGroup, addNewSession,
    activeBatchSessionIds = []
  } = props;

  const [sessionFilter, setSessionFilter] = useState('');
  const [sessionFilterOpen, setSessionFilterOpen] = useState(false);
  const [ungroupedCollapsed, setUngroupedCollapsed] = useState(false);
  const [preFilterGroupStates, setPreFilterGroupStates] = useState<Map<string, boolean>>(new Map());

  // Track git file change counts per session
  const [gitFileCounts, setGitFileCounts] = useState<Map<string, number>>(new Map());

  // Poll git status for all Git sessions
  useEffect(() => {
    const pollGitStatus = async () => {
      const newCounts = new Map<string, number>();

      for (const session of sessions.filter(s => s.isGitRepo)) {
        try {
          const cwd = session.inputMode === 'terminal' ? (session.shellCwd || session.cwd) : session.cwd;
          const status = await gitService.getStatus(cwd);
          newCounts.set(session.id, status.files.length);
        } catch (error) {
          // Ignore errors, don't show indicator if we can't get status
        }
      }

      setGitFileCounts(newCounts);
    };

    pollGitStatus();
    const interval = setInterval(pollGitStatus, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [sessions]);

  // Filter sessions based on search query
  const filteredSessions = sessionFilter
    ? sessions.filter(s => s.name.toLowerCase().includes(sessionFilter.toLowerCase()))
    : sessions;

  // Temporarily expand groups when filtering to show matching sessions
  useEffect(() => {
    if (sessionFilter) {
      // Save current group states before filtering
      if (preFilterGroupStates.size === 0) {
        const currentStates = new Map<string, boolean>();
        groups.forEach(g => currentStates.set(g.id, g.collapsed));
        setPreFilterGroupStates(currentStates);
      }

      // Find groups that contain matching sessions
      const groupsWithMatches = new Set<string>();
      filteredSessions.forEach(session => {
        if (session.groupId) {
          groupsWithMatches.add(session.groupId);
        }
      });

      // Temporarily expand groups with matches
      setGroups(prev => prev.map(g => ({
        ...g,
        collapsed: groupsWithMatches.has(g.id) ? false : g.collapsed
      })));
    } else {
      // Restore original group states when filter is cleared
      if (preFilterGroupStates.size > 0) {
        setGroups(prev => prev.map(g => ({
          ...g,
          collapsed: preFilterGroupStates.get(g.id) ?? g.collapsed
        })));
        setPreFilterGroupStates(new Map());
      }
    }
  }, [sessionFilter, filteredSessions]);

  return (
    <div
      tabIndex={0}
      className={`border-r flex flex-col shrink-0 transition-all duration-300 outline-none relative ${activeFocus === 'sidebar' ? 'ring-1 ring-inset z-10' : ''}`}
      style={{
        width: leftSidebarOpen ? `${leftSidebarWidthState}px` : '64px',
        backgroundColor: theme.colors.bgSidebar,
        borderColor: theme.colors.border,
        ringColor: theme.colors.accent
      }}
      onClick={() => setActiveFocus('sidebar')}
      onFocus={() => setActiveFocus('sidebar')}
      onKeyDown={(e) => {
        // Open session filter with / key when sidebar has focus
        if (e.key === '/' && activeFocus === 'sidebar' && leftSidebarOpen && !sessionFilterOpen) {
          e.preventDefault();
          setSessionFilterOpen(true);
        }
      }}
    >
      {/* Resize Handle */}
      {leftSidebarOpen && (
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-20"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = leftSidebarWidthState;

            const handleMouseMove = (e: MouseEvent) => {
              const delta = e.clientX - startX;
              const newWidth = Math.max(256, Math.min(600, startWidth + delta));
              setLeftSidebarWidthState(newWidth);
            };

            const handleMouseUp = () => {
              window.maestro.settings.set('leftSidebarWidth', leftSidebarWidthState);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      )}

      {/* Branding Header */}
      <div className="p-4 border-b flex items-center justify-between h-16 shrink-0" style={{ borderColor: theme.colors.border }}>
        {leftSidebarOpen ? (
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h1 className="font-bold tracking-widest text-lg" style={{ color: theme.colors.textMain }}>MAESTRO</h1>
            <div className="ml-2 relative group cursor-help" title={anyTunnelActive ? "Index Active" : "No Public Tunnels"}>
              <Globe className={`w-3 h-3 ${anyTunnelActive ? 'text-green-500 animate-pulse' : 'opacity-30'}`} />
              {anyTunnelActive && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-black border border-gray-700 rounded p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">Maestro Index</div>
                  <div className="flex items-center gap-1 text-xs text-green-400 font-mono mb-1">
                    <Globe className="w-3 h-3" />
                    https://maestro-index.ngrok.io
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                    <Network className="w-3 h-3" />
                    http://192.168.1.42:8000
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-2">
            <Wand2 className="w-6 h-6" style={{ color: theme.colors.accent }} />
          </div>
        )}
      </div>

      {/* Command Panel - Quick Action Buttons */}
      {leftSidebarOpen && (
        <div className="px-3 py-2 border-b flex items-center justify-center gap-2" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={() => setShortcutsHelpOpen(true)}
            className="relative group p-2 rounded hover:bg-white/10 transition-colors"
            title={`Keyboard Shortcuts (${shortcuts.help.keys.join('+').replace('Meta', 'Cmd')})`}
            style={{ color: theme.colors.textDim }}
          >
            <Keyboard className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded" style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}>⌘?</span>
          </button>
          <button
            onClick={() => { setSettingsModalOpen(true); setSettingsTab('general'); }}
            className="relative group p-2 rounded hover:bg-white/10 transition-colors"
            title="Settings"
            style={{ color: theme.colors.textDim }}
          >
            <Settings className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded" style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}>⌘,</span>
          </button>
          <button
            onClick={() => setLogViewerOpen(true)}
            className="relative group p-2 rounded hover:bg-white/10 transition-colors"
            title="System Log Viewer"
            style={{ color: theme.colors.textDim }}
          >
            <ScrollText className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded" style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}>LOG</span>
          </button>
          <button
            onClick={() => setProcessMonitorOpen(true)}
            className="relative group p-2 rounded hover:bg-white/10 transition-colors"
            title="System Process Monitor"
            style={{ color: theme.colors.textDim }}
          >
            <Cpu className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded" style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}>CPU</span>
          </button>
        </div>
      )}

      {/* SIDEBAR CONTENT: EXPANDED */}
      {leftSidebarOpen ? (
        <div className="flex-1 overflow-y-auto py-2 select-none scrollbar-thin">
          {/* Session Filter */}
          {sessionFilterOpen && (
            <div className="mx-3 mb-3">
              <input
                autoFocus
                type="text"
                placeholder="Filter agents..."
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSessionFilterOpen(false);
                    setSessionFilter('');
                  }
                }}
                className="w-full px-3 py-2 rounded border bg-transparent outline-none text-sm"
                style={{ borderColor: theme.colors.accent, color: theme.colors.textMain }}
              />
            </div>
          )}

          {/* GROUPS */}
          {[...groups].sort((a, b) => a.name.localeCompare(b.name)).map(group => {
            const groupSessions = [...filteredSessions.filter(s => s.groupId === group.id)].sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div key={group.id} className="mb-1">
                <div
                  className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-opacity-50 group"
                  onClick={() => toggleGroup(group.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnGroup(group.id)}
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider flex-1" style={{ color: theme.colors.textDim }}>
                    {group.collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span className="text-sm">{group.emoji}</span>
                    {editingGroupId === group.id ? (
                      <input
                        autoFocus
                        className="bg-transparent outline-none w-full border-b border-indigo-500"
                        defaultValue={group.name}
                        onClick={e => e.stopPropagation()}
                        onBlur={e => finishRenamingGroup(group.id, e.target.value)}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') finishRenamingGroup(group.id, e.currentTarget.value);
                        }}
                      />
                    ) : (
                      <span onDoubleClick={() => startRenamingGroup(group.id)}>{group.name}</span>
                    )}
                  </div>
                  {groupSessions.length === 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showConfirmation(
                          `Are you sure you want to delete the group "${group.name}"?`,
                          () => {
                            setGroups(prev => prev.filter(g => g.id !== group.id));
                          }
                        );
                      }}
                      className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: theme.colors.error }}
                      title="Delete empty group"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {!group.collapsed ? (
                  <div className="flex flex-col border-l ml-4" style={{ borderColor: theme.colors.border }}>
                    {groupSessions.map(session => {
                      const globalIdx = sortedSessions.findIndex(s => s.id === session.id);
                      const isKeyboardSelected = activeFocus === 'sidebar' && globalIdx === selectedSidebarIndex;
                      return (
                        <div
                          key={session.id}
                          draggable
                          onDragStart={() => handleDragStart(session.id)}
                          onClick={() => setActiveSessionId(session.id)}
                          className={`px-4 py-2 cursor-move flex items-center justify-between group border-l-2 transition-all hover:bg-opacity-50 ${draggingSessionId === session.id ? 'opacity-50' : ''}`}
                          style={{
                            borderColor: (activeSessionId === session.id || isKeyboardSelected) ? theme.colors.accent : 'transparent',
                            backgroundColor: activeSessionId === session.id ? theme.colors.bgActivity : (isKeyboardSelected ? theme.colors.bgActivity + '40' : 'transparent')
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            {editingSessionId === session.id ? (
                              <input
                                autoFocus
                                className="bg-transparent text-sm font-medium outline-none w-full border-b border-indigo-500"
                                defaultValue={session.name}
                                onClick={e => e.stopPropagation()}
                                onBlur={e => finishRenamingSession(session.id, e.target.value)}
                                onKeyDown={e => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') finishRenamingSession(session.id, e.currentTarget.value);
                                }}
                              />
                            ) : (
                              <div
                                className="text-sm font-medium truncate"
                                style={{ color: activeSessionId === session.id ? theme.colors.textMain : theme.colors.textDim }}
                                onDoubleClick={() => startRenamingSession(session.id)}
                              >
                                {session.name}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] mt-0.5 opacity-70">
                              <Activity className="w-3 h-3" /> {session.toolType}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {/* Git Dirty Indicator (only in wide mode) */}
                            {leftSidebarOpen && session.isGitRepo && gitFileCounts.has(session.id) && gitFileCounts.get(session.id)! > 0 && (
                              <div className="flex items-center gap-0.5 text-[10px]" style={{ color: theme.colors.warning }}>
                                <GitBranch className="w-2.5 h-2.5" />
                                <span>{gitFileCounts.get(session.id)}</span>
                              </div>
                            )}
                            {/* AUTO Mode Indicator */}
                            {activeBatchSessionIds.includes(session.id) && (
                              <div
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase animate-pulse"
                                style={{ backgroundColor: theme.colors.warning + '30', color: theme.colors.warning }}
                                title="Auto mode running"
                              >
                                <Bot className="w-2.5 h-2.5" />
                                AUTO
                              </div>
                            )}
                            {/* AI Status Indicator */}
                            <div
                              className={`w-2 h-2 rounded-full ${session.state === 'connecting' ? 'animate-pulse' : ''}`}
                              style={{ backgroundColor: getStatusColor(session.state, theme) }}
                              title={
                                session.state === 'idle' ? 'Ready and waiting' :
                                session.state === 'busy' ? 'Agent is thinking' :
                                session.state === 'connecting' ? 'Attempting to establish connection' :
                                session.state === 'error' ? 'No connection with agent' :
                                'Waiting for input'
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Collapsed Group Palette */
                  <div
                    className="ml-8 mr-3 mt-1 mb-2 flex gap-1 h-1.5 opacity-50 hover:opacity-100 cursor-pointer transition-opacity"
                    onClick={() => toggleGroup(group.id)}
                  >
                    {groupSessions.map(s => (
                      <div
                        key={s.id}
                        className="flex-1 rounded-full"
                        style={{ backgroundColor: getStatusColor(s.state, theme) }}
                        title={`${s.name}: ${s.state}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* UNGROUPED SESSIONS (as collapsible group) */}
          <div className="mb-1 mt-4">
            <div
              className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-opacity-50 group"
              onClick={() => setUngroupedCollapsed(!ungroupedCollapsed)}
              onDragOver={handleDragOver}
              onDrop={handleDropOnUngrouped}
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider flex-1" style={{ color: theme.colors.textDim }}>
                {ungroupedCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <Folder className="w-3.5 h-3.5" />
                <span>Ungrouped</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createNewGroup();
                }}
                className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: theme.colors.textDim }}
                title="Create new group"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {!ungroupedCollapsed && (
              <div className="flex flex-col border-l ml-4" style={{ borderColor: theme.colors.border }}>
                {[...filteredSessions.filter(s => !s.groupId)].sort((a, b) => a.name.localeCompare(b.name)).map((session) => {
                  const globalIdx = sortedSessions.findIndex(s => s.id === session.id);
                  const isKeyboardSelected = activeFocus === 'sidebar' && globalIdx === selectedSidebarIndex;
                  return (
                <div
                  key={session.id}
                  draggable
                  onDragStart={() => handleDragStart(session.id)}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`px-4 py-2 rounded cursor-move flex items-center justify-between mb-1 hover:bg-opacity-50 border-l-2 transition-all ${draggingSessionId === session.id ? 'opacity-50' : ''}`}
                  style={{
                    borderColor: (activeSessionId === session.id || isKeyboardSelected) ? theme.colors.accent : 'transparent',
                    backgroundColor: activeSessionId === session.id ? theme.colors.bgActivity : (isKeyboardSelected ? theme.colors.bgActivity + '40' : 'transparent')
                  }}
                >
                  <div className="min-w-0 flex-1">
                    {editingSessionId === session.id ? (
                      <input
                        autoFocus
                        className="bg-transparent text-sm font-medium outline-none w-full border-b"
                        style={{ borderColor: theme.colors.accent }}
                        defaultValue={session.name}
                        onClick={e => e.stopPropagation()}
                        onBlur={e => finishRenamingSession(session.id, e.target.value)}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') finishRenamingSession(session.id, e.currentTarget.value);
                        }}
                      />
                    ) : (
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: activeSessionId === session.id ? theme.colors.textMain : theme.colors.textDim }}
                        onDoubleClick={() => startRenamingSession(session.id)}
                      >
                        {session.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] mt-0.5 opacity-70">
                      <Activity className="w-3 h-3" /> {session.toolType}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {/* Git Dirty Indicator (only in wide mode) */}
                    {leftSidebarOpen && session.isGitRepo && gitFileCounts.has(session.id) && gitFileCounts.get(session.id)! > 0 && (
                      <div className="flex items-center gap-0.5 text-[10px]" style={{ color: theme.colors.warning }}>
                        <GitBranch className="w-2.5 h-2.5" />
                        <span>{gitFileCounts.get(session.id)}</span>
                      </div>
                    )}
                    {/* AUTO Mode Indicator */}
                    {activeBatchSessionIds.includes(session.id) && (
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase animate-pulse"
                        style={{ backgroundColor: theme.colors.warning + '30', color: theme.colors.warning }}
                        title="Auto mode running"
                      >
                        <Bot className="w-2.5 h-2.5" />
                        AUTO
                      </div>
                    )}
                    {/* AI Status Indicator */}
                    <div
                      className={`w-2 h-2 rounded-full ${session.state === 'busy' ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: getStatusColor(session.state, theme) }}
                    />
                  </div>
                </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SIDEBAR CONTENT: SKINNY MODE */
        <div className="flex-1 flex flex-col items-center py-4 gap-2 overflow-y-auto overflow-x-visible no-scrollbar">
          {sortedSessions.map(session => (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`group relative w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${activeSessionId === session.id ? 'ring-2' : 'hover:bg-white/10'}`}
              style={{ ringColor: theme.colors.accent }}
            >
              <div
                className={`w-3 h-3 rounded-full ${session.state === 'busy' ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: getStatusColor(session.state, theme) }}
              />

              {/* Hover Tooltip for Skinny Mode */}
              <div
                className="fixed rounded px-3 py-2 z-[100] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl"
                style={{
                  minWidth: '240px',
                  left: '80px',
                  backgroundColor: theme.colors.bgSidebar,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {session.groupId && (
                  <div className="text-[10px] font-bold uppercase mb-1" style={{ color: theme.colors.textDim }}>
                    {groups.find(g => g.id === session.groupId)?.name}
                  </div>
                )}
                <div className="text-xs font-bold mb-2" style={{ color: theme.colors.textMain }}>{session.name}</div>
                <div className="text-[10px] capitalize mb-2" style={{ color: theme.colors.textDim }}>{session.state} • {session.toolType}</div>

                <div className="pt-2 mt-2 space-y-1.5" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span style={{ color: theme.colors.textDim }}>Context Window</span>
                    <span style={{ color: theme.colors.textMain }}>{session.contextUsage}%</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.border }}>
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${session.contextUsage}%`,
                        backgroundColor: getContextColor(session.contextUsage, theme)
                      }}
                    />
                  </div>

                  {/* Git Status */}
                  {session.isGitRepo && gitFileCounts.has(session.id) && gitFileCounts.get(session.id)! > 0 && (
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="flex items-center gap-1" style={{ color: theme.colors.textDim }}>
                        <GitBranch className="w-3 h-3" />
                        Git Changes
                      </span>
                      <span style={{ color: theme.colors.warning }}>{gitFileCounts.get(session.id)} files</span>
                    </div>
                  )}

                  {/* Session Cost */}
                  {session.usageStats && session.usageStats.totalCostUsd > 0 && (
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span style={{ color: theme.colors.textDim }}>Session Cost</span>
                      <span className="font-mono font-bold" style={{ color: theme.colors.success }}>
                        ${session.usageStats.totalCostUsd.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Active Time */}
                  {session.activeTimeMs > 0 && (
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="flex items-center gap-1" style={{ color: theme.colors.textDim }}>
                        <Clock className="w-3 h-3" />
                        Active Time
                      </span>
                      <span className="font-mono font-bold" style={{ color: theme.colors.accent }}>
                        {formatActiveTime(session.activeTimeMs)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] font-mono pt-1" style={{ color: theme.colors.textDim }}>
                    <Folder className="w-3 h-3 shrink-0" />
                    <span className="truncate">{session.cwd}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SIDEBAR BOTTOM ACTIONS */}
      <div className="p-2 border-t flex gap-2 items-center" style={{ borderColor: theme.colors.border }}>
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          className="flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors w-8 h-8 shrink-0"
          title={`${leftSidebarOpen ? "Collapse" : "Expand"} Sidebar (${shortcuts.toggleSidebar.keys.join('+').replace('Meta', 'Cmd')})`}
        >
          {leftSidebarOpen ? <PanelLeftClose className="w-4 h-4 opacity-50" /> : <PanelLeftOpen className="w-4 h-4 opacity-50" />}
        </button>

        {leftSidebarOpen && (
          <button onClick={addNewSession} className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition-colors text-white" style={{ backgroundColor: theme.colors.accent }}>
            <Plus className="w-3 h-3" /> New Agent
          </button>
        )}
      </div>
    </div>
  );
}
