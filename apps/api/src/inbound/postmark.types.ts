/** Subset of the Postmark inbound webhook payload that Passidex consumes. */
export interface PostmarkInbound {
  From?: string;
  FromFull?: { Email?: string; Name?: string };
  To?: string;
  ToFull?: { Email?: string }[];
  OriginalRecipient?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Attachments?: {
    Name: string;
    Content: string; // base64
    ContentType: string;
    ContentLength?: number;
  }[];
}
