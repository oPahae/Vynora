import {
  Code2,
  Gamepad2,
  BookOpen,
  Music2,
  MoonStar,
  Coffee,
  Dumbbell,
  Plane,
  Car,
  Briefcase,
  Heart,
  Star,
  Sun,
  Cloud,
  Utensils,
  Home,
  Smile
} from 'lucide-react';

// Le statut personnalise stocke un NOM d'icone (ex: "Code2") plutot qu'un
// emoji, pour un rendu visuel propre et coherent sur toutes les plateformes.
const ICON_MAP = {
  Code2,
  Gamepad2,
  BookOpen,
  Music2,
  MoonStar,
  Coffee,
  Dumbbell,
  Plane,
  Car,
  Briefcase,
  Heart,
  Star,
  Sun,
  Cloud,
  Utensils,
  Home
};

export default function StatusIcon({ name, size = 15, className = '' }) {
  const Icon = ICON_MAP[name] || Smile;
  return <Icon size={size} className={className} />;
}
