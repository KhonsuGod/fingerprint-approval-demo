<?php

require_once 'prototype_store.php';

$data = prototype_request_json();
$image = $data['image'] ?? '';

$convert = prototype_image_to_fmd($image);
if (empty($convert['success'])) {
    prototype_debug('probe fmd failed: ' . ($convert['error'] ?? 'convert failed'));
    prototype_json([
        'success' => false,
        'error' => $convert['error'] ?? 'Konversi FMD gagal.'
    ]);
}

prototype_debug('probe fmd ok width=' . ($convert['width'] ?? '-') . ' height=' . ($convert['height'] ?? '-'));
prototype_json([
    'success' => true,
    'width' => $convert['width'] ?? null,
    'height' => $convert['height'] ?? null
]);
