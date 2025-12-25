/**
 * useSummarizeAndContinue Hook
 *
 * React hook for managing the "Summarize & Continue" workflow.
 * This hook handles:
 * - Extracting context from the source tab
 * - Running the summarization process
 * - Creating a new compacted tab with the summarized context
 * - Tracking progress and errors throughout the process
 *
 * The new tab is created immediately to the right of the source tab
 * with the name format: "{original name} Compacted YYYY-MM-DD"
 */

import { useState, useRef, useCallback } from 'react';
import type { Session } from '../types';
import type { SummarizeProgress, SummarizeResult } from '../types/contextMerge';
import { contextSummarizationService } from '../services/contextSummarizer';
import { createTabAtPosition } from '../utils/tabHelpers';

/**
 * State type for the summarization process.
 */
export type SummarizeState = 'idle' | 'summarizing' | 'complete' | 'error';

/**
 * Result of the useSummarizeAndContinue hook.
 */
export interface UseSummarizeAndContinueResult {
  /** Current state of the summarization process */
  summarizeState: SummarizeState;
  /** Progress information during summarization */
  progress: SummarizeProgress | null;
  /** Result after successful summarization */
  result: SummarizeResult | null;
  /** Error message if summarization failed */
  error: string | null;
  /** Start the summarization process for a specific tab */
  startSummarize: (sourceTabId: string) => Promise<{
    newTabId: string;
    updatedSession: Session;
  } | null>;
  /** Cancel the current summarization operation */
  cancel: () => void;
  /** Check if summarization is allowed based on context usage */
  canSummarize: (contextUsage: number) => boolean;
  /** Get the minimum context usage percentage required for summarization */
  minContextUsagePercent: number;
}

/**
 * Hook for managing the "Summarize & Continue" workflow.
 *
 * @param session - The Maestro session containing the tabs
 * @param onSessionUpdate - Callback to update the session state
 * @returns Object with summarization state and control functions
 *
 * @example
 * function MyComponent({ session, onSessionUpdate }) {
 *   const {
 *     summarizeState,
 *     progress,
 *     result,
 *     error,
 *     startSummarize,
 *     canSummarize,
 *   } = useSummarizeAndContinue(session, onSessionUpdate);
 *
 *   const handleSummarize = async () => {
 *     const activeTab = getActiveTab(session);
 *     if (activeTab && canSummarize(session.contextUsage)) {
 *       const result = await startSummarize(activeTab.id);
 *       if (result) {
 *         // Switch to the new tab
 *         onSessionUpdate(result.updatedSession);
 *       }
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleSummarize} disabled={summarizeState === 'summarizing'}>
 *       {summarizeState === 'summarizing' ? `${progress?.progress}%` : 'Summarize & Continue'}
 *     </button>
 *   );
 * }
 */
export function useSummarizeAndContinue(
  session: Session | null
): UseSummarizeAndContinueResult {
  const [state, setState] = useState<SummarizeState>('idle');
  const [progress, setProgress] = useState<SummarizeProgress | null>(null);
  const [result, setResult] = useState<SummarizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  /**
   * Start the summarization process for a specific tab.
   */
  const startSummarize = useCallback(async (
    sourceTabId: string
  ): Promise<{ newTabId: string; updatedSession: Session } | null> => {
    if (!session) {
      setError('No active session');
      setState('error');
      return null;
    }

    const sourceTab = session.aiTabs.find(t => t.id === sourceTabId);
    if (!sourceTab) {
      setError('Source tab not found');
      setState('error');
      return null;
    }

    // Check if context usage is high enough to warrant summarization
    if (!contextSummarizationService.canSummarize(session.contextUsage)) {
      setError(`Context usage too low to summarize. Need at least ${contextSummarizationService.getMinContextUsagePercent()}% context usage.`);
      setState('error');
      return null;
    }

    setState('summarizing');
    setError(null);
    setResult(null);
    cancelRef.current = false;

    try {
      // Run the summarization
      const summarizeResult = await contextSummarizationService.summarizeContext(
        {
          sourceSessionId: session.id,
          sourceTabId,
          projectRoot: session.projectRoot,
          agentType: session.toolType,
        },
        sourceTab.logs,
        (p) => {
          if (!cancelRef.current) {
            setProgress(p);
          }
        }
      );

      if (cancelRef.current) {
        return null;
      }

      if (!summarizeResult) {
        throw new Error('Summarization returned no result');
      }

      // Create the new compacted tab
      const compactedTabName = contextSummarizationService.formatCompactedTabName(
        sourceTab.name
      );

      const tabResult = createTabAtPosition(session, {
        afterTabId: sourceTabId,
        name: compactedTabName,
        logs: summarizeResult.summarizedLogs,
        saveToHistory: sourceTab.saveToHistory,
      });

      if (!tabResult) {
        throw new Error('Failed to create compacted tab');
      }

      // Calculate final result
      const finalResult: SummarizeResult = {
        success: true,
        newTabId: tabResult.tab.id,
        originalTokens: summarizeResult.originalTokens,
        compactedTokens: summarizeResult.compactedTokens,
        reductionPercent: Math.round(
          (1 - summarizeResult.compactedTokens / summarizeResult.originalTokens) * 100
        ),
      };

      setResult(finalResult);
      setState('complete');
      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Complete!',
      });

      return {
        newTabId: tabResult.tab.id,
        updatedSession: {
          ...tabResult.session,
          activeTabId: tabResult.tab.id, // Switch to the new tab
        },
      };
    } catch (err) {
      if (!cancelRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Summarization failed';
        setError(errorMessage);
        setState('error');
        setResult({
          success: false,
          originalTokens: 0,
          compactedTokens: 0,
          reductionPercent: 0,
          error: errorMessage,
        });
      }
      return null;
    }
  }, [session]);

  /**
   * Cancel the current summarization operation.
   */
  const cancel = useCallback(() => {
    cancelRef.current = true;
    contextSummarizationService.cancelSummarization();
    setState('idle');
    setProgress(null);
  }, []);

  /**
   * Check if summarization is allowed based on context usage.
   */
  const canSummarize = useCallback((contextUsage: number): boolean => {
    return contextSummarizationService.canSummarize(contextUsage);
  }, []);

  return {
    summarizeState: state,
    progress,
    result,
    error,
    startSummarize,
    cancel,
    canSummarize,
    minContextUsagePercent: contextSummarizationService.getMinContextUsagePercent(),
  };
}

export default useSummarizeAndContinue;
