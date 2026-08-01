import Link from "next/link";
import { logout } from "@/server/actions/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/planner", label: "Planner" },
  { href: "/grocery-list", label: "Grocery List" },
  { href: "/pantry", label: "Pantry" },
];

export function NavBar() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button type="submit" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
