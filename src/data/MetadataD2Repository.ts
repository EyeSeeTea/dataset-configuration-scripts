import _ from "lodash";
import fs from "fs";
import { Async } from "domain/entities/Async";
import { Metadata } from "domain/entities/Metadata";
import { MetadataRepository } from "domain/repositories/MetadataRepository";
import {
    D2Api,
    D2ApiDefinition,
    D2DataElement,
    D2Indicator,
    MetadataPayloadBase,
    MetadataPickBase,
    PartialPersistedModel,
} from "types/d2-api";
import { runMetadata } from "./dhis2-utils";
import { getUid } from "./dhis2";
import { Maybe } from "utils/ts-utils";
import { Id, Ref, getId, getName, getRef } from "domain/entities/Base";

const query = {
    // Data elements
    dataElements: { fields: { $owner: true } },
    dataElementGroups: { fields: { $owner: true } },
    dataElementGroupSets: { fields: { name: true, code: true, dataElementGroups: { name: true } } },

    // Indicators
    indicators: { fields: { $owner: true } },
    indicatorGroups: { fields: { $owner: true } },
    indicatorGroupSets: { fields: { name: true, code: true, indicatorGroups: { name: true } } },

    // Relationships
    categoryCombos: { fields: { id: true, name: true } },
    optionSets: { fields: { id: true, name: true } },
    indicatorTypes: { fields: { id: true, name: true } },
} as const;

type CurrentD2Metadata = MetadataPickBase<D2ApiDefinition, typeof query>;

export class MetadataD2Repository implements MetadataRepository {
    constructor(private api: D2Api) {}

    async save(metadata: Metadata): Async<void> {
        const currentD2Metatadata = await this.api.metadata.get(query).getData();

        const payload: Partial<MetadataPayloadBase<D2ApiDefinition["schemas"]>> = {
            ...this.getDataElementsMetadata(currentD2Metatadata, metadata),
            ...this.getIndicatorsMetadata(currentD2Metatadata, metadata),
        };

        console.debug(`Payload saved: payload.json`);
        fs.writeFileSync("payload.json", JSON.stringify(payload, null, 4));

        const res = await runMetadata(this.api.metadata.post(payload));

        const summary = _(res.typeReports)
            .map(tr => [_.last(tr.klass.split(".")), tr.stats])
            .fromPairs()
            .value();

        console.debug(`Stats: ${JSON.stringify(summary)}`);
    }

    private getIndicatorsMetadata(currentD2Metatadata: CurrentD2Metadata, metadata: Metadata) {
        const indicatorsIdMapper = new IdCodeMapper(currentD2Metatadata.indicators);
        const indicatorTypesMapper = new GenericMapper(currentD2Metatadata.indicatorTypes, getName);

        function getGroups(setName: string): string[] {
            const groupSet = currentD2Metatadata.indicatorGroupSets.find(set => set.name === setName);
            if (!groupSet) throw new Error(`Cannot find group set: name=${setName}`);
            return groupSet.indicatorGroups.map(group => group.name);
        }

        const groupSets = {
            origin: getGroups("Indicator Origin"),
            status: getGroups("Status"),
            coreCompetency: getGroups("Core Competency/Area"),
            theme: getGroups("Theme"),
        };

        const validatedIndicators = _(metadata.indicators)
            .map((indicator): Maybe<typeof indicator & Ref> => {
                const validationErrors = _.compact([
                    validateGroup(indicator.groupOrigin, groupSets.origin),
                    validateGroup(indicator.groupStatus, groupSets.status),
                    validateGroup(indicator.groupCoreCompetency, groupSets.coreCompetency),
                    validateGroup(indicator.groupTheme, groupSets.theme),
                ]);

                if (_.isEmpty(validationErrors)) {
                    return {
                        ...indicator,
                        id: indicatorsIdMapper.getExistingOrRandomId(indicator),
                    };
                } else {
                    console.debug(validationErrors.join("\n"));
                    return undefined;
                }
            })
            .compact()
            .value();

        const indicatorInMetadataIds = new Set(validatedIndicators.map(getId));

        const d2IndicatorGroupsUpdated = _(currentD2Metatadata.indicatorGroups)
            .map((group): Maybe<typeof group> => {
                const indicatorInGroupUpdated = _(group.indicators)
                    .reject(indicator => indicatorInMetadataIds.has(indicator.id))
                    .concat(
                        validatedIndicators
                            .filter(indicator =>
                                [
                                    indicator.groupCoreCompetency,
                                    indicator.groupOrigin,
                                    indicator.groupStatus,
                                    indicator.groupTheme,
                                ].includes(group.name)
                            )
                            .map(getRef)
                    )
                    .value();

                return hasChanges(group.indicators, indicatorInGroupUpdated)
                    ? { ...group, indicators: indicatorInGroupUpdated }
                    : undefined;
            })
            .compact()
            .value();

        const d2Indicators = validatedIndicators.map((indicator): PartialPersistedModel<D2Indicator> => {
            return {
                ...indicatorsIdMapper.get(indicator),
                ...indicator,
                indicatorType: indicatorTypesMapper.getRef(indicator.indicatorType),
            };
        });

        return { indicators: d2Indicators, indicatorGroups: d2IndicatorGroupsUpdated };
    }

