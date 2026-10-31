import { Lock, Users, Globe } from 'lucide-react';
import { t } from '@/lib/i18n/runtime';

export const COLLECTION_COLOR_STYLES = {
  violet: { from: '#8B7CF6', to: '#6C5CE7' },
  blue: { from: '#5F82F0', to: '#3D63E8' },
  emerald: { from: '#34d399', to: '#0E9F6E' },
  amber: { from: '#fbbf24', to: '#E8890C' },
  rose: { from: '#fb7185', to: '#E11D48' },
  slate: { from: '#94a3b8', to: '#5B6677' }
};

export function colorGradient(color) {
  const c = COLLECTION_COLOR_STYLES[color] || COLLECTION_COLOR_STYLES.violet;
  // Aplat (plus de degrade) : on garde la teinte la plus profonde.
  return c.to;
}

export const COLLECTION_VISIBILITY_META = {
  private: { icon: Lock, label: () => t("Prive") },
  friends: { icon: Users, label: () => t("Amis") },
  public: { icon: Globe, label: () => t("Public") }
};
