import Head from 'next/head';
import AuthLayout from '@/components/auth/authLayout';
import RegisterForm from '@/components/auth/registerForm';
import { APP_NAME, pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function RegisterPage() {
  return (
    <>
      <Head>
        <title>{pageTitle(t("Inscription"))}</title>
      </Head>
      <AuthLayout title={t("Creez votre compte")} subtitle={t("Rejoignez {APP_NAME} en quelques secondes", { APP_NAME })}>
        <RegisterForm />
      </AuthLayout>
    </>
  );
}
