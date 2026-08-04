import { createHash } from "node:crypto";
import { infrai } from "./infrai.ts";

export type CampaignMessage = {
  to: string;
  subject: string;
  html: string;
};

function deliveryKey(message: CampaignMessage): string {
  return `devtools-campaign-${createHash("sha256")
    .update(`${message.to}\n${message.subject}\n${message.html}`)
    .digest("hex")}`;
}

export async function sendCampaignMessage(message: CampaignMessage): Promise<string> {
  const result = await infrai.email.send(message, deliveryKey(message));
  return result.message_id;
}

export function readDeliveryEvents(messageId: string) {
  return infrai.email.event.list(messageId);
}
