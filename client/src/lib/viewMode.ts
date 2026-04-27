const KEY = 'arc_view_mode';

export type ViewMode = 'member' | 'creator';

export function getViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'creator') return 'creator';
  } catch {}
  return 'member';
}

export function setViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}
