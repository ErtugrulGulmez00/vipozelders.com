"use client";

import { Loader2 } from "lucide-react";
import { createContext, useActionState, useContext, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { initialActionState, type ActionState } from "@/lib/action-state";

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const StateContext = createContext<ActionState>(initialActionState);

/** Formdaki alanın sunucudan gelen hata mesajı */
export function useFieldError(name: string): string | undefined {
  return useContext(StateContext).fieldErrors?.[name];
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null;
}

/**
 * Server Action'a bağlı form: gönderim sırasında butonu kilitler,
 * başarı/hata mesajını gösterir. JavaScript kapalıyken de çalışır.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  hideMessages = false,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: ServerAction;
  resetOnSuccess?: boolean;
  hideMessages?: boolean;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <StateContext value={state}>
      <form
        action={formAction}
        className={className}
        key={resetOnSuccess && state.ok ? state.stamp : undefined}
        {...props}
      >
        {!hideMessages && state.error ? <Alert tone="error" className="mb-4">{state.error}</Alert> : null}
        {!hideMessages && state.ok && state.message ? <Alert tone="success" className="mb-4">{state.message}</Alert> : null}
        {children}
      </form>
    </StateContext>
  );
}

export function useActionResult(): ActionState {
  return useContext(StateContext);
}

export function SubmitButton({
  children,
  pendingText = "Kaydediliyor…",
  variant,
  size,
  className,
  confirmMessage,
  onClick,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: Parameters<typeof buttonClasses>[0];
  size?: Parameters<typeof buttonClasses>[1];
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...props}
      disabled={pending || disabled}
      className={buttonClasses(variant, size, className)}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
        onClick?.(event);
      }}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
