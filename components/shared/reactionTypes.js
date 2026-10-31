import { ThumbsUp, ThumbsDown, Laugh, Sparkles, Angry, Frown } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
const REACTIONS = [
  { type: 'like', get label() { return t("J'aime"); }, icon: ThumbsUp, color: '#3D63E8' },
  { type: 'dislike', get label() { return t("Je n'aime pas"); }, icon: ThumbsDown, color: '#6B7C8D' },
  { type: 'haha', get label() { return t("Haha"); }, icon: Laugh, color: '#f59e0b' },
  { type: 'wow', get label() { return t("Wouah"); }, icon: Sparkles, color: '#7C8CF6' },
  { type: 'grr', get label() { return t("Grr"); }, icon: Angry, color: '#F0623A' },
  { type: 'sad', get label() { return t("Triste"); }, icon: Frown, color: '#2F9BE8' }
];

export default REACTIONS;
