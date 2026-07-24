import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { OrgId } from "../common/context.decorators";
import { CreateComponentDto, CreateProductDto } from "./dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@OrgId() orgId: string, @Query("categoryKey") categoryKey?: string) {
    return this.products.list(orgId, categoryKey);
  }

  @Get(":id")
  getOne(@OrgId() orgId: string, @Param("id") id: string) {
    return this.products.getOne(orgId, id);
  }

  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateProductDto) {
    return this.products.create(orgId, dto);
  }

  @Delete(":id")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.products.remove(orgId, id);
  }

  @Post(":id/components")
  addComponent(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() dto: CreateComponentDto,
  ) {
    return this.products.addComponent(orgId, id, dto);
  }
}
