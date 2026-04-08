"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  setApiBaseUrl,
  type FdtlFrameworkRef,
  type FdtlSchemeRef,
  type FdtlRuleRef,
  type FdtlTableRef,
  type FdtlTabGroup,
} from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { getOperatorId } from "@/stores/use-operator-store";
import { accentTint } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";
import { FdtMatrix } from "./fdt-matrix";
import { FdtRuleList } from "./fdt-rule-list";
import { FdtSchemeSettings } from "./fdt-scheme-settings";
import {
  Clock, Shield, Sparkles, ChevronDown, Check,
  BedDouble, Wrench, Users, Settings, Search,
  Timer, Moon, Plane, AlertTriangle, Radio, Globe,
} from "lucide-react";

setApiBaseUrl("http://localhost:3002");

export const ACCENT = "#7c3aed";

/* ─── Tab icon map — each sidebar tab gets a meaningful icon ─── */
const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  fdp: Clock, fdp_unacclim: Globe, fdp_extended: Timer,
  fdp_augmented: Users, fdp_single_pilot: Plane,
  rest: BedDouble, split_duty: Moon, cumulative: Timer,
  duty: Shield, disruptive: AlertTriangle,
  extension: Wrench, standby: Radio, mixed_ops: Plane,
  cabin_crew: Users, acclimatization: Globe,
  reporting_times: Settings,
};

