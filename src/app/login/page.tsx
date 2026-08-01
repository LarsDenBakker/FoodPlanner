import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold">FoodHelper</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Sign in to your household planner</p>
      </div>
      <LoginForm />
    </div>
  );
}
