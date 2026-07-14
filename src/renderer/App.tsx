import { FolderOpen, FolderPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import BrandMark from './components/BrandMark';
import WorkspaceView from './components/WorkspaceView';
import Button from './components/ui/button';
import type { WorkspaceSelection } from '../shared/workspace';

function OnboardingView({
  error,
  restoring,
  onCreate,
  onOpen
}: {
  error: string | null;
  restoring: boolean;
  onCreate: () => void;
  onOpen: () => void;
}) {
  return (
    <section className="flex w-full max-w-2xl flex-col items-center pt-14 text-center animate-enter sm:pt-20">
      <BrandMark />

      <div className="mt-6 space-y-5">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-entropy-text sm:text-5xl">Entropy</h1>
        <p className="mx-auto max-w-md text-base leading-7 text-entropy-muted sm:text-lg">
          Your ideas have a place. Your files keep theirs.
        </p>
      </div>

      {restoring ? (
        <p className="mt-10 text-sm text-entropy-muted">Restoring your last workspace…</p>
      ) : (
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
      )}

      {error ? (
        <div
          role="alert"
          className="mt-6 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm leading-6 text-red-200"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreLastWorkspace() {
      setRestoring(true);
      setError(null);

      try {
        const result = await window.entropy.getLastWorkspace();
        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setError(result.error);
          setWorkspace(null);
          return;
        }

        setWorkspace(result.data);
      } catch {
        if (!cancelled) {
          setError('Could not restore the last workspace.');
          setWorkspace(null);
        }
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    void restoreLastWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  async function pickWorkspace(action: 'create' | 'open') {
    setError(null);

    try {
      const result = await window.entropy.chooseWorkspace(action);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setWorkspace(result.data);
      }
    } catch {
      setError('Something went wrong while choosing a workspace.');
    }
  }

  async function leaveWorkspace() {
    setError(null);
    setWorkspace(null);

    try {
      const result = await window.entropy.clearLastWorkspace();
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError('Could not clear the remembered workspace.');
    }
  }

  return (
    <main className="min-h-screen bg-entropy-background px-6 text-entropy-text">
      <div
        className={[
          'mx-auto flex min-h-screen w-full flex-col items-center justify-start pb-10',
          workspace ? 'max-w-6xl' : 'max-w-5xl'
        ].join(' ')}
      >
        {workspace ? (
          <WorkspaceView workspace={workspace} onChangeWorkspace={() => void leaveWorkspace()} />
        ) : (
          <OnboardingView
            error={error}
            restoring={restoring}
            onCreate={() => void pickWorkspace('create')}
            onOpen={() => void pickWorkspace('open')}
          />
        )}
      </div>
    </main>
  );
}
