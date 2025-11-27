/**
 * CommandInputBar - Sticky bottom input bar for mobile web interface
 *
 * A touch-friendly command input component that stays fixed at the bottom
 * of the viewport and properly handles mobile keyboard appearance.
 *
 * Features:
 * - Always visible at bottom of screen
 * - Adjusts position when mobile keyboard appears (using visualViewport API)
 * - Supports safe area insets for notched devices
 * - Disabled state when disconnected or offline
 * - Large touch-friendly textarea for easy mobile input
 * - Auto-expanding textarea for multi-line commands (up to 4 lines)
 * - Minimum 44px touch targets per Apple HIG guidelines
 * - Mode toggle button (AI / Terminal) with visual indicator
 * - Interrupt button (red X) visible when session is busy
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useThemeColors } from '../components/ThemeProvider';

/** Minimum touch target size per Apple HIG guidelines (44pt) */
const MIN_TOUCH_TARGET = 44;

/** Default minimum height for the text input area */
const MIN_INPUT_HEIGHT = 48;

/** Line height for text calculations */
const LINE_HEIGHT = 22;

/** Maximum number of lines before scrolling */
const MAX_LINES = 4;

/** Vertical padding inside textarea (top + bottom) */
const TEXTAREA_VERTICAL_PADDING = 28; // 14px top + 14px bottom

/** Maximum height for textarea based on max lines */
const MAX_TEXTAREA_HEIGHT = LINE_HEIGHT * MAX_LINES + TEXTAREA_VERTICAL_PADDING;

/** Input mode type - AI assistant or terminal */
export type InputMode = 'ai' | 'terminal';

export interface CommandInputBarProps {
  /** Whether the device is offline */
  isOffline: boolean;
  /** Whether connected to the server */
  isConnected: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Callback when command is submitted */
  onSubmit?: (command: string) => void;
  /** Callback when input value changes */
  onChange?: (value: string) => void;
  /** Current input value (controlled) */
  value?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Current input mode (AI or terminal) */
  inputMode?: InputMode;
  /** Callback when input mode is toggled */
  onModeToggle?: (mode: InputMode) => void;
  /** Whether the active session is busy (AI thinking) */
  isSessionBusy?: boolean;
  /** Callback when interrupt button is pressed */
  onInterrupt?: () => void;
}

/**
 * CommandInputBar component
 *
 * Provides a sticky bottom input bar optimized for mobile devices.
 * Uses the Visual Viewport API to stay above the keyboard.
 */
