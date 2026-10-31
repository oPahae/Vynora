import SOCIAL_LINKS from '@/components/shared/socialLinksConfig';

export default function SocialLinksRow({ socialLinks }) {
  const active = SOCIAL_LINKS.filter((social) => socialLinks && socialLinks[social.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-3">
      {active.map((social) => (
        <a
          key={social.key}
          href={socialLinks[social.key]}
          target="_blank"
          rel="noopener noreferrer"
          title={social.label}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          style={{ color: social.color }}
        >
          <social.icon size={16} />
        </a>
      ))}
    </div>
  );
}
