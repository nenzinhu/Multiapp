/**
 * Which environment variables the server actually received. Names only: no
 * value is ever returned, so this is safe for `/api/health` and `/setup`.
 */
export function environmentReport(): Record<string, boolean> {
  const keys = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "POSTGRES_HOST",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DATABASE",
    "POSTGRES_PORT",
    "PGHOST",
    "PGUSER",
    "PGPASSWORD",
    "PGDATABASE",
    "PGPORT",
    "POSTGRES_URL_NON_POOLING",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ];
  const report: Record<string, boolean> = {};
  for (const key of keys) report[key] = Boolean(process.env[key]?.trim());
  return report;
}

export function hostingPlatform(): string {
  if (process.env.VERCEL) return "Vercel";
  if (process.env.RAILWAY_ENVIRONMENT) return "Railway";
  if (process.env.RENDER) return "Render";
  if (process.env.FLY_APP_NAME) return "Fly.io";
  if (process.env.NETLIFY) return "Netlify";
  if (process.env.KOYEB_APP_NAME) return "Koyeb";
  return "desconhecida";
}

/** Where to set the variable, in the words of the platform the app is on. */
export function whereToConfigure(): string {
  switch (hostingPlatform()) {
    case "Vercel":
      return "na Vercel: Project → Settings → Environment Variables → DATABASE_URL (Production e Preview) e depois Redeploy";
    case "Railway":
      return "no Railway: Service → Variables → DATABASE_URL e depois Deploy";
    case "Render":
      return "no Render: Environment → Environment Variables → DATABASE_URL e depois Manual Deploy";
    case "Fly.io":
      return "no Fly.io: `fly secrets set DATABASE_URL=...`";
    case "Netlify":
      return "na Netlify: Site configuration → Environment variables → DATABASE_URL e depois Deploys → Trigger deploy";
    case "Koyeb":
      return "no Koyeb: Service → Environment variables → DATABASE_URL e depois Redeploy";
    default:
      return "no painel da hospedagem (Environment variables) e reinicie o serviço";
  }
}
