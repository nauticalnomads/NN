"use client";

import { useFormStatus } from "react-dom";

// Submit button with built-in click + pending feedback for admin forms.
// While the form action runs it disables, dims, and swaps to `pendingText`.
// Pass `formAction` to target a specific server action within a shared form.
export function SubmitButton({
  children,
  className = "",
  pendingText = "Saving…",
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
      className={`${className} inline-flex items-center gap-2 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {pending ? pendingText : children}
    </button>
  );
}
