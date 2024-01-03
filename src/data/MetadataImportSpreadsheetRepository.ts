import _ from "lodash";
import XLSX from "xlsx";
import { Async } from "domain/entities/Async";
import {
    DataElement,
    DataElementGroup,
    Indicator,
    IndicatorGroup,
    Metadata,
    aggregationTypes,
    valueTypes,
} from "domain/entities/Metadata";
import {
    MetadataImportOptions,
    MetadataImportRepository,
} from "domain/repositories/MetadataImportRepository";
import { Codec, array, boolean, exactly, oneOf, optional, string } from "purify-ts/Codec";
import { Left, Right } from "purify-ts/Either";
import { isValidUid } from "./dhis2";

export class MetadataImportSpreadsheetRepository implements MetadataImportRepository {
    async import(options: MetadataImportOptions): Async<Metadata> {
        const workbook = XLSX.readFile(options.inputFile, {});

        const workbookAsJson = _.mapValues(workbook.Sheets, sheet => {
            return XLSX.utils.sheet_to_json(sheet, { defval: undefined });
        });

        return metadataCodec.decode(workbookAsJson).caseOf({
            Left: err => throw_(err),
            Right: (metadata): Metadata => ({
                ...metadata,
                dataElements: metadata.dataElements.map(
                    (dataElement): DataElement => ({
                        ...dataElement,
                        groupOrigin: dataElement["DEG:Origin"],
                        groupStatus: dataElement["DEG:Status"],
                        groupCoreCompetency: dataElement["DEG:CC"],
                        groupTheme: dataElement["DEG:Theme"],
                        groupType: dataElement["DEG:Type"],
                    })
                ),
                indicators: metadata.indicators.map(
                    (indicator): Indicator => ({
                        ...indicator,
                        groupOrigin: indicator["IG:Origin"],
                        groupStatus: indicator["IG:Status"],
                        groupCoreCompetency: indicator["IG:CC"],
                        groupTheme: indicator["IG:Theme"],
                    })
                ),
                dataElementGroups: metadata.dataElementGroups.map(
                    (deg): DataElementGroup => ({
                        ...deg,
                        shortName: deg.shortname,
                    })
                ),
                indicatorGroups: metadata.indicatorGroups.map(
                    (indicator): IndicatorGroup => ({
                        ...indicator,
                        shortName: indicator.shortname,
                    })
                ),
            }),
        });
    }
}

function throw_(err: string): never {
    throw new Error(err);
}

const uid = Codec.custom<string>({
    decode: input => (typeof input === "string" && isValidUid(input) ? Right(input) : Left("Invalid UID")),
    encode: input => input,
});

const metadataCodec = Codec.interface({
    dataElements: array(
        Codec.interface({
            id: optional(uid),
            name: string,
            shortName: string,
            formName: optional(string),
            description: optional(string),
            code: string,
            categoryComboName: optional(string),
            valueType: oneOfExactValues(valueTypes),
            aggregationType: oneOfExactValues(aggregationTypes),
            optionSet: optional(string),
            commentOptionSet: optional(string),
            zeroIsSignificant: boolean,
            fieldMask: optional(string),
            "DEG:Origin": string,
            "DEG:Status": string,
            "DEG:CC": string,
            "DEG:Theme": string,
            "DEG:Type": string,
        })
    ),
    indicators: array(
        Codec.interface({
            id: optional(uid),
            name: string,
            shortName: string,
            formName: optional(string),
            description: optional(string),
            code: string,
            indicatorType: string,
            "IG:Origin": string,
            "IG:Status": string,
            "IG:CC": string,
            "IG:Theme": optional(string),
        })
    ),
    dataElementGroups: array(
        Codec.interface({
            id: optional(uid),
            name: string,
            shortname: string,
            description: optional(string),
            code: string,
            //DEGS: string,
        })
    ),
    indicatorGroups: array(
        Codec.interface({
            id: optional(uid),
            name: string,
            shortname: string,
            description: optional(string),
            code: string,
            //IGS: string,
        })
    ),
});

function oneOfExactValues(values: ReadonlyArray<string>) {
    if (values.length === 0) throw new Error("empty");
    const codecs = values.map(value => exactly(value)) as [Codec<any>, ...Codec<any>[]];
    return oneOf(codecs);
}
