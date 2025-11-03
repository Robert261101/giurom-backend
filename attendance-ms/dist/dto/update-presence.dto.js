"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePresenceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_presence_dto_1 = require("./create-presence.dto");
class UpdatePresenceDto extends (0, swagger_1.PartialType)(create_presence_dto_1.CreatePresenceDto) {
}
exports.UpdatePresenceDto = UpdatePresenceDto;
//# sourceMappingURL=update-presence.dto.js.map