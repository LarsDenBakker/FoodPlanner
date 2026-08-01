import { verifySession } from "@/lib/dal";
import { NavBar } from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await verifySession();

  return (
    <div className="flex flex-1 flex-col">
      <NavBar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