    private getDataElementsMetadata(currentD2Metatadata: CurrentD2Metadata, metadata: Metadata) {
        const dataElementsIdMapper = new IdCodeMapper(currentD2Metatadata.dataElements);
        const categoryComboMapper = new GenericMapper(currentD2Metatadata.categoryCombos, getName);
        const optionSetsMapper = new GenericMapper(currentD2Metatadata.optionSets, getName);

        function getGroups(groupSetCode: string): string[] {
            const groupSet = currentD2Metatadata.dataElementGroupSets.find(set => set.code === groupSetCode);
            if (!groupSet) throw new Error(`Cannot find group set: code=${groupSetCode}`);
            return groupSet.dataElementGroups.map(group => group.name);
        }

        const dataElementGroupSets = {
            origin: getGroups("GL_DEORIGIN_DEGROUPSET"),
            status: getGroups("GL_DESTATUS_DEGROUPSET"),
            coreCompetency: getGroups("GL_CoreComp_DEGROUPSET"),
            theme: getGroups("GL_DETHEME_DEGROUPSET"),
            type: getGroups("GL_DETYPE_DEGROUPSET"),
        };

        const dataElementsWithId = _(metadata.dataElements)
            .map((dataElement): Maybe<typeof dataElement & Ref> => {
                const validationErrors = _.compact([
                    validateGroup(dataElement.groupOrigin, dataElementGroupSets.origin),
                    validateGroup(dataElement.groupStatus, dataElementGroupSets.status),
                    validateGroup(dataElement.groupCoreCompetency, dataElementGroupSets.coreCompetency),
                    validateGroup(dataElement.groupTheme, dataElementGroupSets.theme),
                    validateGroup(dataElement.groupType, dataElementGroupSets.type),
                ]);

                if (_.isEmpty(validationErrors)) {
                    return {
                        ...dataElement,
                        id: dataElementsIdMapper.getExistingOrRandomId(dataElement),
                    };
                } else {
                    console.debug(validationErrors.join("\n"));
                    return undefined;
                }
            })
            .compact()
            .value();

        const d2DataElements = dataElementsWithId.map((dataElement): PartialPersistedModel<D2DataElement> => {
            return {
                domainType: "AGGREGATE",
                ...dataElementsIdMapper.get(dataElement),
                ...dataElement,
                categoryCombo: categoryComboMapper.getRef(dataElement.categoryComboName),
                optionSet: optionSetsMapper.getRef(dataElement.optionSet),
            };
        });

        const dataElementInMetadataIds = new Set(dataElementsWithId.map(getId));

        const d2DataElementGroupsUpdated = _(currentD2Metatadata.dataElementGroups)
            .map((group): Maybe<typeof group> => {
                const dataElementInGroupUpdated = _(group.dataElements)
                    .reject(indicator => dataElementInMetadataIds.has(indicator.id))
                    .concat(
                        dataElementsWithId
                            .filter(dataElement =>
                                [
                                    dataElement.groupCoreCompetency,
                                    dataElement.groupOrigin,
                                    dataElement.groupStatus,
                                    dataElement.groupTheme,
                                    dataElement.groupType,
                                ].includes(group.name)
                            )
                            .map(getRef)
                    )
                    .value();

                return hasChanges(group.dataElements, dataElementInGroupUpdated)
                    ? { ...group, dataElements: dataElementInGroupUpdated }
                    : undefined;
            })
            .compact()
            .value();

        return { dataElements: d2DataElements, dataElementGroups: d2DataElementGroupsUpdated };
    }
}

class GenericMapper<Obj extends Ref> {
    valuesByKey: Map<string, Obj>;

    constructor(objs: Obj[], getKey: (value: Obj) => string) {
        this.valuesByKey = new Map(objs.map(value => [getKey(value), value]));
    }

    getRef(key: Maybe<string>): Maybe<{ id: string }> {
        const value = key ? this.valuesByKey.get(key) : undefined;
        return value ? { id: value.id } : undefined;
    }
}

type MapperSelector = {
    id: Maybe<string>;
    code: string;
};

class IdCodeMapper<Obj extends { id: string; code: string }> {
    objsByCode: Map<string, Obj>;

    constructor(objs: Obj[]) {
        this.objsByCode = new Map(Object.entries(_.keyBy(objs, obj => obj.code)));
    }

    get(selector: MapperSelector): Maybe<Obj> {
        return this.objsByCode.get(selector.code);
    }

    getExistingOrRandomId(selector: MapperSelector): Id {
        return (
            selector.id ||
            (selector.code && this.objsByCode.get(selector.code)?.id) ||
            this.getRandomId(selector)
        );
    }

    private getRandomId(selector: MapperSelector): Id {
        const parts = [selector.code, new Date().getTime(), Math.random()];
        return getUid("dataElement", parts.join("-"));
    }
}

function validateGroup(groupName: Maybe<string>, groupNames: string[]) {
    const isValid = !groupName || groupNames.includes(groupName);
    return isValid ? undefined : `Invalid: ${groupName} (expected: ${groupNames.join(", ")})`;
}

function hasChanges<T extends Ref>(objs1: T[], objs2: T[]): boolean {
    return !_.isEqual(_.sortBy(objs1, getId), _.sortBy(objs2, getId));
}
