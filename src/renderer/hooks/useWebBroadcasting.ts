import { useEffect } from 'react';

/**
 * Ref type for RightPanel to allow refreshing the history panel.
 */
export interface RightPanelHistoryHandle {
  refreshHistoryPanel: () => void;
}

/**
 * Dependencies for the useWebBroadcasting hook.
 */
export interface UseWebBroadcastingDeps {
  /** Ref to RightPanel for refreshing history panel */
  rightPanelRef: React.RefObject<RightPanelHistoryHandle | null>;
}

/**
 * Return type for useWebBroadcasting hook.
 * Currently empty as all functionality is side effects.
 */
export interface UseWebBroadcastingReturn {
  // No return values - all functionality is via side effects
}

/**
 * Hook for handling web broadcasting and external changes.
 *
 * Listens for external history changes (e.g., from CLI operations) and
 * refreshes the history panel when changes are detected. This ensures
 * the desktop app stays in sync with changes made from other sources.
 *
 * NOTE: Tab change broadcasting to web clients is handled separately
 * in useRemoteIntegration hook.
 *
 * @param deps - Hook dependencies
 * @returns Empty object (all functionality via side effects)
 */
export function useWebBroadcasting(deps: UseWebBroadcastingDeps): UseWebBroadcastingReturn {
  const { rightPanelRef } = deps;

  // Listen for external history changes (e.g., from CLI) and refresh history panel
  useEffect(() => {
    const unsubscribe = window.maestro.history.onExternalChange(async () => {
      console.log('[History] External change detected, reloading from disk and refreshing history panel');
      // Reload from disk before refreshing (to bypass electron-store cache)
      await window.maestro.history.reload();
      rightPanelRef.current?.refreshHistoryPanel();
    });
    return unsubscribe;
  }, [rightPanelRef]);

  return {};
}
