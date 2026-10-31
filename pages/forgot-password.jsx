import Head from 'next/head';
import AuthLayout from '@/components/auth/authLayout';
import ForgotPasswordForm from '@/components/auth/forgotPasswordForm';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function ForgotPasswordPage() {
  return (
    <>
      <Head>
        <title>{pageTitle(t("Mot de passe oublie"))}</title>
      </Head>
      <AuthLayout title={t("Mot de passe oublie")} subtitle={t("Recevez un code par email pour le reinitialiser")}>
        <ForgotPasswordForm />
      </AuthLayout>
    </>
  );
}
