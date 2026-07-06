"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createProjectAction,
  type ProjectFormState,
} from "@/lib/projekte/actions";
import { de } from "@/i18n/de";

const initialState: ProjectFormState = {};

export function NewProjectDialog({ ctaLabel }: { ctaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const t = de.projects;

  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        {ctaLabel ?? t.newProject}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.newProject}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold tracking-tight">
              {t.newProject}
            </h2>
            <form ref={formRef} action={formAction} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="project-name"
                  className="block text-sm font-medium text-neutral-700"
                >
                  {t.nameLabel}
                </label>
                <input
                  id="project-name"
                  name="name"
                  type="text"
                  required
                  maxLength={200}
                  placeholder={t.namePlaceholder}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label
                  htmlFor="project-adresse"
                  className="block text-sm font-medium text-neutral-700"
                >
                  {t.adresseLabel}
                </label>
                <input
                  id="project-adresse"
                  name="adresse"
                  type="text"
                  maxLength={300}
                  placeholder={t.adressePlaceholder}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              {state.error ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {state.error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                >
                  {de.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? t.createPending : t.createButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
