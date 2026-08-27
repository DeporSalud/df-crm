"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RemesasRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/pagos");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400 font-semibold">Redirigiendo a Pagos & Facturación...</p>
      </div>
    </div>
  );
}
