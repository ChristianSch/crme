"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Toast, ToastClose, ToastProvider, ToastViewport } from "@/components/ui/toast";

export function PlainToast({ message, onClose }: { message: string; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider duration={4000}>
      <Toast open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) onClose();
      }}>
        <span className="min-w-0 flex-1">{message}</span>
        <ToastClose asChild><Button size="sm" variant="ghost" className="h-8 rounded-xl">Close</Button></ToastClose>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
