import { ChartNetwork, Sparkles } from "lucide-react";
import { Empty, EmptyDescription, EmptyTitle } from "./ui/empty";
import type { IntelligenceView } from "../types/library";

const COPY: Record<
  IntelligenceView,
  { title: string; body: string; icon: typeof ChartNetwork }
> = {
  relationships: {
    title: "Relationships",
    body: "A calm map of how notes and files connect is coming soon. Your files stay on disk — nothing to enable.",
    icon: ChartNetwork,
  },
  copilot: {
    title: "File Copilot",
    body: "Optional local assistance for understanding folders will land here. Entropy stays fully usable offline without it.",
    icon: Sparkles,
  },
};

export function IntelligenceComingSoon({ view }: { view: IntelligenceView }) {
  const copy = COPY[view];
  const Icon = copy.icon;
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-background px-8">
      <Empty className="max-w-md py-16">
        <Icon className="mx-auto mb-4 size-8 text-muted-foreground" strokeWidth={1.5} />
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.body}</EmptyDescription>
      </Empty>
    </div>
  );
}
