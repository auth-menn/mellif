import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type CartRemoveDialogProps = {
    open: boolean;
    productName: string;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    processing?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
};

export default function CartRemoveDialog({
    open,
    productName,
    title,
    description,
    confirmLabel,
    cancelLabel,
    processing = false,
    onOpenChange,
    onConfirm,
}: CartRemoveDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="z-[70] bg-white text-neutral-900"
                overlayClassName="z-[60]"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm font-medium text-neutral-900">
                    {productName}
                </p>
                <DialogFooter>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                        className="border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={onConfirm}
                        className="bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {confirmLabel}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
