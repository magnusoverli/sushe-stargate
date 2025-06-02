const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendPasswordResetEmail = async (email, resetUrl) => {
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM,
    subject: 'Password Reset - SuShe Stargate',
    html: `
      <div style="background-color: #000000; color: #ffffff; padding: 20px; font-family: 'Inter', sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #111827; padding: 30px; border-radius: 8px;">
          <h1 style="color: #dc2626; font-family: 'Cinzel', serif; text-align: center; margin-bottom: 30px;">
            SuShe Stargate
          </h1>
          
          <h2 style="color: #ffffff; margin-bottom: 20px;">Password Reset Request</h2>
          
          <p style="color: #d1d5db; line-height: 1.6; margin-bottom: 20px;">
            You requested a password reset for your SuShe Stargate account. 
            Click the button below to reset your password. This link will expire in 1 hour.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc2626; color: #ffffff; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If you didn't request this password reset, please ignore this email. 
            Your password won't be changed until you create a new one using the link above.
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #374151;">
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              This is an automated email from SuShe Stargate. Please do not reply.
            </p>
          </div>
        </div>
      </div>
    `
  };
  
  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail
};