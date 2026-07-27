"use client";

// Ein-Klick-Schaltfläche „Neues Projekt": legt das Projekt sofort mit
// einem automatischen Namen an und navigiert direkt zur Upload-Seite.
// Kein Dialog, kein Zwischenschritt.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/lib/projekte/actions";
import { useDictionary } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function NewProjectButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dict = useDictionary();

  function handleClick() {
    startTransition(async () => {
      const result = await createProjectAction({}, new FormData());
      if (result.projektId) {
        router.push(`/app/projekt/${result.projektId}/upload`);
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? dict.projects.createPending : `+ ${dict.projects.newProject}`}
    </Button>
  );
}
