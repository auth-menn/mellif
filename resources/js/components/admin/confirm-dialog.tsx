import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    processing?: boolean;
    destructive?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
};

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    processing = false,
    destructive = false,
    onOpenChange,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="admin-theme border-neutral-200 bg-white text-neutral-900">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                        className="border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${destructive ? 'bg-red-700 hover:bg-red-800 focus-visible:outline-red-700' : 'bg-neutral-900 hover:bg-neutral-700 focus-visible:outline-neutral-900'}`}
                    >
                        {confirmLabel}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
