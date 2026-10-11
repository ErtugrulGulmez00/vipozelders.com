import { Logo } from "@/components/site/logo";
import { NotFoundContent } from "@/components/site/not-found-content";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="mx-auto max-w-6xl px-4 py-5">
        <Logo />
      </header>
      <NotFoundContent />
    </div>
  );
}
