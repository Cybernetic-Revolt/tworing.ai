"use client";

/**
 * A submit button that asks first. Used for the admin actions that destroy something a
 * prospect or client cannot recreate — deleting a trial request loses the only record of
 * someone who asked for the product.
 */
export function ConfirmButton({
  confirm,
  className,
  children,
}: {
  confirm: string;
  className?: string;
  children: React.ReactNode;
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
