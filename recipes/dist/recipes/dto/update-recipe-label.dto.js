"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRecipeLabelDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_recipe_label_dto_1 = require("./create-recipe-label.dto");
class UpdateRecipeLabelDto extends (0, swagger_1.PartialType)(create_recipe_label_dto_1.CreateRecipeLabelDto) {
}
exports.UpdateRecipeLabelDto = UpdateRecipeLabelDto;
//# sourceMappingURL=update-recipe-label.dto.js.map