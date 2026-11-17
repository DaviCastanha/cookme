/**
 * Release notes shown in "Novidades" (newest first). Every release that changes something the
 * person can see gets an entry here, and `package.json` "version" must match the first one
 * (a test checks it). Write for the person using the app, not for developers.
 */
export interface Release {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: '1.2.0',
    date: '2026-11-17',
    title: 'Temas de cores',
    items: [
      'Escolha as cores do app em Configurações → Tema: Terracota, Vintage, Moderna, Azulejo, Toscana, Confeitaria ou Café, que é escuro e bom para cozinhar à noite.',
      'Cada tema muda o app inteiro, inclusive o modo Cozinhar. As cores das suas pastas continuam as mesmas.',
      'O tema vale para o aparelho: dá para usar um no celular e outro no computador.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-17',
    title: 'Link público, Story e arrastar no celular',
    items: [
      'Link público: no botão de compartilhar, crie um link da receita que qualquer pessoa abre no navegador, sem conta. Ele acompanha as suas edições e pode ser desativado quando você quiser.',
      'Quem abre o link pode tocar em “Salvar no meu CookMe” e importar uma cópia da receita, com as fotos.',
      'Story do Instagram: uma imagem no formato do Story, com a foto, o tempo e os ingredientes.',
      'No celular, segure uma receita ou pasta por um instante e arraste para reorganizar.',
      'Nova barra no rodapé do celular: Receitas, a receita aberta e Buscar.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-16',
    title: 'Primeira versão',
    items: [
      'Cadernos de receitas com pastas e receitas, cada uma com o ícone e a cor que você quiser. Arraste para reorganizar.',
      'Toda receita nova já vem com Ingredientes, Modo de preparo e Dicas, prontos para preencher.',
      'Foto de capa em destaque (tire na hora, escolha da galeria ou cole um link), tempo de preparo e rendimento.',
      'Ingredientes em lista para ir marcando, passo a passo numerado, e fotos e áudios em qualquer ponto da receita.',
      'Modo Cozinhar: um passo por vez, letra grande, tela sempre acesa e timer quando o passo fala em minutos.',
      'Compartilhe uma receita como imagem (WhatsApp, Instagram…) ou como arquivo CookMe, que a outra pessoa importa no app dela.',
      'Busca por nome ou por ingrediente, com Ctrl+K ou pela barra de busca.',
      'Login com Google: tudo fica na pasta “CookMe” do seu Drive e sincroniza entre celular e computador. Funciona offline.',
    ],
  },
];

export const APP_VERSION = RELEASES[0].version;

/** Negative when a < b, positive when a > b (numeric, dot-separated). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/** Releases newer than `seen`, newest first. */
export function releasesSince(seen: string | null): Release[] {
  if (!seen) return RELEASES;
  return RELEASES.filter((r) => compareVersions(r.version, seen) > 0);
}

export function formatReleaseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}