export function CommandInputBar({
  isOffline,
  isConnected,
  placeholder,
  onSubmit,
  onChange,
  value: controlledValue,
  disabled: externalDisabled,
  inputMode = 'ai',
  onModeToggle,
  isSessionBusy = false,
  onInterrupt,
}: CommandInputBarProps) {
  const colors = useThemeColors();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track keyboard visibility for positioning
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Track textarea height for auto-expansion
  const [textareaHeight, setTextareaHeight] = useState(MIN_INPUT_HEIGHT);

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Determine if input should be disabled
  const isDisabled = externalDisabled || isOffline || !isConnected;

  // Get placeholder text based on state
  const getPlaceholder = () => {
    if (isOffline) return 'Offline...';
    if (!isConnected) return 'Connecting...';
    return placeholder || 'Enter command...';
  };

  /**
   * Auto-resize textarea based on content
   * Expands up to MAX_LINES (4 lines) then enables scrolling
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to minimum to get accurate scrollHeight measurement
    textarea.style.height = `${MIN_INPUT_HEIGHT}px`;

    // Calculate the new height based on content
    const scrollHeight = textarea.scrollHeight;

    // Clamp height between minimum and maximum
    const newHeight = Math.min(Math.max(scrollHeight, MIN_INPUT_HEIGHT), MAX_TEXTAREA_HEIGHT);

    setTextareaHeight(newHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  /**
   * Handle Visual Viewport resize for keyboard detection
   * This is the modern way to handle mobile keyboard appearance
   */
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // Calculate the offset caused by keyboard
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const offset = windowHeight - viewportHeight - viewport.offsetTop;

      // Only update if there's a significant change (keyboard appearing/disappearing)
      if (offset > 50) {
        setKeyboardOffset(offset);
        setIsKeyboardVisible(true);
      } else {
        setKeyboardOffset(0);
        setIsKeyboardVisible(false);
      }
    };

    const handleScroll = () => {
      // Re-adjust on scroll to keep the bar in view
      if (containerRef.current && isKeyboardVisible) {
        // Force the container to stay at the bottom of the visible area
        handleResize();
      }
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleScroll);

    // Initial check
    handleResize();

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [isKeyboardVisible]);

  /**
   * Handle textarea change
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [controlledValue, onChange]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim() || isDisabled) return;

      onSubmit?.(value.trim());

      // Clear input after submit (for uncontrolled mode)
      if (controlledValue === undefined) {
        setInternalValue('');
      }

      // Keep focus on textarea after submit
      textareaRef.current?.focus();
    },
    [value, isDisabled, onSubmit, controlledValue]
  );

  /**
   * Handle key press events
   * Enter submits, Shift+Enter adds a newline
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (Shift+Enter adds newline for multi-line input)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  /**
   * Handle mode toggle between AI and Terminal
   */
  const handleModeToggle = useCallback(() => {
    const newMode = inputMode === 'ai' ? 'terminal' : 'ai';
    onModeToggle?.(newMode);
  }, [inputMode, onModeToggle]);

  /**
   * Handle interrupt button press
   */
  const handleInterrupt = useCallback(() => {
    onInterrupt?.();
  }, [onInterrupt]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: keyboardOffset,
        zIndex: 100,
        // Safe area padding for notched devices
        paddingBottom: isKeyboardVisible ? '0' : 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingTop: '12px',
        backgroundColor: colors.bgSidebar,
        borderTop: `1px solid ${colors.border}`,
        // Smooth transition when keyboard appears/disappears
        transition: isKeyboardVisible ? 'none' : 'bottom 0.15s ease-out',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end', // Align to bottom for multi-line textarea
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        {/* Mode toggle button - AI / Terminal */}
        <button
          type="button"
          onClick={handleModeToggle}
          disabled={isDisabled}
          style={{
            padding: '10px',
            borderRadius: '12px',
            backgroundColor: inputMode === 'ai' ? `${colors.accent}20` : `${colors.textDim}20`,
            border: `2px solid ${inputMode === 'ai' ? colors.accent : colors.textDim}`,
            cursor: isDisabled ? 'default' : 'pointer',
            opacity: isDisabled ? 0.5 : 1,
            // Touch-friendly size - meets Apple HIG 44pt minimum
            width: `${MIN_TOUCH_TARGET + 4}px`,
            height: `${MIN_INPUT_HEIGHT}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            // Smooth transitions
            transition: 'all 150ms ease',
            // Prevent button from shrinking
            flexShrink: 0,
            // Active state feedback
            WebkitTapHighlightColor: 'transparent',
          }}
          onTouchStart={(e) => {
            if (!isDisabled) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          aria-label={`Switch to ${inputMode === 'ai' ? 'terminal' : 'AI'} mode. Currently in ${inputMode === 'ai' ? 'AI' : 'terminal'} mode.`}
          aria-pressed={inputMode === 'ai'}
        >
          {/* Mode icon - AI sparkle or Terminal prompt */}
          {inputMode === 'ai' ? (
            // AI sparkle icon
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v2M12 19v2M5.64 5.64l1.42 1.42M16.95 16.95l1.41 1.41M3 12h2M19 12h2M5.64 18.36l1.42-1.42M16.95 7.05l1.41-1.41" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          ) : (
            // Terminal prompt icon
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.textDim}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          )}
          {/* Mode label */}
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: inputMode === 'ai' ? colors.accent : colors.textDim,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {inputMode === 'ai' ? 'AI' : 'CLI'}
          </span>
        </button>

        {/* Large touch-friendly command textarea with auto-expansion */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={isDisabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          rows={1}
          style={{
            flex: 1,
            // Large touch-friendly padding (minimum 12px, but larger for comfort)
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: colors.bgMain,
            border: `2px solid ${colors.border}`,
            color: isDisabled ? colors.textDim : colors.textMain,
            // 16px minimum prevents iOS zoom on focus, 17px for better readability
            fontSize: '17px',
            fontFamily: 'inherit',
            lineHeight: `${LINE_HEIGHT}px`,
            opacity: isDisabled ? 0.5 : 1,
            outline: 'none',
            // Dynamic height for auto-expansion (controlled by useEffect)
            height: `${textareaHeight}px`,
            // Large minimum height for easy touch targeting
            minHeight: `${MIN_INPUT_HEIGHT}px`,
            // Maximum height based on MAX_LINES (4 lines) before scrolling
            maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
            // Reset appearance for consistent styling
            WebkitAppearance: 'none',
            appearance: 'none',
            // Remove default textarea resize handle
            resize: 'none',
            // Smooth height transitions for auto-expansion
            transition: 'height 100ms ease-out, border-color 150ms ease, opacity 150ms ease, box-shadow 150ms ease',
            // Better text rendering on mobile
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            // Enable scrolling only when content exceeds max height
            overflowY: textareaHeight >= MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden',
            overflowX: 'hidden',
            wordWrap: 'break-word',
          }}
          onFocus={(e) => {
            // Add focus ring for accessibility
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}33`;
          }}
          onBlur={(e) => {
            // Remove focus ring
            e.currentTarget.style.borderColor = colors.border;
            e.currentTarget.style.boxShadow = 'none';
          }}
          aria-label="Command input"
          aria-disabled={isDisabled}
          aria-multiline="true"
        />

        {/* Interrupt button - visible when session is busy (red X) */}
        {isSessionBusy && (
          <button
            type="button"
            onClick={handleInterrupt}
            disabled={isDisabled}
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#ef4444', // Red color for interrupt
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              // Touch-friendly size - meets Apple HIG 44pt minimum
              width: `${MIN_TOUCH_TARGET + 4}px`,
              height: `${MIN_INPUT_HEIGHT}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Smooth transitions
              transition: 'opacity 150ms ease, background-color 150ms ease, transform 100ms ease',
              // Prevent button from shrinking
              flexShrink: 0,
              // Active state feedback
              WebkitTapHighlightColor: 'transparent',
            }}
            onTouchStart={(e) => {
              // Scale down slightly on touch for tactile feedback
              if (!isDisabled) {
                e.currentTarget.style.transform = 'scale(0.95)';
                e.currentTarget.style.backgroundColor = '#dc2626'; // Darker red on press
              }
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = '#ef4444';
            }}
            aria-label="Interrupt session"
          >
            {/* X icon for interrupt - larger for touch */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Send button - large touch target matching input height */}
        <button
          type="submit"
          disabled={isDisabled || !value.trim()}
          style={{
            padding: '14px',
            borderRadius: '12px',
            backgroundColor: colors.accent,
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: isDisabled || !value.trim() ? 'default' : 'pointer',
            opacity: isDisabled || !value.trim() ? 0.5 : 1,
            // Touch-friendly size - meets Apple HIG 44pt minimum
            width: `${MIN_TOUCH_TARGET + 4}px`,
            height: `${MIN_INPUT_HEIGHT}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Smooth transitions
            transition: 'opacity 150ms ease, background-color 150ms ease, transform 100ms ease',
            // Prevent button from shrinking
            flexShrink: 0,
            // Active state feedback
            WebkitTapHighlightColor: 'transparent',
          }}
          onTouchStart={(e) => {
            // Scale down slightly on touch for tactile feedback
            if (!isDisabled && value.trim()) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          aria-label="Send command"
        >
          {/* Arrow up icon for send - larger for touch */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default CommandInputBar;
