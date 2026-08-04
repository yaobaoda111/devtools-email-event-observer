import { readDeliveryEvents, sendCampaignMessage } from "../src/campaign_observer.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const existingMessageId = argument("message-id");

if (existingMessageId) {
  const events = await readDeliveryEvents(existingMessageId);
  console.log(JSON.stringify({ message_id: existingMessageId, events }, null, 2));
} else {
  const to = argument("to");
  if (!to) throw new Error("Pass --to <address> or --message-id <id>");

  const messageId = await sendCampaignMessage({
    to,
    subject: "Your developer workspace report",
    html: "<h1>Workspace report</h1><p>Your build and deployment summary is ready.</p>",
  });
  console.log(JSON.stringify({ message_id: messageId }, null, 2));
}
