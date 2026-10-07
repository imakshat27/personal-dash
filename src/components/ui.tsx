import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  X,
  CircleNotch,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""}`}
          aria-describedby={undefined}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading">
        <h2>{title}</h2>
        {action && (
          <button className="text-button" onClick={action.onClick}>
            {action.label}
            <ArrowUpRight size={15} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <CircleNotch size={24} className="spin" />
      Gathering your little universe…
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <WarningCircle size={32} />
      <h2>We hit a small bump</h2>
      <p>{message}</p>
      <button className="primary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-orbit">○</div>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Sparkline({
  values,
  color = "currentColor",
  fill = false,
}: {
  values: number[];
  color?: string;
  fill?: boolean;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values) * 0.7;
  const points = values
    .map(
      (v, i) =>
        `${(i * 100) / Math.max(1, values.length - 1)},${36 - ((v - min) / (max - min || 1)) * 32}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="sparkline"
      aria-hidden="true"
    >
      {fill && (
        <polygon points={`0,40 ${points} 100,40`} fill={color} opacity=".07" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
