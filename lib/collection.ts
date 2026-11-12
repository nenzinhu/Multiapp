export const STORAGE_KEY = "multiapp.collection.v1";
export const UNCATEGORIZED = "Sem categoria";

export type AppLink = {
  id: string;
  name: string;
  url: string;
  category: string;
  favorite: boolean;
  createdAt: number;
  lastOpened: number;
};

export type Collection = {
  version: 1;
  categories: string[];
  links: AppLink[];
};

export type CollectionView = "all" | "favorites" | "recent";

export type FilterOptions = {
  query: string;
  view: CollectionView;
  category: string;
  sort: string;
};

const MAX_LINKS = 2000;
const MAX_CATEGORIES = 100;

/** Accepts a pasted URL, rejects unsafe schemes and credentialed addresses. */
export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (!value || value.length > 4096 || /\s/.test(value))
    throw new Error("Cole uma URL válida, como https://exemplo.com.");

  // A leading "host:port" is not a scheme, so only treat real schemes as absolute.
  const hasScheme =
    /^[a-z][a-z\d+.-]*:/i.test(value) &&
    !/^[\w.-]+:\d+(?:[/?#]|$)/.test(value);

  let url: URL;
  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    throw new Error("Confira a URL. Exemplo: https://exemplo.com.");
  }

  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (!url.hostname.includes(".") &&
      url.hostname !== "localhost" &&
      !url.hostname.includes(":"))
  )
    throw new Error("Use um endereço http ou https, sem usuário e senha na URL.");

  return url.href;
}

/** Domain based default name, e.g. https://www.figma.com/ -> "Figma". */
export function suggestedName(url: string): string {
  const label = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Validates and normalizes a backup payload. Throws on any invalid record. */
export function validateBackup(raw: unknown): Collection {
  if (!raw || typeof raw !== "object")
    throw new Error(
      "Arquivo inválido. Use um backup JSON exportado pelo Multiapp.",
    );

  const data = raw as Partial<Collection>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.links) ||
    !Array.isArray(data.categories) ||
    data.links.length > MAX_LINKS ||
    data.categories.length > MAX_CATEGORIES
  )
    throw new Error(
      "Backup incompatível. Limite: 2.000 apps e 100 categorias.",
    );

  const categories = [
    ...new Set(
      data.categories.map((category) => {
        if (
          typeof category !== "string" ||
          !category.trim() ||
          category.length > 40
        )
          throw new Error("O backup contém uma categoria inválida.");
        return category.trim();
      }),
    ),
  ];

  const links = data.links.map((link) => {
    if (
      !link ||
      typeof link.name !== "string" ||
      !link.name.trim() ||
      link.name.length > 80 ||
      typeof link.url !== "string" ||
      typeof link.id !== "string" ||
      !link.id ||
      typeof link.category !== "string" ||
      link.category.length > 40 ||
      typeof link.favorite !== "boolean" ||
      !Number.isFinite(link.createdAt) ||
      !Number.isFinite(link.lastOpened)
    )
      throw new Error(
        "O backup contém um app inválido. Nenhum dado foi importado.",
      );

    const category = link.category.trim();
    return {
      id: link.id,
      name: link.name.trim(),
      url: normalizeUrl(link.url),
      category: categories.includes(category) ? category : UNCATEGORIZED,
      favorite: link.favorite,
      createdAt: link.createdAt,
      lastOpened: link.lastOpened,
    } satisfies AppLink;
  });

  if (new Set(links.map((link) => link.id)).size !== links.length)
    throw new Error("O backup contém identificadores repetidos.");

  return { version: 1, categories, links };
}

/** Merges an imported backup into the current collection, keeping existing links. */
export function mergeBackup(
  current: Collection,
  imported: Collection,
): Collection {
  const categories = [
    ...new Set([...current.categories, ...imported.categories]),
  ];
  const known = new Set(current.links.map((link) => link.url));
  const added = imported.links
    .filter((link) => {
      if (known.has(link.url)) return false;
      known.add(link.url);
      return true;
    })
    .map((link) => ({ ...link, id: crypto.randomUUID() }));

  if (
    current.links.length + added.length > MAX_LINKS ||
    categories.length > MAX_CATEGORIES
  )
    throw new Error(
      "A coleção ultrapassaria o limite de 2.000 apps ou 100 categorias.",
    );

  return { version: 1, categories, links: [...current.links, ...added] };
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/** Filters by view, category and search query, then applies the chosen order. */
export function filterLinks(
  links: AppLink[],
  options: FilterOptions,
): AppLink[] {
  const terms = fold(options.query.trim()).split(/\s+/).filter(Boolean);
  return links
    .filter(
      (link) =>
        (!options.category || link.category === options.category) &&
        (options.view !== "favorites" || link.favorite) &&
        (options.view !== "recent" || link.lastOpened > 0) &&
        terms.every((term) => {
          if (term === "is:favorito") return link.favorite;
          if (term === "is:nunca") return link.lastOpened === 0;
          if (term.startsWith("#") && term.length > 1)
            return fold(link.category).includes(term.slice(1));
          if (term.startsWith("@") && term.length > 1) {
            const host = fold(new URL(link.url).hostname);
            const domain = term.slice(1);
            return host === domain || host.endsWith(`.${domain}`);
          }
          return fold(`${link.name} ${link.url} ${link.category}`).includes(term);
        }),
    )
    .sort((a, b) =>
      options.view === "recent"
        ? b.lastOpened - a.lastOpened
        : options.sort === "forgotten"
          ? a.lastOpened - b.lastOpened || a.createdAt - b.createdAt
        : options.sort === "name"
          ? a.name.localeCompare(b.name, "pt-BR")
          : b.createdAt - a.createdAt,
    );
}

/** Editable starter selection shown on a first visit. */
export function initialCollection(): Collection {
  const categories = [
    "Produtividade",
    "Design",
    "Inteligência artificial",
    "Desenvolvimento",
    "Entretenimento",
  ];
  const links: Array<[string, string, string, boolean]> = [
    ["ChatGPT", "https://chatgpt.com/", "Inteligência artificial", true],
    ["Notion", "https://www.notion.so/", "Produtividade", true],
    ["Figma", "https://www.figma.com/", "Design", true],
    ["Canva", "https://www.canva.com/", "Design", false],
    ["Google Drive", "https://drive.google.com/", "Produtividade", false],
    ["GitHub", "https://github.com/", "Desenvolvimento", false],
    ["YouTube", "https://www.youtube.com/", "Entretenimento", false],
    ["Spotify", "https://open.spotify.com/", "Entretenimento", false],
  ];
  return {
    version: 1,
    categories,
    links: links.map(([name, url, category, favorite], index) => ({
      id: `starter-${index}`,
      name,
      url,
      category,
      favorite,
      createdAt: 8 - index,
      lastOpened: 0,
    })),
  };
}

/** Removes only known tracking parameters; functional query values stay intact. */
export function cleanTrackingUrl(input: string): string {
  const url = new URL(normalizeUrl(input));
  const tracking = new Set(["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid"]);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || tracking.has(key.toLowerCase()))
      url.searchParams.delete(key);
  }
  return url.href;
}

/** A portable text list containing only the library links selected by the user. */
export function linksToMarkdown(links: AppLink[]): string {
  return links.map((link) => {
    const name = link.name.replace(/\s+/g, " ").replace(/[\\[\]]/g, "\\$&");
    const url = link.url.replace(/</g, "%3C").replace(/>/g, "%3E");
    return `- [${name}](<${url}>)`;
  }).join("\n");
}
