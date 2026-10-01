import { JournalApp } from '@/components/journal-app';
export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JournalApp initialTab="history" initialGameId={id} />;
}
