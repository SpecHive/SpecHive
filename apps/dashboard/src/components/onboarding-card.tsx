import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import type { TokenCreatedResponse } from '@/types/api';

interface OnboardingCardProps {
  onCreateProject: () => void;
  projectCreated: boolean;
  selectedProjectId: string | null;
  onComplete: () => void;
}

function StepBadge({ step, done }: { step: number; done: boolean }) {
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        done
          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {done ? <Check className="h-4 w-4" /> : step}
    </div>
  );
}

export function OnboardingCard({
  onCreateProject,
  projectCreated,
  selectedProjectId,
  onComplete,
}: OnboardingCardProps) {
  const [tokenValue, setTokenValue] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const tokenGenerated = tokenValue !== null;
  const currentStep = !projectCreated ? 1 : !tokenGenerated ? 2 : 3;

  async function handleGenerateToken() {
    if (!selectedProjectId) return;
    setGeneratingToken(true);
    setTokenError(null);
    try {
      const result = await apiClient.post<TokenCreatedResponse>(
        `/v1/projects/${selectedProjectId}/tokens`,
        { name: 'My First Token' },
      );
      setTokenValue(result.token);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setGeneratingToken(false);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied!');
    } catch {
      toast.error('Failed to copy');
    }
  }

  const configSnippet = `// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['@spechive/playwright-reporter', {
      apiUrl: 'https://your-spechive-instance.com',
      token: '${tokenValue ?? '<YOUR_TOKEN>'}',
    }],
  ],
});`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get started with SpecHive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Create project */}
        <div className="flex gap-4">
          <StepBadge step={1} done={projectCreated} />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">Create your first project</h3>
            {currentStep === 1 && (
              <div className="mt-2">
                <p className="mb-3 text-sm text-muted-foreground">
                  Projects organize your test runs. Start by creating one.
                </p>
                <Button size="sm" onClick={onCreateProject}>
                  Create Project
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Generate token */}
        <div className="flex gap-4">
          <StepBadge step={2} done={tokenGenerated} />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">Generate an API token</h3>
            {currentStep === 2 && (
              <div className="mt-2">
                <p className="mb-3 text-sm text-muted-foreground">
                  Tokens authenticate your CI pipeline to send test results.
                </p>
                {tokenError && <p className="mb-2 text-sm text-destructive">{tokenError}</p>}
                <Button size="sm" onClick={handleGenerateToken} disabled={generatingToken}>
                  {generatingToken ? 'Generating...' : 'Generate Token'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Configure reporter */}
        <div className="flex gap-4">
          <StepBadge step={3} done={false} />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">Configure your reporter</h3>
            {currentStep === 3 && (
              <div className="mt-2">
                <p className="mb-3 text-sm text-muted-foreground">
                  Add the SpecHive reporter to your Playwright config:
                </p>
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Your token</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      {tokenValue}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopy(tokenValue!)}
                      aria-label="Copy token"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                    <code>{configSnippet}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => handleCopy(configSnippet)}
                    aria-label="Copy config"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  Save your token — it won&apos;t be shown again after you leave this page.
                </p>
                <Button className="mt-4" size="sm" onClick={onComplete}>
                  Continue to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
