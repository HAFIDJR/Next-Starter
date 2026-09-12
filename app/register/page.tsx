import { redirect } from "next/navigation";

import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/src/features/auth/session";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return <AuthForm mode="register" nextPath={nextPath} />;
}