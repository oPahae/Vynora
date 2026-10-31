import { getUserFromRequest } from '@/lib/auth';

export default function ProfileIndexRedirect() {
  return null;
}

export async function getServerSideProps(context) {
  const payload = await getUserFromRequest(context.req);

  if (!payload) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  return { redirect: { destination: `/profile/${payload.id}`, permanent: false } };
}
