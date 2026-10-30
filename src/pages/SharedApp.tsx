import { useParams } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import { Logo } from "@/components/AppShell";
import { ErrorBox, Loading } from "@/components/Page";

// A student's vibe-coded app shared by link: no sign-in, the app runs in a sandbox without access to this site.

export default function SharedApp() {
  const { token = "" } = useParams();
  const { data, error, loading } = useApi<{ title: string; code: string; author: string; createdAt: number }>(`/shared/${token}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} className="m-6" />;
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-secondary px-4 py-3 text-secondary-foreground">
        <span className="flex items-center gap-3">
          <Logo className="text-white" />
          <span className="text-sm text-white/80">
            {data.title}
            {data.author ? ` · ${data.author}` : ""}
          </span>
        </span>
        <span className="text-xs text-white/60">Сделано учеником BSTS вместе с ИИ · {new Date(data.createdAt).toLocaleDateString("ru-RU")}</span>
      </header>
      <iframe title={data.title} sandbox="allow-scripts allow-modals" srcDoc={data.code} className="min-h-0 flex-1 border-0 bg-white" />
    </div>
  );
}
