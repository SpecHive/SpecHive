export const MAX_ARTIFACT_NAME_LENGTH = 255;

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

export function sanitizeArtifactName(name: string): string {
  return name
    .replace(/%2e%2e|%2f|%5c|%00/gi, '_')
    .replace(/\0/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .slice(0, MAX_ARTIFACT_NAME_LENGTH);
}
