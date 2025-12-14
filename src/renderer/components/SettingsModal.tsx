import React, { useState, useEffect, useRef, memo } from 'react';
import { X, Key, Moon, Sun, Keyboard, Check, Terminal, Bell, Cpu, Settings, Palette, Sparkles, History, Download } from 'lucide-react';
import type { AgentConfig, Theme, Shortcut, ShellInfo, CustomAICommand } from '../types';
import { useLayerStack } from '../contexts/LayerStackContext';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { AICommandsPanel } from './AICommandsPanel';
import { formatShortcutKeys } from '../utils/shortcutFormatter';
import { ToggleButtonGroup, ToggleButtonOption } from './ToggleButtonGroup';
import { SettingCheckbox } from './SettingCheckbox';
import { AgentSelectionPanel } from './AgentSelectionPanel';
import { FontConfigurationPanel } from './FontConfigurationPanel';
import { NotificationsPanel } from './NotificationsPanel';

// Feature flags - set to true to enable dormant features
const FEATURE_FLAGS = {
  LLM_SETTINGS: false,  // LLM provider configuration (OpenRouter, Anthropic, Ollama)
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  themes: Record<string, Theme>;
  activeThemeId: string;
  setActiveThemeId: (id: string) => void;
  llmProvider: string;
  setLlmProvider: (provider: string) => void;
  modelSlug: string;
  setModelSlug: (slug: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  shortcuts: Record<string, Shortcut>;
  setShortcuts: (shortcuts: Record<string, Shortcut>) => void;
  defaultAgent: string;
  setDefaultAgent: (agentId: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  terminalWidth: number;
  setTerminalWidth: (width: number) => void;
  logLevel: string;
  setLogLevel: (level: string) => void;
  maxLogBuffer: number;
  setMaxLogBuffer: (buffer: number) => void;
  maxOutputLines: number;
  setMaxOutputLines: (lines: number) => void;
  defaultShell: string;
  setDefaultShell: (shell: string) => void;
  ghPath: string;
  setGhPath: (path: string) => void;
  enterToSendAI: boolean;
  setEnterToSendAI: (value: boolean) => void;
  enterToSendTerminal: boolean;
  setEnterToSendTerminal: (value: boolean) => void;
  defaultSaveToHistory: boolean;
  setDefaultSaveToHistory: (value: boolean) => void;
  osNotificationsEnabled: boolean;
  setOsNotificationsEnabled: (value: boolean) => void;
  audioFeedbackEnabled: boolean;
  setAudioFeedbackEnabled: (value: boolean) => void;
  audioFeedbackCommand: string;
  setAudioFeedbackCommand: (value: string) => void;
  toastDuration: number;
  setToastDuration: (value: number) => void;
  checkForUpdatesOnStartup: boolean;
  setCheckForUpdatesOnStartup: (value: boolean) => void;
  customAICommands: CustomAICommand[];
  setCustomAICommands: (commands: CustomAICommand[]) => void;
  initialTab?: 'general' | 'llm' | 'shortcuts' | 'theme' | 'notifications' | 'aicommands';
  hasNoAgents?: boolean;
}

export const SettingsModal = memo(function SettingsModal(props: SettingsModalProps) {
  const { isOpen, onClose, theme, themes, initialTab } = props;
  const [activeTab, setActiveTab] = useState<'general' | 'llm' | 'shortcuts' | 'theme' | 'notifications' | 'aicommands'>('general');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [fontLoading, setFontLoading] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentConfigs, setAgentConfigs] = useState<Record<string, Record<string, any>>>({});
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [shortcutsFilter, setShortcutsFilter] = useState('');
  const [testingLLM, setTestingLLM] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error' | null; message: string }>({ status: null, message: '' });
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [shellsLoading, setShellsLoading] = useState(false);
  const [shellsLoaded, setShellsLoaded] = useState(false);
  const [customAgentPaths, setCustomAgentPaths] = useState<Record<string, string>>({});

  // Layer stack integration
  const { registerLayer, unregisterLayer, updateLayerHandler } = useLayerStack();
  const layerIdRef = useRef<string>();
  const shortcutsFilterRef = useRef<HTMLInputElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAgents();
      // Don't load fonts immediately - only when user interacts with font selector
      // Set initial tab if provided, otherwise default to 'general'
      setActiveTab(initialTab || 'general');
    }
  }, [isOpen, initialTab]);

  // Store onClose in a ref to avoid re-registering layer when onClose changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Register layer when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const id = registerLayer({
      type: 'modal',
      priority: MODAL_PRIORITIES.SETTINGS,
      blocksLowerLayers: true,
      capturesFocus: true,
      focusTrap: 'strict',
      ariaLabel: 'Settings',
      onEscape: () => {
        // If recording a shortcut, cancel recording instead of closing modal
        if (recordingId) {
          setRecordingId(null);
        } else {
          onCloseRef.current();
        }
      }
    });

    layerIdRef.current = id;

    return () => {
      if (layerIdRef.current) {
        unregisterLayer(layerIdRef.current);
      }
    };
  }, [isOpen, registerLayer, unregisterLayer]); // Removed onClose from deps

  // Update handler when dependencies change
  useEffect(() => {
    if (!isOpen || !layerIdRef.current) return;

    updateLayerHandler(layerIdRef.current, () => {
      // If recording a shortcut, cancel recording instead of closing modal
      if (recordingId) {
        setRecordingId(null);
      } else {
        onCloseRef.current();
      }
    });
  }, [isOpen, recordingId, updateLayerHandler]); // Use ref for onClose

  // Tab navigation with Cmd+Shift+[ and ]
  useEffect(() => {
    if (!isOpen) return;

    const handleTabNavigation = (e: KeyboardEvent) => {
      const tabs: Array<'general' | 'llm' | 'shortcuts' | 'theme' | 'notifications' | 'aicommands'> = FEATURE_FLAGS.LLM_SETTINGS
        ? ['general', 'llm', 'shortcuts', 'theme', 'notifications', 'aicommands']
        : ['general', 'shortcuts', 'theme', 'notifications', 'aicommands'];
      const currentIndex = tabs.indexOf(activeTab);

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '[') {
        e.preventDefault();
        const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        setActiveTab(tabs[prevIndex]);
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ']') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleTabNavigation);
    return () => window.removeEventListener('keydown', handleTabNavigation);
  }, [isOpen, activeTab]);

  // Focus theme picker when theme tab becomes active
  useEffect(() => {
    if (isOpen && activeTab === 'theme') {
      const timer = setTimeout(() => themePickerRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Auto-focus shortcuts filter when switching to shortcuts tab
  useEffect(() => {
    if (isOpen && activeTab === 'shortcuts') {
      // Small delay to ensure DOM is ready
      setTimeout(() => shortcutsFilterRef.current?.focus(), 50);
    }
  }, [isOpen, activeTab]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const detectedAgents = await window.maestro.agents.detect();
      setAgents(detectedAgents);

      // Load configurations for all agents
      const configs: Record<string, Record<string, any>> = {};
      for (const agent of detectedAgents) {
        const config = await window.maestro.agents.getConfig(agent.id);
        configs[agent.id] = config;
      }
      setAgentConfigs(configs);

      // Load custom paths for agents
      const paths = await window.maestro.agents.getAllCustomPaths();
      setCustomAgentPaths(paths);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFonts = async () => {
    if (fontsLoaded) return; // Don't reload if already loaded

    setFontLoading(true);
    try {
      const detected = await window.maestro.fonts.detect();
      setSystemFonts(detected);

      const savedCustomFonts = await window.maestro.settings.get('customFonts');
      if (savedCustomFonts) {
        setCustomFonts(savedCustomFonts);
      }
      setFontsLoaded(true);
    } catch (error) {
      console.error('Failed to load fonts:', error);
    } finally {
      setFontLoading(false);
    }
  };

  const handleFontInteraction = () => {
    if (!fontsLoaded && !fontLoading) {
      loadFonts();
    }
  };

  const loadShells = async () => {
    if (shellsLoaded) return; // Don't reload if already loaded

    setShellsLoading(true);
    try {
      const detected = await window.maestro.shells.detect();
      setShells(detected);
      setShellsLoaded(true);
    } catch (error) {
      console.error('Failed to load shells:', error);
    } finally {
      setShellsLoading(false);
    }
  };

  const handleShellInteraction = () => {
    if (!shellsLoaded && !shellsLoading) {
      loadShells();
    }
  };

  const addCustomFont = (font: string) => {
    if (font && !customFonts.includes(font)) {
      const newCustomFonts = [...customFonts, font];
      setCustomFonts(newCustomFonts);
      window.maestro.settings.set('customFonts', newCustomFonts);
    }
  };

  const removeCustomFont = (font: string) => {
    const newCustomFonts = customFonts.filter(f => f !== font);
    setCustomFonts(newCustomFonts);
    window.maestro.settings.set('customFonts', newCustomFonts);
  };

  const testLLMConnection = async () => {
    setTestingLLM(true);
    setTestResult({ status: null, message: '' });

    try {
      let response;
      const testPrompt = 'Respond with exactly: "Connection successful"';

      if (props.llmProvider === 'openrouter') {
        if (!props.apiKey) {
          throw new Error('API key is required for OpenRouter');
        }

        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${props.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://maestro.local',
          },
          body: JSON.stringify({
            model: props.modelSlug || 'anthropic/claude-3.5-sonnet',
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 50,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
          throw new Error('Invalid response from OpenRouter');
        }

        setTestResult({
          status: 'success',
          message: 'Successfully connected to OpenRouter!',
        });
      } else if (props.llmProvider === 'anthropic') {
        if (!props.apiKey) {
          throw new Error('API key is required for Anthropic');
        }

        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': props.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: props.modelSlug || 'claude-3-5-sonnet-20241022',
            max_tokens: 50,
            messages: [{ role: 'user', content: testPrompt }],
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.content?.[0]?.text) {
          throw new Error('Invalid response from Anthropic');
        }

        setTestResult({
          status: 'success',
          message: 'Successfully connected to Anthropic!',
        });
      } else if (props.llmProvider === 'ollama') {
        response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: props.modelSlug || 'llama3:latest',
            prompt: testPrompt,
            stream: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status}. Make sure Ollama is running locally.`);
        }

        const data = await response.json();
        if (!data.response) {
          throw new Error('Invalid response from Ollama');
        }

        setTestResult({
          status: 'success',
          message: 'Successfully connected to Ollama!',
        });
      }
    } catch (error: any) {
      setTestResult({
        status: 'error',
        message: error.message || 'Connection failed',
      });
    } finally {
      setTestingLLM(false);
    }
  };

  const handleRecord = (e: React.KeyboardEvent, actionId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Escape cancels recording without saving
    if (e.key === 'Escape') {
      setRecordingId(null);
      return;
    }

    const keys = [];
    if (e.metaKey) keys.push('Meta');
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;

    // On macOS, Alt+letter produces special characters (e.g., Alt+L = ¬, Alt+P = π)
    // Use e.code to get the physical key name when Alt is pressed
    let mainKey = e.key;
    if (e.altKey && e.code) {
      // e.code is like 'KeyL', 'KeyP', 'Digit1', etc.
      if (e.code.startsWith('Key')) {
        mainKey = e.code.replace('Key', '').toLowerCase();
      } else if (e.code.startsWith('Digit')) {
        mainKey = e.code.replace('Digit', '');
      } else {
        // For other keys like Arrow keys, use as-is
        mainKey = e.key;
      }
    }
    keys.push(mainKey);
    props.setShortcuts({
      ...props.shortcuts,
      [actionId]: { ...props.shortcuts[actionId], keys }
    });
    setRecordingId(null);
  };

  if (!isOpen) return null;

  // Group themes by mode for the ThemePicker
  const groupedThemes = Object.values(themes).reduce((acc: Record<string, Theme[]>, t: Theme) => {
    if (!acc[t.mode]) acc[t.mode] = [];
    acc[t.mode].push(t);
    return acc;
  }, {} as Record<string, Theme[]>);

  const handleThemePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      // Create ordered array: dark themes first, then light, then vibe (cycling back to dark)
      const allThemes = [...(groupedThemes['dark'] || []), ...(groupedThemes['light'] || []), ...(groupedThemes['vibe'] || [])];
      const currentIndex = allThemes.findIndex((t: Theme) => t.id === props.activeThemeId);

      let newThemeId: string;
      if (e.shiftKey) {
        // Shift+Tab: go backwards
        const prevIndex = currentIndex === 0 ? allThemes.length - 1 : currentIndex - 1;
        newThemeId = allThemes[prevIndex].id;
      } else {
        // Tab: go forward
        const nextIndex = (currentIndex + 1) % allThemes.length;
        newThemeId = allThemes[nextIndex].id;
      }
      props.setActiveThemeId(newThemeId);

      // Scroll the newly selected theme button into view
      setTimeout(() => {
        const themeButton = themePickerRef.current?.querySelector(`[data-theme-id="${newThemeId}"]`);
        themeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 0);
    }
  };

  // Theme picker JSX (not a separate component to avoid remount issues)
  const themePickerContent = (
    <div
      ref={themePickerRef}
      className="space-y-6 outline-none"
      tabIndex={0}
      onKeyDown={handleThemePickerKeyDown}
    >
      {['dark', 'light', 'vibe'].map(mode => (
        <div key={mode}>
          <div className="text-xs font-bold uppercase mb-3 flex items-center gap-2" style={{ color: theme.colors.textDim }}>
            {mode === 'dark' ? <Moon className="w-3 h-3" /> : mode === 'light' ? <Sun className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {mode} Mode
          </div>
          <div className="grid grid-cols-2 gap-3">
            {groupedThemes[mode]?.map((t: Theme) => (
              <button
                key={t.id}
                data-theme-id={t.id}
                onClick={() => props.setActiveThemeId(t.id)}
                className={`p-3 rounded-lg border text-left transition-all ${props.activeThemeId === t.id ? 'ring-2' : ''}`}
                style={{
                  borderColor: theme.colors.border,
                  backgroundColor: t.colors.bgSidebar,
                  ringColor: t.colors.accent
                }}
                tabIndex={-1}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold" style={{ color: t.colors.textMain }}>{t.name}</span>
                  {props.activeThemeId === t.id && <Check className="w-4 h-4" style={{ color: t.colors.accent }} />}
                </div>
                <div className="flex h-3 rounded overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: t.colors.bgMain }} />
                  <div className="flex-1" style={{ backgroundColor: t.colors.bgActivity }} />
                  <div className="flex-1" style={{ backgroundColor: t.colors.accent }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="w-[650px] h-[600px] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
           style={{ backgroundColor: theme.colors.bgSidebar, borderColor: theme.colors.border }}>

        <div className="flex border-b" style={{ borderColor: theme.colors.border }}>
          <button onClick={() => setActiveTab('general')} className={`px-4 py-4 text-sm font-bold border-b-2 ${activeTab === 'general' ? 'border-indigo-500' : 'border-transparent'} flex items-center gap-2`} tabIndex={-1} title="General">
            <Settings className="w-4 h-4" />
            {activeTab === 'general' && <span>General</span>}
          </button>
          {FEATURE_FLAGS.LLM_SETTINGS && (
            <button onClick={() => setActiveTab('llm')} className={`px-4 py-4 text-sm font-bold border-b-2 ${activeTab === 'llm' ? 'border-indigo-500' : 'border-transparent'}`} tabIndex={-1} title="LLM">LLM</button>
          )}
          <button onClick={() => setActiveTab('shortcuts')} className={`px-4 py-4 text-sm font-bold border-b-2 ${activeTab === 'shortcuts' ? 'border-indigo-500' : 'border-transparent'} flex items-center gap-2`} tabIndex={-1} title="Shortcuts">
            <Keyboard className="w-4 h-4" />
            {activeTab === 'shortcuts' && <span>Shortcuts</span>}
          </button>
          <button onClick={() => setActiveTab('theme')} className={`px-4 py-4 text-sm font-bold border-b-2 ${activeTab === 'theme' ? 'border-indigo-500' : 'border-transparent'} flex items-center gap-2`} tabIndex={-1} title="Themes">
            <Palette className="w-4 h-4" />
            {activeTab === 'theme' && <span>Themes</span>}
          </button>
          <button onClick={() => setActiveTab('notifications')} className={`px-4 py-4 text-sm font-bold border-b-2 ${activeTab === 'notifications' ? 'border-indigo-500' : 'border-transparent'} flex items-center gap-2`} tabIndex={-1} title="Notifications">
            <Bell className="w-4 h-4" />
            {activeTab === 'notifications' && <span>Notify</span>}
          </button>
          <button onClick={() => setActiveTab('aicommands')} className={`px-4 py-4 text-sm font-bold border-b-2 ${activeTab === 'aicommands' ? 'border-indigo-500' : 'border-transparent'} flex items-center gap-2`} tabIndex={-1} title="AI Commands">
            <Cpu className="w-4 h-4" />
            {activeTab === 'aicommands' && <span>AI Commands</span>}
          </button>
          <div className="flex-1 flex justify-end items-center pr-4">
            <button onClick={onClose} tabIndex={-1}><X className="w-5 h-5 opacity-50 hover:opacity-100" /></button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <AgentSelectionPanel
                agents={agents}
                loading={loading}
                defaultAgent={props.defaultAgent}
                setDefaultAgent={props.setDefaultAgent}
                agentConfigs={agentConfigs}
                setAgentConfigs={setAgentConfigs}
                customAgentPaths={customAgentPaths}
                setCustomAgentPaths={setCustomAgentPaths}
                loadAgents={loadAgents}
                theme={theme}
              />

              {/* Font Family */}
              <FontConfigurationPanel
                fontFamily={props.fontFamily}
                setFontFamily={props.setFontFamily}
                systemFonts={systemFonts}
                fontsLoaded={fontsLoaded}
                fontLoading={fontLoading}
                customFonts={customFonts}
                onAddCustomFont={addCustomFont}
                onRemoveCustomFont={removeCustomFont}
                onFontInteraction={handleFontInteraction}
                theme={theme}
              />

              {/* Font Size */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">Font Size</label>
                <ToggleButtonGroup
                  options={[
                    { value: 12, label: 'Small' },
                    { value: 14, label: 'Medium' },
                    { value: 16, label: 'Large' },
                    { value: 18, label: 'X-Large' },
                  ]}
                  value={props.fontSize}
                  onChange={props.setFontSize}
                  theme={theme}
                />
              </div>

              {/* Terminal Width */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">Terminal Width (Columns)</label>
                <ToggleButtonGroup
                  options={[80, 100, 120, 160]}
                  value={props.terminalWidth}
                  onChange={props.setTerminalWidth}
                  theme={theme}
                />
              </div>

              {/* Log Level */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">System Log Level</label>
                <ToggleButtonGroup
                  options={[
                    { value: 'debug', label: 'Debug', activeColor: '#6366f1' },
                    { value: 'info', label: 'Info', activeColor: '#3b82f6' },
                    { value: 'warn', label: 'Warn', activeColor: '#f59e0b' },
                    { value: 'error', label: 'Error', activeColor: '#ef4444' },
                  ]}
                  value={props.logLevel}
                  onChange={props.setLogLevel}
                  theme={theme}
                />
                <p className="text-xs opacity-50 mt-2">
                  Higher levels show fewer logs. Debug shows all logs, Error shows only errors.
                </p>
              </div>

              {/* Max Log Buffer */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">Maximum Log Buffer</label>
                <ToggleButtonGroup
                  options={[1000, 5000, 10000, 25000]}
                  value={props.maxLogBuffer}
                  onChange={props.setMaxLogBuffer}
                  theme={theme}
                />
                <p className="text-xs opacity-50 mt-2">
                  Maximum number of log messages to keep in memory. Older logs are automatically removed.
                </p>
              </div>

              {/* Max Output Lines */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">Max Output Lines per Response</label>
                <ToggleButtonGroup
                  options={[
                    { value: 15 },
                    { value: 25 },
                    { value: 50 },
                    { value: 100 },
                    { value: Infinity, label: 'All' },
                  ]}
                  value={props.maxOutputLines}
                  onChange={props.setMaxOutputLines}
                  theme={theme}
                />
                <p className="text-xs opacity-50 mt-2">
                  Long outputs will be collapsed into a scrollable window. Set to "All" to always show full output.
                </p>
              </div>

              {/* Default Shell */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2 flex items-center gap-2">
                  <Terminal className="w-3 h-3" />
                  Default Terminal Shell
                </label>
                {shellsLoading ? (
                  <div className="text-sm opacity-50 p-2">Loading shells...</div>
                ) : (
                  <div className="space-y-2">
                    {shellsLoaded && shells.length > 0 ? (
                      shells.map((shell) => (
                        <button
                          key={shell.id}
                          disabled={!shell.available}
                          onClick={() => {
                            if (shell.available) {
                              props.setDefaultShell(shell.id);
                            }
                          }}
                          onMouseEnter={handleShellInteraction}
                          onFocus={handleShellInteraction}
                          className={`w-full text-left p-3 rounded border transition-all ${
                            props.defaultShell === shell.id ? 'ring-2' : ''
                          } ${!shell.available ? 'opacity-40 cursor-not-allowed' : 'hover:bg-opacity-10'}`}
                          style={{
                            borderColor: theme.colors.border,
                            backgroundColor: props.defaultShell === shell.id ? theme.colors.accentDim : theme.colors.bgMain,
                            ringColor: theme.colors.accent,
                            color: theme.colors.textMain,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{shell.name}</div>
                              {shell.path && (
                                <div className="text-xs opacity-50 font-mono mt-1">{shell.path}</div>
                              )}
                            </div>
                            {shell.available ? (
                              props.defaultShell === shell.id ? (
                                <Check className="w-4 h-4" style={{ color: theme.colors.accent }} />
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.success + '20', color: theme.colors.success }}>
                                  Available
                                </span>
                              )
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.error + '20', color: theme.colors.error }}>
                                Not Found
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <button
                        onClick={handleShellInteraction}
                        className="w-full text-left p-3 rounded border"
                        style={{
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.bgMain,
                          color: theme.colors.textMain,
                        }}
                      >
                        Click to detect available shells...
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs opacity-50 mt-2">
                  Choose which shell to use for terminal sessions. Only available shells are shown.
                </p>
              </div>

              {/* GitHub CLI Path */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2 flex items-center gap-2">
                  <Terminal className="w-3 h-3" />
                  GitHub CLI (gh) Path
                </label>
                <div className="p-3 rounded border" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain }}>
                  <label className="block text-xs opacity-60 mb-1">Custom Path (optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={props.ghPath}
                      onChange={(e) => props.setGhPath(e.target.value)}
                      placeholder="/opt/homebrew/bin/gh"
                      className="flex-1 p-1.5 rounded border bg-transparent outline-none text-xs font-mono"
                      style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
                    />
                    {props.ghPath && (
                      <button
                        onClick={() => props.setGhPath('')}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-xs opacity-40 mt-2">
                    Specify the full path to the <code className="px-1 py-0.5 rounded" style={{ backgroundColor: theme.colors.bgActivity }}>gh</code> binary if it's not in your PATH. Used for Auto Run worktree features.
                  </p>
                </div>
              </div>

              {/* Input Behavior Settings */}
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2 flex items-center gap-2">
                  <Keyboard className="w-3 h-3" />
                  Input Send Behavior
                </label>
                <p className="text-xs opacity-50 mb-3">
                  Configure how to send messages in each mode. Choose between Enter or Command+Enter for each input type.
                </p>

                {/* AI Mode Setting */}
                <div className="mb-4 p-3 rounded border" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">AI Interaction Mode</label>
                    <button
                      onClick={() => props.setEnterToSendAI(!props.enterToSendAI)}
                      className="px-3 py-1.5 rounded text-xs font-mono transition-all"
                      style={{
                        backgroundColor: props.enterToSendAI ? theme.colors.accentDim : theme.colors.bgActivity,
                        color: theme.colors.textMain,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      {props.enterToSendAI ? 'Enter' : '⌘ + Enter'}
                    </button>
                  </div>
                  <p className="text-xs opacity-50">
                    {props.enterToSendAI
                      ? 'Press Enter to send. Use Shift+Enter for new line.'
                      : 'Press Command+Enter to send. Enter creates new line.'}
                  </p>
                </div>

                {/* Terminal Mode Setting */}
                <div className="p-3 rounded border" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Terminal Mode</label>
                    <button
                      onClick={() => props.setEnterToSendTerminal(!props.enterToSendTerminal)}
                      className="px-3 py-1.5 rounded text-xs font-mono transition-all"
                      style={{
                        backgroundColor: props.enterToSendTerminal ? theme.colors.accentDim : theme.colors.bgActivity,
                        color: theme.colors.textMain,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      {props.enterToSendTerminal ? 'Enter' : '⌘ + Enter'}
                    </button>
                  </div>
                  <p className="text-xs opacity-50">
                    {props.enterToSendTerminal
                      ? 'Press Enter to send. Use Shift+Enter for new line.'
                      : 'Press Command+Enter to send. Enter creates new line.'}
                  </p>
                </div>
              </div>

              {/* Default History Toggle */}
              <SettingCheckbox
                icon={History}
                sectionLabel="Default History Toggle"
                title="Enable &quot;History&quot; by default for new tabs"
                description="When enabled, new AI tabs will have the &quot;History&quot; toggle on by default, saving a synopsis after each completion"
                checked={props.defaultSaveToHistory}
                onChange={props.setDefaultSaveToHistory}
                theme={theme}
              />

              {/* Check for Updates on Startup */}
              <SettingCheckbox
                icon={Download}
                sectionLabel="Updates"
                title="Check for updates on startup"
                description="Automatically check for new Maestro versions when the app starts"
                checked={props.checkForUpdatesOnStartup}
                onChange={props.setCheckForUpdatesOnStartup}
                theme={theme}
              />
            </div>
          )}

          {activeTab === 'llm' && FEATURE_FLAGS.LLM_SETTINGS && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">LLM Provider</label>
                <select
                  value={props.llmProvider}
                  onChange={(e) => props.setLlmProvider(e.target.value)}
                  className="w-full p-2 rounded border bg-transparent outline-none"
                  style={{ borderColor: theme.colors.border }}
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-2">Model Slug</label>
                <input
                  value={props.modelSlug}
                  onChange={(e) => props.setModelSlug(e.target.value)}
                  className="w-full p-2 rounded border bg-transparent outline-none"
                  style={{ borderColor: theme.colors.border }}
                  placeholder={props.llmProvider === 'ollama' ? 'llama3:latest' : 'anthropic/claude-3.5-sonnet'}
                />
              </div>

              {props.llmProvider !== 'ollama' && (
                <div>
                  <label className="block text-xs font-bold opacity-70 uppercase mb-2">API Key</label>
                  <div className="flex items-center border rounded px-3 py-2" style={{ backgroundColor: theme.colors.bgMain, borderColor: theme.colors.border }}>
                    <Key className="w-4 h-4 mr-2 opacity-50" />
                    <input
                      type="password"
                      value={props.apiKey}
                      onChange={(e) => props.setApiKey(e.target.value)}
                      className="bg-transparent flex-1 text-sm outline-none"
                      placeholder="sk-..."
                    />
                  </div>
                  <p className="text-[10px] mt-2 opacity-50">Keys are stored locally in ~/.maestro/settings.json</p>
                </div>
              )}

              {/* Test Connection */}
              <div className="pt-4 border-t" style={{ borderColor: theme.colors.border }}>
                <button
                  onClick={testLLMConnection}
                  disabled={testingLLM || (props.llmProvider !== 'ollama' && !props.apiKey)}
                  className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentForeground,
                  }}
                >
                  {testingLLM ? 'Testing Connection...' : 'Test Connection'}
                </button>

                {testResult.status && (
                  <div
                    className="mt-3 p-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: testResult.status === 'success' ? theme.colors.success + '20' : theme.colors.error + '20',
                      color: testResult.status === 'success' ? theme.colors.success : theme.colors.error,
                      border: `1px solid ${testResult.status === 'success' ? theme.colors.success : theme.colors.error}`,
                    }}
                  >
                    {testResult.message}
                  </div>
                )}

                <p className="text-[10px] mt-3 opacity-50 text-center">
                  Test sends a simple prompt to verify connectivity and configuration
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (() => {
            const totalShortcuts = Object.values(props.shortcuts).length;
            const filteredShortcuts = Object.values(props.shortcuts)
              .filter((sc: Shortcut) => sc.label.toLowerCase().includes(shortcutsFilter.toLowerCase()));
            const filteredCount = filteredShortcuts.length;

            return (
              <div className="flex flex-col" style={{ minHeight: '450px' }}>
                {props.hasNoAgents && (
                  <p className="text-xs mb-3 px-2 py-1.5 rounded" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                    Note: Most functionality is unavailable until you've created your first agent.
                  </p>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    ref={shortcutsFilterRef}
                    type="text"
                    value={shortcutsFilter}
                    onChange={(e) => setShortcutsFilter(e.target.value)}
                    placeholder="Filter shortcuts..."
                    className="flex-1 px-3 py-2 rounded border bg-transparent outline-none text-sm"
                    style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
                  />
                  <span className="text-xs px-2 py-1.5 rounded font-medium" style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}>
                    {shortcutsFilter ? `${filteredCount} / ${totalShortcuts}` : totalShortcuts}
                  </span>
                </div>
                <p className="text-xs opacity-50 mb-3" style={{ color: theme.colors.textDim }}>
                  Not all shortcuts can be modified. Press <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: theme.colors.bgActivity }}>⌘/</kbd> from the main interface to view the full list of keyboard shortcuts.
                </p>
                <div className="space-y-2 flex-1 overflow-y-auto pr-2 scrollbar-thin">
                  {filteredShortcuts.map((sc: Shortcut) => (
                    <div key={sc.id} className="flex items-center justify-between p-3 rounded border" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain }}>
                      <span className="text-sm font-medium" style={{ color: theme.colors.textMain }}>{sc.label}</span>
                      <button
                        onClick={(e) => {
                          setRecordingId(sc.id);
                          // Auto-focus the button so it immediately starts listening for keys
                          e.currentTarget.focus();
                        }}
                        onKeyDownCapture={(e) => {
                          if (recordingId === sc.id) {
                            // Prevent default in capture phase to catch all key combinations
                            // (including browser/system shortcuts like Option+Arrow)
                            e.preventDefault();
                            e.stopPropagation();
                            handleRecord(e, sc.id);
                          }
                        }}
                        className={`px-3 py-1.5 rounded border text-xs font-mono min-w-[80px] text-center transition-colors ${recordingId === sc.id ? 'ring-2' : ''}`}
                        style={{
                          borderColor: recordingId === sc.id ? theme.colors.accent : theme.colors.border,
                          backgroundColor: recordingId === sc.id ? theme.colors.accentDim : theme.colors.bgActivity,
                          color: recordingId === sc.id ? theme.colors.accent : theme.colors.textDim,
                          ringColor: theme.colors.accent
                        }}
                      >
                        {recordingId === sc.id ? 'Press keys...' : formatShortcutKeys(sc.keys)}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {activeTab === 'theme' && themePickerContent}

          {activeTab === 'notifications' && (
            <NotificationsPanel
              osNotificationsEnabled={props.osNotificationsEnabled}
              setOsNotificationsEnabled={props.setOsNotificationsEnabled}
              audioFeedbackEnabled={props.audioFeedbackEnabled}
              setAudioFeedbackEnabled={props.setAudioFeedbackEnabled}
              audioFeedbackCommand={props.audioFeedbackCommand}
              setAudioFeedbackCommand={props.setAudioFeedbackCommand}
              toastDuration={props.toastDuration}
              setToastDuration={props.setToastDuration}
              theme={theme}
            />
          )}

          {activeTab === 'aicommands' && (
            <AICommandsPanel
              theme={theme}
              customAICommands={props.customAICommands}
              setCustomAICommands={props.setCustomAICommands}
            />
          )}
        </div>
      </div>
    </div>
  );
});
