import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { WorkspaceSelection } from '../../shared/workspace';

export interface AppConfig {
  lastWorkspace: WorkspaceSelection | null;
}

const DEFAULT_CONFIG: AppConfig = {
  lastWorkspace: null
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function readAppConfig(): AppConfig {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;

    return {
      lastWorkspace: normalizeWorkspace(parsed.lastWorkspace)
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeAppConfig(config: AppConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export function getLastWorkspace(): WorkspaceSelection | null {
  return readAppConfig().lastWorkspace;
}

export function setLastWorkspace(workspace: WorkspaceSelection | null): void {
  const config = readAppConfig();
  config.lastWorkspace = workspace;
  writeAppConfig(config);
}

function normalizeWorkspace(value: unknown): WorkspaceSelection | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WorkspaceSelection>;
  if (typeof candidate.path !== 'string' || typeof candidate.name !== 'string') {
    return null;
  }

  if (!candidate.path.trim() || !candidate.name.trim()) {
    return null;
  }

  return {
    path: candidate.path,
    name: candidate.name
  };
}
