import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, CheckCircle2, RefreshCcw } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function VerifyOtp() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [otpMessage, setOtpMessage] = useState({
    type: 'info',
    text: 'A 6-digit code was sent to your registered email.',
  });
  const [resendSeconds, setResendSeconds] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;

    const timer = setInterval(() => {
      setResendSeconds((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const nextOtp = [...otp];
    const finalValue = value.slice(-1);
    nextOtp[index] = finalValue;
    setOtp(nextOtp);

    if (finalValue && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'Backspace' && otp[index]) {
      const nextOtp = [...otp];
      nextOtp[index] = '';
      setOtp(nextOtp);
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pastedValue = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);

    if (!pastedValue) return;

    const nextOtp = Array(6).fill('');
    pastedValue.split('').forEach((digit, index) => {
      nextOtp[index] = digit;
    });

    setOtp(nextOtp);
    const nextIndex = Math.min(pastedValue.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalOtp = otp.join('');

    if (finalOtp.length !== 6) {
      setOtpMessage({ type: 'error', text: 'Please enter all 6 digits to verify.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const email = localStorage.getItem('pendingSignupEmail') || '';
      const isPasswordReset = localStorage.getItem('pendingAuthFlow') === 'reset';
      await apiRequest(isPasswordReset ? '/api/auth/reset-password' : '/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify(isPasswordReset ? { email, otp: finalOtp, password: newPassword } : { email, otp: finalOtp }),
      });

      setOtpMessage({ type: 'success', text: isPasswordReset ? 'Password reset successfully.' : 'OTP verified successfully.' });
      localStorage.removeItem('pendingSignupEmail');
      localStorage.removeItem('pendingAuthFlow');
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      setOtpMessage({ type: 'error', text: err.message || 'Verification failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0) return;

    const email = localStorage.getItem('pendingSignupEmail') || '';
    if (!email) {
      setOtpMessage({ type: 'error', text: 'No email is available for resending OTP.' });
      return;
    }

    try {
      await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setOtp(['', '', '', '', '', '']);
      setResendSeconds(30);
      setOtpMessage({ type: 'info', text: 'A new verification code has been sent.' });
      inputRefs.current[0]?.focus();
    } catch (err) {
      setOtpMessage({ type: 'error', text: err.message || 'Unable to resend OTP.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[420px] bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm">
        <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-5">
          <ShieldCheck size={20} />
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Two-Step Verification</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter the 6-digit code sent to your registered email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Enter OTP
            </label>
            <div className="flex justify-between gap-2" onPaste={handlePaste}>
              {otp.map((data, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="1"
                  autoComplete="one-time-code"
                  className="w-12 h-12 text-center text-lg font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  value={data}
                  onChange={(e) => handleChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onFocus={(e) => e.target.select()}
                  aria-label={`OTP digit ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {localStorage.getItem('pendingAuthFlow') === 'reset' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                minLength="6"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                placeholder="At least 6 characters"
              />
            </div>
          )}

          <p
            className={`text-xs ${
              otpMessage.type === 'success'
                ? 'text-emerald-600'
                : otpMessage.type === 'error'
                  ? 'text-rose-600'
                  : 'text-slate-500'
            }`}
          >
            {otpMessage.text}
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium py-2.5 rounded-lg text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={16} /> {isSubmitting ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendSeconds > 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
          >
            <RefreshCcw size={13} />
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend OTP'}
          </button>
        </div>
      </div>
    </div>
  );
}