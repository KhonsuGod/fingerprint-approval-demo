<?php

require_once 'prototype_store.php';

$data = prototype_request_json();
$image = $data['image'] ?? '';
$requestedUser = trim($data['requested_user'] ?? '');

$templates = prototype_read_templates();
if (!$templates) {
    prototype_fail('Belum ada template FMD di SQL.');
}

prototype_debug('identify templates loaded users=' . count($templates));

$convert = prototype_image_to_fmd($image);
if (empty($convert['success'])) {
    prototype_log('IDENTIFY_FAILED', $requestedUser, $convert['error'] ?? 'convert failed');
    prototype_json($convert);
}

$dbFile = tempnam(sys_get_temp_dir(), 'hid_webapi_identify_db_');
$handle = fopen($dbFile, 'wb');
if (!$handle) {
    prototype_fail('Tidak bisa membuat file DB sementara.');
}

$recordCount = 0;
foreach ($templates as $nama => $template) {
    foreach (($template['samples'] ?? []) as $sample) {
        if (empty($sample['fmd'])) {
            continue;
        }
        $recordId = $sample['id'] ?? ($recordCount + 1);
        fwrite($handle, $recordId . "\t" . str_replace(["\t", "\n", "\r"], ' ', $nama) . "\t" . trim($sample['fmd']) . "\n");
        $recordCount++;
    }
}
fclose($handle);

if ($recordCount === 0) {
    @unlink($dbFile);
    prototype_fail('Belum ada sample FMD di SQL.');
}

prototype_debug('identify db file built record_count=' . $recordCount . ' requested_user=' . $requestedUser);

$candidateFile = tempnam(sys_get_temp_dir(), 'hid_webapi_identify_candidate_');
file_put_contents($candidateFile, $convert['fmd']);

try {
    $compare = prototype_run_java(__DIR__ . '/CompareFmd.java', [$candidateFile, $dbFile]);
} finally {
    @unlink($candidateFile);
    @unlink($dbFile);
}

if (!empty($compare['success'])) {
    $matchedName = $compare['nama'] ?? '';
    $compare['requested_user'] = $requestedUser;
    $compare['approved'] = !empty($compare['matched'])
        && $requestedUser !== ''
        && mb_strtolower($matchedName) === mb_strtolower($requestedUser);
    $compare['template_count'] = count($templates);
    $compare['sample_count'] = $recordCount;

    prototype_debug(
        'identify result requested_user=' . $requestedUser .
        ' matched=' . (!empty($compare['matched']) ? 'true' : 'false') .
        ' matched_name=' . $matchedName .
        ' approved=' . (!empty($compare['approved']) ? 'true' : 'false') .
        ' score=' . ($compare['score'] ?? '-') .
        ' threshold=' . ($compare['threshold'] ?? '-')
    );

    prototype_log(
        !empty($compare['approved']) ? 'DEMO_APPROVED' : 'DEMO_REJECTED',
        $requestedUser,
        'matched_name=' . $matchedName .
        ', matched=' . (!empty($compare['matched']) ? 'true' : 'false') .
        ', score=' . ($compare['score'] ?? '-') .
        ', threshold=' . ($compare['threshold'] ?? '-')
    );
}

prototype_json($compare);
