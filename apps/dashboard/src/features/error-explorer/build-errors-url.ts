export function buildErrorsUrl(params: {
  errorGroupId?: string | undefined;
  projectId?: string | undefined;
  branch?: string | undefined;
}): string {
  const search = new URLSearchParams();
  if (params.errorGroupId) search.set('errorGroupId', params.errorGroupId);
  if (params.projectId) search.set('projectId', params.projectId);
  if (params.branch) search.set('branch', params.branch);
  const qs = search.toString();
  return qs ? `/errors?${qs}` : '/errors';
}
