import React, { useEffect, useRef, useState } from 'react';
import { X, Bot, User, ExternalLink, Copy, Check, CheckCircle, XCircle, Trash2, Clock, Cpu, Zap, Play } from 'lucide-react';
import type { Theme, HistoryEntry } from '../types';
import { useLayerStack } from '../contexts/LayerStackContext';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';

// Format elapsed time in human-readable format
const formatElapsedTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

interface HistoryDetailModalProps {
  theme: Theme;
  entry: HistoryEntry;
  onClose: () => void;
  onJumpToClaudeSession?: (claudeSessionId: string) => void;
  onResumeSession?: (claudeSessionId: string) => void;
  onDelete?: (entryId: string) => void;
}

// Get context bar color based on usage percentage
const getContextColor = (usage: number, theme: Theme) => {
  if (usage >= 90) return theme.colors.error;
  if (usage >= 70) return theme.colors.warning;
  return theme.colors.success;
};

export function HistoryDetailModal({
  theme,
  entry,
  onClose,
  onJumpToClaudeSession,
  onResumeSession,
  onDelete
}: HistoryDetailModalProps) {
  const { registerLayer, unregisterLayer, updateLayerHandler } = useLayerStack();
  const layerIdRef = useRef<string>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Register layer on mount
  useEffect(() => {
    const id = registerLayer({
      type: 'modal',
      priority: MODAL_PRIORITIES.CONFIRM, // Use same priority as confirm modal
      onEscape: () => {
        onCloseRef.current();
      }
    });
    layerIdRef.current = id;

    return () => {
      if (layerIdRef.current) {
        unregisterLayer(layerIdRef.current);
      }
    };
  }, [registerLayer, unregisterLayer]);

  // Keep escape handler up to date
  useEffect(() => {
    if (layerIdRef.current) {
      updateLayerHandler(layerIdRef.current, () => {
        onCloseRef.current();
      });
    }
  }, [onClose, updateLayerHandler]);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get pill color based on type
  const getPillColor = () => {
    if (entry.type === 'AUTO') {
      return { bg: theme.colors.warning + '20', text: theme.colors.warning, border: theme.colors.warning + '40' };
    }
    return { bg: theme.colors.accent + '20', text: theme.colors.accent, border: theme.colors.accent + '40' };
  };

  const colors = getPillColor();
  const Icon = entry.type === 'AUTO' ? Bot : User;

  // For AUTO entries:
  //   - summary = short 1-2 sentence synopsis (shown in list view and toast)
  //   - fullResponse = complete synopsis with details (shown in detail view)
  // For USER entries:
  //   - summary = the synopsis text
  //   - fullResponse = may contain more context
  const rawResponse = entry.fullResponse || entry.summary || '';
  const cleanResponse = rawResponse.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-lg border shadow-2xl flex flex-col"
        style={{
          backgroundColor: theme.colors.bgSidebar,
          borderColor: theme.colors.border
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: theme.colors.border }}
        >
          <div className="flex items-center gap-3">
            {/* Success/Failure Indicator for AUTO entries */}
            {entry.type === 'AUTO' && entry.success !== undefined && (
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full"
                style={{
                  backgroundColor: entry.success ? theme.colors.success + '20' : theme.colors.error + '20',
                  border: `1px solid ${entry.success ? theme.colors.success + '40' : theme.colors.error + '40'}`
                }}
                title={entry.success ? 'Task completed successfully' : 'Task failed'}
              >
                {entry.success ? (
                  <CheckCircle className="w-4 h-4" style={{ color: theme.colors.success }} />
                ) : (
                  <XCircle className="w-4 h-4" style={{ color: theme.colors.error }} />
                )}
              </span>
            )}

            {/* Type Pill */}
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`
              }}
            >
              <Icon className="w-2.5 h-2.5" />
              {entry.type}
            </span>

            {/* Session ID Octet - copyable with optional jump */}
            {entry.claudeSessionId && (
              <div className="flex items-center gap-1">
                {/* Copy button */}
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(entry.claudeSessionId!);
                    setCopiedSessionId(true);
                    setTimeout(() => setCopiedSessionId(false), 2000);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: theme.colors.accent + '20',
                    color: theme.colors.accent,
                    border: `1px solid ${theme.colors.accent}40`
                  }}
                  title={`Copy session ID: ${entry.claudeSessionId}`}
                >
                  {entry.claudeSessionId.split('-')[0].toUpperCase()}
                  {copiedSessionId ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </button>
                {/* Resume button */}
                {onResumeSession && (
                  <button
                    onClick={() => {
                      onResumeSession(entry.claudeSessionId!);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: theme.colors.success + '20',
                      color: theme.colors.success,
                      border: `1px solid ${theme.colors.success}40`
                    }}
                    title={`Resume session ${entry.claudeSessionId}`}
                  >
                    <Play className="w-2.5 h-2.5" />
                    Resume
                  </button>
                )}
                {/* Jump button */}
                {onJumpToClaudeSession && (
                  <button
                    onClick={() => {
                      onJumpToClaudeSession(entry.claudeSessionId!);
                      onClose();
                    }}
                    className="p-1 rounded-full transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: theme.colors.accent + '20',
                      color: theme.colors.accent,
                      border: `1px solid ${theme.colors.accent}40`
                    }}
                    title={`Jump to session ${entry.claudeSessionId}`}
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )}

            {/* Timestamp */}
            <span className="text-xs" style={{ color: theme.colors.textDim }}>
              {formatTime(entry.timestamp)}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textDim }} />
          </button>
        </div>

        {/* Stats Panel - shown when we have usage stats */}
        {(entry.usageStats || entry.contextUsage !== undefined || entry.elapsedTimeMs) && (
          <div
            className="px-6 py-4 border-b shrink-0"
            style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain + '40' }}
          >
            <div className="flex items-center gap-6 flex-wrap">
              {/* Context Window Widget */}
              {entry.contextUsage !== undefined && entry.usageStats && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" style={{ color: theme.colors.textDim }} />
                    <span className="text-[10px] font-bold uppercase" style={{ color: theme.colors.textDim }}>
                      Context
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.border }}>
                        <div
                          className="h-full transition-all duration-500 ease-out"
                          style={{
                            width: `${entry.contextUsage}%`,
                            backgroundColor: getContextColor(entry.contextUsage, theme)
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: getContextColor(entry.contextUsage, theme) }}>
                        {entry.contextUsage}%
                      </span>
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: theme.colors.textDim }}>
                      {((entry.usageStats.inputTokens + entry.usageStats.outputTokens) / 1000).toFixed(1)}k / {(entry.usageStats.contextWindow / 1000).toFixed(0)}k tokens
                    </span>
                  </div>
                </div>
              )}

              {/* Token Breakdown */}
              {entry.usageStats && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" style={{ color: theme.colors.textDim }} />
                    <span className="text-[10px] font-bold uppercase" style={{ color: theme.colors.textDim }}>
                      Tokens
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span style={{ color: theme.colors.accent }}>
                      <span style={{ color: theme.colors.textDim }}>In:</span> {entry.usageStats.inputTokens.toLocaleString()}
                    </span>
                    <span style={{ color: theme.colors.success }}>
                      <span style={{ color: theme.colors.textDim }}>Out:</span> {entry.usageStats.outputTokens.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Elapsed Time */}
              {entry.elapsedTimeMs !== undefined && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: theme.colors.textDim }} />
                  <span className="text-xs font-mono font-bold" style={{ color: theme.colors.textMain }}>
                    {formatElapsedTime(entry.elapsedTimeMs)}
                  </span>
                </div>
              )}

              {/* Cost */}
              {entry.usageStats && entry.usageStats.totalCostUsd > 0 && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full border border-green-500/30 text-green-500 bg-green-500/10">
                  ${entry.usageStats.totalCostUsd.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin"
          style={{ color: theme.colors.textMain }}
        >
          <pre
            className="whitespace-pre-wrap font-mono text-sm leading-relaxed"
            style={{ color: theme.colors.textMain }}
          >
            {cleanResponse}
          </pre>
        </div>

        {/* Footer */}
        <div
          className="flex justify-between px-6 py-4 border-t shrink-0"
          style={{ borderColor: theme.colors.border }}
        >
          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors hover:opacity-90"
            style={{
              backgroundColor: theme.colors.error + '20',
              color: theme.colors.error,
              border: `1px solid ${theme.colors.error}40`
            }}
            title="Delete this history entry"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium transition-colors hover:opacity-90"
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentForeground
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[10001]"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-[400px] border rounded-lg shadow-2xl overflow-hidden"
            style={{
              backgroundColor: theme.colors.bgSidebar,
              borderColor: theme.colors.border
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: theme.colors.border }}
            >
              <h2 className="text-sm font-bold" style={{ color: theme.colors.textMain }}>
                Delete History Entry
              </h2>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ color: theme.colors.textDim }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed" style={{ color: theme.colors.textMain }}>
                Are you sure you want to delete this {entry.type === 'AUTO' ? 'auto' : 'user'} history entry? This action cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded border hover:bg-white/5 transition-colors"
                  style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (onDelete) {
                      onDelete(entry.id);
                    }
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded text-white"
                  style={{ backgroundColor: theme.colors.error }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
