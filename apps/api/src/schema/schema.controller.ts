import { Controller, Get } from "@nestjs/common";
import { SCHEMA_VERSION } from "@passidex/schema";
import { ProductSchemaService } from "./product-schema.service";

/** Read-only exposure of the category/field catalogue to the frontend. */
@Controller("schema")
export class SchemaController {
  constructor(private readonly schema: ProductSchemaService) {}

  @Get("categories")
  categories() {
    return { version: SCHEMA_VERSION, categories: this.schema.categories() };
  }
}
