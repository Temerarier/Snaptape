"use client";

// Dialog „Neues Projekt" auf Basis der Design-System-Komponenten
// (Modal, Input, Button).
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProjectAction,
  type ProjectFormState,
} from "@/lib/projekte/actions";
import { useDictionary } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const initialState: ProjectFormState = {};

export function NewProjectDialog({ ctaLabel }: { ctaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const dict = useDictionary();
  const t = dict.projects;

  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
    }
  }, [open]);

  // Nach erfolgreichem Anlegen: Dialog schließen und direkt zur
  // Upload-Seite des neuen Projekts navigieren.
  useEffect(() => {
    if (state.success && state.projektId) {
      setOpen(false);
      router.push(`/app/projekt/${state.projektId}/upload`);
    }
  }, [state, router]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + {ctaLabel ?? t.newProject}
      </Button>
      <Modal
        offen={open}
        onSchliessen={() => {
          if (!pending) setOpen(false);
        }}
        titel={t.newProject}
      >
        {/* noValidate: statt der (lokalabhängigen) Browser-Validierung
            zeigt die Server-Action die Fehlermeldung in der Nutzersprache. */}
        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="space-y-4"
        >
          <Input
            label={t.nameLabel}
            name="name"
            type="text"
            required
            maxLength={200}
            placeholder={t.namePlaceholder}
          />
          <Input
            label={t.adresseLabel}
            name="adresse"
            type="text"
            maxLength={300}
            placeholder={t.adressePlaceholder}
          />
          {state.error ? (
            <p
              role="alert"
              className="rounded-eingabe bg-fehler-flaeche px-3 py-2 text-sm font-medium text-fehler"
            >
              {state.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variante="sekundaer"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {dict.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.createPending : t.createButton}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
