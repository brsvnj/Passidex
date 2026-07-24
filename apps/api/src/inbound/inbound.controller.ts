import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/public.decorator";
import { InboundService } from "./inbound.service";
import type { PostmarkInbound } from "./postmark.types";

/**
 * Public webhook for Postmark inbound email. Not tenant-scoped — the request is
 * resolved from the unique reply-to address. Protected by a shared secret passed
 * as ?token= (configure the same value in the Postmark inbound URL).
 */
@Controller("inbound")
export class InboundController {
  constructor(
    private readonly inbound: InboundService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("postmark")
  postmark(@Body() payload: PostmarkInbound, @Query("token") token?: string) {
    const secret = this.config.get<string>("INBOUND_WEBHOOK_SECRET");
    if (secret && token !== secret) {
      throw new ForbiddenException("Invalid webhook token");
    }
    return this.inbound.handlePostmark(payload);
  }
}
