import { Maybe, UnionFromValues } from "utils/ts-utils";

export type Metadata = {
    dataElements: DataElement[];
    indicators: Indicator[];
    dataElementGroups: DataElementGroup[];
    indicatorGroups: IndicatorGroup[];
};

export interface DataElement {
    id: Maybe<string>;
    name: string;
    shortName: string;
    formName: Maybe<string>;
    description: Maybe<string>;
    code: string;
    categoryComboName: Maybe<Name>;
    valueType: Maybe<ValueType>;
    aggregationType: Maybe<AggregationType>;
    optionSet: Maybe<Name>;
    //commentOptionSet: Maybe<string>;
    zeroIsSignificant: boolean;
    fieldMask: Maybe<string>;
    groupOrigin: Name;
    groupStatus: Name;
    groupCoreCompetency: Name;
    groupTheme: Name;
    groupType: Name;
}

type Name = string;

export interface Indicator {
    id: Maybe<string>;
    name: string;
    shortName: string;
    formName: Maybe<string>;
    description: Maybe<string>;
    code: string;
    indicatorType: Maybe<Name>;
    groupOrigin: string;
    groupStatus: string;
    groupCoreCompetency: string;
    groupTheme: Maybe<string>;
}

export const valueTypes = [
    "INTEGER",
    "INTEGER_POSITIVE",
    "INTEGER_ZERO_OR_POSITIVE",
    "LONG_TEXT",
    "NUMBER",
    "PERCENTAGE",
    "TEXT",
] as const;

type ValueType = UnionFromValues<typeof valueTypes>;

export const aggregationTypes = ["AVERAGE", "COUNT", "NONE", "SUM"] as const;

type AggregationType = UnionFromValues<typeof aggregationTypes>;

export interface DataElementGroup {
    id: Maybe<string>;
    name: string;
    shortName: string;
    description: Maybe<string>;
    code: string;
}

export interface IndicatorGroup {
    id: Maybe<string>;
    name: string;
    shortName: string;
    description: Maybe<string>;
    code: string;
}
