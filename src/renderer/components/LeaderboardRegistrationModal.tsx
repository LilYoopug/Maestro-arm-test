/**
 * LeaderboardRegistrationModal.tsx
 *
 * Modal for registering to the runmaestro.ai leaderboard.
 * Users provide display name, email (required), and optional social handles.
 * On submission, stats are sent to the API and email confirmation is required.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Trophy, Mail, User, Loader2, Check, AlertCircle, ExternalLink, UserX, Key, RefreshCw } from 'lucide-react';
import type { Theme, AutoRunStats, LeaderboardRegistration } from '../types';
import { useLayerStack } from '../contexts/LayerStackContext';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { getBadgeForTime, CONDUCTOR_BADGES } from '../constants/conductorBadges';

// Social media icons as SVG components
const GithubIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const XTwitterIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface LeaderboardRegistrationModalProps {
  theme: Theme;
  autoRunStats: AutoRunStats;
  existingRegistration: LeaderboardRegistration | null;
  onClose: () => void;
  onSave: (registration: LeaderboardRegistration) => void;
  onOptOut: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'awaiting_confirmation' | 'polling' | 'error' | 'opted_out';

// Generate a random client token for polling
function generateClientToken(): string {
  return crypto.randomUUID();
}

// Error message for lost auth token
const AUTH_TOKEN_LOST_MESSAGE = 'Your email is confirmed but we seem to have lost your auth token. Please contact pedram@runmaestro.ai to resolve this issue or ping him on Discord.';

export function LeaderboardRegistrationModal({
  theme,
  autoRunStats,
  existingRegistration,
  onClose,
  onSave,
  onOptOut,
}: LeaderboardRegistrationModalProps) {
  const { registerLayer, unregisterLayer } = useLayerStack();
  const layerIdRef = useRef<string>();
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Form state
  const [displayName, setDisplayName] = useState(existingRegistration?.displayName || '');
  const [email, setEmail] = useState(existingRegistration?.email || '');
  const [twitterHandle, setTwitterHandle] = useState(existingRegistration?.twitterHandle || '');
  const [githubUsername, setGithubUsername] = useState(existingRegistration?.githubUsername || '');
  const [linkedinHandle, setLinkedinHandle] = useState(existingRegistration?.linkedinHandle || '');

  // Submission state
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);

  // Polling state - generate clientToken once if not already persisted
  const [clientToken] = useState(() => existingRegistration?.clientToken || generateClientToken());
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual token entry state
  const [showManualTokenEntry, setShowManualTokenEntry] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Get current badge info
  const currentBadge = getBadgeForTime(autoRunStats.cumulativeTimeMs);
  const badgeLevel = currentBadge?.level || 0;
  const badgeName = currentBadge?.name || 'No Badge Yet';

  // Check if we need to recover auth token (email confirmed but no token)
  const needsAuthTokenRecovery = existingRegistration?.emailConfirmed && !existingRegistration?.authToken && existingRegistration?.clientToken;

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = displayName.trim().length > 0 && email.trim().length > 0 && isValidEmail(email);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Poll for auth token
  const pollForAuthToken = useCallback(async (token: string) => {
    try {
      const result = await window.maestro.leaderboard.pollAuthStatus(token);

      if (result.status === 'confirmed' && result.authToken) {
        stopPolling();
        // Save the auth token
        const registration: LeaderboardRegistration = {
          email: email.trim(),
          displayName: displayName.trim(),
          twitterHandle: twitterHandle.trim() || undefined,
          githubUsername: githubUsername.trim() || undefined,
          linkedinHandle: linkedinHandle.trim() || undefined,
          registeredAt: existingRegistration?.registeredAt || Date.now(),
          emailConfirmed: true,
          lastSubmissionAt: Date.now(),
          clientToken: token,
          authToken: result.authToken,
        };
        onSave(registration);
        setSubmitState('success');
        setSuccessMessage('Email confirmed! Your stats have been submitted to the leaderboard.');
      } else if (result.status === 'expired') {
        stopPolling();
        setSubmitState('error');
        setErrorMessage('Confirmation link expired. Please submit again to receive a new confirmation email.');
      } else if (result.status === 'error') {
        // Don't stop polling on transient errors, just log
        console.warn('Polling error:', result.error);
      }
      // 'pending' status - continue polling
    } catch (error) {
      console.warn('Poll request failed:', error);
      // Continue polling on network errors
    }
  }, [email, displayName, twitterHandle, githubUsername, linkedinHandle, existingRegistration, onSave, stopPolling]);

  // Start polling for confirmation
  const startPolling = useCallback((token: string) => {
    setIsPolling(true);
    setSubmitState('polling');

    // Poll immediately, then every 5 seconds
    pollForAuthToken(token);
    pollingIntervalRef.current = setInterval(() => {
      pollForAuthToken(token);
    }, 5000);
  }, [pollForAuthToken]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setSubmitState('submitting');
    setErrorMessage('');

    try {
      // Format longest run date if available
      let longestRunDate: string | undefined;
      if (autoRunStats.longestRunTimestamp > 0) {
        longestRunDate = new Date(autoRunStats.longestRunTimestamp).toISOString().split('T')[0];
      }

      const result = await window.maestro.leaderboard.submit({
        email: email.trim(),
        displayName: displayName.trim(),
        githubUsername: githubUsername.trim() || undefined,
        twitterHandle: twitterHandle.trim() || undefined,
        linkedinHandle: linkedinHandle.trim() || undefined,
        badgeLevel,
        badgeName,
        cumulativeTimeMs: autoRunStats.cumulativeTimeMs,
        totalRuns: autoRunStats.totalRuns,
        longestRunMs: autoRunStats.longestRunMs || undefined,
        longestRunDate,
        theme: theme.id,
        clientToken,
        authToken: existingRegistration?.authToken,
      });

      if (result.success) {
        // Save registration locally with clientToken (persists the token)
        const registration: LeaderboardRegistration = {
          email: email.trim(),
          displayName: displayName.trim(),
          twitterHandle: twitterHandle.trim() || undefined,
          githubUsername: githubUsername.trim() || undefined,
          linkedinHandle: linkedinHandle.trim() || undefined,
          registeredAt: existingRegistration?.registeredAt || Date.now(),
          emailConfirmed: !result.pendingEmailConfirmation,
          lastSubmissionAt: Date.now(),
          clientToken,
          authToken: existingRegistration?.authToken,
        };
        onSave(registration);

        if (result.pendingEmailConfirmation) {
          setSubmitState('awaiting_confirmation');
          setSuccessMessage('Please check your email to confirm your registration.');
          // Start polling for confirmation
          startPolling(clientToken);
        } else {
          setSubmitState('success');
          setSuccessMessage('Your stats have been submitted! Your entry is now queued for manual approval.');
        }
      } else if (result.authTokenRequired) {
        // Email is confirmed but we're missing the auth token - show manual entry
        setSubmitState('error');
        setShowManualTokenEntry(true);
        setErrorMessage(AUTH_TOKEN_LOST_MESSAGE);
      } else {
        setSubmitState('error');
        setErrorMessage(result.error || result.message || 'Submission failed');
      }
    } catch (error) {
      setSubmitState('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }, [isFormValid, email, displayName, githubUsername, twitterHandle, linkedinHandle, badgeLevel, badgeName, autoRunStats, existingRegistration, onSave, theme.id, clientToken, startPolling]);

  // Handle manual token submission
  const handleManualTokenSubmit = useCallback(async () => {
    if (!manualToken.trim()) return;

    // Save the manually entered token and retry submission
    const registration: LeaderboardRegistration = {
      email: email.trim(),
      displayName: displayName.trim(),
      twitterHandle: twitterHandle.trim() || undefined,
      githubUsername: githubUsername.trim() || undefined,
      linkedinHandle: linkedinHandle.trim() || undefined,
      registeredAt: existingRegistration?.registeredAt || Date.now(),
      emailConfirmed: true,
      lastSubmissionAt: Date.now(),
      clientToken,
      authToken: manualToken.trim(),
    };
    onSave(registration);
    setShowManualTokenEntry(false);
    setManualToken('');

    // Now submit with the token
    setSubmitState('submitting');
    try {
      let longestRunDate: string | undefined;
      if (autoRunStats.longestRunTimestamp > 0) {
        longestRunDate = new Date(autoRunStats.longestRunTimestamp).toISOString().split('T')[0];
      }

      const result = await window.maestro.leaderboard.submit({
        email: email.trim(),
        displayName: displayName.trim(),
        githubUsername: githubUsername.trim() || undefined,
        twitterHandle: twitterHandle.trim() || undefined,
        linkedinHandle: linkedinHandle.trim() || undefined,
        badgeLevel,
        badgeName,
        cumulativeTimeMs: autoRunStats.cumulativeTimeMs,
        totalRuns: autoRunStats.totalRuns,
        longestRunMs: autoRunStats.longestRunMs || undefined,
        longestRunDate,
        theme: theme.id,
        clientToken,
        authToken: manualToken.trim(),
      });

      if (result.success) {
        setSubmitState('success');
        setSuccessMessage('Your stats have been submitted! Your entry is now queued for manual approval.');
      } else {
        setSubmitState('error');
        setErrorMessage(result.error || result.message || 'Submission failed. Please check your auth token.');
      }
    } catch (error) {
      setSubmitState('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }, [manualToken, email, displayName, twitterHandle, githubUsername, linkedinHandle, existingRegistration, clientToken, onSave, autoRunStats, badgeLevel, badgeName, theme.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // On mount, if we need auth token recovery, try polling once to see if the server has our token
  useEffect(() => {
    if (needsAuthTokenRecovery && existingRegistration?.clientToken && !recoveryAttempted) {
      setRecoveryAttempted(true);
      setIsRecovering(true);
      // Try a single poll to recover the auth token
      window.maestro.leaderboard.pollAuthStatus(existingRegistration.clientToken).then((result) => {
        setIsRecovering(false);
        if (result.status === 'confirmed' && result.authToken) {
          // Token recovered! Save it
          const registration: LeaderboardRegistration = {
            ...existingRegistration,
            emailConfirmed: true,
            authToken: result.authToken,
          };
          onSave(registration);
          setSubmitState('success');
          setSuccessMessage('Auth token recovered! Your registration is complete.');
        } else {
          // Token not available from server, show manual entry
          setShowManualTokenEntry(true);
          setErrorMessage(AUTH_TOKEN_LOST_MESSAGE);
        }
      }).catch(() => {
        setIsRecovering(false);
        // On error, show manual entry as fallback
        setShowManualTokenEntry(true);
        setErrorMessage(AUTH_TOKEN_LOST_MESSAGE);
      });
    }
  }, [needsAuthTokenRecovery, existingRegistration, onSave, recoveryAttempted]);

  // Handle opt-out (clears local registration)
  const handleOptOut = useCallback(() => {
    onOptOut();
    setSubmitState('opted_out');
    setSuccessMessage('You have opted out of the leaderboard. Your local stats are preserved.');
  }, [onOptOut]);

  // Register layer on mount
  useEffect(() => {
    const id = registerLayer({
      type: 'modal',
      priority: MODAL_PRIORITIES.LEADERBOARD_REGISTRATION,
      blocksLowerLayers: true,
      capturesFocus: true,
      focusTrap: 'strict',
      ariaLabel: 'Register for Leaderboard',
      onEscape: () => onCloseRef.current(),
    });
    layerIdRef.current = id;

    containerRef.current?.focus();

    return () => {
      if (layerIdRef.current) {
        unregisterLayer(layerIdRef.current);
      }
    };
  }, [registerLayer, unregisterLayer]);

  // Handle Enter key for form submission
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && isFormValid && submitState === 'idle') {
      e.preventDefault();
      handleSubmit();
    }
  }, [isFormValid, submitState, handleSubmit]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 modal-overlay flex items-center justify-center z-[9999] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Register for Leaderboard"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-[480px] max-h-[90vh] border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: theme.colors.bgSidebar, borderColor: theme.colors.border }}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: '#FFD700' }} />
            <h2 className="text-sm font-bold" style={{ color: theme.colors.textMain }}>
              {existingRegistration ? 'Update Leaderboard Registration' : 'Register for Leaderboard'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: theme.colors.textDim }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Info text */}
          <p className="text-sm" style={{ color: theme.colors.textDim }}>
            Join the global Maestro leaderboard at{' '}
            <button
              onClick={() => window.maestro.shell.openExternal('https://runmaestro.ai')}
              className="inline-flex items-center gap-1 hover:underline"
              style={{ color: theme.colors.accent }}
            >
              runmaestro.ai
              <ExternalLink className="w-3 h-3" />
            </button>
            . Your cumulative AutoRun time and achievements will be displayed.
          </p>

          {/* Current stats preview */}
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: theme.colors.bgActivity, border: `1px solid ${theme.colors.border}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4" style={{ color: '#FFD700' }} />
              <span className="text-xs font-medium" style={{ color: theme.colors.textMain }}>Your Current Stats</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span style={{ color: theme.colors.textDim }}>Badge: </span>
                <span className="font-medium" style={{ color: theme.colors.accent }}>{badgeName}</span>
              </div>
              <div>
                <span style={{ color: theme.colors.textDim }}>Total Runs: </span>
                <span className="font-medium" style={{ color: theme.colors.textMain }}>{autoRunStats.totalRuns}</span>
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            {/* Display Name - Required */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium mb-1.5" style={{ color: theme.colors.textMain }}>
                <User className="w-3.5 h-3.5" />
                Display Name <span style={{ color: theme.colors.error }}>*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ConductorPedram"
                className="w-full px-3 py-2 text-sm rounded border outline-none focus:ring-1"
                style={{
                  backgroundColor: theme.colors.bgActivity,
                  borderColor: theme.colors.border,
                  color: theme.colors.textMain,
                }}
                disabled={submitState === 'submitting'}
              />
            </div>

            {/* Email - Required */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium mb-1.5" style={{ color: theme.colors.textMain }}>
                <Mail className="w-3.5 h-3.5" />
                Email Address <span style={{ color: theme.colors.error }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="conductor@maestro.ai"
                className="w-full px-3 py-2 text-sm rounded border outline-none focus:ring-1"
                style={{
                  backgroundColor: theme.colors.bgActivity,
                  borderColor: email && !isValidEmail(email) ? theme.colors.error : theme.colors.border,
                  color: theme.colors.textMain,
                }}
                disabled={submitState === 'submitting'}
              />
              {email && !isValidEmail(email) && (
                <p className="text-xs mt-1" style={{ color: theme.colors.error }}>
                  Please enter a valid email address
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: theme.colors.textDim }}>
                Your email is kept private and will not be displayed on the leaderboard
              </p>
            </div>

            {/* Social handles - Optional */}
            <div className="pt-2 border-t" style={{ borderColor: theme.colors.border }}>
              <p className="text-xs font-medium mb-3" style={{ color: theme.colors.textDim }}>
                Optional: Link your social profiles
              </p>

              <div className="space-y-3">
                {/* GitHub */}
                <div className="flex items-center gap-2">
                  <GithubIcon className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} />
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value.replace(/^@/, ''))}
                    placeholder="username"
                    className="flex-1 px-3 py-1.5 text-sm rounded border outline-none focus:ring-1"
                    style={{
                      backgroundColor: theme.colors.bgActivity,
                      borderColor: theme.colors.border,
                      color: theme.colors.textMain,
                    }}
                    disabled={submitState === 'submitting'}
                  />
                </div>

                {/* X/Twitter */}
                <div className="flex items-center gap-2">
                  <XTwitterIcon className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} />
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ''))}
                    placeholder="handle"
                    className="flex-1 px-3 py-1.5 text-sm rounded border outline-none focus:ring-1"
                    style={{
                      backgroundColor: theme.colors.bgActivity,
                      borderColor: theme.colors.border,
                      color: theme.colors.textMain,
                    }}
                    disabled={submitState === 'submitting'}
                  />
                </div>

                {/* LinkedIn */}
                <div className="flex items-center gap-2">
                  <LinkedInIcon className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textDim }} />
                  <input
                    type="text"
                    value={linkedinHandle}
                    onChange={(e) => setLinkedinHandle(e.target.value.replace(/^@/, ''))}
                    placeholder="username"
                    className="flex-1 px-3 py-1.5 text-sm rounded border outline-none focus:ring-1"
                    style={{
                      backgroundColor: theme.colors.bgActivity,
                      borderColor: theme.colors.border,
                      color: theme.colors.textMain,
                    }}
                    disabled={submitState === 'submitting'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status messages */}
          {submitState === 'error' && !showManualTokenEntry && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ backgroundColor: `${theme.colors.error}15`, border: `1px solid ${theme.colors.error}30` }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.colors.error }} />
              <p className="text-xs" style={{ color: theme.colors.error }}>{errorMessage}</p>
            </div>
          )}

          {/* Recovering auth token status */}
          {isRecovering && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ backgroundColor: `${theme.colors.accent}15`, border: `1px solid ${theme.colors.accent}30` }}
            >
              <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" style={{ color: theme.colors.accent }} />
              <p className="text-xs" style={{ color: theme.colors.textMain }}>
                Checking for your auth token...
              </p>
            </div>
          )}

          {/* Polling status */}
          {(submitState === 'awaiting_confirmation' || submitState === 'polling') && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ backgroundColor: `${theme.colors.accent}15`, border: `1px solid ${theme.colors.accent}30` }}
            >
              <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" style={{ color: theme.colors.accent }} />
              <div className="flex-1">
                <p className="text-xs" style={{ color: theme.colors.textMain }}>
                  {successMessage || 'Waiting for email confirmation...'}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.colors.textDim }}>
                  Click the link in your email to complete registration. This will update automatically.
                </p>
              </div>
            </div>
          )}

          {/* Manual token entry */}
          {showManualTokenEntry && (
            <>
              {/* Error/info message above token entry */}
              {errorMessage && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ backgroundColor: `${theme.colors.error}15`, border: `1px solid ${theme.colors.error}30` }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.colors.error }} />
                  <p className="text-xs" style={{ color: theme.colors.error }}>{errorMessage}</p>
                </div>
              )}
              <div
                className="p-3 rounded-lg space-y-3"
                style={{ backgroundColor: `${theme.colors.accent}10`, border: `1px solid ${theme.colors.accent}30` }}
              >
                <div className="flex items-start gap-2">
                  <Key className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.colors.accent }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: theme.colors.textMain }}>
                      Enter Auth Token
                    </p>
                    <p className="text-xs mt-1" style={{ color: theme.colors.textDim }}>
                      Copy the token from your confirmation email or the confirmation page.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste your 64-character auth token"
                    className="flex-1 px-3 py-2 text-xs rounded border outline-none focus:ring-1 font-mono"
                    style={{
                      backgroundColor: theme.colors.bgActivity,
                      borderColor: theme.colors.border,
                      color: theme.colors.textMain,
                    }}
                  />
                  <button
                    onClick={handleManualTokenSubmit}
                    disabled={!manualToken.trim()}
                    className="px-3 py-2 text-xs font-medium rounded transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: '#fff',
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </>
          )}

          {(submitState === 'success' || submitState === 'opted_out') && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ backgroundColor: `${theme.colors.success}15`, border: `1px solid ${theme.colors.success}30` }}
            >
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.colors.success }} />
              <p className="text-xs" style={{ color: theme.colors.success }}>{successMessage}</p>
            </div>
          )}

          {/* Opt-out confirmation */}
          {showOptOutConfirm && submitState === 'idle' && (
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${theme.colors.error}10`, border: `1px solid ${theme.colors.error}30` }}
            >
              <p className="text-xs mb-3" style={{ color: theme.colors.textMain }}>
                Are you sure you want to remove yourself from the leaderboard? This will request removal of your entry from runmaestro.ai.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowOptOutConfirm(false)}
                  className="px-3 py-1.5 text-xs rounded hover:bg-white/10 transition-colors"
                  style={{ color: theme.colors.textDim }}
                >
                  Keep Registration
                </button>
                <button
                  onClick={handleOptOut}
                  className="px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: theme.colors.error,
                    color: '#fff',
                  }}
                >
                  <UserX className="w-3.5 h-3.5" />
                  Yes, Remove Me
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between" style={{ borderColor: theme.colors.border }}>
          {/* Left side - Opt Out (only for existing registrations) */}
          <div>
            {existingRegistration && !showOptOutConfirm && submitState === 'idle' && (
              <button
                onClick={() => setShowOptOutConfirm(true)}
                className="px-3 py-2 text-xs rounded hover:bg-white/10 transition-colors flex items-center gap-1.5"
                style={{ color: theme.colors.error }}
              >
                <UserX className="w-3.5 h-3.5" />
                Opt Out
              </button>
            )}
          </div>

          {/* Right side - Cancel/Close and Submit */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                stopPolling();
                onClose();
              }}
              className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
              style={{ color: theme.colors.textDim }}
              disabled={submitState === 'submitting'}
            >
              {submitState === 'success' || submitState === 'opted_out' ? 'Close' :
               submitState === 'awaiting_confirmation' || submitState === 'polling' ? 'Close (Continue in Background)' : 'Cancel'}
            </button>
            {submitState !== 'success' && submitState !== 'awaiting_confirmation' && submitState !== 'polling' && submitState !== 'opted_out' && (
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || submitState === 'submitting' || showOptOutConfirm || showManualTokenEntry}
                className="px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: '#fff',
                }}
              >
                {submitState === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    {existingRegistration ? 'Update & Submit' : 'Register'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardRegistrationModal;
