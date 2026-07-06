<?php

require_once 'prototype_store.php';

$data = prototype_request_json();
$nama = trim($data['nama'] ?? 'atasan');
$image = $data['image'] ?? '';

if ($nama === '') {
    prototype_fail('Nama tidak boleh kosong.');
}

$convert = prototype_image_to_fmd($image);
if (empty($convert['success'])) {
    prototype_log('ENROLL_FAILED', $nama, $convert['error'] ?? 'convert failed');
    prototype_json($convert);
}

$conn = prototype_db();
$sample = [
    'width' => $convert['width'] ?? null,
    'height' => $convert['height'] ?? null,
    'fmd' => $convert['fmd']
];
$id = prototype_insert_fmd($conn, $nama, $sample);
$templates = prototype_read_templates();
$sampleCount = count($templates[$nama]['samples'] ?? []);
prototype_log('ENROLL', $nama, 'SQL FMD saved id=' . $id . ', samples=' . $sampleCount);

prototype_json([
    'success' => true,
    'nama' => $nama,
    'id' => $id,
    'samples' => $sampleCount,
    'width' => $convert['width'] ?? null,
    'height' => $convert['height'] ?? null
]);
