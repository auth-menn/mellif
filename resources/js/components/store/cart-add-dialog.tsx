import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type CartAddDialogProps = {
    open: boolean;
    productName: string;
    size: string;
    quantity: number;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    processing?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
};

export default function CartAddDialog({
    open,
    productName,
    size,
    quantity,
    title,
    description,
    confirmLabel,
    cancelLabel,
    processing = false,
    onOpenChange,
    onConfirm,
}: CartAddDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="z-[90] bg-white text-neutral-900"
                overlayClassName="z-[80]"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-1 text-sm text-neutral-900">
                    <p className="font-medium">{productName}</p>
                    <p className="text-neutral-600">
                        {size} · {quantity}
                    </p>
                </div>
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
