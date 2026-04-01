import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useApi } from '@/shared/hooks/use-api';
import type { PaginatedResponse, Project } from '@/types/api';

interface ProjectContextValue {
  projects: Project[];
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
  isAllSelected: boolean;
  loading: boolean;
  refetchProjects: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

function getStorageKey(orgId: string): string {
  return `spechive_selected_projects_${orgId}`;
}

function readSelectedProjectsFromStorage(orgId: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

function writeSelectedProjectsToStorage(orgId: string, ids: string[]): void {
  if (!orgId) return;
  try {
    localStorage.setItem(getStorageKey(orgId), JSON.stringify(ids));
  } catch {
    // localStorage full or unavailable — degrade to in-memory only
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  const orgId = organization?.id ?? '';

  const {
    data: projectsData,
    loading,
    refetch,
  } = useApi<PaginatedResponse<Project>>('/v1/projects');

  // Empty array means "all selected" — no explicit selection made yet
  const [selectedIds, setSelectedIdsState] = useState<string[]>(() =>
    readSelectedProjectsFromStorage(orgId),
  );

  const projects = useMemo(() => projectsData?.data ?? [], [projectsData]);

  // Org switching invalidates the previous selection — re-hydrate from storage
  useEffect(() => {
    setSelectedIdsState(readSelectedProjectsFromStorage(orgId));
  }, [orgId]);

  const isAllSelected = selectedIds.length === 0 || selectedIds.length === projects.length;

  const selectedProjectIds = useMemo(() => {
    if (selectedIds.length === 0) {
      return projects.map((p) => p.id);
    }
    const valid = selectedIds.filter((id) => projects.some((p) => p.id === id));
    return valid.length > 0 ? valid : projects.map((p) => p.id);
  }, [selectedIds, projects]);

  const setSelectedProjectIds = useCallback(
    (ids: string[]) => {
      setSelectedIdsState(ids);
      writeSelectedProjectsToStorage(orgId, ids);
    },
    [orgId],
  );

  const value = useMemo(
    () => ({
      projects,
      selectedProjectIds,
      setSelectedProjectIds,
      isAllSelected,
      loading,
      refetchProjects: refetch,
    }),
    [projects, selectedProjectIds, setSelectedProjectIds, isAllSelected, loading, refetch],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
