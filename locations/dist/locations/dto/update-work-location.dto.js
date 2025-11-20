"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWorkLocationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_work_location_dto_1 = require("./create-work-location.dto");
class UpdateWorkLocationDto extends (0, swagger_1.PartialType)((0, swagger_1.OmitType)(create_work_location_dto_1.CreateWorkLocationDto, ['company_id'])) {
}
exports.UpdateWorkLocationDto = UpdateWorkLocationDto;
//# sourceMappingURL=update-work-location.dto.js.map