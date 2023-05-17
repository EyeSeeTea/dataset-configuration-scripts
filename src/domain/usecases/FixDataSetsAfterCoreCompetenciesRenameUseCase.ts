import { DataSetD2Repository } from "scripts/DataSetD2Repository";

export class FixDataSetsAfterCoreCompetenciesRenameUseCase {
    constructor(private dataSetsRepository: DataSetD2Repository) {}

    async execute() {
        const coreCompetenciesMapping = new Map([
            ["SHELTER", "SHELTER & SETTLEMENTS"],
            ["FOOD SECURITY", "LIVELIHOODS & FOOD SECURITY"],
            ["CAMP MANAGEMENT", "PROTECTION FROM VIOLENCE"],
        ]);

        await this.dataSetsRepository.fix(coreCompetenciesMapping);
    }
}
