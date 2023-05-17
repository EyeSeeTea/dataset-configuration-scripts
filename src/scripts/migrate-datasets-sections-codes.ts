import { command } from "cmd-ts";
import { FixDataSetsAfterCoreCompetenciesRenameUseCase } from "domain/usecases/FixDataSetsAfterCoreCompetenciesRenameUseCase";

import { getApiUrlOption, getD2Api } from "./common";
import { DataSetD2Repository } from "./DataSetD2Repository";

export const fixSectionsDatasetsCommand = command({
    name: "fix-sections-datasets",
    description: "Fix data sets after a core competencies rename",
    args: { url: getApiUrlOption({ long: "url" }) },
    handler: async args => {
        const api = getD2Api(args.url);
        const dataSetRepository = new DataSetD2Repository(api);
        new FixDataSetsAfterCoreCompetenciesRenameUseCase(dataSetRepository).execute();
    },
});
