"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTaskTemplateAssignmentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_task_template_assignment_dto_1 = require("./create-task-template-assignment.dto");
class UpdateTaskTemplateAssignmentDto extends (0, swagger_1.PartialType)((0, swagger_1.OmitType)(create_task_template_assignment_dto_1.CreateTaskTemplateAssignmentDto, ['location_id'])) {
}
exports.UpdateTaskTemplateAssignmentDto = UpdateTaskTemplateAssignmentDto;
//# sourceMappingURL=update-task-template-assignment.dto.js.map