import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ART } from "@/lib/format";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Progress } from "@/components/ui/card";

export default function Vocab() {
  const { data, error, loading } = useApi<{ id: string; title: string; topic: string; words: number; known: number }[]>("/sat/vocab");
  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title={"SAT vocabulary"} subtitle={"Each unit contains 10 words, a passage showing them in context, and a quiz to check your understanding."} image={ART.painting} position="center 35%" />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data!.map((u, i) => (
            <Link key={u.id} to={`/sat/vocab/${u.id}`} className="group flex flex-col gap-3 rounded-2xl border border-border p-5 hover:border-primary">
              <span className="text-xs text-muted-foreground">
                Unit {i + 1} · {u.topic}
              </span>
              <span className="font-display text-xl font-semibold">{u.title}</span>
              <Progress value={(u.known / u.words) * 100} tone="ok" />
              <span className="flex items-center justify-between text-sm text-muted-foreground">
                {u.known} from {u.words} words learned
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
