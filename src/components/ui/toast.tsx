'use client';

import { toast } from 'sonner';

/** Toasts con sonner. Misma firma que la Fase 1: toast(texto, esError). */
const show = (text: string, err = false) => (err ? toast.error(text, { duration: 4200 }) : toast(text, { duration: 2200 }));
export const useToast = () => show;
