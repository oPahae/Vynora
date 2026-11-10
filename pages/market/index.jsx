import Head from 'next/head';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { Store, Plus, Search, SlidersHorizontal, Loader2, PackageOpen } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import EmptyState from '@/components/shared/emptyState';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';
import ProductCard from '@/components/market/productCard';
import ProductForm from '@/components/market/productForm';
import { getCategories } from '@/lib/marketMeta';
import { useToast } from '@/lib/toastContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const PAGE_SIZE = 12;
const FIELD = 'text-sm rounded-xl2 border border-slate-200 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-200';

export default function MarketPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState('all'); // all | mine
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    async (offset) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE), sort });
      if (tab === 'mine') params.set('mine', '1');
      if (search.trim()) params.set('query', search.trim());
      if (category) params.set('category', category);
      if (city.trim()) params.set('city', city.trim());
      if (minPrice !== '') params.set('minPrice', minPrice);
      if (maxPrice !== '') params.set('maxPrice', maxPrice);
      try {
        const response = await fetch(`/api/market?${params.toString()}`);
        const data = await response.json();
        if (requestId !== requestRef.current) return;
        if (data.success) {
          setProducts((prev) => (offset === 0 ? data.products : [...prev, ...data.products]));
          setHasMore(data.hasMore);
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [tab, search, category, city, minPrice, maxPrice, sort]
  );

  // Recherche avec un court delai pour ne pas interroger l'API a chaque touche.
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(0), 250);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPage(products.length);
  }, [fetchPage, hasMore, loading, products.length]);

  const categories = getCategories();

  return (
    <>
      <Head>
        <title>{pageTitle(t("Market"))}</title>
      </Head>
      <AppLayout>
        <PageHeader
          icon={Store}
          title={t("Market")}
          subtitle={t("Achetez et vendez entre membres")}
          actions={
            <button type="button" onClick={() => setFormOpen(true)} className="nx-btn-primary px-4 h-10">
              <Plus size={16} /> <span className="hidden sm:inline">{t("Vendre")}</span>
            </button>
          }
        />

        <div className="flex gap-2 mb-4">
          {[
            { key: 'all', label: t("Toutes les annonces") },
            { key: 'mine', label: t("Mes annonces") }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`nx-chip ${tab === item.key ? 'nx-chip-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Rechercher un article...")}
              className={`${FIELD} w-full ps-9`}
            />
          </div>
          <button type="button" onClick={() => setShowFilters((v) => !v)} className={`nx-btn-ghost h-10 px-3 border border-slate-200 ${showFilters ? 'bg-slate-100' : ''}`} aria-label={t("Filtres")}>
            <SlidersHorizontal size={16} /> <span className="hidden sm:inline">{t("Filtres")}</span>
          </button>
        </div>

        {showFilters && (
          <div className="nx-card p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
              <option value="">{t("Toutes categories")}</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("Ville")} className={FIELD} />
            <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} inputMode="decimal" placeholder={t("Prix min")} className={FIELD} />
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} inputMode="decimal" placeholder={t("Prix max")} className={FIELD} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${FIELD} col-span-2 md:col-span-1`}>
              <option value="recent">{t("Plus recentes")}</option>
              <option value="priceAsc">{t("Prix croissant")}</option>
              <option value="priceDesc">{t("Prix decroissant")}</option>
              <option value="popular">{t("Les plus aimees")}</option>
            </select>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
          <button type="button" onClick={() => setCategory('')} className={`nx-chip shrink-0 ${category === '' ? 'nx-chip-active' : ''}`}>
            {t("Tout")}
          </button>
          {categories.map((c) => (
            <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={`nx-chip shrink-0 ${category === c.key ? 'nx-chip-active' : ''}`}>
              {c.label}
            </button>
          ))}
        </div>

        {products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        )}

        {!loading && products.length === 0 && (
          <EmptyState
            icon={PackageOpen}
            title={tab === 'mine' ? t("Vous n'avez aucune annonce") : t("Aucune annonce trouvee")}
            description={tab === 'mine' ? t("Publiez votre premier article en quelques secondes.") : t("Essayez d'autres mots-cles ou de modifier les filtres.")}
            action={
              <button type="button" onClick={() => setFormOpen(true)} className="nx-btn-primary px-5 h-10">
                <Plus size={16} /> {t("Vendre un article")}
              </button>
            }
          />
        )}

        <InfiniteScrollSentinel onIntersect={loadMore} enabled={hasMore && !loading} />

        <AnimatePresence>
          {formOpen && (
            <ProductForm
              onClose={() => setFormOpen(false)}
              onSaved={(product) => {
                setFormOpen(false);
                showToast({ title: t("Annonce publiee"), message: t("Votre article est en vente."), type: 'success' });
                router.push(`/market/${product.id}`);
              }}
            />
          )}
        </AnimatePresence>
      </AppLayout>
    </>
  );
}
