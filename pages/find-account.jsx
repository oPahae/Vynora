import Head from 'next/head';
import AuthLayout from '@/components/auth/authLayout';
import FindAccountForm from '@/components/auth/findAccountForm';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function FindAccountPage() {
  return (
    <>
      <Head>
        <title>{pageTitle(t("Trouver mon compte"))}</title>
      </Head>
      <AuthLayout title={t("Trouver mon compte")} subtitle={t("Retrouvez votre compte par nom ou adresse email")}>
        <FindAccountForm />
      </AuthLayout>
    </>
  );
}
