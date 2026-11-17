import type { Metadata } from 'next';
import Link from 'next/link';
import { ChefHat, Clock, Download, Users } from 'lucide-react';
import { RecipeContent } from '@/components/public/RecipeContent';
import { getCookingPlan } from '@/features/recipes/content';
import type { PublicRecipe } from '@/features/share/publicRecipe';
import { fetchPublicRecipe } from '@/lib/server/publicDrive';
import type { RichContent } from '@/lib/schemas';
import styles from './page.module.scss';

/** Re-read from Drive at most once a minute, so edits by the owner show up shortly. */
export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

function coverSrc(id: string, recipe: PublicRecipe) {
  if (recipe.coverAssetId && recipe.files[recipe.coverAssetId]) return `/r/${id}/arquivo/${recipe.coverAssetId}`;
  return recipe.coverUrl;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const recipe = await fetchPublicRecipe(id);
  if (!recipe) return { title: 'Receita não encontrada · CookMe', robots: { index: false } };
  const { ingredients } = getCookingPlan(recipe.content as RichContent);
  const meta = [recipe.time, recipe.servings && `rende ${recipe.servings}`].filter(Boolean).join(' · ');
  const description = [meta, ingredients.slice(0, 4).join(', ')].filter(Boolean).join(' — ') || 'Receita compartilhada pelo CookMe.';
  const cover = coverSrc(id, recipe);
  return {
    title: `${recipe.name} · CookMe`,
    description,
    // Shared by link only: keep it out of search engines.
    robots: { index: false, follow: false },
    openGraph: {
      title: recipe.name,
      description,
      type: 'article',
      siteName: 'CookMe',
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

export default async function PublicRecipePage({ params }: Params) {
  const { id } = await params;
  const recipe = await fetchPublicRecipe(id);

  if (!recipe) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.missing}>
          <h1>Receita não encontrada</h1>
          <p>O link pode ter sido desativado por quem compartilhou, ou a receita foi apagada.</p>
          <Link href="/">Conhecer o CookMe</Link>
        </main>
      </div>
    );
  }

  const cover = coverSrc(id, recipe);
  const assetUrl = (assetId: string) => (recipe.files[assetId] ? `/r/${id}/arquivo/${assetId}` : null);

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        {cover && (
          <img className={styles.cover} src={cover} alt={`Foto de ${recipe.name}`} />
        )}
        <h1 className={styles.title}>{recipe.name}</h1>
        {(recipe.time || recipe.servings) && (
          <div className={styles.meta}>
            {recipe.time && (
              <span>
                <Clock size={15} /> {recipe.time}
              </span>
            )}
            {recipe.servings && (
              <span>
                <Users size={15} /> Rende {recipe.servings}
              </span>
            )}
          </div>
        )}
        <RecipeContent content={recipe.content as RichContent} assetUrl={assetUrl} />

        <section className={styles.save}>
          <div>
            <strong>Gostou? Guarde no seu caderno.</strong>
            <p>Baixe a receita e use “Importar receita” no CookMe para ter uma cópia sua, com fotos, para editar à vontade.</p>
          </div>
          <a className={styles.saveButton} href={`/r/${id}/cookme`} download>
            <Download size={16} /> Salvar no meu CookMe
          </a>
        </section>
      </main>
      <footer className={styles.footer}>
        Compartilhado com <Link href="/">CookMe</Link> · <Link href="/privacidade">Privacidade</Link>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <ChefHat size={18} strokeWidth={1.9} />
        </span>
        CookMe
      </Link>
    </header>
  );
}
