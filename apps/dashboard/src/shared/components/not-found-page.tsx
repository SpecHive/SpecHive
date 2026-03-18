import { Link } from 'react-router';

import { buttonVariants } from '@/shared/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-center">
      <div className="space-y-2">
        <h1 className="text-8xl font-bold tracking-tight text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link to="/" className={buttonVariants()}>
        Go to Dashboard
      </Link>
    </div>
  );
}
