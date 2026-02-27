export const MAX_ARTIFACT_NAME_LENGTH = 255;

export function sanitizeArtifactName(name: string): string {
  return name
    .replace(/%2e%2e|%2f|%5c|%00/gi, '_')
    .replace(/\0/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .slice(0, MAX_ARTIFACT_NAME_LENGTH);
}
