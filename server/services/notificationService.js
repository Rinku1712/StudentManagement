const sendTwilioMessage = async (to, message, channel) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from =
    channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from)
    return { status: 'skipped', reason: 'Twilio is not configured.' };

  const destination = channel === 'whatsapp' && !to.startsWith('whatsapp:') ? `whatsapp:${to}` : to;
  const body = new URLSearchParams({ To: destination, From: from, Body: message });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || `Twilio ${channel} delivery failed.`);
  }
  return { status: 'sent' };
};

const sendGuardianAlert = async (student, message) => {
  const phone = student.academicProfile?.guardianPhone;
  if (!phone) return [{ channel: 'sms', status: 'skipped', reason: 'Guardian phone is missing.' }];

  const channels = [];
  for (const channel of ['sms', 'whatsapp']) {
    const result = await sendTwilioMessage(phone, message, channel);
    channels.push({ channel, ...result });
  }
  return channels;
};

module.exports = { sendGuardianAlert };
