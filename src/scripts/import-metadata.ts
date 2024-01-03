import { command } from "cmd-ts";
import { getApiUrlOption, getD2Api, runAsync } from "./common";
import { ImportMetadataUseCase } from "domain/usecases/ImportMetadataUseCase";
import { MetadataImportSpreadsheetRepository } from "data/MetadataImportSpreadsheetRepository";
import { MetadataD2Repository } from "data/MetadataD2Repository";

export const importMetadata = command({
    name: "import-metadata",
    description: "Import metadata from XLSX file",
    args: {
        url: getApiUrlOption({ long: "url" }),
        inputFile: getApiUrlOption({ long: "input-file" }),
    },
    handler: async args => {
        const api = getD2Api(args.url);

        runAsync(
            new ImportMetadataUseCase(
                new MetadataImportSpreadsheetRepository(),
                new MetadataD2Repository(api)
            ).execute(args)
        );
    },
});
