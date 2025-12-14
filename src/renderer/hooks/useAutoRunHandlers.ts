import { useCallback } from 'react';
import type { Session, BatchRunConfig } from '../types';

/**
 * Tree node structure for Auto Run document tree
 */
export interface AutoRunTreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: unknown[];
}

/**
 * Dependencies required by the useAutoRunHandlers hook
 */
export interface UseAutoRunHandlersDeps {
  // State setters
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setAutoRunDocumentList: React.Dispatch<React.SetStateAction<string[]>>;
  setAutoRunDocumentTree: React.Dispatch<React.SetStateAction<AutoRunTreeNode[]>>;
  setAutoRunIsLoadingDocuments: React.Dispatch<React.SetStateAction<boolean>>;
  setAutoRunSetupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchRunnerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveRightTab: React.Dispatch<React.SetStateAction<'files' | 'history' | 'autorun'>>;
  setRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveFocus: React.Dispatch<React.SetStateAction<'sidebar' | 'main' | 'right'>>;
  setSuccessFlashNotification: React.Dispatch<React.SetStateAction<string | null>>;

  // Current state values
  autoRunDocumentList: string[];

  // Batch processor hook
  startBatchRun: (sessionId: string, config: BatchRunConfig, folderPath: string) => void;
}

/**
 * Return type for the useAutoRunHandlers hook
 */
export interface UseAutoRunHandlersReturn {
  /** Handle folder selection from Auto Run setup modal */
  handleAutoRunFolderSelected: (folderPath: string) => Promise<void>;
  /** Start a batch run with the given configuration */
  handleStartBatchRun: (config: BatchRunConfig) => void;
  /** Get the number of unchecked tasks in a document */
  getDocumentTaskCount: (filename: string) => Promise<number>;
  /** Handle content changes in the Auto Run editor */
  handleAutoRunContentChange: (content: string) => Promise<void>;
  /** Handle mode changes (edit/preview) */
  handleAutoRunModeChange: (mode: 'edit' | 'preview') => void;
  /** Handle state changes (scroll/cursor positions) */
  handleAutoRunStateChange: (state: {
    mode: 'edit' | 'preview';
    cursorPosition: number;
    editScrollPos: number;
    previewScrollPos: number;
  }) => void;
  /** Handle document selection */
  handleAutoRunSelectDocument: (filename: string) => Promise<void>;
  /** Refresh the document list */
  handleAutoRunRefresh: () => Promise<void>;
  /** Open the Auto Run setup modal */
  handleAutoRunOpenSetup: () => void;
  /** Create a new document */
  handleAutoRunCreateDocument: (filename: string) => Promise<boolean>;
}

/**
 * Hook that provides handlers for Auto Run operations.
 * Extracted from App.tsx to reduce file size and improve maintainability.
 *
 * @param activeSession - The currently active session (can be null)
 * @param deps - Dependencies including state setters and values
 * @returns Object containing all Auto Run handler functions
 */
