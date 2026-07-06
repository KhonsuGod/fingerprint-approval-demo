<?php

$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    $loadedConfig = require $localConfig;
} else {
    $loadedConfig = [];
}

define('PROTOTYPE_DB_CONFIG', [
    'host' => getenv('FINGERPRINT_DB_HOST') ?: ($loadedConfig['host'] ?? '127.0.0.1'),
    'user' => getenv('FINGERPRINT_DB_USER') ?: ($loadedConfig['user'] ?? 'finger_user'),
    'pass' => getenv('FINGERPRINT_DB_PASS') ?: ($loadedConfig['pass'] ?? ''),
    'name' => getenv('FINGERPRINT_DB_NAME') ?: ($loadedConfig['name'] ?? 'finger_verification'),
]);

define('DB_HOST', PROTOTYPE_DB_CONFIG['host']);
define('DB_USER', PROTOTYPE_DB_CONFIG['user']);
define('DB_PASS', PROTOTYPE_DB_CONFIG['pass']);
define('DB_NAME', PROTOTYPE_DB_CONFIG['name']);
define('FMD_SAMPLE_TYPE', 'FMD_ANSI_378_2004');

function prototype_data_dir() {
    $dir = __DIR__ . '/prototype-data';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    return $dir;
}

function prototype_db() {
    static $conn = null;
    if ($conn instanceof mysqli) {
        return $conn;
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        $conn->set_charset('utf8mb4');
        prototype_debug('db connected host=' . DB_HOST . ' db=' . DB_NAME);
        prototype_init_schema($conn);
        prototype_migrate_json_to_sql_once($conn);
        return $conn;
    } catch (Throwable $error) {
        prototype_debug('db connection failed: ' . $error->getMessage());
        prototype_fail('Database connection failed: ' . $error->getMessage(), 500);
    }
}

