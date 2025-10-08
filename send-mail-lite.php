<?php
// send-mail-lite.php  —  Mínimo y sin dependencias (Donweb friendly)

// Si viene desde fetch() con Accept JSON, respondemos JSON; si no, HTML mínimo.
$wantsJson = (isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  exit($wantsJson ? json_encode(['ok'=>false,'message'=>'Método no permitido']) : 'Método no permitido');
}

// Honeypot (campo que debe quedar vacío)
$hp = trim($_POST['company'] ?? '');
if ($hp !== '') {
  // Éxito silencioso para bots (no dar pistas)
  echo $wantsJson ? json_encode(['ok'=>true,'message'=>'OK']) : 'OK';
  exit;
}

// Campos esperados
$name     = trim($_POST['name'] ?? '');
$email    = trim($_POST['email'] ?? '');
$telefono = preg_replace('/\D+/', '', $_POST['telefono'] ?? '');
$mensaje  = trim($_POST['mensaje'] ?? '');

if ($name === '' || $mensaje === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  if ($wantsJson) {
    http_response_code(422);
    echo json_encode(['ok'=>false,'message'=>'Completá nombre, email válido y mensaje.']);
  } else {
    echo 'Completá nombre, email válido y mensaje.';
  }
  exit;
}

// Configuración mínima
$to       = 'comercial@silvafast.com.ar';
$subject  = 'consulta pagina';
$from     = 'no-reply@silvafast.com.ar'; // remitente técnico del dominio (mejor entregabilidad)
$ip       = $_SERVER['REMOTE_ADDR'] ?? '';
$ua       = $_SERVER['HTTP_USER_AGENT'] ?? '';
date_default_timezone_set('America/Argentina/Tucuman');
$ts       = date('Y-m-d H:i:s');

// Cuerpo del correo (texto plano)
$body = "Nueva consulta desde la página\n"
      . "---------------------------------\n"
      . "Nombre:   {$name}\n"
      . "Email:    {$email}\n"
      . "Teléfono: {$telefono}\n"
      . "Mensaje:\n{$mensaje}\n\n"
      . "Meta: IP {$ip} · UA {$ua} · Fecha {$ts}\n";

// Encabezados
$headers  = "From: {$from}\r\n";
$headers .= "Reply-To: {$email}\r\n"; // así respondés directo al usuario
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Algunos hostings piden envelope sender -f para evitar rebotes:
// $params = '-f'.$from; // si ves rebotes por remitente, descomentá y sumá como 5to parámetro

$sent = @mail($to, '=?UTF-8?B?'.base64_encode($subject).'?=', $body, $headers /*, $params*/);

if ($sent) {
  if ($wantsJson) {
    echo json_encode(['ok'=>true,'message'=>'¡Gracias! Recibimos tu consulta.']);
  } else {
    // Respuesta HTML mínima (fallback sin JS)
    echo '<!doctype html><meta charset="utf-8"><title>Enviado</title>
    <style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:32px;line-height:1.5}</style>
    <h1>¡Gracias!</h1><p>Recibimos tu consulta. Te responderemos a la brevedad.</p>
    <p><a href="/" style="color:#3b2b23">Volver al sitio</a></p>';
  }
} else {
  http_response_code(500);
  if ($wantsJson) {
    echo json_encode(['ok'=>false,'message'=>'No pudimos enviar tu mensaje. Intentá más tarde.']);
  } else {
    echo 'No pudimos enviar tu mensaje. Intentá más tarde.';
  }
}
