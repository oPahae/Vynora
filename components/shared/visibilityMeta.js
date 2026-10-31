import { Globe2, Users, Lock, UserMinus, UserCheck2 } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
const VISIBILITY_META = {
  public: { get label() { return t("Public"); }, icon: Globe2 },
  friends: { get label() { return t("Amis"); }, icon: Users },
  private: { get label() { return t("Prive"); }, icon: Lock },
  exceptFor: { get label() { return t("Sauf certaines personnes"); }, icon: UserMinus },
  onlyFor: { get label() { return t("Personnes precises"); }, icon: UserCheck2 }
};

export default VISIBILITY_META;
