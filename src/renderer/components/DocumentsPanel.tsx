import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { GripVertical, Plus, Repeat, RotateCcw, X, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Theme, BatchDocumentEntry } from '../types';

interface DocumentsPanelProps {
  theme: Theme;
  documents: BatchDocumentEntry[];
  setDocuments: React.Dispatch<React.SetStateAction<BatchDocumentEntry[]>>;
  taskCounts: Record<string, number>;
  loadingTaskCounts: boolean;
  loopEnabled: boolean;
  setLoopEnabled: (enabled: boolean) => void;
  maxLoops: number | null;
  setMaxLoops: (maxLoops: number | null) => void;
  allDocuments: string[];
  onRefreshDocuments: () => Promise<void>;
}

// Document selector modal component
interface DocumentSelectorModalProps {
  theme: Theme;
  allDocuments: string[];
  taskCounts: Record<string, number>;
  loadingTaskCounts: boolean;
  documents: BatchDocumentEntry[];
  onClose: () => void;
  onAdd: (selectedDocs: Set<string>) => void;
  onRefresh: () => Promise<void>;
}

function DocumentSelectorModal({
  theme,
  allDocuments,
  taskCounts,
  loadingTaskCounts,
  documents,
  onClose,
  onAdd,
  onRefresh
}: DocumentSelectorModalProps) {
  // Pre-select currently added documents
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(() => {
    return new Set(documents.map(d => d.filename));
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [prevDocCount, setPrevDocCount] = useState(allDocuments.length);

  // Toggle document selection
  const toggleDoc = useCallback((filename: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    const countBefore = allDocuments.length;
    setRefreshing(true);
    setRefreshMessage(null);

    await onRefresh();

    // Use a small timeout to let the prop update
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, [onRefresh, allDocuments.length]);

  // Track document count changes for refresh notification
  useEffect(() => {
    if (refreshing === false && prevDocCount !== allDocuments.length) {
      const diff = allDocuments.length - prevDocCount;
      let message: string;
      if (diff > 0) {
        message = `Found ${diff} new document${diff === 1 ? '' : 's'}`;
      } else if (diff < 0) {
        message = `${Math.abs(diff)} document${Math.abs(diff) === 1 ? '' : 's'} removed`;
      } else {
        message = 'No changes';
      }
      setRefreshMessage(message);
      setPrevDocCount(allDocuments.length);

      // Clear message after 3 seconds
      const timer = setTimeout(() => setRefreshMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [allDocuments.length, prevDocCount, refreshing]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="w-[400px] max-h-[60vh] border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: theme.colors.bgSidebar, borderColor: theme.colors.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Selector Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold" style={{ color: theme.colors.textMain }}>
              Select Documents
            </h3>
            {refreshMessage && (
              <span
                className="text-xs px-2 py-0.5 rounded animate-in fade-in"
                style={{
                  backgroundColor: theme.colors.success + '20',
                  color: theme.colors.success
                }}
              >
                {refreshMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              style={{ color: theme.colors.textDim }}
              title="Refresh document list"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: theme.colors.textDim }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Checkboxes */}
        <div className="flex-1 overflow-y-auto p-2">
          {allDocuments.length === 0 ? (
            <div className="p-4 text-center" style={{ color: theme.colors.textDim }}>
              <p className="text-sm">No documents found in folder</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allDocuments.map((filename) => {
                const isSelected = selectedDocs.has(filename);
                const docTaskCount = taskCounts[filename] ?? 0;

                return (
                  <button
                    key={filename}
                    onClick={() => toggleDoc(filename)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                      isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-accent border-accent' : ''
                      }`}
                      style={{
                        borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                        backgroundColor: isSelected ? theme.colors.accent : 'transparent'
                      }}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Filename */}
                    <span
                      className="flex-1 text-sm text-left truncate"
                      style={{ color: theme.colors.textMain }}
                    >
                      {filename}.md
                    </span>

                    {/* Task Count */}
                    <span
                      className="text-xs px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: docTaskCount === 0 ? theme.colors.textDim + '20' : theme.colors.success + '20',
                        color: docTaskCount === 0 ? theme.colors.textDim : theme.colors.success
                      }}
                    >
                      {loadingTaskCounts ? '...' : `${docTaskCount} ${docTaskCount === 1 ? 'task' : 'tasks'}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selector Footer */}
        <div className="p-4 border-t flex justify-end gap-2 shrink-0" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border hover:bg-white/5 transition-colors"
            style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
          >
            Cancel
          </button>
          <button
            onClick={() => onAdd(selectedDocs)}
            className="px-4 py-2 rounded text-white font-bold"
            style={{ backgroundColor: theme.colors.accent }}
          >
            Add ({selectedDocs.size})
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentsPanel({
  theme,
  documents,
  setDocuments,
  taskCounts,
  loadingTaskCounts,
  loopEnabled,
  setLoopEnabled,
  maxLoops,
  setMaxLoops,
  allDocuments,
  onRefreshDocuments
}: DocumentsPanelProps) {
  // Document selector modal state
  const [showDocSelector, setShowDocSelector] = useState(false);

  // Loop mode state
  const [showMaxLoopsSlider, setShowMaxLoopsSlider] = useState(maxLoops != null);

  // Drag state for reordering
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Calculate counts
  const totalTaskCount = documents.reduce((sum, doc) => {
    if (doc.isMissing) return sum;
    return sum + (taskCounts[doc.filename] || 0);
  }, 0);
  const missingDocCount = documents.filter(doc => doc.isMissing).length;
  const hasMissingDocs = missingDocCount > 0;

  // Document list handlers
  const handleRemoveDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, [setDocuments]);

  const handleToggleReset = useCallback((id: string) => {
    setDocuments(prev => prev.map(d =>
      d.id === id ? { ...d, resetOnCompletion: !d.resetOnCompletion } : d
    ));
  }, [setDocuments]);

  const handleDuplicateDocument = useCallback((id: string) => {
    setDocuments(prev => {
      const index = prev.findIndex(d => d.id === id);
      if (index === -1) return prev;

      const original = prev[index];
      const duplicate: BatchDocumentEntry = {
        id: crypto.randomUUID(),
        filename: original.filename,
        resetOnCompletion: original.resetOnCompletion,
        isDuplicate: true
      };

      return [
        ...prev.slice(0, index + 1),
        duplicate,
        ...prev.slice(index + 1)
      ];
    });
  }, [setDocuments]);

  const handleOpenDocSelector = useCallback(() => {
    setShowDocSelector(true);
  }, []);

  const handleAddSelectedDocs = useCallback((selectedDocs: Set<string>) => {
    const existingFilenames = new Set(documents.map(d => d.filename));

    const newDocs: BatchDocumentEntry[] = [];
    selectedDocs.forEach(filename => {
      if (!existingFilenames.has(filename)) {
        newDocs.push({
          id: crypto.randomUUID(),
          filename,
          resetOnCompletion: false,
          isDuplicate: false
        });
      }
    });

    const filteredDocs = documents.filter(d => selectedDocs.has(d.filename));
    setDocuments([...filteredDocs, ...newDocs]);
    setShowDocSelector(false);
  }, [documents, setDocuments]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      setDocuments(prev => {
        const items = [...prev];
        const draggedIndex = items.findIndex(d => d.id === draggedId);
        const targetIndex = items.findIndex(d => d.id === dragOverId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [removed] = items.splice(draggedIndex, 1);
          items.splice(targetIndex, 0, removed);
        }

        return items;
      });
    }
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, setDocuments]);

  // Sync showMaxLoopsSlider when maxLoops prop changes externally
  useEffect(() => {
    setShowMaxLoopsSlider(maxLoops != null);
  }, [maxLoops]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold uppercase" style={{ color: theme.colors.textDim }}>
          Documents to Run
        </label>
        <button
          onClick={handleOpenDocSelector}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: theme.colors.accent }}
        >
          <Plus className="w-3 h-3" />
          Add Docs
        </button>
      </div>

      {/* Document List with Loop Indicator */}
      <div className={`relative ${loopEnabled && documents.length > 1 ? 'ml-7' : ''}`}>
        {/* Loop path - right-angled lines from bottom around left to top */}
        {loopEnabled && documents.length > 1 && (
          <>
            {/* Left vertical line */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: -24,
                top: 8,
                bottom: 8,
                width: 3,
                backgroundColor: theme.colors.accent,
                borderRadius: 1.5
              }}
            />
            {/* Top horizontal line - stops before document */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: -24,
                top: 8,
                width: 18,
                height: 3,
                backgroundColor: theme.colors.accent,
                borderRadius: 1.5
              }}
            />
            {/* Bottom horizontal line - stops before document */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: -24,
                bottom: 8,
                width: 18,
                height: 3,
                backgroundColor: theme.colors.accent,
                borderRadius: 1.5
              }}
            />
            {/* Arrow head pointing right (toward top doc) */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: -10,
                top: 2,
                width: 0,
                height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: `9px solid ${theme.colors.accent}`
              }}
            />
          </>
        )}
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: theme.colors.bgMain, borderColor: theme.colors.border }}
        >
        {documents.length === 0 ? (
          <div className="p-4 text-center" style={{ color: theme.colors.textDim }}>
            <p className="text-sm">No documents selected</p>
            <p className="text-xs mt-1">Click "+ Add Docs" to select documents to run</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme.colors.border }}>
            {documents.map((doc) => {
              const docTaskCount = taskCounts[doc.filename] ?? 0;
              const isBeingDragged = draggedId === doc.id;
              const isDragTarget = dragOverId === doc.id;

              return (
                <div
                  key={doc.id}
                  draggable={!doc.isMissing}
                  onDragStart={(e) => !doc.isMissing && handleDragStart(e, doc.id)}
                  onDragOver={(e) => handleDragOver(e, doc.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2 transition-all ${
                    isBeingDragged ? 'opacity-50' : ''
                  } ${isDragTarget ? 'bg-white/10' : 'hover:bg-white/5'} ${
                    doc.isMissing ? 'opacity-60' : ''
                  }`}
                  style={{
                    borderColor: theme.colors.border,
                    backgroundColor: doc.isMissing ? theme.colors.error + '08' : undefined
                  }}
                >
                  {/* Drag Handle */}
                  <GripVertical
                    className={`w-4 h-4 shrink-0 ${doc.isMissing ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                    style={{ color: doc.isMissing ? theme.colors.error + '60' : theme.colors.textDim }}
                  />

                  {/* Document Name */}
                  <span
                    className={`flex-1 text-sm font-medium truncate ${doc.isMissing ? 'line-through' : ''}`}
                    style={{ color: doc.isMissing ? theme.colors.error : theme.colors.textMain }}
                  >
                    {doc.filename}.md
                  </span>

                  {/* Missing Indicator */}
                  {doc.isMissing && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded shrink-0 uppercase font-bold"
                      style={{
                        backgroundColor: theme.colors.error + '20',
                        color: theme.colors.error
                      }}
                      title="This document no longer exists in the folder"
                    >
                      Missing
                    </span>
                  )}

                  {/* Task Count Badge (invisible placeholder for missing docs) */}
                  {!doc.isMissing ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: docTaskCount === 0 ? theme.colors.error + '20' : theme.colors.success + '20',
                        color: docTaskCount === 0 ? theme.colors.error : theme.colors.success
                      }}
                    >
                      {loadingTaskCounts ? '...' : `${docTaskCount} ${docTaskCount === 1 ? 'task' : 'tasks'}`}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 shrink-0 invisible">0 tasks</span>
                  )}

                  {/* Reset Toggle Button (invisible placeholder for missing docs) */}
                  {!doc.isMissing ? (() => {
                    const hasDuplicates = documents.filter(d => d.filename === doc.filename).length > 1;
                    const canDisableReset = !hasDuplicates;

                    let tooltipText: string;
                    if (doc.resetOnCompletion) {
                      if (canDisableReset) {
                        tooltipText = 'Reset enabled: uncompleted tasks will be re-checked when done. Click to disable.';
                      } else {
                        tooltipText = 'Reset enabled: uncompleted tasks will be re-checked when done. Remove duplicates to disable.';
                      }
                    } else {
                      tooltipText = 'Enable reset: uncompleted tasks will be re-checked when this document completes';
                    }

                    return (
                      <button
                        onClick={() => {
                          if (!doc.resetOnCompletion || canDisableReset) {
                            handleToggleReset(doc.id);
                          }
                        }}
                        className={`p-1 rounded transition-colors shrink-0 ${
                          doc.resetOnCompletion
                            ? (canDisableReset ? 'hover:bg-white/10' : 'cursor-not-allowed')
                            : 'hover:bg-white/10'
                        }`}
                        style={{
                          backgroundColor: doc.resetOnCompletion ? theme.colors.accent + '20' : 'transparent',
                          color: doc.resetOnCompletion ? theme.colors.accent : theme.colors.textDim,
                          opacity: doc.resetOnCompletion && !canDisableReset ? 0.7 : 1
                        }}
                        title={tooltipText}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    );
                  })() : (
                    <span className="p-1 shrink-0 invisible"><RotateCcw className="w-3.5 h-3.5" /></span>
                  )}

                  {/* Duplicate Button (invisible placeholder when not applicable) */}
                  {doc.resetOnCompletion && !doc.isMissing ? (
                    <button
                      onClick={() => handleDuplicateDocument(doc.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                      style={{ color: theme.colors.textDim }}
                      title="Duplicate document"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="p-1 shrink-0 invisible"><Plus className="w-3.5 h-3.5" /></span>
                  )}

                  {/* Remove Button (invisible placeholder when not applicable) */}
                  {(doc.isDuplicate || documents.length > 1 || doc.isMissing) ? (
                    <button
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                      style={{ color: doc.isMissing ? theme.colors.error : theme.colors.textDim }}
                      title={doc.isMissing ? 'Remove missing document' : 'Remove document'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="p-1 shrink-0 invisible"><X className="w-3.5 h-3.5" /></span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Missing Documents Warning */}
      {hasMissingDocs && (
        <div
          className="mt-2 flex items-center gap-2 p-2 rounded border text-xs"
          style={{
            backgroundColor: theme.colors.warning + '10',
            borderColor: theme.colors.warning + '40',
            color: theme.colors.warning
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {missingDocCount} document{missingDocCount > 1 ? 's' : ''} no longer exist{missingDocCount === 1 ? 's' : ''} in the folder and will be skipped
          </span>
        </div>
      )}

      {/* Total Summary with Loop Button */}
      {documents.length > 1 && (
        <div className="mt-2 flex items-center justify-between">
          {/* Loop Mode Toggle with Max Loops Control */}
          <div className="flex items-center gap-2">
            {/* Loop Toggle Button */}
            <button
              onClick={() => setLoopEnabled(!loopEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                loopEnabled ? 'border-accent' : 'border-border hover:bg-white/5'
              }`}
              style={{
                borderColor: loopEnabled ? theme.colors.accent : theme.colors.border,
                backgroundColor: loopEnabled ? theme.colors.accent + '15' : 'transparent'
              }}
              title="Loop back to first document when finished"
            >
              <Repeat
                className="w-3.5 h-3.5"
                style={{ color: loopEnabled ? theme.colors.accent : theme.colors.textDim }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: loopEnabled ? theme.colors.accent : theme.colors.textMain }}
              >
                Loop
              </span>
            </button>

            {/* Max Loops Control - only shown when loop is enabled */}
            {loopEnabled && (
              <div
                className="flex items-center rounded-lg border overflow-hidden"
                style={{ borderColor: theme.colors.border }}
              >
                {/* Infinity Toggle */}
                <button
                  onClick={() => {
                    setShowMaxLoopsSlider(false);
                    setMaxLoops(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    !showMaxLoopsSlider ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  style={{
                    color: !showMaxLoopsSlider ? theme.colors.accent : theme.colors.textDim
                  }}
                  title="Loop forever until all tasks complete"
                >
                  <span className="text-xl leading-none">∞</span>
                </button>
                {/* Max Toggle */}
                <button
                  onClick={() => {
                    setShowMaxLoopsSlider(true);
                    if (maxLoops === null) {
                      setMaxLoops(5);
                    }
                  }}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors border-l ${
                    showMaxLoopsSlider ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  style={{
                    color: showMaxLoopsSlider ? theme.colors.accent : theme.colors.textDim,
                    borderColor: theme.colors.border
                  }}
                  title="Set maximum loop iterations"
                >
                  max
                </button>
              </div>
            )}

            {/* Slider for max loops - shown when max is selected */}
            {loopEnabled && showMaxLoopsSlider && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={maxLoops ?? 5}
                  onChange={(e) => setMaxLoops(parseInt(e.target.value))}
                  className="w-32 h-1 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${theme.colors.accent} 0%, ${theme.colors.accent} ${((maxLoops ?? 5) / 25) * 100}%, ${theme.colors.border} ${((maxLoops ?? 5) / 25) * 100}%, ${theme.colors.border} 100%)`
                  }}
                />
                <span
                  className="text-xs font-mono w-6 text-center"
                  style={{ color: theme.colors.accent }}
                >
                  {maxLoops}
                </span>
              </div>
            )}
          </div>
          <span className="text-xs" style={{ color: theme.colors.textDim }}>
            Total: {loadingTaskCounts ? '...' : totalTaskCount} tasks across {documents.length - missingDocCount} {hasMissingDocs ? 'available ' : ''}document{documents.length - missingDocCount !== 1 ? 's' : ''}
            {hasMissingDocs && ` (${missingDocCount} missing)`}
          </span>
        </div>
      )}

      {/* Document Selector Modal */}
      {showDocSelector && (
        <DocumentSelectorModal
          theme={theme}
          allDocuments={allDocuments}
          taskCounts={taskCounts}
          loadingTaskCounts={loadingTaskCounts}
          documents={documents}
          onClose={() => setShowDocSelector(false)}
          onAdd={handleAddSelectedDocs}
          onRefresh={onRefreshDocuments}
        />
      )}
    </div>
  );
}
