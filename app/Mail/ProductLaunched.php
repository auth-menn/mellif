<?php

namespace App\Mail;

use App\Models\Product;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProductLaunched extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Product $product)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Produk baru diluncurkan: '.$this->product->name,
        );
    }

    public function content(): Content
    {
        $this->product->loadMissing('images');
        $productImage = $this->product->images->first();

        return new Content(
            markdown: 'emails.products.launched',
            with: [
                'productUrl' => route('shop.show', $this->product->slug),
                'productImageUrl' => $productImage ? asset('storage/'.$productImage->path) : null,
            ],
        );
    }
}
