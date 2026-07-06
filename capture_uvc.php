<?php

header('Content-Type: application/json');

$ffmpeg = '/usr/bin/ffmpeg';
$device = findDigitalPersonaVideoDevice();

if (!file_exists($device)) {
    echo json_encode([
        'success' => false,
        'error' => 'DigitalPersona UVC reader tidak ditemukan.'
    ]);
    exit;
}

if (!is_executable($ffmpeg)) {
    echo json_encode([
        'success' => false,
        'error' => 'ffmpeg tidak ditemukan.'
    ]);
    exit;
}

$output = tempnam(sys_get_temp_dir(), 'hid_webapi_uvc_') . '.png';
$cmd = implode(' ', [
    escapeshellarg($ffmpeg),
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'v4l2',
    '-pixel_format', 'yuyv422',
    '-video_size', '1360x540',
    '-framerate', '15',
    '-i', escapeshellarg($device),
    '-vf', escapeshellarg('extractplanes=y,format=gray,eq=contrast=1.35:brightness=0.02'),
    '-frames:v', '1',
    escapeshellarg($output),
    '2>&1'
]);

$lines = [];
$status = 0;
exec($cmd, $lines, $status);

if ($status !== 0 || !is_file($output) || filesize($output) === 0) {
    @unlink($output);
    echo json_encode([
        'success' => false,
        'error' => trim(implode("\n", $lines)) ?: 'Gagal capture UVC.'
    ]);
    exit;
}

$image = base64_encode(file_get_contents($output));
@unlink($output);

echo json_encode([
    'success' => true,
    'device' => $device,
    'format' => 'png',
    'width' => 1360,
    'height' => 540,
    'image' => $image
]);

function findDigitalPersonaVideoDevice() {
    $byId = glob('/dev/v4l/by-id/*DigitalPersona*');
    if ($byId && count($byId) > 0) {
        foreach ($byId as $path) {
            $resolved = realpath($path);
            if ($resolved && isCaptureNode($resolved)) {
                return $resolved;
            }
        }
    }

    $devices = glob('/dev/video*') ?: [];
    sort($devices);
    foreach ($devices as $candidate) {
        if (isCaptureNode($candidate)) {
            return $candidate;
        }
    }

    return '/dev/video2';
}

function isCaptureNode($candidate) {
    $cmd = 'v4l2-ctl -d ' . escapeshellarg($candidate) . ' --all 2>/dev/null';
    $output = shell_exec($cmd);
    return is_string($output)
        && stripos($output, 'DigitalPersona') !== false
        && (stripos($output, 'Format Video Capture') !== false || stripos($output, 'Video input') !== false);
}
