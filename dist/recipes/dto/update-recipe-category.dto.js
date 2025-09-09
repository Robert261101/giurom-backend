"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRecipeCategoryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_recipe_category_dto_1 = require("./create-recipe-category.dto");
class UpdateRecipeCategoryDto extends (0, swagger_1.PartialType)(create_recipe_category_dto_1.CreateRecipeCategoryDto) {
}
exports.UpdateRecipeCategoryDto = UpdateRecipeCategoryDto;
//# sourceMappingURL=update-recipe-category.dto.js.map