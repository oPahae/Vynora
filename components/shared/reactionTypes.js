import { LikeIcon, DislikeIcon, HahaIcon, WowIcon, GrrIcon, SadIcon } from '@/components/shared/reactionIcons';

import { t } from '@/lib/i18n/runtime';
// Design des reactions : pastilles rondes et brillantes (voir reactionIcons.jsx).
// Le coeur est le "j'aime". Les cles (like, dislike, haha...) restent celles de la
// base de donnees : seul l'habillage change. `color` sert aux halos et eclats.
const REACTIONS = [
  { type: 'like', get label() { return t("J'aime"); }, icon: LikeIcon, color: '#F0305A' },
  { type: 'dislike', get label() { return t("Je n'aime pas"); }, icon: DislikeIcon, color: '#7C2CF3' },
  { type: 'haha', get label() { return t("Haha"); }, icon: HahaIcon, color: '#FDB93E' },
  { type: 'wow', get label() { return t("Wouah"); }, icon: WowIcon, color: '#FDB93E' },
  { type: 'grr', get label() { return t("Grr"); }, icon: GrrIcon, color: '#F0623A' },
  { type: 'sad', get label() { return t("Triste"); }, icon: SadIcon, color: '#FDB93E' }
];

export default REACTIONS;
