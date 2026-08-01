import Link from "next/link";

const SECTIONS = [
  { href: "/recipes", title: "Recipes", description: "Browse and add household recipes." },
  { href: "/planner", title: "Planner", description: "Plan meals for the week ahead." },
  { href: "/grocery-list", title: "Grocery List", description: "See what to buy this week." },
  { href: "/pantry", title: "Pantry", description: "Track what's already on hand." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-black/10 p-5 transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
          >
            <h2 className="font-medium">{section.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
