import { Async } from "domain/entities/Async";
import { FilePath } from "domain/entities/Base";
import { MetadataImportRepository } from "domain/repositories/MetadataImportRepository";
import { MetadataRepository } from "domain/repositories/MetadataRepository";

export class ImportMetadataUseCase {
    constructor(
        private metadataImportRepository: MetadataImportRepository,
        private metadataRepository: MetadataRepository
    ) {}

    async execute(options: { inputFile: FilePath }): Async<void> {
        const metadata = await this.metadataImportRepository.import(options);
        console.debug(
            [
                `inputFile: ${options.inputFile}`,
                `dataElements: ${metadata.dataElements.length}`,
                `indicators: ${metadata.indicators.length}`,
            ].join("\n")
        );
        await this.metadataRepository.save(metadata);
    }
}
