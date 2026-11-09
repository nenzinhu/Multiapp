"use client";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Folder,
  FolderPlus,
  Grid2X2,
  LayoutGrid,
  Link2,
  List,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  filterLinks,
  initialCollection,
  mergeBackup,
  normalizeUrl,
  STORAGE_KEY,
  suggestedName,
  UNCATEGORIZED,
  validateBackup,
  type AppLink,
  type Collection,
} from "@/lib/collection";

type View = "all" | "favorites" | "recent";
type Notice = { message: string; error?: boolean; undo?: () => void };
type Editor = {
  link?: AppLink;
  url: string;
  name: string;
  category: string;
  favorite: boolean;
};
const EMPTY: Collection = { version: 1, categories: [], links: [] };
const categoryColors = ["blue", "orange", "violet", "green", "pink"];
function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        multiapp<span className="brand-period">.</span>
      </span>
    </span>
  );
}
function Favicon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="favicon">
      {failed ? (
        <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`}
          alt=""
          width="28"
          height="28"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) previousFocus.current = document.activeElement as HTMLElement;
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`app-dialog ${className}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = previousFocus.current;
          if (target?.isConnected && !target.closest('[role="menu"]'))
            target.focus();
          else document.getElementById("search")?.focus();
        }}
      >
        <div className="dialog-heading">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Fechar">
            <X size={20} />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export default function Home() {
  const reduceMotion = useReducedMotion();
  const [collection, setCollection] = useState<Collection>(EMPTY);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [view, setView] = useState<View>("all");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [layout, setLayout] = useState("grid");
  const [quickUrl, setQuickUrl] = useState("");
  const [quickError, setQuickError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [fieldError, setFieldError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const [manageCategories, setManageCategories] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [importing, setImporting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? validateBackup(JSON.parse(raw)) : initialCollection();
      if (!raw) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setCollection(data);
      if (localStorage.getItem("multiapp.layout") === "list") setLayout("list");
      if (localStorage.getItem("multiapp.sort") === "name") setSort("name");
    } catch {
      setStorageError(
        "Não foi possível ler ou salvar a coleção. Libere o armazenamento do navegador e recarregue. Os dados existentes não foram alterados.",
      );
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        setCollection(
          event.newValue ? validateBackup(JSON.parse(event.newValue)) : EMPTY,
        );
        setStorageError("");
      } catch {
        setStorageError(
          "A coleção mudou em outra aba, mas não pôde ser lida. Recarregue para tentar novamente.",
        );
      }
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  function commit(
    transform: (current: Collection) => Collection,
  ): Collection | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? validateBackup(JSON.parse(raw)) : EMPTY;
      const next = transform(current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setCollection(next);
      setStorageError("");
      return next;
    } catch (error) {
      setNotice({
        message:
          error instanceof DOMException
            ? "Armazenamento indisponível ou cheio. Exporte um backup e libere espaço."
            : `Não foi possível salvar. ${(error as Error).message}`,
        error: true,
      });
      return null;
    }
  }
  function notify(message: string) {
    setNotice({ message });
  }
  function navigate(nextView: View, nextCategory = "") {
    setView(nextView);
    setCategory(nextCategory);
    setMobileOpen(false);
  }
  function preference(key: "layout" | "sort", value: string) {
    if (key === "layout") setLayout(value);
    else setSort(value);
    try {
      localStorage.setItem(`multiapp.${key}`, value);
    } catch {
      notify("Preferência aplicada somente nesta sessão.");
    }
  }
  function openEditor(link?: AppLink, url = "") {
    setFieldError(null);
    setEditor(
      link
        ? {
            link,
            url: link.url,
            name: link.name,
            category: link.category,
            favorite: link.favorite,
          }
        : {
            url,
            name: url ? suggestedName(url) : "",
            category: category || UNCATEGORIZED,
            favorite: false,
          },
    );
    setEditorOpen(true);
  }
  function quickAdd(event: FormEvent) {
    event.preventDefault();
    try {
      const url = normalizeUrl(quickUrl);
      setQuickError("");
      openEditor(undefined, url);
    } catch (error) {
      setQuickError((error as Error).message);
      document.getElementById("quick-url")?.focus();
    }
  }
  function saveLink(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    let url: string;
    try {
      url = normalizeUrl(editor.url);
    } catch (error) {
      setFieldError({ field: "url", message: (error as Error).message });
      document.getElementById("link-url")?.focus();
      return;
    }
    if (!editor.name.trim()) {
      setFieldError({
        field: "name",
        message: "Dê um nome para encontrar este app depois.",
      });
      document.getElementById("link-name")?.focus();
      return;
    }
    let reason = "";
    const result = commit((current) => {
      if (
        current.links.some(
          (link) => link.url === url && link.id !== editor.link?.id,
        )
      ) {
        reason =
          "Esta URL já está na coleção. Busque pelo domínio para encontrá-la.";
        throw new Error(reason);
      }
      if (editor.link) {
        const latest = current.links.find(
          (link) => link.id === editor.link!.id,
        );
        if (
          !latest ||
          latest.url !== editor.link.url ||
          latest.name !== editor.link.name ||
          latest.category !== editor.link.category ||
          latest.favorite !== editor.link.favorite
        ) {
          reason =
            "Este app mudou em outra aba. Feche e abra a edição novamente.";
          throw new Error(reason);
        }
      } else if (current.links.length >= 2000)
        throw new Error("Limite de 2.000 apps atingido.");
      const link: AppLink = {
        id: editor.link?.id || crypto.randomUUID(),
        name: editor.name.trim(),
        url,
        category: current.categories.includes(editor.category)
          ? editor.category
          : UNCATEGORIZED,
        favorite: editor.favorite,
        createdAt: editor.link?.createdAt || Date.now(),
        lastOpened:
          current.links.find((item) => item.id === editor.link?.id)
            ?.lastOpened || 0,
      };
      return {
        ...current,
        links: editor.link
          ? current.links.map((item) => (item.id === link.id ? link : item))
          : [link, ...current.links],
      };
    });
    if (result) {
      setEditorOpen(false);
      setEditor(null);
      setQuickUrl("");
      notify(
        editor.link ? "Alterações salvas." : "App adicionado à sua coleção.",
      );
    } else {
      setFieldError({
        field: "url",
        message:
          reason ||
          "Não foi possível salvar. Verifique o armazenamento e tente novamente.",
      });
      document.getElementById("link-url")?.focus();
    }
  }
  function recordOpen(link: AppLink) {
    commit((current) => ({
      ...current,
      links: current.links.map((item) =>
        item.id === link.id ? { ...item, lastOpened: Date.now() } : item,
      ),
    }));
  }
  function toggleFavorite(link: AppLink) {
    const result = commit((current) => ({
      ...current,
      links: current.links.map((item) =>
        item.id === link.id ? { ...item, favorite: !item.favorite } : item,
      ),
    }));
    if (result)
      notify(
        result.links.find((item) => item.id === link.id)?.favorite
          ? `${link.name} adicionado aos favoritos.`
          : `${link.name} removido dos favoritos.`,
      );
  }
  function removeLink(link: AppLink) {
    let deleted: AppLink | undefined;
    const result = commit((current) => {
      deleted = current.links.find((item) => item.id === link.id);
      return {
        ...current,
        links: current.links.filter((item) => item.id !== link.id),
      };
    });
    if (result && deleted) {
      const removed = deleted;
      setNotice({
        message: `${removed.name} removido.`,
        undo: () => {
          if (
            commit((current) => ({
              ...current,
              links: current.links.some((item) => item.url === removed.url)
                ? current.links
                : [
                    {
                      ...removed,
                      category: current.categories.includes(removed.category)
                        ? removed.category
                        : UNCATEGORIZED,
                    },
                    ...current.links,
                  ],
            }))
          )
            notify("App restaurado.");
        },
      });
      searchRef.current?.focus();
    }
  }
  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      notify("URL copiada.");
    } catch {
      setNotice({
        message:
          "Não foi possível copiar. Abra Editar e copie o endereço no campo URL.",
        error: true,
      });
    }
  }
  function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) {
      setCategoryError("Digite o nome da categoria.");
      document.getElementById("category-name")?.focus();
      return;
    }
    if (
      name.toLocaleLowerCase("pt-BR") ===
        UNCATEGORIZED.toLocaleLowerCase("pt-BR") ||
      collection.categories.some(
        (item) =>
          item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      setCategoryError("Essa categoria já existe.");
      return;
    }
    if (
      commit((current) => {
        if (current.categories.length >= 100)
          throw new Error("Limite de 100 categorias atingido.");
        if (
          current.categories.some(
            (item) =>
              item.toLocaleLowerCase("pt-BR") ===
              name.toLocaleLowerCase("pt-BR"),
          )
        )
          throw new Error("Essa categoria já existe.");
        return { ...current, categories: [...current.categories, name] };
      })
    ) {
      setCategoryName("");
      setCategoryError("");
      notify("Categoria criada.");
    }
  }
  function removeCategory(name: string) {
    let affected: string[] = [];
    const result = commit((current) => {
      affected = current.links
        .filter((link) => link.category === name)
        .map((link) => link.id);
      return {
        ...current,
        categories: current.categories.filter((item) => item !== name),
        links: current.links.map((link) =>
          link.category === name ? { ...link, category: UNCATEGORIZED } : link,
        ),
      };
    });
    if (result) {
      if (category === name) setCategory("");
      setNotice({
        message: "Categoria removida. Os apps foram mantidos em Sem categoria.",
        undo: () => {
          if (
            commit((current) => ({
              ...current,
              categories: [...new Set([...current.categories, name])],
              links: current.links.map((link) =>
                affected.includes(link.id) && link.category === UNCATEGORIZED
                  ? { ...link, category: name }
                  : link,
              ),
            }))
          )
            notify("Categoria restaurada.");
        },
      });
    }
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(collection, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `multiapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Backup exportado. Guarde o arquivo em um lugar seguro.");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    setBackupError("");
    setImporting(true);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("O arquivo deve ter até 5 MB.");
      const imported = validateBackup(JSON.parse(await file.text()));
      let added = 0;
      const result = commit((current) => {
        const next = mergeBackup(current, imported);
        added = next.links.length - current.links.length;
        return next;
      });
      if (result) {
        notify(
          `${added} ${added === 1 ? "app importado" : "apps importados"}. URLs já existentes foram preservadas.`,
        );
        setBackupOpen(false);
      } else
        setBackupError(
          "Não foi possível salvar o backup. Verifique o armazenamento e tente novamente.",
        );
    } catch (error) {
      setBackupError(
        error instanceof SyntaxError
          ? "Este arquivo não é um JSON válido. Selecione um backup do Multiapp."
          : (error as Error).message,
      );
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }
  const visible = useMemo(
    () => filterLinks(collection.links, { query, view, category, sort }),
    [collection, query, view, category, sort],
  );
  const favorites = collection.links.filter((link) => link.favorite).length;
  const title =
    category ||
    (view === "favorites"
      ? "Favoritos"
      : view === "recent"
        ? "Acessados recentemente"
        : "Todos os apps");
  function sidebarContent() {
    return (
      <>
        <div className="workspace-label">SEU ESPAÇO</div>
        <nav aria-label="Biblioteca" className="main-nav">
          <button
            className={view === "all" && !category ? "selected" : ""}
            onClick={() => navigate("all")}
            aria-current={view === "all" && !category ? "page" : undefined}
          >
            <LayoutGrid size={18} />
            <span>Todos os apps</span>
            <small>{collection.links.length}</small>
          </button>
          <button
            className={view === "favorites" ? "selected" : ""}
            onClick={() => navigate("favorites")}
            aria-current={view === "favorites" ? "page" : undefined}
          >
            <Star size={18} />
            <span>Favoritos</span>
            <small>{favorites}</small>
          </button>
          <button
            className={view === "recent" ? "selected" : ""}
            onClick={() => navigate("recent")}
            aria-current={view === "recent" ? "page" : undefined}
          >
            <Clock3 size={18} />
            <span>Recentes</span>
          </button>
        </nav>
        <div className="category-heading">
          <span>CATEGORIAS</span>
          <button
            className="icon-button small"
            title="Gerenciar categorias"
            aria-label="Gerenciar categorias"
            onClick={() => {
              setMobileOpen(false);
              setManageCategories(true);
            }}
          >
            <Plus size={17} />
          </button>
        </div>
        <nav aria-label="Categorias" className="category-nav">
          {collection.categories.map((name, index) => (
            <button
              key={name}
              className={category === name ? "selected" : ""}
              aria-current={category === name ? "page" : undefined}
              onClick={() => navigate("all", name)}
            >
              <span
                className={`category-dot ${categoryColors[index % categoryColors.length]}`}
              />
              <span className="nav-name">{name}</span>
              <small>
                {
                  collection.links.filter((link) => link.category === name)
                    .length
                }
              </small>
            </button>
          ))}
          <button
            className={category === UNCATEGORIZED ? "selected" : ""}
            onClick={() => navigate("all", UNCATEGORIZED)}
            aria-current={category === UNCATEGORIZED ? "page" : undefined}
          >
            <span className="category-dot gray" />
            <span className="nav-name">Sem categoria</span>
            <small>
              {
                collection.links.filter(
                  (link) => link.category === UNCATEGORIZED,
                ).length
              }
            </small>
          </button>
        </nav>
        <button
          className="new-category"
          onClick={() => {
            setMobileOpen(false);
            setManageCategories(true);
          }}
        >
          <FolderPlus size={17} />
          Nova categoria
        </button>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-note-icon">
              <ShieldCheck size={19} />
            </span>
            <strong>Seu espaço pessoal</strong>
            <p>
              Seus links ficam salvos
              <br />
              neste navegador.
            </p>
          </div>
          <button
            className="backup-nav"
            onClick={() => {
              setMobileOpen(false);
              setBackupOpen(true);
            }}
          >
            <ArrowDownToLine size={17} />
            Importar e exportar
            <ChevronRight size={15} />
          </button>
          <div className="sidebar-foot">
            <span className="tiny-mark">m.</span>
            <span>Menos abas. Mais foco.</span>
          </div>
        </div>
      </>
    );
  }
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: "easeOut" }}>
    <div className="app-shell">
      <a className="skip-link" href="#collection">
        Ir para os apps
      </a>
      <aside className="sidebar">
        <div className="brand-area">
          <Logo />
          <span className="personal-badge">PESSOAL</span>
        </div>
        {sidebarContent()}
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegação"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <Folder size={16} />
            <span>Meu espaço</span>
            <ChevronRight size={14} />
            <strong>Biblioteca</strong>
          </div>
          <span className="save-status">
            <span />
            {storageError
              ? "Armazenamento indisponível"
              : ready
                ? "Salvo neste navegador"
                : "Carregando coleção…"}
          </span>
          <button
            className="profile-avatar"
            onClick={() => setBackupOpen(true)}
            aria-label="Armazenamento e backup"
            title="Armazenamento e backup"
          >
            M
          </button>
        </header>
        <main>
          <motion.div className="page-heading" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div>
              <div className="eyebrow">SUA INTERNET, ORGANIZADA</div>
              <h1>
                Menos abas.<br /><span>Mais possibilidades.</span>
              </h1>
              <p>Seu universo de apps, em um espaço só seu.</p>
            </div>
            <button
              className="button primary add-top"
              disabled={!ready || !!storageError}
              onClick={() => (editor ? setEditorOpen(true) : openEditor())}
            >
              <Plus size={18} />
              Adicionar app
            </button>
          </motion.div>
          {storageError && (
            <div className="error-banner" role="alert">
              {storageError}
              <button
                className="button secondary"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </button>
            </div>
          )}
          <div className="workspace-overview" aria-label="Resumo da biblioteca">
            <span><LayoutGrid size={15} /><strong>{ready ? collection.links.length : "—"}</strong> apps na coleção</span>
            <span><Star size={15} /><strong>{ready ? favorites : "—"}</strong> favoritos</span>
            <span><Folder size={15} /><strong>{ready ? collection.categories.length : "—"}</strong> categorias</span>
            <span className="overview-note"><span /> Tudo no seu ritmo</span>
          </div>
          <section className="capture-box" aria-label="Adicionar por URL">
            <div className="capture-symbol">
              <Link2 size={23} />
            </div>
            <div className="capture-content">
              <label htmlFor="quick-url">Um novo app por aí?</label>
              <span>Cole o link e deixe o resto com a gente.</span>
            </div>
            <form onSubmit={quickAdd} noValidate className="capture-form">
              <div className="url-wrap">
                <Link2 size={16} />
                <input
                  id="quick-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="Cole a URL do app aqui..."
                  value={quickUrl}
                  aria-invalid={!!quickError}
                  aria-describedby={quickError ? "quick-error" : undefined}
                  onChange={(event) => {
                    setQuickUrl(event.target.value);
                    setQuickError("");
                  }}
                />
              </div>
              <button
                className="button primary"
                disabled={!ready || !!storageError}
                type="submit"
              >
                <Plus size={17} />
                <span>Adicionar</span>
              </button>
            </form>
            {quickError && (
              <p
                id="quick-error"
                className="capture-error field-error"
                role="alert"
              >
                {quickError}
              </p>
            )}
          </section>
          {ready && favorites > 0 && view === "all" && !category && !query && (
            <section className="favorites-shelf" aria-labelledby="favorites-title">
              <div className="shelf-heading"><h2 id="favorites-title"><Star size={17} /> Sempre por perto</h2><button className="text-button" onClick={() => navigate("favorites")}>Ver favoritos <ArrowUpRight size={14} /></button></div>
              <div className="favorite-shortcuts">
                {collection.links.filter((link) => link.favorite).slice(0, 6).map((link) => (
                  <motion.a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="favorite-shortcut" onClick={() => recordOpen(link)} whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
                    <Favicon url={link.url} name={link.name} /><span>{link.name}</span><ArrowUpRight size={14} /><span className="sr-only">Abrir em nova aba</span>
                  </motion.a>
                ))}
              </div>
            </section>
          )}
          <section
            id="collection"
            aria-labelledby="collection-title"
            className="collection-section"
          >
            <div className="collection-heading">
              <div>
                <h2 id="collection-title">
                  {title}
                  <span className="count-badge">{visible.length}</span>
                </h2>
                <p>
                  {category
                    ? "Tudo desta categoria, em um só lugar."
                    : view === "favorites"
                      ? "Os que você quer sempre por perto."
                      : view === "recent"
                        ? "Os apps que você abriu por aqui."
                        : "Um atalho para tudo o que você usa."}
                </p>
              </div>
              <div className="layout-toggle" aria-label="Visualização">
                <button
                  className={layout === "grid" ? "active" : ""}
                  aria-label="Visualização em grade"
                  aria-pressed={layout === "grid"}
                  title="Grade"
                  onClick={() => preference("layout", "grid")}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  className={layout === "list" ? "active" : ""}
                  aria-label="Visualização em lista"
                  aria-pressed={layout === "list"}
                  title="Lista"
                  onClick={() => preference("layout", "list")}
                >
                  <List size={19} />
                </button>
              </div>
            </div>
            <div className="collection-tools">
              <div className="search-field">
                <Search size={18} />
                <input
                  id="search"
                  ref={searchRef}
                  aria-label="Buscar apps"
                  placeholder="Buscar por nome, link ou categoria..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button
                    className="icon-button small"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    aria-label="Limpar busca"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <kbd>Ctrl K</kbd>
                )}
              </div>
              <div className="sort-field">
                <label htmlFor="sort">Ordenar por</label>
                <select
                  id="sort"
                  value={view === "recent" ? "recent" : sort}
                  disabled={view === "recent"}
                  onChange={(event) => preference("sort", event.target.value)}
                >
                  {view === "recent" ? (
                    <option value="recent">Último acesso</option>
                  ) : (
                    <>
                      <option value="newest">Mais recentes</option>
                      <option value="name">Nome A–Z</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            {(category || view !== "all" || query) && (
              <div className="filter-summary">
                <span>
                  {visible.length}{" "}
                  {visible.length === 1 ? "app encontrado" : "apps encontrados"}
                  {query && ` para “${query}”`}
                </span>
                <button
                  onClick={() => {
                    setQuery("");
                    navigate("all");
                  }}
                  className="text-button"
                >
                  Limpar filtros
                  <X size={13} />
                </button>
              </div>
            )}
            {!ready ? (
              <div className="empty-state" role="status">
                <span className="empty-symbol">
                  <LayoutGrid size={25} />
                </span>
                <h3>Carregando sua coleção…</h3>
              </div>
            ) : visible.length > 0 ? (
              <div
                className={`app-grid ${layout === "list" ? "list-view" : ""}`}
              >
                <AnimatePresence initial={false}>
                {visible.map((link, index) => (
                  <motion.article layout={!reduceMotion ? "position" : false} className="app-card" key={link.id}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                    transition={{ opacity: { duration: 0.18 }, y: { duration: 0.3, delay: Math.min(index, 7) * 0.035 }, layout: { duration: 0.25 } }}
                    whileHover={reduceMotion ? undefined : { y: -4 }}
                  >
                    <div className="card-top">
                      <Favicon key={link.url} url={link.url} name={link.name} />
                      <div className="card-actions">
                        <button
                          className={`icon-button favorite-button ${link.favorite ? "is-favorite" : ""}`}
                          aria-label={
                            link.favorite
                              ? `Remover ${link.name} dos favoritos`
                              : `Favoritar ${link.name}`
                          }
                          aria-pressed={link.favorite}
                          title={
                            link.favorite
                              ? "Remover dos favoritos"
                              : "Favoritar"
                          }
                          onClick={() => toggleFavorite(link)}
                        >
                          <Star size={16} />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="icon-button"
                            aria-label={`Opções de ${link.name}`}
                            title="Opções do app"
                          >
                            <MoreHorizontal size={19} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="app-menu">
                            <DropdownMenuItem onSelect={() => openEditor(link)}>
                              <Pencil size={15} />
                              Editar app
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => copyLink(link.url)}
                            >
                              <Copy size={15} />
                              Copiar URL
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => removeLink(link)}
                            >
                              <Trash2 size={15} />
                              Remover app
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <a
                      className="card-link"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Abrir ${link.name} em nova aba: ${link.url}`}
                      onClick={() => recordOpen(link)}
                    >
                      <h3>{link.name}</h3>
                      <span className="card-domain">
                        {new URL(link.url).hostname.replace(/^www\./, "")}
                      </span>
                      <ArrowUpRight className="open-arrow" size={17} />
                      <span className="sr-only"> — abrir em nova aba</span>
                    </a>
                    <div className="card-footer">
                      <span
                        className={`category-pill ${categoryColors[Math.max(0, collection.categories.indexOf(link.category)) % categoryColors.length]}`}
                      >
                        <span />
                        {link.category}
                      </span>
                    </div>
                  </motion.article>
                ))}
                </AnimatePresence>
                {layout === "grid" && view === "all" && !query && (
                  <button className="add-card" onClick={() => openEditor()}>
                    <span>
                      <Plus size={21} />
                    </span>
                    <strong>Adicionar app</strong>
                    <small>Seu próximo atalho</small>
                  </button>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-symbol">
                  {query ? (
                    <Search size={26} />
                  ) : view === "favorites" ? (
                    <Star size={26} />
                  ) : view === "recent" ? (
                    <Clock3 size={26} />
                  ) : (
                    <LayoutGrid size={26} />
                  )}
                </span>
                <h3>
                  {query
                    ? "Nenhum app encontrado"
                    : view === "favorites"
                      ? "Seus favoritos ficam aqui"
                      : view === "recent"
                        ? "Seu próximo clique começa aqui"
                        : "Espaço para seus próximos apps"}
                </h3>
                <p>
                  {query
                    ? "Tente outro nome, domínio ou categoria."
                    : view === "favorites"
                      ? "Toque na estrela de um app para deixá-lo sempre à mão."
                      : view === "recent"
                        ? "Abra um app da sua biblioteca para vê-lo nesta lista."
                        : "Cole uma URL acima ou adicione seu primeiro app."}
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    if (query) setQuery("");
                    else if (view !== "all") navigate("all");
                    else openEditor();
                  }}
                >
                  {query
                    ? "Limpar busca"
                    : view !== "all"
                      ? "Ver todos os apps"
                      : "Adicionar app"}
                </button>
              </div>
            )}
            {ready &&
              collection.links.some((link) =>
                link.id.startsWith("starter-"),
              ) && (
                <div className="starter-note">
                  <Sparkles size={15} />
                  <p>
                    Alguns apps para começar. Edite, remova e deixe a coleção
                    com a sua cara.
                  </p>
                </div>
              )}
          </section>
          <footer className="page-footer">
            <span>
              <ShieldCheck size={14} />
              Sua coleção é salva automaticamente neste navegador.
            </span>
            <button className="text-button" onClick={() => setBackupOpen(true)}>
              Fazer backup
              <ArrowUpRight size={14} />
            </button>
          </footer>
        </main>
      </div>
      <Modal
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Meu espaço"
        description="Sua biblioteca de apps"
        className="mobile-navigation"
      >
        {sidebarContent()}
      </Modal>
      <Modal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editor?.link ? "Editar app" : "Adicionar app"}
        description="Um link, um nome e um lugar na sua coleção."
      >
        {editor && (
          <form noValidate onSubmit={saveLink} className="editor-form">
            <div className="field">
              <label htmlFor="link-url">URL do app</label>
              <input
                id="link-url"
                autoFocus
                inputMode="url"
                type="text"
                autoComplete="off"
                placeholder="https://exemplo.com"
                maxLength={4096}
                value={editor.url}
                onChange={(event) => {
                  setEditor({ ...editor, url: event.target.value });
                  setFieldError(null);
                }}
                onBlur={() => {
                  if (!editor.name) {
                    try {
                      setEditor({
                        ...editor,
                        name: suggestedName(normalizeUrl(editor.url)),
                      });
                    } catch {
                      /* Keep invalid input for correction. */
                    }
                  }
                }}
                aria-invalid={fieldError?.field === "url"}
                aria-describedby={
                  fieldError?.field === "url" ? "link-url-error" : "url-help"
                }
              />
              <p id="url-help" className="field-help">
                O favicon é carregado automaticamente pelo domínio.
              </p>
              {fieldError?.field === "url" && (
                <p id="link-url-error" className="field-error" role="alert">
                  {fieldError.message}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="link-name">Nome do app</label>
              <input
                id="link-name"
                placeholder="Como você chama este app?"
                maxLength={80}
                value={editor.name}
                onChange={(event) => {
                  setEditor({ ...editor, name: event.target.value });
                  setFieldError(null);
                }}
                aria-invalid={fieldError?.field === "name"}
                aria-describedby={
                  fieldError?.field === "name" ? "link-name-error" : undefined
                }
              />
              {fieldError?.field === "name" && (
                <p id="link-name-error" className="field-error" role="alert">
                  {fieldError.message}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="link-category">Categoria</label>
              <select
                id="link-category"
                value={editor.category}
                onChange={(event) =>
                  setEditor({ ...editor, category: event.target.value })
                }
              >
                <option>{UNCATEGORIZED}</option>
                {collection.categories.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={editor.favorite}
                onChange={(event) =>
                  setEditor({ ...editor, favorite: event.target.checked })
                }
              />
              <Star size={16} />
              Adicionar aos favoritos
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setEditorOpen(false);
                  setEditor(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="button primary">
                <Check size={17} />
                {editor.link ? "Salvar alterações" : "Adicionar app"}
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={manageCategories}
        onOpenChange={setManageCategories}
        title="Suas categorias"
        description="Crie espaços para organizar os apps do seu jeito."
      >
        <form noValidate className="category-form" onSubmit={addCategory}>
          <label htmlFor="category-name">Nova categoria</label>
          <div>
            <input
              id="category-name"
              placeholder="Ex.: Trabalho, estudos, finanças…"
              value={categoryName}
              maxLength={40}
              aria-invalid={!!categoryError}
              aria-describedby={categoryError ? "category-error" : undefined}
              onChange={(event) => {
                setCategoryName(event.target.value);
                setCategoryError("");
              }}
            />
            <button className="button primary" type="submit">
              Criar
            </button>
          </div>
          {categoryError && (
            <p id="category-error" role="alert" className="field-error">
              {categoryError}
            </p>
          )}
        </form>
        <div className="category-list">
          {collection.categories.map((name, index) => (
            <div key={name}>
              <span
                className={`category-dot ${categoryColors[index % categoryColors.length]}`}
              />
              <span>{name}</span>
              <small>
                {
                  collection.links.filter((link) => link.category === name)
                    .length
                }{" "}
                apps
              </small>
              <button
                className="icon-button"
                aria-label={`Remover categoria ${name}`}
                title={`Remover categoria ${name}`}
                onClick={() => removeCategory(name)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="field-help">
          Ao remover uma categoria, os apps vão para “Sem categoria”. Nenhum
          link é apagado.
        </p>
      </Modal>
      <Modal
        open={backupOpen}
        onOpenChange={(open) => {
          if (!importing) setBackupOpen(open);
        }}
        title="Sua coleção vai com você"
        description="Exporte um backup para guardar ou levar seus apps para outro navegador."
      >
        <div className="backup-info">
          <ShieldCheck size={22} />
          <p>
            Os links ficam <strong>somente neste navegador</strong>. Não há
            sincronização entre aparelhos. Limpar os dados do navegador também
            apaga a coleção.
          </p>
        </div>
        <button
          className="backup-option"
          onClick={exportBackup}
          disabled={!ready || !!storageError}
        >
          <span>
            <ArrowDownToLine size={22} />
          </span>
          <div>
            <strong>Exportar backup</strong>
            <p>
              Baixar seus {collection.links.length} apps e categorias em JSON.
            </p>
          </div>
          <ChevronRight size={18} />
        </button>
        <button
          className="backup-option"
          disabled={importing || !!storageError}
          aria-busy={importing}
          onClick={() => importRef.current?.click()}
        >
          <span>
            <ArrowUpFromLine size={22} />
          </span>
          <div>
            <strong>{importing ? "Importando…" : "Importar backup"}</strong>
            <p>Adicionar apps de um arquivo. Os atuais são mantidos.</p>
          </div>
          <ChevronRight size={18} />
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Arquivo de backup JSON"
          onChange={(event) => importBackup(event.target.files?.[0])}
        />
        {backupError && (
          <p role="alert" className="field-error">
            {backupError}
          </p>
        )}
        <p className="field-help">
          Até 5 MB · 2.000 apps · URLs repetidas não são importadas.
          <br />
          Favicons são fornecidos pelo Google a partir do domínio do app.
        </p>
      </Modal>
      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice && (
          <div className={`app-toast ${notice.error ? "toast-error" : ""}`}>
            <span className="toast-symbol">
              {notice.error ? <X size={17} /> : <Check size={17} />}
            </span>
            <span>{notice.message}</span>
            {notice.undo && <button onClick={notice.undo}>Desfazer</button>}
            <button
              className="icon-button"
              aria-label="Dispensar mensagem"
              onClick={() => setNotice(null)}
            >
              <X size={17} />
            </button>
          </div>
        )}
      </div>
    </div>
    </MotionConfig>
  );
}
