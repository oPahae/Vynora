import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { UserCog, Shield, Palette, Languages, ExternalLink, Bookmark, FileEdit, BellRing, BarChart3 } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import EmailSettingsForm from '@/components/settings/emailSettingsForm';
import PasswordSettingsForm from '@/components/settings/passwordSettingsForm';
import PrivacySettings from '@/components/settings/privacySettings';
import ThemeSettings from '@/components/settings/themeSettings';
import LanguageSettings from '@/components/settings/languageSettings';
import PushNotificationSettings from '@/components/settings/pushNotificationSettings';
import DangerZoneSettings from '@/components/settings/dangerZoneSettings';
import { useAuth } from '@/lib/authContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const TABS = [
  { key: 'account', get label() { return t("Compte"); }, icon: UserCog },
  { key: 'privacy', get label() { return t("Confidentialite"); }, icon: Shield },
  { key: 'notifications', get label() { return t("Notifications"); }, icon: BellRing },
  { key: 'appearance', get label() { return t("Apparence"); }, icon: Palette },
  { key: 'language', get label() { return t("Langue"); }, icon: Languages }
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('account');

  return (
    <>
      <Head>
        <title>{pageTitle(t("Parametres"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[14.5rem_minmax(0,1fr)] gap-6">
          <nav className="space-y-1 nx-card p-2 self-start md:sticky md:top-20">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl2 text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {activeTab === tab.key && (
                  <motion.span
                    layoutId="settings-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute inset-0 rounded-xl2 bg-brand-50"
                    style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--spot) / 0.2), inset 0 1px 0 rgb(var(--highlight))' }}
                  />
                )}
                <tab.icon size={16} className={`relative ${activeTab === tab.key ? 'text-brand-600' : ''}`} />
                <span className="relative">{tab.label}</span>
              </button>
            ))}
            {user && (
              <Link
                href={`/profile/${user.id}`}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink size={16} />{t("Modifier le profil")}</Link>
            )}
            <Link
              href="/saved"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Bookmark size={16} />{t("Publications enregistrees")}</Link>
            <Link
              href="/drafts"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <FileEdit size={16} />{t("Mes brouillons")}</Link>
            <Link
              href="/stats"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <BarChart3 size={16} />{t("Statistiques")}</Link>
          </nav>

          <div className="nx-card p-6 sm:p-7 space-y-8">
            {activeTab === 'account' && (
              <>
                <EmailSettingsForm />
                <div className="border-t border-slate-100 pt-6">
                  <PasswordSettingsForm />
                </div>
                <div className="border-t border-slate-100 pt-6">
                  <DangerZoneSettings />
                </div>
              </>
            )}
            {activeTab === 'privacy' && <PrivacySettings />}
            {activeTab === 'notifications' && <PushNotificationSettings />}
            {activeTab === 'appearance' && <ThemeSettings />}
            {activeTab === 'language' && <LanguageSettings />}
          </div>
        </div>
      </AppLayout>
    </>
  );
}