export function useAutoRunHandlers(
  activeSession: Session | null,
  deps: UseAutoRunHandlersDeps
): UseAutoRunHandlersReturn {
  const {
    setSessions,
    setAutoRunDocumentList,
    setAutoRunDocumentTree,
    setAutoRunIsLoadingDocuments,
    setAutoRunSetupModalOpen,
    setBatchRunnerModalOpen,
    setActiveRightTab,
    setRightPanelOpen,
    setActiveFocus,
    setSuccessFlashNotification,
    autoRunDocumentList,
    startBatchRun,
  } = deps;

  // Handler for auto run folder selection from setup modal
  const handleAutoRunFolderSelected = useCallback(async (folderPath: string) => {
    if (!activeSession) return;

    // Load the document list from the folder
    const result = await window.maestro.autorun.listDocs(folderPath);
    if (result.success) {
      setAutoRunDocumentList(result.files || []);
      setAutoRunDocumentTree((result.tree as AutoRunTreeNode[]) || []);
      // Auto-select first document if available
      const firstFile = result.files?.[0];
      // Load content of first document
      let firstFileContent = '';
      if (firstFile) {
        const contentResult = await window.maestro.autorun.readDoc(folderPath, firstFile + '.md');
        if (contentResult.success) {
          firstFileContent = contentResult.content || '';
        }
      }
      // Update session with folder, file, AND content (atomically)
      setSessions(prev => prev.map(s =>
        s.id === activeSession.id
          ? {
              ...s,
              autoRunFolderPath: folderPath,
              autoRunSelectedFile: firstFile,
              autoRunContent: firstFileContent,
              autoRunContentVersion: (s.autoRunContentVersion || 0) + 1,
            }
          : s
      ));
    } else {
      setSessions(prev => prev.map(s =>
        s.id === activeSession.id
          ? { ...s, autoRunFolderPath: folderPath, autoRunContent: '', autoRunContentVersion: (s.autoRunContentVersion || 0) + 1 }
          : s
      ));
    }
    setAutoRunSetupModalOpen(false);
    // Switch to the autorun tab now that folder is configured
    setActiveRightTab('autorun');
    setRightPanelOpen(true);
    setActiveFocus('right');
  }, [activeSession, setSessions, setAutoRunDocumentList, setAutoRunDocumentTree, setAutoRunSetupModalOpen, setActiveRightTab, setRightPanelOpen, setActiveFocus]);

  // Handler to start batch run from modal with multi-document support
  const handleStartBatchRun = useCallback((config: BatchRunConfig) => {
    console.log('[useAutoRunHandlers] handleStartBatchRun called with config:', config);
    if (!activeSession || !activeSession.autoRunFolderPath) {
      console.log('[useAutoRunHandlers] handleStartBatchRun early return - no active session or autoRunFolderPath');
      return;
    }
    console.log('[useAutoRunHandlers] Starting batch run for session:', activeSession.id, 'folder:', activeSession.autoRunFolderPath);
    setBatchRunnerModalOpen(false);
    startBatchRun(activeSession.id, config, activeSession.autoRunFolderPath);
  }, [activeSession, startBatchRun, setBatchRunnerModalOpen]);

  // Memoized function to get task count for a document (used by BatchRunnerModal)
  const getDocumentTaskCount = useCallback(async (filename: string) => {
    if (!activeSession?.autoRunFolderPath) return 0;
    const result = await window.maestro.autorun.readDoc(activeSession.autoRunFolderPath, filename + '.md');
    if (!result.success || !result.content) return 0;
    // Count unchecked tasks: - [ ] pattern
    const matches = result.content.match(/^[\s]*-\s*\[\s*\]\s*.+$/gm);
    return matches ? matches.length : 0;
  }, [activeSession?.autoRunFolderPath]);

  // Auto Run document content change handler
  // Updates content in the session state (per-session, not global)
  const handleAutoRunContentChange = useCallback(async (content: string) => {
    if (!activeSession) return;
    setSessions(prev => prev.map(s =>
      s.id === activeSession.id ? { ...s, autoRunContent: content } : s
    ));
  }, [activeSession, setSessions]);

  // Auto Run mode change handler
  const handleAutoRunModeChange = useCallback((mode: 'edit' | 'preview') => {
    if (!activeSession) return;
    setSessions(prev => prev.map(s =>
      s.id === activeSession.id ? { ...s, autoRunMode: mode } : s
    ));
  }, [activeSession, setSessions]);

  // Auto Run state change handler (scroll/cursor positions)
  const handleAutoRunStateChange = useCallback((state: {
    mode: 'edit' | 'preview';
    cursorPosition: number;
    editScrollPos: number;
    previewScrollPos: number;
  }) => {
    if (!activeSession) return;
    setSessions(prev => prev.map(s =>
      s.id === activeSession.id ? {
        ...s,
        autoRunMode: state.mode,
        autoRunCursorPosition: state.cursorPosition,
        autoRunEditScrollPos: state.editScrollPos,
        autoRunPreviewScrollPos: state.previewScrollPos,
      } : s
    ));
  }, [activeSession, setSessions]);

  // Auto Run document selection handler
  // Updates both selectedFile AND content atomically in session state
  const handleAutoRunSelectDocument = useCallback(async (filename: string) => {
    if (!activeSession?.autoRunFolderPath) return;

    // Load new document content
    const result = await window.maestro.autorun.readDoc(
      activeSession.autoRunFolderPath,
      filename + '.md'
    );
    const newContent = result.success ? (result.content || '') : '';

    // Update both selectedFile and content atomically in session state
    // This prevents any race conditions or mismatched file/content
    setSessions(prev => prev.map(s =>
      s.id === activeSession.id
        ? {
            ...s,
            autoRunSelectedFile: filename,
            autoRunContent: newContent,
            autoRunContentVersion: (s.autoRunContentVersion || 0) + 1,
          }
        : s
    ));
  }, [activeSession, setSessions]);

  // Auto Run refresh handler - reload document list and show flash notification
  const handleAutoRunRefresh = useCallback(async () => {
    if (!activeSession?.autoRunFolderPath) return;
    const previousCount = autoRunDocumentList.length;
    setAutoRunIsLoadingDocuments(true);
    const result = await window.maestro.autorun.listDocs(activeSession.autoRunFolderPath);
    if (result.success) {
      const newFiles = result.files || [];
      setAutoRunDocumentList(newFiles);
      setAutoRunDocumentTree((result.tree as AutoRunTreeNode[]) || []);
      setAutoRunIsLoadingDocuments(false);

      // Show flash notification with result
      const diff = newFiles.length - previousCount;
      let message: string;
      if (diff > 0) {
        message = `Found ${diff} new document${diff === 1 ? '' : 's'}`;
      } else if (diff < 0) {
        message = `${Math.abs(diff)} document${Math.abs(diff) === 1 ? '' : 's'} removed`;
      } else {
        message = 'Refresh complete, no new documents';
      }
      setSuccessFlashNotification(message);
      setTimeout(() => setSuccessFlashNotification(null), 2000);
      return;
    }
    setAutoRunIsLoadingDocuments(false);
  }, [activeSession?.autoRunFolderPath, autoRunDocumentList.length, setAutoRunDocumentList, setAutoRunDocumentTree, setAutoRunIsLoadingDocuments, setSuccessFlashNotification]);

  // Auto Run open setup handler
  const handleAutoRunOpenSetup = useCallback(() => {
    setAutoRunSetupModalOpen(true);
  }, [setAutoRunSetupModalOpen]);

  // Auto Run create new document handler
  const handleAutoRunCreateDocument = useCallback(async (filename: string): Promise<boolean> => {
    if (!activeSession?.autoRunFolderPath) return false;

    try {
      // Create the document with empty content so placeholder hint shows
      const result = await window.maestro.autorun.writeDoc(
        activeSession.autoRunFolderPath,
        filename + '.md',
        ''
      );

      if (result.success) {
        // Refresh the document list
        const listResult = await window.maestro.autorun.listDocs(activeSession.autoRunFolderPath);
        if (listResult.success) {
          setAutoRunDocumentList(listResult.files || []);
        }

        // Select the new document, set content, and switch to edit mode (atomically)
        setSessions(prev => prev.map(s =>
          s.id === activeSession.id
            ? {
                ...s,
                autoRunSelectedFile: filename,
                autoRunContent: '',
                autoRunContentVersion: (s.autoRunContentVersion || 0) + 1,
                autoRunMode: 'edit',
              }
            : s
        ));

        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create document:', error);
      return false;
    }
  }, [activeSession, setSessions, setAutoRunDocumentList]);

  return {
    handleAutoRunFolderSelected,
    handleStartBatchRun,
    getDocumentTaskCount,
    handleAutoRunContentChange,
    handleAutoRunModeChange,
    handleAutoRunStateChange,
    handleAutoRunSelectDocument,
    handleAutoRunRefresh,
    handleAutoRunOpenSetup,
    handleAutoRunCreateDocument,
  };
}
