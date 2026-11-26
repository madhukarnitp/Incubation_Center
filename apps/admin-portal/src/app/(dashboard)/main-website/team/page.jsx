'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/ui/Loader';

export default function UnifiedTeamRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/team-management');
  }, [router]);

  return <Loader fullPage text="Opening Unified Team Management..." />;
}
