<?php

require_once 'prototype_store.php';

$templates = prototype_read_templates();
$out = [];

foreach ($templates as $template) {
    $out[] = [
        'nama' => $template['nama'] ?? '',
        'format' => $template['format'] ?? 'FMD_ANSI_378_2004',
        'samples' => count($template['samples'] ?? []),
        'created_at' => $template['created_at'] ?? '',
        'updated_at' => $template['updated_at'] ?? ''
    ];
}

prototype_json([
    'success' => true,
    'templates' => $out
]);
