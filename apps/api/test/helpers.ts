import "reflect-metadata";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/** Build the Nest app exactly as main.ts does (minus listen). */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

let counter = 0;
export function uniqEmail(): string {
  counter += 1;
  return `e2e-${Date.now()}-${counter}@passidex.test`;
}

export type Agent = ReturnType<typeof request.agent>;

/** Register a fresh org + owner and return a cookie-persisting agent. */
export async function registerAgent(
  app: INestApplication,
): Promise<{ agent: Agent; email: string; user: any }> {
  const agent = request.agent(app.getHttpServer());
  const email = uniqEmail();
  const res = await agent
    .post("/api/auth/register")
    .send({ orgName: `Org ${email}`, email, password: "password123", name: "Owner" })
    .expect(201);
  return { agent, email, user: res.body };
}
