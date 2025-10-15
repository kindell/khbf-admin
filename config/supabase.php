<?php
/**
 * Supabase PHP Client
 * Simple wrapper for making requests to Supabase REST API
 */

// Load environment variables from .env file
if (file_exists(__DIR__ . '/../.env')) {
    $lines = file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $_ENV[trim($name)] = trim($value);
    }
}

define('SUPABASE_URL', $_ENV['VITE_SUPABASE_URL'] ?? getenv('VITE_SUPABASE_URL'));
define('SUPABASE_KEY', $_ENV['VITE_SUPABASE_SERVICE_ROLE_KEY'] ?? getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'));

/**
 * Make a request to Supabase REST API
 */
function supabaseRequest($method, $path, $data = null, $params = []) {
    $url = SUPABASE_URL . '/rest/v1/' . $path;

    // Add query parameters
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }

    $headers = [
        'apikey: ' . SUPABASE_KEY,
        'Authorization: Bearer ' . SUPABASE_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    if ($data !== null && in_array($method, ['POST', 'PATCH', 'PUT'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return [
            'success' => false,
            'error' => $error,
            'status' => 0
        ];
    }

    $decoded = json_decode($response, true);

    return [
        'success' => $httpCode >= 200 && $httpCode < 300,
        'status' => $httpCode,
        'data' => $decoded
    ];
}

/**
 * Select data from a table
 */
function supabaseSelect($table, $columns = '*', $filters = []) {
    $params = ['select' => $columns];

    foreach ($filters as $key => $value) {
        if (is_array($value)) {
            // Handle operators like eq, gte, is, etc
            $params[$key] = $value['op'] . '.' . $value['value'];
        } else {
            $params[$key] = 'eq.' . $value;
        }
    }

    return supabaseRequest('GET', $table, null, $params);
}

/**
 * Insert data into a table
 */
function supabaseInsert($table, $data) {
    return supabaseRequest('POST', $table, $data);
}

/**
 * Update data in a table
 */
function supabaseUpdate($table, $data, $filters = []) {
    $params = [];

    foreach ($filters as $key => $value) {
        $params[$key] = 'eq.' . $value;
    }

    return supabaseRequest('PATCH', $table . '?' . http_build_query($params), $data);
}

/**
 * Call a Supabase RPC function
 */
function supabaseRpc($functionName, $params = []) {
    return supabaseRequest('POST', 'rpc/' . $functionName, $params);
}
