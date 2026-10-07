import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';

type CartRemoveDialogProps = {
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

export default function CartRemoveDialog({
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
}: CartRemoveDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="z-[70] bg-white text-neutral-900 sm:max-w-lg"
                overlayClassName="z-[60]"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-4">
                    <div className="space-y-2 pt-1">
                        <p className="text-sm font-medium text-neutral-900">
                            {productName}
                        </p>
                        <p className="text-xs text-neutral-600">
                            {t('cart.size')} {size} · {t('cart.quantity')} {quantity}
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
