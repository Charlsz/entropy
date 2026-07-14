import { FolderOpen, FolderPlus } from 'lucide-react';
import { useState } from 'react';
import BrandMark from './components/BrandMark';
import WorkspaceView from './components/WorkspaceView';
import Button from './components/ui/button';
import type { WorkspaceSelection } from '../shared/workspace';

function OnboardingView({ onCreate, onOpen }: { onCreate: () => void; onOpen: () => void }) {
  return (
    <section className="flex w-full max-w-2xl flex-col items-center pt-14 text-center animate-enter sm:pt-20">
      <BrandMark />

      <div className="mt-6 space-y-5">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-entropy-text sm:text-5xl">
          Entropy
        </h1>
        <p className="mx-auto max-w-md text-base leading-7 text-entropy-muted sm:text-lg">
          Your ideas have a place. Your files keep theirs.
        </p>
      </div>

      <div className="mt-12 grid w-full gap-3 sm:grid-cols-2">
        <Button onClick={onCreate} className="w-full">
          <FolderPlus className="h-4 w-4" />
          Create Workspace
        </Button>
        <Button variant="secondary" onClick={onOpen} className="w-full">
          <FolderOpen className="h-4 w-4" />
          Open Workspace
        </Button>
      </div>
    </section>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);

  async function pickWorkspace(action: 'create' | 'open') {
    const selection = await window.entropy.chooseWorkspace(action);
    if (selection) {
      setWorkspace(selection);
    }
  }

  return (
    <main className="min-h-screen bg-entropy-background px-6 text-entropy-text">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-start pb-10">
        {workspace ? (
          <WorkspaceView workspace={workspace} />
        ) : (
          <OnboardingView onCreate={() => void pickWorkspace('create')} onOpen={() => void pickWorkspace('open')} />
        )}
      </div>
    </main>
  );
}