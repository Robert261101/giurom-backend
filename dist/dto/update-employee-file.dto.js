"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEmployeeFileDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_employee_file_dto_1 = require("./create-employee-file.dto");
class UpdateEmployeeFileDto extends (0, swagger_1.PartialType)(create_employee_file_dto_1.CreateEmployeeFileDto) {
}
exports.UpdateEmployeeFileDto = UpdateEmployeeFileDto;
//# sourceMappingURL=update-employee-file.dto.js.map