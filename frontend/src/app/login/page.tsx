import { MagicLinkCard } from "@/components/auth/magic-link-card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <MagicLinkCard mode="login" nextPath={params.next} />;
}
