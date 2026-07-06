CLEAN HID WEBAPI MOD
====================

Base folder:

  ~/usb-pak-edi/UareUSampleWEB2

Folder ini dipakai sebagai base karena lebih dekat ke sample bawaan
DigitalPersona/HID WebAPI. Fitur asli WebAPI tetap ada:

  Reader tab
  Capture tab
  Start / Stop
  Info
  RAW / Feature Set / WSQ / PNG acquisition
  Export

Tambahan yang dibuat:

  Linux Capture
  Supervisor Approval FMD
  Enroll FMD
  Enroll 3 Samples
  Verify Approval
  Demo Confirm Access
  Linux UVC fallback reader: linux-uvc:auto

Kenapa perlu tambahan Linux UVC:

  Di mesin Kali ini SDK WebAPI bawaan tidak melihat reader sebagai HID WebAPI
  service, tapi Linux melihat reader sebagai UVC camera di /dev/video2.

Jalur tambahan:

  /dev/video2 -> capture PNG -> convert ke FMD ANSI_378_2004 -> compare FMD

Database config:

  cp config.local.example.php config.local.php
  edit config.local.php sesuai kredensial MariaDB lokal

  Alternatif environment variable:

  FINGERPRINT_DB_HOST
  FINGERPRINT_DB_USER
  FINGERPRINT_DB_PASS
  FINGERPRINT_DB_NAME

Start server:

  systemctl start mariadb
  cd ~/usb-pak-edi/UareUSampleWEB2
  php -S 127.0.0.1:8080

Buka:

  http://127.0.0.1:8080/index.html

Cara demo:

1. Pilih reader "DigitalPersona Linux UVC (/dev/video2)" jika WebAPI native
   tidak mendeteksi reader.
2. Klik Capture tab.
3. Untuk daftar user, isi "Approver name" lalu klik Enroll 3 Samples.
4. Setelah tombol diklik, tempel jari dan tahan stabil sampai sample tersimpan.
5. Untuk demo request akses, isi "Demo request user".
6. Klik Demo Confirm Access, lalu tempel jari.
7. Sistem identify ke semua FMD di SQL dan APPROVED hanya jika fingerprint
   cocok dengan user yang diminta.

Storage SQL prototype:

  MariaDB database: finger_verification
  Main table: fingerprints
  Log table: approval_logs
  Schema file: schema.sql

FMD rows:

  fingerprints.sample_type = FMD_ANSI_378_2004
  fingerprints.raw_data    = FMD base64

Legacy JSON data from:

  ~/.fingerprint-demo-fmd/templates/
  ~/usb-pak-edi/UareUSampleWEB2/prototype-data/templates.json

is imported once into SQL by prototype_migrations key json_to_sql_v1.

Check SQL data:

  mysql -u <db_user> -p <db_name> \
    -e "SELECT sample_type,nama,COUNT(*) FROM fingerprints GROUP BY sample_type,nama;"

Catatan keamanan:

  Jangan commit config.local.php, prototype-data, database dump, atau template
  FMD asli. File tersebut bisa berisi data biometrik dan kredensial lokal.
