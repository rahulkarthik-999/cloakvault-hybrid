import { FileText, FolderLock, Sparkles } from 'lucide-react';

type Pane = 'files' | 'doc' | 'insights';

interface MobileTabBarProps {
  active: Pane;
  onChange: (pane: Pane) => void;
  riskScore: number | null;
  busy: boolean;
  alert: boolean;
}

/** Bottom navigation for phones and tablets (hidden on desktop, where all three panes are visible). */
export function MobileTabBar({ active, onChange, riskScore, busy, alert }: MobileTabBarProps) {
  const tabs: Array<{ id: Pane; label: string; icon: typeof FileText; badge?: string | null }> = [
    { id: 'files', label: 'Files', icon: FolderLock },
    { id: 'doc', label: 'Document', icon: FileText },
    { id: 'insights', label: 'Insights', icon: Sparkles, badge: riskScore !== null ? String(riskScore) : null },
  ];
  return (
    <nav
      aria-label="Workbench sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EC] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-3">
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const on = id === active;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={on ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                on ? 'text-[#0E1015]' : 'text-[#9CA2B0]'
              }`}
            >
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${on ? 'bg-[#0E1015] text-white' : ''}`}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {label}
              {id === 'insights' && (busy || alert || badge) && (
                <span
                  className={`absolute right-[22%] top-1.5 min-w-[18px] rounded-full px-1 font-mono text-[9.5px] leading-[18px] text-white ${
                    busy ? 'animate-pulse bg-indigo-600' : alert ? 'bg-amber-500' : 'bg-red-600'
                  }`}
                >
                  {busy ? '…' : alert ? '!' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
