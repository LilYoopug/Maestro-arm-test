/**
 * ParticipantCard.tsx
 *
 * Displays a single group chat participant with their status,
 * agent type, context usage, and last activity. Expandable to
 * show additional details like session ID.
 */

import { useState } from 'react';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';
import type { Theme, GroupChatParticipant, SessionState } from '../types';

interface ParticipantCardProps {
  theme: Theme;
  participant: GroupChatParticipant;
  state: SessionState;
}

export function ParticipantCard({
  theme,
  participant,
  state,
}: ParticipantCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (): string => {
    switch (state) {
      case 'busy':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      case 'connecting':
        return theme.colors.warning;
      default:
        return theme.colors.success;
    }
  };

  const getStatusLabel = (): string => {
    switch (state) {
      case 'busy':
        return 'Working';
      case 'error':
        return 'Error';
      case 'connecting':
        return 'Connecting';
      default:
        return 'Idle';
    }
  };

  const copySessionId = (): void => {
    navigator.clipboard.writeText(participant.sessionId);
  };

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: theme.colors.bgMain,
        borderColor: theme.colors.border,
      }}
    >
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown
              className="w-4 h-4"
              style={{ color: theme.colors.textDim }}
            />
          ) : (
            <ChevronRight
              className="w-4 h-4"
              style={{ color: theme.colors.textDim }}
            />
          )}
          <span
            className="font-medium"
            style={{ color: theme.colors.textMain }}
          >
            {participant.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getStatusColor() }}
            title={getStatusLabel()}
          />
        </div>
      </div>

      {/* Agent type */}
      <div
        className="text-xs mt-1 ml-6"
        style={{ color: theme.colors.textDim }}
      >
        {participant.agentId}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 ml-6 space-y-2">
          {/* Session ID */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{
                backgroundColor: theme.colors.border,
                color: theme.colors.textDim,
              }}
            >
              {participant.sessionId.slice(0, 8)}...
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copySessionId();
              }}
              className="p-1 rounded hover:opacity-80"
              style={{ color: theme.colors.textDim }}
              title="Copy session ID"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* Context usage bar */}
          {participant.contextUsage !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs"
                  style={{ color: theme.colors.textDim }}
                >
                  Context
                </span>
                <span
                  className="text-xs"
                  style={{ color: theme.colors.textDim }}
                >
                  {participant.contextUsage}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: theme.colors.border }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${participant.contextUsage}%`,
                    backgroundColor:
                      participant.contextUsage > 80
                        ? theme.colors.warning
                        : theme.colors.accent,
                  }}
                />
              </div>
            </div>
          )}

          {/* Last activity summary */}
          {participant.lastSummary && (
            <div>
              <span
                className="text-xs"
                style={{ color: theme.colors.textDim }}
              >
                Last: {participant.lastSummary}
              </span>
            </div>
          )}

          {/* Last activity time */}
          {participant.lastActivity && (
            <div
              className="text-xs"
              style={{ color: theme.colors.textDim }}
            >
              {new Date(participant.lastActivity).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
