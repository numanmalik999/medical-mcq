import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

/**
 * Updates an existing loading toast with a new message or converts it to success/error.
 */
export const updateLoading = (toastId: string | number, message: string, type: 'loading' | 'success' | 'error' = 'loading') => {
  if (type === 'success') {
    toast.success(message, { id: toastId });
  } else if (type === 'error') {
    toast.error(message, { id: toastId });
  } else {
    toast.loading(message, { id: toastId });
  }
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};