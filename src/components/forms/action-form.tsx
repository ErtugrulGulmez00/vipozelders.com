"use client";

import { Loader2 } from "lucide-react";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { initialActionState, type ActionState } from "@/lib/action-state";

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const StateContext = createContext<ActionState>(initialActionState);
const PendingContext = createContext(false);

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
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: ServerAction;
  resetOnSuccess?: boolean;
  hideMessages?: boolean;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  // React form action'dan sonra formu her durumda sıfırlar; hata dönünce yazılanlar kaybolmasın diye gönderimi
  // burada yapıyoruz ve yalnız başarıda sıfırlıyoruz. JavaScript kapalıyken tarayıcının kendi gönderimi çalışır.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <StateContext value={state}>
      <PendingContext value={pending}>
        <form
          ref={formRef}
          action={formAction}
          className={className}
          key={resetOnSuccess && state.ok ? state.stamp : undefined}
          onSubmit={(event) => {
            onSubmit?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            // Hangi düğmeyle gönderildi (ör. name="decision" value="keep")
            const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            if (submitter?.name) data.append(submitter.name, submitter.value);
            startTransition(() => formAction(data));
          }}
          {...props}
        >
          {!hideMessages && state.error ? <Alert tone="error" className="mb-4">{state.error}</Alert> : null}
          {!hideMessages && state.ok && state.message ? <Alert tone="success" className="mb-4">{state.message}</Alert> : null}
          {children}
        </form>
      </PendingContext>
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
  // ActionForm gönderimi kendisi yaptığı için bekleme durumu oradan gelir; düz <form action> içinde useFormStatus
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
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
