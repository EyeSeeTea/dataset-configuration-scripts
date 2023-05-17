export interface DataSetRepository {
    fix(coreCompetenciesMapping: Map<string, string>): Promise<void>;
}
