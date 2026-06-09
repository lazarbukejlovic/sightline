import type { ActionState } from "@/app/app/actions";

export function FormFeedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-signal"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p
        role="status"
        className="rounded-md border border-teal/30 bg-teal/5 px-3 py-2 text-sm text-teal"
      >
        {state.message}
      </p>
    );
  }
  return null;
}
