import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Theme, Shortcut } from '../types';
import { fuzzyMatch } from '../utils/search';
import { useLayerStack } from '../hooks/useLayerStack';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';

interface ShortcutsHelpModalProps {
  theme: Theme;
  shortcuts: Record<string, Shortcut>;
  onClose: () => void;
}

export function ShortcutsHelpModal({ theme, shortcuts, onClose }: ShortcutsHelpModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { registerLayer, unregisterLayer, updateLayerHandler } = useLayerStack();
  const layerIdRef = useRef<string>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Register layer on mount
  useEffect(() => {
    layerIdRef.current = registerLayer({
      type: 'modal',
      priority: MODAL_PRIORITIES.SHORTCUTS_HELP,
      blocksLowerLayers: true,
      capturesFocus: true,
      focusTrap: 'strict',
      ariaLabel: 'Keyboard Shortcuts',
      onEscape: () => {
        onClose();
      }
    });

    return () => {
      if (layerIdRef.current) {
        unregisterLayer(layerIdRef.current);
      }
    };
  }, []);

  // Update handler when dependencies change
  useEffect(() => {
    if (layerIdRef.current) {
      updateLayerHandler(layerIdRef.current, () => {
        onClose();
      });
    }
  }, [onClose]);

  // Auto-focus on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        tabIndex={-1}
        className="w-[400px] border rounded-lg shadow-2xl overflow-hidden outline-none"
        style={{ backgroundColor: theme.colors.bgSidebar, borderColor: theme.colors.border }}>
        <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: theme.colors.textMain }}>Keyboard Shortcuts</h2>
            <button onClick={onClose} style={{ color: theme.colors.textDim }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            className="w-full px-3 py-2 rounded border bg-transparent outline-none text-sm"
            style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
            autoFocus
          />
        </div>
        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {Object.values(shortcuts).filter(sc =>
            fuzzyMatch(sc.label, searchQuery) ||
            fuzzyMatch(sc.keys.join(' '), searchQuery)
          ).map((sc, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span style={{ color: theme.colors.textDim }}>{sc.label}</span>
              <kbd className="px-2 py-1 rounded border font-mono text-xs font-bold" style={{ backgroundColor: theme.colors.bgActivity, borderColor: theme.colors.border, color: theme.colors.textMain }}>
                {sc.keys.join(' ')}
              </kbd>
            </div>
          ))}
          {Object.values(shortcuts).filter(sc =>
            fuzzyMatch(sc.label, searchQuery) ||
            fuzzyMatch(sc.keys.join(' '), searchQuery)
          ).length === 0 && (
            <div className="text-center text-sm opacity-50" style={{ color: theme.colors.textDim }}>
              No shortcuts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
