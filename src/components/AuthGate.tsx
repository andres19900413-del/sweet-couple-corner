import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

const PUBLIC_PATHS = new Set(["/auth"]);

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) navigate({ to: "/auth", replace: true });
    if (user && isPublic) navigate({ to: "/", replace: true });
  }, [user, loading, isPublic, navigate]);

  if (loading || (!user && !isPublic) || (user && isPublic)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Heart className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
