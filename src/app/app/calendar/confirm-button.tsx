"use client";

/**
 * A submit button that asks first. Disconnecting a Google account is destructive — it stops
 * every booking from reaching that account's calendars — so it must not happen on a stray
 * click. `window.confirm` is deliberately plain: it works without JS hydration races and is
 * the browser's own, unmissable, blocking prompt.
 */
export function ConfirmButton({
  children,
  confirm,
  className,
}: {
  children: React.ReactNode;
  confirm: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
