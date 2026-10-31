import Link from 'next/link';

const TOKEN_REGEX = /(#[\p{L}0-9_]{2,50})|(@[\p{L}\-']+ [\p{L}\-']+)/gu;

export default function PostContent({ content, mentions = [] }) {
  if (!content) return null;

  const parts = content.split(TOKEN_REGEX).filter((part) => part !== undefined && part !== '');

  return (
    <p className="text-sm text-slate-700 whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith('#')) {
          return (
            <Link
              key={`${part}-${index}`}
              href={`/hashtag/${part.slice(1).toLowerCase()}`}
              className="text-brand-600 font-medium hover:underline"
            >
              {part}
            </Link>
          );
        }

        if (part.startsWith('@')) {
          const name = part.slice(1);
          const mention = mentions.find((user) => `${user.firstName} ${user.lastName}` === name);
          if (mention) {
            return (
              <Link
                key={`${part}-${index}`}
                href={`/profile/${mention.id}`}
                className="text-brand-600 font-medium hover:underline"
              >
                {part}
              </Link>
            );
          }
        }

        return <span key={`text-${index}`}>{part}</span>;
      })}
    </p>
  );
}
