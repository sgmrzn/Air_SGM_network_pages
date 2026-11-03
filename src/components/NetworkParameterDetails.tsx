import { useRef, type ReactNode } from "react";

export function NetworkParameterDetails({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className={className}>
      <button
        type="button"
        className="network-parameters__detail-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        {title} <span aria-hidden="true">↗</span>
      </button>
      <dialog
        ref={dialog}
        className="network-parameters__dialog"
        aria-label={title}
      >
        <header>
          <h3>{title}</h3>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            Закрыть
          </button>
        </header>
        <div className="network-parameters__dialog-body">{children}</div>
      </dialog>
    </div>
  );
}
