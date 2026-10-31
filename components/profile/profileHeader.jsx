import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { AnimatePresence, motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { Camera, Pencil, MoreHorizontal, MapPin, Users, ShieldOff, Shield, MessageCircle, Loader2, Settings, QrCode, Flag } from 'lucide-react';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import QrShareModal from '@/components/profile/qrShareModal';
import ReportModal from '@/components/reports/reportModal';
import Avatar from '@/components/shared/avatar';
import FriendButton from '@/components/friends/friendButton';
import EditProfileModal from '@/components/profile/editProfileModal';
import SocialLinksRow from '@/components/profile/socialLinksRow';
import ProfileMusicPlayer from '@/components/profile/profileMusicPlayer';
import StatusBadge from '@/components/status/statusBadge';
import { useConfirm } from '@/lib/confirmContext';

import { t } from '@/lib/i18n/runtime';
export default function ProfileHeader({ profile: initialProfile, relation: initialRelation, mutualFriendsCount, friendsCount, isSelf, showStatus = true }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [profile, setProfile] = useState(initialProfile);
  const [relationStatus, setRelationStatus] = useState(initialRelation.status);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState(null);
  const menuRef = useRef(null);
  // Parallaxe : la couverture se deplace moins vite que la page et s'agrandit legerement.
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 320], [0, reduceMotion ? 0 : 70]);
  const coverScale = useTransform(scrollY, [0, 320], [1.04, reduceMotion ? 1.04 : 1.16]);

  useEffect(() => {
    if (!showStatus) return;
    fetch(`/api/status/${profile.id}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setPresenceStatus(data.status);
      })
      .catch(() => {});
  }, [profile.id, showStatus]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  async function handleMessage() {
    setIsMessageLoading(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      const data = await response.json();
      if (data.success) {
        router.push(`/messages/${data.conversation.id}`);
      }
    } finally {
      setIsMessageLoading(false);
    }
  }

  async function uploadImage(file, endpoint, field, postIdField) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) {
      setProfile((prev) => ({ ...prev, [field]: data[field], [postIdField]: data.postId }));
    }
  }

  async function handleBlockToggle() {
    setIsMenuOpen(false);
    const isBlocked = initialRelation.blockedByMe;
    const confirmed = await confirm({
      title: isBlocked ? t("Debloquer cet utilisateur ?") : t("Bloquer cet utilisateur ?"),
      message: isBlocked
        ? t("Vous pourrez a nouveau interagir normalement ensemble.")
        : t("Vous ne serez plus amis et ne pourrez plus vous envoyer de messages."),
      confirmLabel: isBlocked ? t("Debloquer") : t("Bloquer"),
      danger: !isBlocked
    });
    if (!confirmed) return;

    setIsBlockLoading(true);
    try {
      await fetch(`/api/block/${profile.id}`, { method: isBlocked ? 'DELETE' : 'POST' });
      router.replace(router.asPath);
    } finally {
      setIsBlockLoading(false);
    }
  }

  return (
    <div className="nx-card">
      <div className="relative h-48 sm:h-72 rounded-t-xl3 overflow-hidden bg-brand-500">
        <motion.div className="absolute inset-0 will-change-transform" style={{ y: coverY, scale: coverScale }}>
          {!profile.cover && (
            <div className="absolute inset-0">
              <div className="absolute -top-20 start-10 w-64 h-64 rounded-full bg-white/10 animate-drift-a" />
              <div className="absolute -bottom-24 end-16 w-72 h-72 rounded-full bg-white/10 animate-drift-b" />
              <div className="absolute top-10 end-1/3 w-10 h-10 rounded-full bg-lumen-400 animate-drift-c" />
            </div>
          )}
          {profile.cover && (
            <Link href={profile.coverPostId ? `/post/${profile.coverPostId}` : '#'} className="absolute inset-0 block">
              <Image src={profile.cover} alt={t("Couverture")} fill className="object-cover" priority />
            </Link>
          )}
        </motion.div>
        {isSelf && (
          <label className="absolute bottom-4 end-4 flex items-center gap-2 bg-surface/90 hover:bg-surface text-slate-700 text-xs font-medium px-3 py-2 rounded-xl2 cursor-pointer shadow-soft transition-colors backdrop-blur">
            <Camera size={15} />{t("Modifier la couverture")}<input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                event.target.files[0] && uploadImage(event.target.files[0], '/api/users/me/cover', 'cover', 'coverPostId')
              }
            />
          </label>
        )}
      </div>

      <div className="px-6 sm:px-8 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 sm:-mt-14 gap-4">
          <div className="flex flex-col items-start sm:flex-row sm:items-end gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="relative p-1 rounded-full shrink-0">
              <span aria-hidden className="absolute inset-0 rounded-full bg-surface" />
              {profile.avatar && profile.avatarPostId ? (
                <Link href={`/post/${profile.avatarPostId}`}>
                  <Avatar src={profile.avatar} firstName={profile.firstName} lastName={profile.lastName} size="xxl" ring />
                </Link>
              ) : (
                <Avatar src={profile.avatar} firstName={profile.firstName} lastName={profile.lastName} size="xxl" ring />
              )}
              {isSelf && (
                <label className="absolute bottom-1 end-1 w-8 h-8 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white cursor-pointer transition-colors">
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      event.target.files[0] && uploadImage(event.target.files[0], '/api/users/me/avatar', 'avatar', 'avatarPostId')
                    }
                  />
                </label>
              )}
            </div>
            <div className="pb-1 min-w-0 w-full sm:w-auto">
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight break-words">
                {profile.firstName} {profile.lastName}
                {profile.verified && <VerifiedBadge size={22} />}
              </h1>
              {presenceStatus && (
                <div className="mt-0.5">
                  <StatusBadge status={presenceStatus} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={14} />{' '}{t("{friendsCount} amis", { friendsCount })}</span>
                {!isSelf && mutualFriendsCount > 0 && <span>{t("{mutualFriendsCount} amis en commun", { mutualFriendsCount })}</span>}
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {profile.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-1 shrink-0">
            {isSelf ? (
              <>
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="nx-btn-secondary"
                >
                  <Pencil size={16} />{' '}{t("Modifier le profil")}</button>
                <button
                  onClick={() => setIsQrOpen(true)}
                  title={t("Partager mon profil")}
                  className="w-10 h-10 rounded-xl2 bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                >
                  <QrCode size={18} />
                </button>
                <Link
                  href="/settings"
                  title={t("Parametres")}
                  className="md:hidden w-10 h-10 rounded-xl2 bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                >
                  <Settings size={18} />
                </Link>
              </>
            ) : (
              <>
                {relationStatus === 'friends' && (
                  <button
                    onClick={handleMessage}
                    disabled={isMessageLoading}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                  >
                    {isMessageLoading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}{t("Message")}</button>
                )}
                <FriendButton
                  userId={profile.id}
                  status={relationStatus}
                  onStatusChange={(userId, status) => setRelationStatus(status)}
                />
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    className="w-10 h-10 rounded-xl2 bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute end-0 mt-2 w-48 nx-pop !rounded-xl2 py-1.5 z-30 overflow-hidden animate-pop-in origin-top-right">
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsQrOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <QrCode size={16} />
                        {t("QR code du profil")}
                      </button>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsReportOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Flag size={16} />
                        {t("Signaler ce compte")}
                      </button>
                      <button
                        onClick={handleBlockToggle}
                        disabled={isBlockLoading}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {initialRelation.blockedByMe ? <Shield size={16} /> : <ShieldOff size={16} />}
                        {initialRelation.blockedByMe ? t("Debloquer") : t("Bloquer")}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {profile.bio && <p className="mt-4 text-sm text-slate-600 max-w-2xl">{profile.bio}</p>}
        <SocialLinksRow socialLinks={profile.socialLinks} />
        <ProfileMusicPlayer
          musicUrl={profile.musicUrl}
          musicTitle={profile.musicTitle}
          musicStartSec={profile.musicStartSec}
          musicEndSec={profile.musicEndSec}
        />
      </div>

      <AnimatePresence>
        {isQrOpen && <QrShareModal profile={profile} onClose={() => setIsQrOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isReportOpen && <ReportModal targetType="user" targetId={profile.id} onClose={() => setIsReportOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isEditOpen && (
          <EditProfileModal
            profile={profile}
            onClose={() => setIsEditOpen(false)}
            onProfilePatch={(patch) => setProfile((prev) => ({ ...prev, ...patch }))}
            onSaved={(updated) => {
              setProfile((prev) => ({ ...prev, ...updated }));
              setIsEditOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
