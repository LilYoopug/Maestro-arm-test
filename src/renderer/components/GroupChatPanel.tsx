/**
 * GroupChatPanel.tsx
 *
 * Main container for the Group Chat view. Composes the header, messages,
 * and input components into a full chat interface. This panel replaces
 * the MainPanel when a group chat is active.
 */

import type { Theme, GroupChat, GroupChatMessage, GroupChatState, Shortcut, Session, QueuedItem } from '../types';
import { GroupChatHeader } from './GroupChatHeader';
import { GroupChatMessages } from './GroupChatMessages';
import { GroupChatInput } from './GroupChatInput';

interface GroupChatPanelProps {
  theme: Theme;
  groupChat: GroupChat;
  messages: GroupChatMessage[];
  state: GroupChatState;
  onSendMessage: (content: string, images?: string[], readOnly?: boolean) => void;
  onClose: () => void;
  onRename: () => void;
  onShowInfo: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  shortcuts: Record<string, Shortcut>;
  sessions: Session[];
  onDraftChange?: (draft: string) => void;
  onOpenPromptComposer?: () => void;
  // Lifted state for sync with PromptComposer
  stagedImages?: string[];
  setStagedImages?: React.Dispatch<React.SetStateAction<string[]>>;
  readOnlyMode?: boolean;
  setReadOnlyMode?: (value: boolean) => void;
  // External ref for focusing from keyboard handler
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  // Image paste handler from App
  handlePaste?: (e: React.ClipboardEvent) => void;
  // Image lightbox handler
  onOpenLightbox?: (image: string, contextImages?: string[]) => void;
  // Execution queue props
  executionQueue?: QueuedItem[];
  onRemoveQueuedItem?: (itemId: string) => void;
  onReorderQueuedItems?: (fromIndex: number, toIndex: number) => void;
  // Markdown toggle (Cmd+E)
  markdownEditMode?: boolean;
  onToggleMarkdownEditMode?: () => void;
  // Output collapsing
  maxOutputLines?: number;
  // Input send behavior
  enterToSendAI?: boolean;
  setEnterToSendAI?: (value: boolean) => void;
}

export function GroupChatPanel({
  theme,
  groupChat,
  messages,
  state,
  onSendMessage,
  onClose,
  onRename,
  onShowInfo,
  rightPanelOpen,
  onToggleRightPanel,
  shortcuts,
  sessions,
  onDraftChange,
  onOpenPromptComposer,
  stagedImages,
  setStagedImages,
  readOnlyMode,
  setReadOnlyMode,
  inputRef,
  handlePaste,
  onOpenLightbox,
  executionQueue,
  onRemoveQueuedItem,
  onReorderQueuedItems,
  markdownEditMode,
  onToggleMarkdownEditMode,
  maxOutputLines,
  enterToSendAI,
  setEnterToSendAI,
}: GroupChatPanelProps): JSX.Element {
  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: theme.colors.bgMain }}
    >
      <GroupChatHeader
        theme={theme}
        name={groupChat.name}
        participantCount={groupChat.participants.length}
        onClose={onClose}
        onRename={onRename}
        onShowInfo={onShowInfo}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={onToggleRightPanel}
        shortcuts={shortcuts}
      />

      <GroupChatMessages
        theme={theme}
        messages={messages}
        participants={groupChat.participants}
        state={state}
        markdownEditMode={markdownEditMode}
        onToggleMarkdownEditMode={onToggleMarkdownEditMode}
        maxOutputLines={maxOutputLines}
      />

      <GroupChatInput
        theme={theme}
        state={state}
        onSend={onSendMessage}
        participants={groupChat.participants}
        sessions={sessions}
        groupChatId={groupChat.id}
        draftMessage={groupChat.draftMessage}
        onDraftChange={onDraftChange}
        onOpenPromptComposer={onOpenPromptComposer}
        stagedImages={stagedImages}
        setStagedImages={setStagedImages}
        readOnlyMode={readOnlyMode}
        setReadOnlyMode={setReadOnlyMode}
        inputRef={inputRef}
        handlePaste={handlePaste}
        onOpenLightbox={onOpenLightbox}
        executionQueue={executionQueue}
        onRemoveQueuedItem={onRemoveQueuedItem}
        onReorderQueuedItems={onReorderQueuedItems}
        enterToSendAI={enterToSendAI}
        setEnterToSendAI={setEnterToSendAI}
      />
    </div>
  );
}
