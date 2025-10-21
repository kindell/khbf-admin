import { useState, useRef, KeyboardEvent } from 'react';
import '../SMSLogin.css'; // Reuse existing styles

interface AdminLoginProps {
  onLoginSuccess: (memberId: string, memberName: string, phoneNumber: string) => void;
}

type LoginStep = 'phone' | 'code';

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresIn, setExpiresIn] = useState(300);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Normalize phone number (remove spaces, dashes, etc.)
      const normalizedPhone = phoneNumber.replace(/[^0-9+]/g, '');

      if (!normalizedPhone) {
        setError('Ange ett giltigt telefonnummer');
        setLoading(false);
        return;
      }

      const response = await fetch(`${import.meta.env.BASE_URL}api/otp-auth.php?action=request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: normalizedPhone })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Kunde inte skicka verifieringskod');
        setLoading(false);
        return;
      }

      // Success - move to code entry step
      setStep('code');
      setExpiresIn(data.expires_in || 300);

      // Start countdown timer
      const timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Focus first code input
      setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 100);

    } catch (err) {
      console.error('Request code error:', err);
      setError('Ett fel uppstod vid kommunikation med servern');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const enteredCode = code.join('');

      if (enteredCode.length !== 6) {
        setError('Ange alla 6 siffror');
        setLoading(false);
        return;
      }

      const normalizedPhone = phoneNumber.replace(/[^0-9+]/g, '');

      const response = await fetch(`${import.meta.env.BASE_URL}api/otp-auth.php?action=verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: normalizedPhone,
          code: enteredCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ogiltig verifieringskod');
        // Clear code inputs on error
        setCode(['', '', '', '', '', '']);
        codeInputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // Success!
      onLoginSuccess(data.member_id, data.member_name, normalizedPhone);

    } catch (err) {
      console.error('Verify code error:', err);
      setError('Ett fel uppstod vid verifiering');
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // If current input is empty, move to previous and clear it
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
        codeInputRefs.current[index - 1]?.focus();
      } else if (code[index]) {
        // Clear current input
        const newCode = [...code];
        newCode[index] = '';
        setCode(newCode);
      }
    }
    // Handle left/right arrow keys
    else if (e.key === 'ArrowLeft' && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');

    if (pastedData.length === 6) {
      const newCode = pastedData.split('').slice(0, 6);
      setCode(newCode);
      codeInputRefs.current[5]?.focus();
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (step === 'code') {
    return (
      <div className="sms-login-container">
        <div className="sms-login-card">
          <div className="sms-login-header">
            <h1>📱 Ange Verifieringskod</h1>
            <p>Vi har skickat en 6-siffrig kod till</p>
            <p className="phone-display">{phoneNumber}</p>
          </div>

          <form onSubmit={handleVerifyCode} className="sms-login-form">
            <div className="code-input-group" onPaste={handleCodePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => codeInputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeInput(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  disabled={loading}
                  className="code-input"
                  autoComplete="off"
                />
              ))}
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="timer">
              {expiresIn > 0 ? (
                <span>Koden går ut om {formatTime(expiresIn)}</span>
              ) : (
                <span className="expired">Koden har gått ut</span>
              )}
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading || code.join('').length !== 6 || expiresIn === 0}
            >
              {loading ? 'Verifierar...' : 'Verifiera Kod'}
            </button>

            <button
              type="button"
              className="back-button-link"
              onClick={() => {
                setStep('phone');
                setCode(['', '', '', '', '', '']);
                setError('');
              }}
            >
              ← Ändra telefonnummer
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="sms-login-container">
      <div className="sms-login-card">
        <div className="sms-login-header">
          <h1>🔐 KHBF Admin</h1>
          <p>Logga in med ditt telefonnummer</p>
        </div>

        <form onSubmit={handleRequestCode} className="sms-login-form">
          <div className="form-group">
            <label htmlFor="phone">Telefonnummer</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+46701234567"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading || !phoneNumber}
          >
            {loading ? 'Skickar kod...' : 'Skicka Verifieringskod'}
          </button>
        </form>

        <div className="sms-login-footer">
          <p className="hint">
            💡 Endast administratörer kan logga in här
          </p>
        </div>
      </div>
    </div>
  );
}
