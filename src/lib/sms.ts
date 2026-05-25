// SMS gateway. MVP ships a mock that prints to the server log; swap to
// Twilio/Aligo by implementing the same `send` interface.

import { env } from "@/lib/env";

export type SmsResult = { delivered: boolean; provider: string; messageId?: string };

async function sendMock(phoneNumber: string, body: string): Promise<SmsResult> {
  // eslint-disable-next-line no-console
  console.log(`\n📱 [SMS MOCK] -> ${phoneNumber}\n   ${body}\n`);
  return { delivered: true, provider: "mock", messageId: `mock-${Date.now()}` };
}

export async function sendSms(phoneNumber: string, body: string): Promise<SmsResult> {
  switch (env.smsProvider) {
    case "mock":
    default:
      return sendMock(phoneNumber, body);
    // case "twilio": ...
    // case "aligo":  ...
  }
}
