import { onUnmounted, ref } from "vue";

export interface ConfirmationOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * Page-local confirmation queue: never resolves twice and cancels safely if the
 * user navigates away while a confirmation is visible.
 */
export function useConfirmDialog() {
  const open = ref(false);
  const message = ref("");
  const title = ref("");
  const confirmLabel = ref("");
  const danger = ref(false);
  let pending: ((confirmed: boolean) => void) | null = null;

  function ask(text: string, options: ConfirmationOptions = {}): Promise<boolean> {
    if (open.value) return Promise.resolve(false);
    message.value = text;
    title.value = options.title ?? "";
    confirmLabel.value = options.confirmLabel ?? "";
    danger.value = Boolean(options.danger);
    open.value = true;
    return new Promise(resolve => { pending = resolve; });
  }

  function settle(confirmed: boolean): void {
    if (!open.value && !pending) return;
    open.value = false;
    const resolver = pending;
    pending = null;
    message.value = "";
    title.value = "";
    confirmLabel.value = "";
    danger.value = false;
    resolver?.(confirmed);
  }

  onUnmounted(() => settle(false));

  return { open, message, title, confirmLabel, danger, ask, settle };
}
