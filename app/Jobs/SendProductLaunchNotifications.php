<?php

namespace App\Jobs;

use App\Mail\ProductLaunched;
use App\Models\Product;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendProductLaunchNotifications implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $productId) {}

    public function handle(): void
    {
        $product = Product::query()->with('images')->find($this->productId);

        if ($product === null || ! $product->is_active) {
            return;
        }

        User::query()
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->select(['id', 'email'])
            ->chunkById(500, function (Collection $users) use ($product): void {
                foreach ($users as $user) {
                    Mail::to($user->email)->queue(new ProductLaunched($product));
                }
            });
    }
}
