"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompanyDocumentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_company_document_dto_1 = require("./create-company-document.dto");
class UpdateCompanyDocumentDto extends (0, swagger_1.PartialType)((0, swagger_1.OmitType)(create_company_document_dto_1.CreateCompanyDocumentDto, ['company_id'])) {
}
exports.UpdateCompanyDocumentDto = UpdateCompanyDocumentDto;
//# sourceMappingURL=update-company-document.dto.js.map