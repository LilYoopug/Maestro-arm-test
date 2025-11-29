import React, { useState, useRef, useCallback } from 'react';
import { X, Plus, Star } from 'lucide-react';
import type { AITab, Theme } from '../types';

interface TabBarProps {
  tabs: AITab[];
  activeTabId: string;
  theme: Theme;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabRename?: (tabId: string, newName: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
  onCloseOthers?: (tabId: string) => void;
}

interface TabProps {
  tab: AITab;
  isActive: boolean;
  theme: Theme;
  canClose: boolean;
  onSelect: () => void;
  onClose: () => void;
  onMiddleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  isDragOver: boolean;
}

/**
 * Get the display name for a tab.
 * Priority: name > first UUID octet > "New"
 */
function getTabDisplayName(tab: AITab): string {
  if (tab.name) {
    return tab.name;
  }
  if (tab.claudeSessionId) {
    // Return first octet of UUID in uppercase
    return tab.claudeSessionId.split('-')[0].toUpperCase();
  }
  return 'New';
}

/**
 * Individual tab component with hover state for close button.
 */
function Tab({
  tab,
  isActive,
  theme,
  canClose,
  onSelect,
  onClose,
  onMiddleClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging,
  isDragOver
}: TabProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle-click to close
    if (e.button === 1 && canClose) {
      e.preventDefault();
      onMiddleClick();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const displayName = getTabDisplayName(tab);

  return (
    <div
      className={`
        relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer
        transition-all duration-150 select-none
        ${isDragging ? 'opacity-50' : ''}
        ${isDragOver ? 'ring-2 ring-inset' : ''}
      `}
      style={{
        backgroundColor: isActive ? theme.colors.bgMain : 'transparent',
        borderColor: theme.colors.border,
        borderWidth: isActive ? '1px 1px 0 1px' : '0',
        borderStyle: 'solid',
        marginBottom: isActive ? '-1px' : '0',
        ringColor: isDragOver ? theme.colors.accent : 'transparent'
      }}
      onClick={onSelect}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      title={tab.name || tab.claudeSessionId || 'New tab'}
    >
      {/* Star indicator for starred sessions */}
      {tab.starred && (
        <Star
          className="w-3 h-3 fill-current shrink-0"
          style={{ color: theme.colors.warning }}
        />
      )}

      {/* Tab name */}
      <span
        className="text-xs font-medium truncate max-w-[120px]"
        style={{ color: isActive ? theme.colors.textMain : theme.colors.textDim }}
      >
        {displayName}
      </span>

      {/* Close button - visible on hover or when active */}
      {canClose && (isHovered || isActive) && (
        <button
          onClick={handleCloseClick}
          className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
          title="Close tab"
        >
          <X
            className="w-3 h-3"
            style={{ color: theme.colors.textDim }}
          />
        </button>
      )}

      {/* Active tab indicator line */}
      {isActive && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: theme.colors.accent }}
        />
      )}
    </div>
  );
}

/**
 * Context menu for tab right-click actions.
 */
interface ContextMenuProps {
  x: number;
  y: number;
  theme: Theme;
  canClose: boolean;
  canCloseOthers: boolean;
  onRename: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onDismiss: () => void;
}

function ContextMenu({
  x,
  y,
  theme,
  canClose,
  canCloseOthers,
  onRename,
  onClose,
  onCloseOthers,
  onDismiss
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onDismiss]);

  // Close on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 py-1 rounded-md shadow-xl border"
      style={{
        left: x,
        top: y,
        backgroundColor: theme.colors.bgSidebar,
        borderColor: theme.colors.border,
        minWidth: '140px'
      }}
    >
      <button
        onClick={() => {
          onRename();
          onDismiss();
        }}
        className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
        style={{ color: theme.colors.textMain }}
      >
        Rename
      </button>
      {canClose && (
        <button
          onClick={() => {
            onClose();
            onDismiss();
          }}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
          style={{ color: theme.colors.textMain }}
        >
          Close
        </button>
      )}
      {canCloseOthers && (
        <button
          onClick={() => {
            onCloseOthers();
            onDismiss();
          }}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
          style={{ color: theme.colors.textMain }}
        >
          Close Others
        </button>
      )}
    </div>
  );
}

/**
 * TabBar component for displaying AI session tabs.
 * Shows tabs for each Claude Code conversation within a Maestro session.
 * Appears only in AI mode (hidden in terminal mode).
 */
export function TabBar({
  tabs,
  activeTabId,
  theme,
  onTabSelect,
  onTabClose,
  onNewTab,
  onTabRename,
  onTabReorder,
  onCloseOthers
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const tabBarRef = useRef<HTMLDivElement>(null);

  // Can only close tabs if there's more than one
  const canClose = tabs.length > 1;

  const handleContextMenu = useCallback((tabId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      tabId,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  const handleDragStart = useCallback((tabId: string, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    setDraggingTabId(tabId);
  }, []);

  const handleDragOver = useCallback((tabId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tabId !== draggingTabId) {
      setDragOverTabId(tabId);
    }
  }, [draggingTabId]);

  const handleDragEnd = useCallback(() => {
    setDraggingTabId(null);
    setDragOverTabId(null);
  }, []);

  const handleDrop = useCallback((targetTabId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceTabId = e.dataTransfer.getData('text/plain');

    if (sourceTabId && sourceTabId !== targetTabId && onTabReorder) {
      const sourceIndex = tabs.findIndex(t => t.id === sourceTabId);
      const targetIndex = tabs.findIndex(t => t.id === targetTabId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        onTabReorder(sourceIndex, targetIndex);
      }
    }

    setDraggingTabId(null);
    setDragOverTabId(null);
  }, [tabs, onTabReorder]);

  const handleRenameRequest = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !onTabRename) return;

    // For now, use a simple prompt. This could be replaced with an inline edit UI.
    const currentName = tab.name || '';
    const newName = window.prompt('Enter tab name:', currentName);

    if (newName !== null) {
      onTabRename(tabId, newName.trim());
    }
  }, [tabs, onTabRename]);

  return (
    <div
      ref={tabBarRef}
      className="flex items-end px-2 pt-1 border-b overflow-x-auto scrollbar-thin"
      style={{
        backgroundColor: theme.colors.bgSidebar,
        borderColor: theme.colors.border
      }}
    >
      {/* Tabs */}
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          theme={theme}
          canClose={canClose}
          onSelect={() => onTabSelect(tab.id)}
          onClose={() => onTabClose(tab.id)}
          onMiddleClick={() => canClose && onTabClose(tab.id)}
          onContextMenu={(e) => handleContextMenu(tab.id, e)}
          onDragStart={(e) => handleDragStart(tab.id, e)}
          onDragOver={(e) => handleDragOver(tab.id, e)}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(tab.id, e)}
          isDragging={draggingTabId === tab.id}
          isDragOver={dragOverTabId === tab.id}
        />
      ))}

      {/* New Tab Button */}
      <button
        onClick={onNewTab}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/5 transition-colors shrink-0 ml-1 mb-0.5"
        style={{ color: theme.colors.textDim }}
        title="New tab (Cmd+T)"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          theme={theme}
          canClose={canClose}
          canCloseOthers={tabs.length > 1}
          onRename={() => handleRenameRequest(contextMenu.tabId)}
          onClose={() => onTabClose(contextMenu.tabId)}
          onCloseOthers={() => onCloseOthers?.(contextMenu.tabId)}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
