import _ from "lodash";
import logger from "../utils/log";
import { promiseMap, runMetadata } from "../data/dhis2-utils";
import { D2Api, MetadataPick } from "../types/d2-api";
import { Maybe } from "../utils/ts-utils";
import { DataSetRepository } from "domain/repositories/DataSetRepository";
import { CoreCompetency } from "domain/CoreCompetency";

export class DataSetD2Repository implements DataSetRepository {
    createdByAppAttributeCode = "GL_CREATED_BY_DATASET_CONFIGURATION";

    constructor(private api: D2Api) {}

    async fix(coreCompetenciesMapping: Map<string, string>) {
        const dataSets = await this.getDataSets();
        const coreCompetenciesByName = await this.getCoreCompetencies();
        const sections = _.flatMap(dataSets, dataSet => dataSet.sections);

        const sectionsFixed = _(sections)
            .map(section => this.fixSection(section, coreCompetenciesByName, coreCompetenciesMapping))
            .compact()
            .value();

        logger.info(`Core competencies: ${_.keys(coreCompetenciesByName).join(", ")}`);
        logger.info(`Data sets: ${dataSets.length} - Sections: ${sections.length}`);
        logger.info(`Sections to fix: ${sectionsFixed.length}`);

        this.saveSections(sectionsFixed);
    }

    private saveSections(sections: D2Section[]) {
        if (_.isEmpty(sections)) return;

        const sectionsGroupList = _(sections)
            .sortBy(section => section.greyedFields.length)
            .reverse()
            .chunk(10)
            .value();

        return promiseMap(sectionsGroupList, async (sectionsChunk, idx) => {
            logger.info(`POST ${sectionsChunk.length} sections: ${idx + 1}/${sectionsGroupList.length}`);
            const res = await runMetadata(this.api.metadata.post({ sections: sectionsChunk }));
            logger.info(`Result: ${res.status} (${JSON.stringify(res.stats)})`);
        });
    }

    private fixSection(
        section: D2Section,
        coreCompetenciesByName: CoreCompetenciesIndexedByName,
        coreCompetenciesRenameMapping: RenameMapping
    ): Maybe<D2Section> {
        const match = section.name.match(/^(.*) (Outputs|Outcomes)$/);
        const err = `Cannot match section: id='${section.id}' name='${section.name}'`;
        if (!match) throw new Error(err);
        const [sectionName, type] = match.slice(1);
        if (!sectionName || !type) throw new Error(err);

        const ccName = coreCompetenciesRenameMapping.get(sectionName) || sectionName;
        const coreCompetency = coreCompetenciesByName[ccName];
        logger.debug(`section ${section.id} (${section.name}): sectionName=${sectionName}, type=${type}`);
        if (!coreCompetency) throw new Error(`Core competency (DEGroup) not found: name='${ccName}'`);

        const name = [coreCompetency.name, type].join(" ");
        const code = [section.dataSet.id, type.toUpperCase(), coreCompetency.code].join("_");
        const sectionFixed: D2Section = { ...section, name: name, code: code };
        return _.isEqual(section, sectionFixed) ? undefined : sectionFixed;
    }

    private async getCoreCompetencies(): Promise<Record<Name, CoreCompetency>> {
        const { dataElementGroupSets } = await this.api.metadata
            .get({
                dataElementGroupSets: {
                    fields: {
                        id: true,
                        code: true,
                        dataElementGroups: { id: true, code: true, name: true },
                    },
                    filter: { code: { eq: "GL_CoreComp_DEGROUPSET" } },
                },
            })
            .getData();

        const coreCompetencySet = dataElementGroupSets[0];
        if (!coreCompetencySet) throw new Error("Cannot get dataElementGroupSet");

        return _.keyBy(coreCompetencySet.dataElementGroups, deg => deg.name);
    }

    private async getDataSets(): Promise<D2DataSet[]> {
        const { dataSets } = await this.api.metadata.get(metadataQuery).getData();

        return dataSets.filter(dataSet =>
            dataSet.attributeValues.some(
                av => av.attribute.code === this.createdByAppAttributeCode && av.value === "true"
            )
        );
    }
}

const metadataQuery = {
    dataSets: {
        fields: {
            attributeValues: { value: true, attribute: { code: true } },
            sections: { $owner: true, greyedFields: { $owner: true } },
        },
    },
} as const;

type D2DataSet = MetadataPick<typeof metadataQuery>["dataSets"][number];

type D2Section = D2DataSet["sections"][number];

type CoreCompetenciesIndexedByName = Record<Name, CoreCompetency>;

type Name = string;

type RenameMapping = Map<string, string>;
