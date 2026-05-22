// Using 'as const' object instead of enum so the values stay plain strings
// and match exactly what is stored in the DB and sent over the wire.
export const OTP_PURPOSE = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
} as const;

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];
