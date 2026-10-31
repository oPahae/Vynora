import VerifiedBadge from '@/components/shared/verifiedBadge';
import { memo } from 'react';
import Link from 'next/link';
import Avatar from '@/components/shared/avatar';
import StatusBadge from '@/components/status/statusBadge';

function FriendCard({ user, subtitle, status, actions }) {
  return (
    <div className="flex items-center justify-between gap-4 nx-card-interactive !rounded-xl2 p-4">
      <Link href={`/profile/${user.id}`} className="flex items-center gap-3 min-w-0">
        <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="lg" />
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">
            {user.firstName} {user.lastName}{user.verified && <VerifiedBadge size={14} />}
          </p>
          {status ? <StatusBadge status={status} size="xs" /> : subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </Link>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </div>
  );
}

export default memo(FriendCard);
