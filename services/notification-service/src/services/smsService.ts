import axios from 'axios';

const AT_API_KEY  = process.env.AFRICAS_TALKING_API_KEY!;
const AT_USERNAME = process.env.AFRICAS_TALKING_USERNAME!;
const AT_SENDER   = process.env.AFRICAS_TALKING_SENDER_ID || 'AfriXplore';

export async function sendSMS(phoneNumber: string, message: string): Promise<void> {
  await axios.post(
    'https://api.africastalking.com/version1/messaging',
    new URLSearchParams({
      username: AT_USERNAME,
      to: phoneNumber,
      message: message.slice(0, 160),
      from: AT_SENDER,
    }),
    {
      headers: {
        apiKey: AT_API_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  console.log(`SMS sent to ${phoneNumber}`);
}

export async function sendBulkSMS(recipients: string[], message: string): Promise<void> {
  await sendSMS(recipients.join(','), message);
}
