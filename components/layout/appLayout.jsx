import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topBar';
import MobileTabBar from '@/components/layout/mobileTabBar';

// Coque de l'application.
// - md et plus : rail lateral plat (icones seules jusqu'a xl, libelles ensuite) + barre superieure.
// - mobile : barre superieure legere + dock flottant en bas, pense pour le pouce.
// `noMobileChrome` : pages plein ecran sur mobile (conversation, serveur) qui masquent
// header et dock, tout en gardant la coque complete sur tablette et desktop.
// `wide` : donne plus de largeur au contenu (serveurs).
export default function AppLayout({ children, noMobileChrome = false, wide = false }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:ps-[72px] xl:ps-[264px] min-w-0">
        <div className={noMobileChrome ? 'hidden md:block' : ''}>
          <TopBar />
        </div>
        <main
          className={
            noMobileChrome
              ? `${wide ? 'md:max-w-7xl' : 'md:max-w-5xl'} md:mx-auto md:px-6 md:py-8 h-[100dvh] md:h-auto`
              : 'nx-page max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10'
          }
        >
          {children}
        </main>
      </div>
      <div className={noMobileChrome ? 'hidden' : 'md:hidden'}>
        <MobileTabBar />
      </div>
    </div>
  );
}
