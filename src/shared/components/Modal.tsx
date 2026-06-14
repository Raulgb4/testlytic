import { ReactNode, useId } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  onClose: () => void;
};

export function Modal({ title, children, actions, className, onClose }: ModalProps) {
  const titleId = useId();
  const modalClassName = className ? `modal ${className}` : "modal";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={modalClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        <div className="modal-body">{children}</div>
        {actions ? <div className="card-actions modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
