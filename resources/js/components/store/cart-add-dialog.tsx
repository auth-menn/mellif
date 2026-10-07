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
    productImage: string;
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
    productImage,
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
                className="z-[90] bg-white text-neutral-900 sm:max-w-xl"
                overlayClassName="z-[80]"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-[minmax(0,1fr)_96px] items-start gap-4 text-sm text-neutral-900 sm:grid-cols-[minmax(0,1fr)_128px]">
                    <div className="space-y-1">
                        <p className="font-medium">{productName}</p>
                        <p className="text-neutral-600">
                            {size} · {quantity}
                        </p>
                    </div>
                    <div className="aspect-square overflow-hidden bg-neutral-100">
                        <img
                            src={productImage}
                            alt={productName}
                            className="h-full w-full object-cover"
                        />
                    </div>
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
