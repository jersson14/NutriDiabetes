'use client';

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100/90 rounded-xl mb-6 border border-slate-200/60">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap
            ${activeTab === tab.id
              ? 'bg-white text-[#0057B8] shadow-[0_1px_6px_rgba(15,28,60,0.10)] font-semibold'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
