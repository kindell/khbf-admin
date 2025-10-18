<?php
/**
 * OTP Authentication API
 * Handles one-time password generation and verification for SMS login
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load config - try production path first, then development path
if (file_exists(__DIR__ . '/../config/supabase.php')) {
    require_once __DIR__ . '/../config/supabase.php';  // Production (dist/api → dist/config)
} else {
    require_once __DIR__ . '/../../config/supabase.php';  // Development (public/api → config)
}

// Get action from query parameter
$action = $_GET['action'] ?? '';

// Parse JSON input
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'request-code':
        handleRequestCode($input);
        break;
    case 'verify-code':
        handleVerifyCode($input);
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

/**
 * Request a verification code
 * POST /api/otp-auth.php?action=request-code
 */
function handleRequestCode($input) {
    $phoneNumber = $input['phone_number'] ?? '';

    if (empty($phoneNumber)) {
        http_response_code(400);
        echo json_encode(['error' => 'Phone number is required']);
        return;
    }

    // Normalize phone number
    $normalizedPhone = preg_replace('/[^0-9+]/', '', $phoneNumber);

    // Check if phone number exists and has admin role
    $result = supabaseSelect(
        'phone_mappings',
        'member_id,members!inner(id,first_name,last_name,member_role_assignments!member_role_assignments_member_id_fkey!inner(role_id,member_roles!inner(name)))',
        ['phone_number' => $normalizedPhone]
    );

    // Debug logging
    error_log("Supabase result: " . json_encode($result));
    error_log("Normalized phone: " . $normalizedPhone);

    if (!$result['success'] || empty($result['data'])) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Phone number not found in system',
            'debug' => [
                'phone' => $normalizedPhone,
                'supabase_status' => $result['status'] ?? 'unknown',
                'supabase_error' => $result['data'] ?? 'no data'
            ]
        ]);
        return;
    }

    $phoneMapping = $result['data'][0];

    // Check if member has admin role
    $hasAdminRole = false;
    foreach ($phoneMapping['members']['member_role_assignments'] as $assignment) {
        if ($assignment['member_roles']['name'] === 'admin') {
            $hasAdminRole = true;
            break;
        }
    }

    if (!$hasAdminRole) {
        http_response_code(403);
        echo json_encode(['error' => 'Not authorized for SMS admin']);
        return;
    }

    // Rate limiting: Check if code was requested in last 60 seconds
    $oneMinuteAgo = date('Y-m-d\TH:i:s', strtotime('-60 seconds')) . 'Z';
    $recentResult = supabaseSelect(
        'sms_auth_codes',
        'created_at',
        [
            'phone_number' => $normalizedPhone,
            'created_at' => ['op' => 'gte', 'value' => $oneMinuteAgo]
        ]
    );

    if ($recentResult['success'] && !empty($recentResult['data'])) {
        http_response_code(429);
        echo json_encode([
            'error' => 'Please wait before requesting a new code',
            'retry_after' => 60
        ]);
        return;
    }

    // Generate 6-digit code
    $code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d\TH:i:s', strtotime('+5 minutes')) . 'Z';

    // Store code in database
    $insertResult = supabaseInsert('sms_auth_codes', [
        'phone_number' => $normalizedPhone,
        'code' => $code,
        'member_id' => $phoneMapping['members']['id'],
        'expires_at' => $expiresAt,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]);

    if (!$insertResult['success']) {
        error_log('Failed to store auth code: ' . json_encode($insertResult));
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate code']);
        return;
    }

    // Queue SMS to be sent (non-blocking - OTP code is already saved)
    $message = "Din verifieringskod för KHBF SMS Admin är: {$code}\n\nKoden är giltig i 5 minuter.";

    $smsResult = supabaseInsert('sms_queue', [
        'direction' => 'outbound',
        'phone_number' => $normalizedPhone,
        'message' => $message,
        'status' => 'pending',
        'is_system' => true  // Mark OTP messages as system messages
    ]);

    if (!$smsResult['success']) {
        // Log SMS queueing failure but don't block the request
        // OTP code is already saved and can be verified
        error_log('Failed to queue SMS (non-critical): ' . json_encode($smsResult));
    } else {
        error_log("Code requested for {$normalizedPhone}, queued for sending");
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Verification code sent',
        'expires_in' => 300
    ]);
}

/**
 * Verify a code
 * POST /api/otp-auth.php?action=verify-code
 */
function handleVerifyCode($input) {
    $phoneNumber = $input['phone_number'] ?? '';
    $code = $input['code'] ?? '';

    if (empty($phoneNumber) || empty($code)) {
        http_response_code(400);
        echo json_encode(['error' => 'Phone number and code are required']);
        return;
    }

    // Normalize phone number
    $normalizedPhone = preg_replace('/[^0-9+]/', '', $phoneNumber);

    // Find the most recent non-verified code for this phone number
    $params = [
        'select' => '*',
        'phone_number' => 'eq.' . $normalizedPhone,
        'verified_at' => 'is.null',
        'order' => 'created_at.desc',
        'limit' => 1
    ];

    $result = supabaseRequest('GET', 'sms_auth_codes', null, $params);

    if (!$result['success'] || empty($result['data'])) {
        http_response_code(404);
        echo json_encode(['error' => 'No pending verification code found']);
        return;
    }

    $authCode = $result['data'][0];

    // Check if code has expired
    if (strtotime($authCode['expires_at']) < time()) {
        http_response_code(400);
        echo json_encode(['error' => 'Verification code has expired']);
        return;
    }

    // Check if max attempts exceeded
    if ($authCode['attempts'] >= 3) {
        http_response_code(400);
        echo json_encode(['error' => 'Too many failed attempts. Request a new code.']);
        return;
    }

    // Increment attempts
    supabaseUpdate(
        'sms_auth_codes',
        ['attempts' => $authCode['attempts'] + 1],
        ['id' => $authCode['id']]
    );

    // Verify code
    if ($authCode['code'] !== $code) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid verification code',
            'attempts_remaining' => 3 - ($authCode['attempts'] + 1)
        ]);
        return;
    }

    // Mark as verified
    supabaseUpdate(
        'sms_auth_codes',
        ['verified_at' => date('Y-m-d\TH:i:s') . 'Z'],
        ['id' => $authCode['id']]
    );

    // Get member info
    $memberResult = supabaseSelect(
        'phone_mappings',
        'member_id,members!inner(id,first_name,last_name)',
        ['phone_number' => $normalizedPhone]
    );

    if (!$memberResult['success'] || empty($memberResult['data'])) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to retrieve member info']);
        return;
    }

    $phoneMapping = $memberResult['data'][0];

    error_log("Code verified for {$normalizedPhone}");

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'member_id' => $phoneMapping['members']['id'],
        'member_name' => $phoneMapping['members']['first_name'] . ' ' . $phoneMapping['members']['last_name']
    ]);
}
