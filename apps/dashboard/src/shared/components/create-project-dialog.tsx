import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '@/shared/components/ui/dialog';
import { Form, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { apiClient } from '@/shared/lib/api-client';
import type { ProjectResponse } from '@/types/api';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectResponse) => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setName('');
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name is required');
      return;
    }
    if (trimmed.length > 100) {
      setError('Project name must be 100 characters or less');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const project = await apiClient.post<ProjectResponse>('/v1/projects', { name: trimmed });
      toast.success(`Project "${project.name}" created`);
      handleClose();
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Create Project</DialogHeader>
      <Form onSubmit={handleSubmit}>
        <FormItem>
          <FormLabel htmlFor="project-name">Name</FormLabel>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Project"
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
            {submitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </Form>
    </Dialog>
  );
}
