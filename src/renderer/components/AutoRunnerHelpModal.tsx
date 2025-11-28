import React, { useEffect, useRef } from 'react';
import { X, CheckSquare, Play, History, Eye, Square, Keyboard } from 'lucide-react';
import type { Theme } from '../types';
import { useLayerStack } from '../contexts/LayerStackContext';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';

interface AutoRunnerHelpModalProps {
  theme: Theme;
  onClose: () => void;
}

export function AutoRunnerHelpModal({ theme, onClose }: AutoRunnerHelpModalProps) {
  const { registerLayer, unregisterLayer, updateLayerHandler } = useLayerStack();
  const layerIdRef = useRef<string>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border shadow-2xl flex flex-col"
        style={{
          backgroundColor: theme.colors.bgSidebar,
          borderColor: theme.colors.border
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <h2 className="text-lg font-bold" style={{ color: theme.colors.textMain }}>
            Automatic Runner Guide
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textDim }} />
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin"
          style={{ color: theme.colors.textMain }}
        >
          {/* Introduction */}
          <section>
            <p className="text-sm leading-relaxed" style={{ color: theme.colors.textDim }}>
              Maestro's Automatic Runner lets you batch-process tasks using AI agents.
              Define your tasks as markdown checkboxes, and let the AI work through them one by one, each time with a fresh context window.
            </p>
          </section>

          {/* Creating Tasks */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <h3 className="font-bold">Creating Tasks</h3>
            </div>
            <div
              className="text-sm space-y-2 pl-7"
              style={{ color: theme.colors.textDim }}
            >
              <p>
                Use markdown checkboxes to define tasks in the Scratchpad:
              </p>
              <div
                className="font-mono text-xs p-3 rounded border"
                style={{
                  backgroundColor: theme.colors.bgActivity,
                  borderColor: theme.colors.border
                }}
              >
                - [ ] Implement user authentication<br />
                - [ ] Add unit tests for the login flow<br />
                - [ ] Update documentation
              </div>
              <div
                className="flex items-center gap-2 mt-3 px-3 py-2 rounded"
                style={{ backgroundColor: theme.colors.accent + '15' }}
              >
                <Keyboard className="w-4 h-4" style={{ color: theme.colors.accent }} />
                <span>
                  <strong style={{ color: theme.colors.textMain }}>Tip:</strong> Press{' '}
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                    style={{
                      backgroundColor: theme.colors.bgActivity,
                      border: `1px solid ${theme.colors.border}`
                    }}
                  >
                    ⌘L
                  </kbd>{' '}
                  to quickly insert a new checkbox at your cursor position.
                </span>
              </div>
            </div>
          </section>

          {/* Running Tasks */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Play className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <h3 className="font-bold">Running the Automation</h3>
            </div>
            <div
              className="text-sm space-y-2 pl-7"
              style={{ color: theme.colors.textDim }}
            >
              <p>
                Click the <strong style={{ color: theme.colors.textMain }}>Run</strong> button to start.
                A prompt editor will appear where you can customize instructions for the AI agent.
              </p>
              <p>
                The runner will iterate through each unchecked task (<code>- [ ]</code>),
                spawning a fresh AI session for each one. Tasks are processed serially,
                ensuring each completes before the next begins.
              </p>
              <p>
                Each session starts with a clean context that's pre-loaded with the
                project instructions and all requisite information to work intelligently—without
                carrying over context from previous tasks. This isolation prevents
                cross-contamination between tasks while keeping each agent fully informed.
              </p>
              <p>
                The scratchpad file is passed to the AI via the <code>$$SCRATCHPAD$$</code> placeholder,
                so the agent can read and modify tasks directly.
              </p>
            </div>
          </section>

          {/* History Logs */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <h3 className="font-bold">History & Tracking</h3>
            </div>
            <div
              className="text-sm space-y-2 pl-7"
              style={{ color: theme.colors.textDim }}
            >
              <p>
                Each completed task is logged to the <strong style={{ color: theme.colors.textMain }}>History</strong> panel
                with an <span style={{ color: theme.colors.warning }}>AUTO</span> label.
              </p>
              <p>
                History entries include a session ID pill that you can click to jump directly
                to that AI conversation, allowing you to review what the agent did.
              </p>
              <p>
                Use <code>/synopsis</code> to manually add summaries, or <code>/clear</code> to
                capture a synopsis before starting fresh.
              </p>
            </div>
          </section>

          {/* Read-Only Mode */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-5 h-5" style={{ color: theme.colors.warning }} />
              <h3 className="font-bold">Read-Only Mode</h3>
            </div>
            <div
              className="text-sm space-y-2 pl-7"
              style={{ color: theme.colors.textDim }}
            >
              <p>
                While automation is running, the AI interpreter operates in{' '}
                <strong style={{ color: theme.colors.warning }}>read-only/plan mode</strong>.
              </p>
              <p>
                You can still send messages to the AI, but it will only be able to read and plan—not
                make changes. This prevents conflicts between your manual interactions and the
                automated tasks.
              </p>
              <p>
                The input area will show a <span style={{ color: theme.colors.warning }}>READ-ONLY</span> indicator
                and have a subtle warning background to remind you of this mode.
              </p>
            </div>
          </section>

          {/* Stopping */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Square className="w-5 h-5" style={{ color: theme.colors.error }} />
              <h3 className="font-bold">Stopping the Runner</h3>
            </div>
            <div
              className="text-sm space-y-2 pl-7"
              style={{ color: theme.colors.textDim }}
            >
              <p>
                You can request a stop at any time by clicking the{' '}
                <strong style={{ color: theme.colors.error }}>Stop</strong> button in the header
                or scratchpad.
              </p>
              <p>
                The runner will complete the current task before stopping gracefully.
                This ensures no work is left in an incomplete state.
              </p>
              <p>
                Any completed tasks will remain checked, and you can resume later by
                clicking Run again.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-4 border-t"
          style={{ borderColor: theme.colors.border }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium transition-colors hover:opacity-90"
            style={{
              backgroundColor: theme.colors.accent,
              color: 'white'
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