function prototype_init_schema($conn) {
    $conn->query("
        CREATE TABLE IF NOT EXISTS fingerprints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nama VARCHAR(255) NOT NULL,
            sample_type VARCHAR(64) NOT NULL,
            raw_data LONGTEXT NOT NULL,
            width INT NULL,
            height INT NULL,
            dpi INT NULL,
            bpp INT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $conn->query("
        CREATE TABLE IF NOT EXISTS approval_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action VARCHAR(64) NOT NULL,
            nama VARCHAR(255) NULL,
            result TEXT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $conn->query("
        CREATE TABLE IF NOT EXISTS prototype_migrations (
            migration_key VARCHAR(128) PRIMARY KEY,
            migration_value TEXT NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    try {
        $conn->query("CREATE INDEX idx_fingerprints_type_name ON fingerprints (sample_type, nama)");
    } catch (Throwable $ignored) {
        // Index already exists on MariaDB, or user lacks duplicate-index detail.
    }
}

function prototype_migrate_json_to_sql_once($conn) {
    $migrationKey = 'json_to_sql_v1';
    $stmt = $conn->prepare("SELECT migration_value FROM prototype_migrations WHERE migration_key = ?");
    $stmt->bind_param('s', $migrationKey);
    $stmt->execute();
    $exists = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($exists) {
        return;
    }

    $templates = [];
    $webJson = prototype_data_dir() . '/templates.json';
    if (is_file($webJson)) {
        $data = json_decode(file_get_contents($webJson), true);
        if (is_array($data)) {
            foreach ($data as $name => $template) {
                $templates[$name] = $template;
            }
        }
    }

    foreach (prototype_import_cli_templates() as $name => $template) {
        if (empty($templates[$name])) {
            $templates[$name] = $template;
        } else {
            $templates[$name]['samples'] = array_merge($templates[$name]['samples'] ?? [], $template['samples'] ?? []);
        }
    }

    $inserted = 0;
    foreach ($templates as $name => $template) {
        foreach (($template['samples'] ?? []) as $sample) {
            if (empty($sample['fmd'])) {
                continue;
            }
            if (prototype_fmd_exists($conn, $name, $sample['fmd'])) {
                continue;
            }
            prototype_insert_fmd($conn, $name, $sample);
            $inserted++;
        }
    }

    $value = 'inserted=' . $inserted;
    $stmt = $conn->prepare("INSERT INTO prototype_migrations (migration_key, migration_value) VALUES (?, ?)");
    $stmt->bind_param('ss', $migrationKey, $value);
    $stmt->execute();
    $stmt->close();
    prototype_debug('json migration complete ' . $value);
}

function prototype_import_cli_templates() {
    $home = getenv('HOME') ?: '/home/zazouim';
    $dir = $home . '/.fingerprint-demo-fmd/templates';
    $templates = [];
    foreach (glob($dir . '/*.json') ?: [] as $file) {
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data) || empty($data['samples'])) {
            continue;
        }
        $name = $data['name'] ?? pathinfo($file, PATHINFO_FILENAME);
        $samples = [];
        foreach ($data['samples'] as $sample) {
            if (!empty($sample['fmd'])) {
                $samples[] = $sample;
            }
        }
        if ($samples) {
            $templates[$name] = [
                'nama' => $name,
                'created_at' => $data['created_at'] ?? date('Y-m-d H:i:s'),
                'updated_at' => $data['created_at'] ?? date('Y-m-d H:i:s'),
                'format' => FMD_SAMPLE_TYPE,
                'samples' => $samples
            ];
        }
    }
    return $templates;
}

function prototype_fmd_exists($conn, $nama, $fmd) {
    $sampleType = FMD_SAMPLE_TYPE;
    $stmt = $conn->prepare("SELECT id FROM fingerprints WHERE nama = ? AND sample_type = ? AND raw_data = ? LIMIT 1");
    $stmt->bind_param('sss', $nama, $sampleType, $fmd);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return (bool)$row;
}

function prototype_insert_fmd($conn, $nama, $sample) {
    $sampleType = FMD_SAMPLE_TYPE;
    $fmd = trim($sample['fmd']);
    $width = isset($sample['width']) ? (int)$sample['width'] : null;
    $height = isset($sample['height']) ? (int)$sample['height'] : null;
    $dpi = 500;
    $bpp = null;

    $stmt = $conn->prepare("
        INSERT INTO fingerprints (nama, sample_type, raw_data, width, height, dpi, bpp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param('sssiiii', $nama, $sampleType, $fmd, $width, $height, $dpi, $bpp);
    $stmt->execute();
    $id = $stmt->insert_id;
    $stmt->close();
    prototype_debug("fmd inserted id=$id nama=$nama width=$width height=$height");
    return $id;
}

function prototype_read_templates() {
    $conn = prototype_db();
    $sampleType = FMD_SAMPLE_TYPE;
    $stmt = $conn->prepare("
        SELECT id, nama, raw_data, width, height, dpi, bpp, created_at
        FROM fingerprints
        WHERE sample_type = ?
        ORDER BY nama ASC, id ASC
    ");
    $stmt->bind_param('s', $sampleType);
    $stmt->execute();
    $result = $stmt->get_result();

    $templates = [];
    while ($row = $result->fetch_assoc()) {
        $name = $row['nama'];
        if (empty($templates[$name])) {
            $templates[$name] = [
                'nama' => $name,
                'created_at' => $row['created_at'],
                'updated_at' => $row['created_at'],
                'format' => FMD_SAMPLE_TYPE,
                'samples' => []
            ];
        }
        $templates[$name]['updated_at'] = $row['created_at'];
        $templates[$name]['samples'][] = [
            'id' => (int)$row['id'],
            'created_at' => $row['created_at'],
            'width' => $row['width'] === null ? null : (int)$row['width'],
            'height' => $row['height'] === null ? null : (int)$row['height'],
            'dpi' => $row['dpi'] === null ? null : (int)$row['dpi'],
            'bpp' => $row['bpp'] === null ? null : (int)$row['bpp'],
            'fmd' => $row['raw_data']
        ];
    }
    $stmt->close();

    $templateCount = count($templates);
    $sampleCount = array_sum(array_map(function ($item) {
        return count($item['samples']);
    }, $templates));
    prototype_debug("templates loaded from sql users=$templateCount samples=$sampleCount");
    return $templates;
}

function prototype_log($action, $nama, $result) {
    prototype_debug("log action=$action nama=$nama result=$result");
    try {
        $conn = prototype_db();
        $stmt = $conn->prepare("INSERT INTO approval_logs (action, nama, result) VALUES (?, ?, ?)");
        $stmt->bind_param('sss', $action, $nama, $result);
        $stmt->execute();
        $stmt->close();
    } catch (Throwable $error) {
        prototype_debug('log insert failed: ' . $error->getMessage());
    }
}

function prototype_read_logs() {
    $conn = prototype_db();
    $result = $conn->query("
        SELECT action, nama, result, created_at
        FROM approval_logs
        ORDER BY id DESC
        LIMIT 100
    ");

    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = [
            'time' => $row['created_at'],
            'action' => $row['action'],
            'nama' => $row['nama'],
            'result' => $row['result']
        ];
    }
    prototype_debug('logs loaded from sql count=' . count($logs));
    return array_reverse($logs);
}

function prototype_request_json() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function prototype_json($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function prototype_fail($message, $status = 400) {
    prototype_debug('error: ' . $message);
    prototype_json([
        'success' => false,
        'error' => $message
    ], $status);
}

function prototype_decode_png_to_file($image) {
    if (strpos($image, ',') !== false) {
        $image = explode(',', $image, 2)[1];
    }

    $png = base64_decode($image, true);
    if ($png === false || strlen($png) === 0) {
        prototype_fail('PNG/base64 kosong atau tidak valid.');
    }

    $input = tempnam(sys_get_temp_dir(), 'hid_webapi_fmd_') . '.png';
    file_put_contents($input, $png);
    return $input;
}

function prototype_run_java($javaFile, $args) {
    $lib = '/opt/Crossmatch/urusdk-linux/Linux/lib/x64';
    $jar = '/opt/Crossmatch/urusdk-linux/Linux/lib/java/dpuareu.jar';

    $cmd = 'LD_LIBRARY_PATH=' . escapeshellarg($lib)
        . ' java --enable-native-access=ALL-UNNAMED'
        . ' -Djava.library.path=' . escapeshellarg($lib)
        . ' -cp ' . escapeshellarg($jar)
        . ' ' . escapeshellarg($javaFile);

    foreach ($args as $arg) {
        $cmd .= ' ' . escapeshellarg($arg);
    }
    $cmd .= ' 2>&1';

    $lines = [];
    $status = 0;
    exec($cmd, $lines, $status);

    $text = trim(implode("\n", $lines));
    $json = json_decode($text, true);
    if (is_array($json)) {
        prototype_debug('java result success=' . (($json['success'] ?? false) ? 'true' : 'false'));
        return $json;
    }

    prototype_debug('java non-json status=' . $status . ' output=' . $text);
    return [
        'success' => false,
        'error' => $text ?: 'Java engine tidak mengembalikan JSON.'
    ];
}

function prototype_image_to_fmd($image) {
    $input = prototype_decode_png_to_file($image);
    try {
        $result = prototype_run_java(__DIR__ . '/UvcToFmd.java', [$input]);
        if (!empty($result['success'])) {
            prototype_debug('capture converted to fmd width=' . ($result['width'] ?? '-') . ' height=' . ($result['height'] ?? '-'));
        }
        return $result;
    } finally {
        @unlink($input);
    }
}

function prototype_debug($message) {
    error_log('[fingerprint-sql] ' . $message);
}
