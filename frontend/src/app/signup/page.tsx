import { MagicLinkCard } from "@/components/auth/magic-link-card";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <MagicLinkCard mode="signup" nextPath={params.next} />;
}
