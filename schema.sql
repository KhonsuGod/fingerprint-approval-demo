CREATE DATABASE IF NOT EXISTS finger_verification
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE finger_verification;

CREATE TABLE IF NOT EXISTS fingerprints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  sample_type VARCHAR(64) NOT NULL,
  raw_data LONGTEXT NOT NULL,
  width INT NULL,
  height INT NULL,
  dpi INT NULL,
  bpp INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fingerprints_type_name (sample_type, nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(64) NOT NULL,
  nama VARCHAR(255) NULL,
  result TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prototype_migrations (
  migration_key VARCHAR(128) PRIMARY KEY,
  migration_value TEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FMD templates are stored here:
--   sample_type = 'FMD_ANSI_378_2004'
--   raw_data    = base64 FMD payload used by CompareFmd.java
