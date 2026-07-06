<?php

require_once 'prototype_store.php';

$data = prototype_request_json();
$nama = trim($data['nama'] ?? 'atasan');
$image = $data['image'] ?? '';

if ($nama === '') {
    prototype_fail('Nama approver tidak boleh kosong.');
}

$templates = prototype_read_templates();
if (empty($templates[$nama]) || empty($templates[$nama]['samples'])) {
    prototype_fail("Template FMD untuk '$nama' belum ada.");
}
prototype_debug('verify templates loaded nama=' . $nama . ' count=' . count($templates[$nama]['samples']));

$convert = prototype_image_to_fmd($image);
if (empty($convert['success'])) {
    prototype_log('VERIFY_FAILED', $nama, $convert['error'] ?? 'convert failed');
    prototype_json($convert);
}

$dbFile = tempnam(sys_get_temp_dir(), 'hid_webapi_fmd_db_');
$handle = fopen($dbFile, 'wb');
if (!$handle) {
    prototype_fail('Tidak bisa membuat file DB sementara.');
}

$rowId = 1;
foreach ($templates[$nama]['samples'] as $sample) {
    $recordId = $sample['id'] ?? $rowId;
    fwrite($handle, $recordId . "\t" . str_replace(["\t", "\n", "\r"], ' ', $nama) . "\t" . trim($sample['fmd']) . "\n");
    $rowId++;
}
fclose($handle);
prototype_debug('compare db file built nama=' . $nama . ' template_count=' . ($rowId - 1));

$candidateFile = tempnam(sys_get_temp_dir(), 'hid_webapi_candidate_');
file_put_contents($candidateFile, $convert['fmd']);

try {
    $compare = prototype_run_java(__DIR__ . '/CompareFmd.java', [$candidateFile, $dbFile]);
} finally {
    @unlink($candidateFile);
    @unlink($dbFile);
}

if (!empty($compare['success'])) {
    $compare['nama'] = $nama;
    prototype_debug('matching result nama=' . $nama . ' matched=' . ($compare['matched'] ? 'true' : 'false') . ' score=' . ($compare['score'] ?? '-') . ' threshold=' . ($compare['threshold'] ?? '-'));
    prototype_log(
        $compare['matched'] ? 'VERIFY_APPROVED' : 'VERIFY_REJECTED',
        $nama,
        'score=' . ($compare['score'] ?? '-') . ', threshold=' . ($compare['threshold'] ?? '-')
    );
}

prototype_json($compare);
