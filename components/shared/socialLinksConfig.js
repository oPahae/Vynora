import { Facebook, Instagram, Music2, X, Ghost, Linkedin, Github } from 'lucide-react';

const SOCIAL_LINKS = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/...', color: '#1877F2' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/...', color: '#E1306C' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, placeholder: 'https://tiktok.com/@...', color: '#000000' },
  { key: 'x', label: 'X', icon: X, placeholder: 'https://x.com/...', color: '#000000' },
  { key: 'snapchat', label: 'Snapchat', icon: Ghost, placeholder: 'https://snapchat.com/add/...', color: '#FFFC00' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/...', color: '#0A66C2' },
  { key: 'github', label: 'GitHub', icon: Github, placeholder: 'https://github.com/...', color: '#171515' }
];

export default SOCIAL_LINKS;
