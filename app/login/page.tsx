import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/src/features/auth/session";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return <AuthForm mode="login" nextPath={nextPath} />;
}
