import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '@/shared/components/ui/dialog';
import { Form, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { apiClient } from '@/shared/lib/api-client';
import type { Project, TokenCreatedResponse } from '@/types/api';

export function CreateTokenDialog({
  open,
  projects,
  selectedProjectIds,
  onClose,
  onCreated,
}: {
  open: boolean;
  projects: Project[];
  selectedProjectIds: string[];
  onClose: () => void;
  onCreated: (token: TokenCreatedResponse) => void;
}) {
  const [name, setName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(() =>
    selectedProjectIds.length === 1 ? selectedProjectIds[0] : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setName('');
    setSelectedProjectId(selectedProjectIds.length === 1 ? selectedProjectIds[0] : '');
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Token name is required');
      return;
    }
    if (trimmed.length > 100) {
      setError('Token name must be 100 characters or less');
      return;
    }
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const token = await apiClient.post<TokenCreatedResponse>('/v1/tokens', {
        name: trimmed,
        projectId: selectedProjectId,
      });
      handleClose();
      onCreated(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Generate Token</DialogHeader>
      <Form onSubmit={handleSubmit}>
        <FormItem>
          <FormLabel htmlFor="token-project">Project</FormLabel>
          <select
            id="token-project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FormItem>
        <FormItem>
          <FormLabel htmlFor="token-name">Name</FormLabel>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CI Pipeline"
            disabled={submitting}
            autoFocus
          />
          <FormMessage>{error}</FormMessage>
        </FormItem>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </Form>
    </Dialog>
  );
}
