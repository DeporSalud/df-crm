"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RecepcionRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return (
    <div className="py-12 text-center text-xs text-[var(--color-text-secondary)]">
      Redirigiendo al Dashboard y Recepción unificados...
    </div>
  );
}
