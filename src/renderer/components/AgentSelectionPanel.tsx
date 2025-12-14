import React from 'react';
import type { AgentConfig, Theme } from '../types';

export interface AgentSelectionPanelProps {
  /** List of available agents */
  agents: AgentConfig[];
  /** Whether agents are still loading */
  loading: boolean;
  /** Currently selected default agent ID */
  defaultAgent: string;
  /** Callback to set the default agent */
  setDefaultAgent: (agentId: string) => void;
  /** Agent configurations keyed by agent ID */
  agentConfigs: Record<string, Record<string, any>>;
  /** Callback to update agent configurations */
  setAgentConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
  /** Custom agent paths keyed by agent ID */
  customAgentPaths: Record<string, string>;
  /** Callback to update custom agent paths */
  setCustomAgentPaths: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Callback to reload agents after path changes */
  loadAgents: () => Promise<void>;
  /** The current theme */
  theme: Theme;
}

/**
 * A panel for selecting and configuring AI agents in settings.
 * Displays:
 * - List of available agents with availability badges
 * - Custom path input for Claude Code
 * - Agent-specific configuration options (checkboxes)
 */
export function AgentSelectionPanel({
  agents,
  loading,
  defaultAgent,
  setDefaultAgent,
  agentConfigs,
  setAgentConfigs,
  customAgentPaths,
  setCustomAgentPaths,
  loadAgents,
  theme,
}: AgentSelectionPanelProps): React.ReactElement {
  return (
    <>
      {/* Default AI Agent Selection */}
      <div>
        <label className="block text-xs font-bold opacity-70 uppercase mb-2">Default AI Agent</label>
        {loading ? (
          <div className="text-sm opacity-50">Loading agents...</div>
        ) : (
          <div className="space-y-2">
            {agents.filter((agent) => !agent.hidden).map((agent) => (
              <div
                key={agent.id}
                className={`rounded border transition-all ${
                  defaultAgent === agent.id ? 'ring-2' : ''
                }`}
                style={{
                  borderColor: theme.colors.border,
                  backgroundColor: defaultAgent === agent.id ? theme.colors.accentDim : theme.colors.bgMain,
                  ringColor: theme.colors.accent,
                }}
              >
                <button
                  disabled={agent.id !== 'claude-code' || !agent.available}
                  onClick={() => setDefaultAgent(agent.id)}
                  className={`w-full text-left p-3 ${(agent.id !== 'claude-code' || !agent.available) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-opacity-10'}`}
                  style={{ color: theme.colors.textMain }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      {agent.path && (
                        <div className="text-xs opacity-50 font-mono mt-1">{agent.path}</div>
                      )}
                    </div>
                    {agent.id === 'claude-code' ? (
                      agent.available ? (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.success + '20', color: theme.colors.success }}>
                          Available
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.error + '20', color: theme.colors.error }}>
                          Not Found
                        </span>
                      )
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.warning + '20', color: theme.colors.warning }}>
                        Coming Soon
                      </span>
                    )}
                  </div>
                </button>
                {/* Custom path input for Claude Code */}
                {agent.id === 'claude-code' && (
                  <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: theme.colors.border }}>
                    <label className="block text-xs opacity-60 mb-1">Custom Path (optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAgentPaths[agent.id] || ''}
                        onChange={(e) => {
                          const newPaths = { ...customAgentPaths, [agent.id]: e.target.value };
                          setCustomAgentPaths(newPaths);
                        }}
                        onBlur={async () => {
                          const path = customAgentPaths[agent.id]?.trim() || null;
                          await window.maestro.agents.setCustomPath(agent.id, path);
                          // Refresh agents to pick up the new path
                          loadAgents();
                        }}
                        placeholder="/path/to/claude"
                        className="flex-1 p-1.5 rounded border bg-transparent outline-none text-xs font-mono"
                        style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
                      />
                      {customAgentPaths[agent.id] && (
                        <button
                          onClick={async () => {
                            const newPaths = { ...customAgentPaths };
                            delete newPaths[agent.id];
                            setCustomAgentPaths(newPaths);
                            await window.maestro.agents.setCustomPath(agent.id, null);
                            loadAgents();
                          }}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textDim }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-xs opacity-40 mt-1">
                      Specify a custom path if the agent is not in your PATH
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent-Specific Configuration */}
      {!loading && agents.length > 0 && (() => {
        const selectedAgent = agents.find(a => a.id === defaultAgent);
        if (!selectedAgent || !selectedAgent.configOptions || selectedAgent.configOptions.length === 0) {
          return null;
        }

        return (
          <div>
            <label className="block text-xs font-bold opacity-70 uppercase mb-2">
              {selectedAgent.name} Configuration
            </label>
            <div className="space-y-3">
              {selectedAgent.configOptions.map((option: any) => (
                <div key={option.key}>
                  {option.type === 'checkbox' && (
                    <label className="flex items-center gap-3 p-3 rounded border cursor-pointer hover:bg-opacity-10"
                           style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain }}>
                      <input
                        type="checkbox"
                        checked={agentConfigs[selectedAgent.id]?.[option.key] ?? option.default}
                        onChange={(e) => {
                          const newConfig = {
                            ...agentConfigs[selectedAgent.id],
                            [option.key]: e.target.checked
                          };
                          setAgentConfigs(prev => ({
                            ...prev,
                            [selectedAgent.id]: newConfig
                          }));
                          window.maestro.agents.setConfig(selectedAgent.id, newConfig);
                        }}
                        className="w-4 h-4"
                        style={{ accentColor: theme.colors.accent }}
                      />
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: theme.colors.textMain }}>
                          {option.label}
                        </div>
                        <div className="text-xs opacity-50 mt-0.5" style={{ color: theme.colors.textDim }}>
                          {option.description}
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
