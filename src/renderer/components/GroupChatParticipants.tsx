/**
 * GroupChatParticipants.tsx
 *
 * Right panel component that displays all participants in a group chat.
 * Shows participant cards with their status, agent type, and context usage.
 * This panel replaces the RightPanel when a group chat is active.
 */

import type { Theme, GroupChatParticipant, SessionState } from '../types';
import { ParticipantCard } from './ParticipantCard';

interface GroupChatParticipantsProps {
  theme: Theme;
  participants: GroupChatParticipant[];
  participantStates: Map<string, SessionState>;
}

export function GroupChatParticipants({
  theme,
  participants,
  participantStates,
}: GroupChatParticipantsProps): JSX.Element {
  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: theme.colors.bgSidebar }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: theme.colors.border }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: theme.colors.textMain }}
        >
          Participants
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {participants.length === 0 ? (
          <div
            className="text-sm text-center py-4"
            style={{ color: theme.colors.textDim }}
          >
            No participants yet.
            <br />
            Ask the moderator to add agents.
          </div>
        ) : (
          participants.map((participant) => (
            <ParticipantCard
              key={participant.sessionId}
              theme={theme}
              participant={participant}
              state={participantStates.get(participant.sessionId) || 'idle'}
            />
          ))
        )}
      </div>
    </div>
  );
}
