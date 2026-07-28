import type { AppError } from "../../types/error";

type Props = {
  error: AppError;
  onDismiss: () => void;
};

export function ErrorBanner({ error, onDismiss }: Props) {
  return (
    <div className="error-banner" role="alert">
      <span>{error.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error">
        ×
      </button>
    </div>
  );
}
