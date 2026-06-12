import { Callout } from "@/components/ui/callout";
import type { ActionState } from "@/app/app/actions";

export function FormFeedback({ state }: { state: ActionState }) {
  if (state.error) return <Callout tone="error">{state.error}</Callout>;
  if (state.message) return <Callout tone="success">{state.message}</Callout>;
  return null;
}
