import type React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/schema-visualizer/ThemeToggle";

export default function Page() {
  return (
    <main className="relative min-h-[100svh] bg-background text-foreground flex items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <section className="max-w-2xl text-center space-y-8">
        <h1 className="text-pretty text-3xl md:text-5xl font-semibold tracking-tight">
          Visualize your database schema—instantly.
        </h1>
        <p className="text-lg text-muted-foreground">
          Beautiful, interactive diagrams for Drizzle and Prisma ORM
        </p>

        <div className="flex items-center justify-center">
          <CtaButton href="/visualizer" ariaLabel="Go to the schema visualizer">
            Start visualizing
          </CtaButton>
        </div>
      </section>
    </main>
  );
}

function CtaButton({
  href,
  children,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel || "Go"}
      className={cn(
        "group inline-flex items-center justify-center rounded-full px-6 py-3",
        // Orange CTA to match the design
        "bg-orange-500 text-black border border-border",
        "transition-colors hover:bg-orange-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <span className="font-medium tracking-tight">{children}</span>
      <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">{"→"}</span>
    </Link>
  );
}