export function FdtRulesShell() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [frameworks, setFrameworks] = useState<FdtlFrameworkRef[]>([]);
  const [tabGroups, setTabGroups] = useState<FdtlTabGroup[]>([]);
  const [scheme, setScheme] = useState<FdtlSchemeRef | null>(null);
  const [rules, setRules] = useState<FdtlRuleRef[]>([]);
  const [tables, setTables] = useState<FdtlTableRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fw, tg] = await Promise.all([
        api.getFdtlFrameworks(),
        api.getFdtlTabGroups(),
      ]);
      setFrameworks(fw);
      setTabGroups(tg);

      try {
        const s = await api.getFdtlScheme(getOperatorId());
        setScheme(s);
        const [r, t] = await Promise.all([
          api.getFdtlRules(getOperatorId(), s.frameworkCode),
          api.getFdtlTables(getOperatorId(), s.frameworkCode),
        ]);
        setRules(r);
        setTables(t);
        if (!activeTab && tg.length > 0 && tg[0].tabs.length > 0) {
          setActiveTab(tg[0].tabs[0].key);
        }
      } catch {
        setScheme(null);
      }
    } catch {
      setErrorMsg("Failed to load FDTL data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSeed = useCallback(async (frameworkCode: string) => {
    setSeeding(true); setErrorMsg("");
    try {
      await api.seedFdtl(getOperatorId(), frameworkCode);
      await fetchData();
    } catch { setErrorMsg("Failed to seed framework"); }
    finally { setSeeding(false); }
  }, [fetchData]);

  const handleCellChange = useCallback(async (tableId: string, rowKey: string, colKey: string, valueMinutes: number | null) => {
    try {
      const updated = await api.updateFdtlTableCell(tableId, rowKey, colKey, valueMinutes);
      setTables(prev => prev.map(t => t._id === tableId ? updated : t));
    } catch { setErrorMsg("Failed to update cell"); }
  }, []);

  const handleResetTable = useCallback(async (tableId: string) => {
    try {
      const updated = await api.resetFdtlTable(tableId);
      setTables(prev => prev.map(t => t._id === tableId ? updated : t));
    } catch { setErrorMsg("Failed to reset table"); }
  }, []);

  const handleRuleChange = useCallback(async (id: string, value: string) => {
    try {
      const updated = await api.updateFdtlRule(id, { value });
      setRules(prev => prev.map(r => r._id === id ? updated : r));
    } catch { setErrorMsg("Failed to update rule"); }
  }, []);

  const handleRuleReset = useCallback(async (id: string) => {
    try {
      const updated = await api.resetFdtlRule(id);
      setRules(prev => prev.map(r => r._id === id ? updated : r));
    } catch { setErrorMsg("Failed to reset rule"); }
  }, []);

  const handleSchemeUpdate = useCallback(async (data: Partial<FdtlSchemeRef>) => {
    if (!scheme) return;
    try {
      const updated = await api.updateFdtlScheme(scheme._id, data);
      setScheme(updated);
    } catch { setErrorMsg("Failed to update settings"); }
  }, [scheme]);

  // ── Derived ──
  const activeFramework = frameworks.find(f => f.code === scheme?.frameworkCode);
  const tabRules = rules.filter(r => (r.tabKey ?? r.category) === activeTab);
  const tabTables = tables.filter(t => t.tabKey === activeTab);

  const ruleCountByTab = new Map<string, number>();
  for (const r of rules) ruleCountByTab.set(r.tabKey ?? r.category, (ruleCountByTab.get(r.tabKey ?? r.category) ?? 0) + 1);
  const tableCountByTab = new Map<string, number>();
  for (const t of tables) tableCountByTab.set(t.tabKey, (tableCountByTab.get(t.tabKey) ?? 0) + 1);

  const activeTabLabel = tabGroups.flatMap(g => g.tabs).find(t => t.key === activeTab)?.label ?? activeTab;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[14px] text-hz-text-secondary animate-pulse">Loading FDTL configuration...</div>
      </div>
    );
  }

  if (!scheme) {
    return <FrameworkSetup frameworks={frameworks} onSeed={handleSeed} seeding={seeding} isDark={isDark} />;
  }

  return (
    <MasterDetailLayout
      left={
        <div className="flex flex-col h-full">
          {/* Sidebar header — framework + legend */}
          <div className="px-4 py-4 border-b border-hz-border shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeFramework?.color ?? ACCENT }} />
              <span className="text-[16px] font-bold" style={{ color: activeFramework?.color ?? ACCENT }}>
                {activeFramework?.name ?? scheme.frameworkCode}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold px-1.5 rounded bg-[rgba(255,136,0,0.12)] text-[#E67A00] dark:bg-[rgba(253,172,66,0.15)] dark:text-[#FDAC42]">GOV</span>
                <span className="text-[13px] text-hz-text-secondary">Default</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold px-1.5 rounded" style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.1), color: ACCENT }}>CO</span>
                <span className="text-[13px] text-hz-text-secondary">Company override</span>
              </div>
            </div>
          </div>

          {/* Tab list — flat with group headers */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {tabGroups.map(group => {
              const syntheticTabs = new Set(["reporting_times"]);
              const visibleTabs = group.tabs.filter(tab => {
                return syntheticTabs.has(tab.key) || (ruleCountByTab.get(tab.key) ?? 0) + (tableCountByTab.get(tab.key) ?? 0) > 0;
              });
              if (visibleTabs.length === 0) return null;

              return (
                <div key={group.key} className="mb-3">
                  {/* Group label */}
                  <div className="px-2 py-1.5 mb-1">
                    <span className="text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">
                      {group.label}
                    </span>
                  </div>

                  {/* Tab items */}
                  <div className="space-y-0.5">
                    {visibleTabs.map(tab => {
                      const isSel = activeTab === tab.key;
                      const Icon = TAB_ICONS[tab.key] ?? Clock;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                            isSel
                              ? "border border-module-accent/40 bg-module-accent/[0.06] shadow-sm"
                              : "border border-transparent hover:bg-hz-border/20"
                          }`}
                        >
                          <Icon size={16} className={isSel ? "" : "text-hz-text-tertiary"} style={isSel ? { color: ACCENT } : undefined} strokeWidth={1.8} />
                          <span className={`text-[13px] flex-1 ${isSel ? "font-semibold" : "text-hz-text-secondary"}`}
                            style={isSel ? { color: ACCENT } : undefined}>
                            {tab.label}
                          </span>
                          {isSel && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-hz-border shrink-0 flex items-center justify-between">
            <span className="text-[13px] text-hz-text-tertiary">{tabGroups.reduce((s, g) => s + g.tabs.length, 0)} tabs</span>
            <span className="text-[13px] font-mono font-semibold" style={{ color: activeFramework?.color }}>{scheme.frameworkCode}</span>
          </div>
        </div>
      }
      center={
        <div className="flex flex-col h-full">
          {/* Content header */}
          <div className="px-6 py-4 border-b border-hz-border shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold">{activeTabLabel}</h2>
                <p className="text-[13px] text-hz-text-secondary mt-0.5">
                  {activeTab === "reporting_times"
                    ? "Configure reporting and debrief defaults"
                    : "Click any cell to edit your company value"}
                </p>
              </div>

              {/* Framework selector — top right */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeFramework?.color ?? ACCENT }} />
                <select
                  value={scheme.frameworkCode}
                  onChange={(e) => handleSeed(e.target.value)}
                  disabled={seeding}
                  className="text-[13px] font-semibold bg-transparent outline-none cursor-pointer text-hz-text appearance-none pr-1"
                >
                  {frameworks.map(fw => (
                    <option key={fw.code} value={fw.code}>{fw.name}</option>
                  ))}
                </select>
                {activeFramework?.region && (
                  <span className="text-[13px] px-2 py-0.5 rounded-full bg-hz-border/30 text-hz-text-tertiary">{activeFramework.region}</span>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
                <span className="text-[13px] text-red-700 dark:text-red-400 flex-1">{errorMsg}</span>
                <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 text-[13px] font-medium">Dismiss</button>
              </div>
            )}
          </div>

          {/* Content body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === "reporting_times" && scheme && (
              <FdtSchemeSettings scheme={scheme} onUpdate={handleSchemeUpdate} />
            )}

            {activeTab !== "reporting_times" && (
              <>
                {/* Tables first */}
                {tabTables.map(table => (
                  <FdtMatrix
                    key={table._id}
                    table={table}
                    isDark={isDark}
                    onCellChange={handleCellChange}
                    onResetTable={handleResetTable}
                  />
                ))}

                {/* Then rules */}
                {tabRules.length > 0 && (
                  <FdtRuleList
                    rules={tabRules}
                    showHeader={tabTables.length > 0}
                    onRuleChange={handleRuleChange}
                    onRuleReset={handleRuleReset}
                  />
                )}

                {tabRules.length === 0 && tabTables.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-hz-text-secondary">
                    <Clock size={32} className="mb-3 opacity-30" />
                    <p className="text-[14px]">No data configured for this tab</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      }
    />
  );
}

/* ─── Framework Setup (initial, no scheme yet) ─── */

function FrameworkSetup({
  frameworks, onSeed, seeding, isDark,
}: {
  frameworks: FdtlFrameworkRef[];
  onSeed: (code: string) => void;
  seeding: boolean;
  isDark: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentTint(ACCENT, 0.1) }}>
        <Shield size={24} color={ACCENT} strokeWidth={1.8} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-hz-text mb-1">Flight Duty Time Rules</h2>
        <p className="text-[14px] text-hz-text-secondary max-w-lg">
          Select the regulatory framework for your operation. This will populate all FDP tables,
          rest requirements, cumulative limits, and augmented crew rules.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {frameworks.map(fw => {
          const isSel = selected === fw.code;
          return (
            <button
              key={fw.code}
              onClick={() => setSelected(fw.code)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                isSel ? "shadow-md" : "border-hz-border/50 hover:border-hz-border"
              }`}
              style={isSel ? { borderColor: fw.color, backgroundColor: accentTint(fw.color, isDark ? 0.08 : 0.04) } : undefined}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fw.color }} />
                <span className="text-[14px] font-semibold text-hz-text">{fw.name}</span>
              </div>
              <p className="text-[13px] text-hz-text-secondary">{fw.region}</p>
              <p className="text-[13px] text-hz-text-tertiary mt-0.5">{fw.legalBasis}</p>
              {isSel && (
                <div className="flex items-center gap-1 mt-2">
                  <Check size={13} color={fw.color} />
                  <span className="text-[13px] font-semibold" style={{ color: fw.color }}>Selected</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => selected && onSeed(selected)}
        disabled={!selected || seeding}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40 bg-module-accent"
      >
        <Sparkles className="h-4 w-4" />
        {seeding ? "Seeding rules & tables..." : "Initialize Framework"}
      </button>
    </div>
  );
}
