'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { AuthProvider } from './AuthContext';
import { CatalogProvider } from './CatalogContext';
import EvoShopFooter from './EvoShopFooter';
import EvoShopNav from './EvoShopNav';
import RequestDrawer from './RequestDrawer';
import { RequestListProvider } from './RequestListContext';

/** The 1440px desktop frame — canvas shows outside it (README §3). At 1440
    and up this is pixel-identical to the original fixed frame; below that the
    frame fluidly tracks the viewport (MOBILE_FIX_PLAN.md, option B). */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The wizard steps render without the footer in the references; the
  // confirmation screen brings it back.
  const hideFooter = pathname.startsWith('/request') && pathname !== '/request/confirmation';

  return (
    <AuthProvider>
      <CatalogProvider>
        <RequestListProvider>
          <div className="relative mx-auto flex min-h-screen w-full max-w-frame flex-col bg-white">
            <Suspense fallback={null}>
              <EvoShopNav />
            </Suspense>
            <main className="flex flex-1 flex-col">{children}</main>
            {!hideFooter && <EvoShopFooter />}
          </div>
          <RequestDrawer />
        </RequestListProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
