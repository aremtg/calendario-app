<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Solo se ejecuta desde la terminal.'); }
// Uso: php bin/create-admin.php "Nombre" correo@ejemplo.com "ClaveSegura123"
require __DIR__ . '/../src/bootstrap.php';
[$_, $name, $email, $pass] = $argv + [null, null, null, null];
if (!$name || !$email || !$pass || strlen($pass) < 8) exit("Uso: php bin/create-admin.php \"Nombre\" correo clave(min 8)\n");
$st = db()->prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?, 'admin')");
$st->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT)]);
echo "Administrador creado: $email\n";


//guillermo@acbocol.com
//"guille123"




//@echo off
// cd /d "C:\xampp"

// :: Lanzar Apache y MySQL de forma externa a traves de PowerShell para que la consola se libere
// powershell -WindowStyle Hidden -Command "Start-Process 'apache\bin\httpd.exe' -WindowStyle Hidden"
// powershell -WindowStyle Hidden -Command "Start-Process 'mysql\bin\mysqld.exe' -ArgumentList '--defaults-file=mysql\bin\my.ini' -WindowStyle Hidden"

// :: Forzar el cierre inmediato y absoluto de esta ventana de comandos
// taskkill /f /im cmd.exe
