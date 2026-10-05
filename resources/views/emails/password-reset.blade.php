<div>
    <!-- Simplicity is the essence of happiness. - Cedric Bledsoe -->
</div>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ubah password Mellif Studio</title>
</head>
<body style="margin:0; padding:0; background:#000000; color:#ffffff; font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000; padding:40px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#111111; border:1px solid #292929;">
                    <tr>
                        <td align="center" style="padding:38px 28px 22px;">
                            <video autoplay loop muted playsinline width="180" style="display:block; width:180px; height:auto; margin:0 auto 10px;">
                                <source src="{{ $logoVideoUrl }}" type="video/webm">
                                MELLIF STUDIO
                            </video>
                            <p style="margin:0; color:#ffffff; font-size:15px; letter-spacing:5px;">MELLIF STUDIO</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 36px 38px;">
                            <p style="margin:0 0 12px; color:#a3a3a3; font-size:11px; letter-spacing:2px; text-transform:uppercase;">Keamanan akun</p>
                            <h1 style="margin:0 0 18px; color:#ffffff; font-size:27px; font-weight:500; line-height:1.3;">Atur ulang password Anda</h1>
                            <p style="margin:0 0 14px; color:#d4d4d4; font-size:15px; line-height:1.7;">Halo {{ $name }}, kami menerima permintaan untuk mengubah password akun Mellif Studio Anda.</p>
                            <p style="margin:0 0 26px; color:#d4d4d4; font-size:15px; line-height:1.7;">Gunakan tombol di bawah untuk membuat password baru. Tautan ini berlaku selama {{ $expiresIn }} menit.</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" bgcolor="#ffffff" style="background:#ffffff;">
                                        <a href="{{ $resetUrl }}" style="display:inline-block; padding:15px 25px; color:#000000; font-size:13px; font-weight:bold; letter-spacing:1px; text-decoration:none;">UBAH PASSWORD</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:26px 0 8px; color:#a3a3a3; font-size:12px; line-height:1.7;">Jika tombol tidak berfungsi, salin tautan ini ke browser Anda:</p>
                            <p style="margin:0; overflow-wrap:anywhere; color:#d4d4d4; font-size:12px; line-height:1.7;"><a href="{{ $resetUrl }}" style="color:#d4d4d4;">{{ $resetUrl }}</a></p>
                            <p style="margin:24px 0 0; color:#737373; font-size:12px; line-height:1.7;">Jika Anda tidak meminta perubahan password, abaikan email ini. Password Anda tidak akan berubah.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="border-top:1px solid #292929; padding:18px 36px; color:#737373; font-size:11px; letter-spacing:1px;">MELLIF STUDIO · LOCAL GOODS</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
