<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderPlaced extends Mailable implements ShouldQueue
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
                ? 'Pesanan baru '.$this->order->order_number
                : 'Pesanan '.$this->order->order_number.' diterima',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.orders.placed',
            with: ['order' => $this->order->loadMissing(['user', 'items']), 'forAdmin' => $this->forAdmin],
        );
    }
}
