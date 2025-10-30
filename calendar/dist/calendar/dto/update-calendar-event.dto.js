"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCalendarEventDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_calendar_event_dto_1 = require("./create-calendar-event.dto");
class UpdateCalendarEventDto extends (0, swagger_1.PartialType)(create_calendar_event_dto_1.CreateCalendarEventDto) {
}
exports.UpdateCalendarEventDto = UpdateCalendarEventDto;
//# sourceMappingURL=update-calendar-event.dto.js.map