<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderPaymentConfirmed extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order, public bool $forAdmin)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->forAdmin
                ? 'Pembayaran diterima '.$this->order->order_number
                : 'Pembayaran pesanan '.$this->order->order_number.' berhasil',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.orders.payment-confirmed',
            with: ['order' => $this->order->loadMissing(['user', 'items']), 'forAdmin' => $this->forAdmin],
        );
    }
}
