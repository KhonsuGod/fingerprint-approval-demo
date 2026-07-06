<?php

header('Content-Type: application/json');

$devices = [];
foreach (glob('/dev/video*') ?: [] as $candidate) {
    $cmd = 'v4l2-ctl -d ' . escapeshellarg($candidate) . ' --all 2>/dev/null';
    $output = shell_exec($cmd);
    $isDigitalPersona = is_string($output) && stripos($output, 'DigitalPersona') !== false;
    $isCapture = is_string($output)
        && (stripos($output, 'Format Video Capture') !== false || stripos($output, 'Video input') !== false);
    $devices[] = [
        'node' => $candidate,
        'digitalpersona' => $isDigitalPersona,
        'capture' => $isCapture,
        'summary' => summarize($output)
    ];
}

$lsusb = shell_exec('lsusb 2>/dev/null');
$usbPresent = is_string($lsusb) && stripos($lsusb, '05ba:000d') !== false;

echo json_encode([
    'success' => true,
    'usb_present' => $usbPresent,
    'devices' => $devices
]);

function summarize($text) {
    if (!is_string($text) || $text === '') {
        return '';
    }

    $lines = preg_split('/\r?\n/', $text);
    $keep = [];
    foreach ($lines as $line) {
        if (stripos($line, 'Card type') !== false
            || stripos($line, 'Bus info') !== false
            || stripos($line, 'Pixel Format') !== false
            || stripos($line, 'Width/Height') !== false) {
            $keep[] = trim($line);
        }
    }

    return implode(' | ', $keep);
}
