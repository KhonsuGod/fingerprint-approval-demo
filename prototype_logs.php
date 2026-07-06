<?php

require_once 'prototype_store.php';

prototype_json([
    'success' => true,
    'logs' => prototype_read_logs()
]);
