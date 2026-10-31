import Head from 'next/head';
import AuthLayout from '@/components/auth/authLayout';
import LoginForm from '@/components/auth/loginForm';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function LoginPage() {
  return (
    <>
      <Head>
        <title>{pageTitle(t("Connexion"))}</title>
      </Head>
      <AuthLayout title={t("Content de vous revoir")} subtitle={t("Connectez-vous pour retrouver votre communaute")}>
        <LoginForm />
      </AuthLayout>
    </>
  );
}
