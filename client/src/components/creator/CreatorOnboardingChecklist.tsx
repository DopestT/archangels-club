import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ChecklistItem } from '../../hooks/useCreatorProgress';

interface CreatorOnboardingChecklistProps {
  items: ChecklistItem[];
  completePct: number;
  allComplete: boolean;
  userId: string;
  onStripeSetup?: () => void;
}

const STORAGE_PREFIX = 'arc_checklist_dismissed_';

export default function CreatorOnboardingChecklist({
  items,
  completePct,
  allComplete,
  userId,
  onStripeSetup,
}: CreatorOnboardingChecklistProps) {
  const storageKey = `${STORAGE_PREFIX}${userId}`;

  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(storageKey) === 'true',
  );
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse when ≥ 80% complete but not yet all done
  useEffect(() => {
    if (completePct >= 80 && !allComplete) setCollapsed(true);
  }, [completePct, allComplete]);

  function handleDismiss() {
    localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  }

  if (dismissed) return null;

  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="rounded-xl border border-white/8 bg-bg-surface mb-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div>
            <p className="section-eyebrow">Launch Your Studio</p>
          </div>
          <span className="text-xs text-arc-muted">
            {completedCount} of {items.length} complete
          </span>
        </div>

        <div className="flex items-center gap-2">
          {allComplete && (
            <button
              onClick={handleDismiss}
              className="text-xs text-gold hover:underline mr-2"
            >
              Dismiss
            </button>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg text-arc-muted hover:text-white hover:bg-white/6 transition-colors"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronUp className="w-4 h-4" />}
          </button>
          {!allComplete && (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-arc-muted hover:text-white hover:bg-white/6 transition-colors"
              aria-label="Dismiss setup checklist"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${completePct}%`,
            background: allComplete
              ? '#22C55E'
              : 'linear-gradient(90deg, #D4AF37, #E8C84A)',
          }}
        />
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="divide-y divide-white/5">
          {allComplete ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-5 h-5 rounded-full bg-arc-success/15 border border-arc-success/30 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-arc-success" />
              </div>
              <p className="text-sm text-arc-success font-medium">
                Studio setup complete. You're ready to earn.
              </p>
            </div>
          ) : (
            items.map(item => (
              <ChecklistRow
                key={item.key}
                item={item}
                isPayoutItem={item.key === 'payout_setup'}
                onStripeSetup={onStripeSetup}
              />
            ))
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {collapsed && !allComplete && (
        <div className="px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                  item.completed
                    ? 'text-arc-success bg-arc-success/8 border-arc-success/20'
                    : 'text-arc-muted bg-white/3 border-white/8'
                }`}
              >
                {item.completed
                  ? <Check className="w-3 h-3" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 inline-block" />}
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ChecklistRow({
  item,
  isPayoutItem,
  onStripeSetup,
}: {
  item: ChecklistItem;
  isPayoutItem: boolean;
  onStripeSetup?: () => void;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${item.completed ? 'opacity-50' : ''}`}>
      {/* Status dot */}
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
        item.completed
          ? 'bg-arc-success/15 border-arc-success/30'
          : 'bg-white/4 border-white/15'
      }`}>
        {item.completed
          ? <Check className="w-3 h-3 text-arc-success" />
          : <span className="w-1.5 h-1.5 rounded-full bg-white/30 inline-block" />}
      </div>

      {/* Label + hint */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.completed ? 'text-arc-muted line-through' : 'text-white'}`}>
          {item.label}
        </p>
        {!item.completed && (
          <p className="text-xs text-arc-muted mt-0.5 leading-relaxed">{item.hint}</p>
        )}
      </div>

      {/* CTA */}
      {!item.completed && (
        isPayoutItem && onStripeSetup ? (
          <button
            onClick={onStripeSetup}
            className="text-xs font-medium text-gold hover:underline flex-shrink-0"
          >
            {item.actionLabel}
          </button>
        ) : (
          <Link
            to={item.actionTo}
            className="text-xs font-medium text-gold hover:underline flex-shrink-0"
          >
            {item.actionLabel}
          </Link>
        )
      )}
    </div>
  );
}
