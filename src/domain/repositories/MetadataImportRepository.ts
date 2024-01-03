import { Async } from "domain/entities/Async";
import { Metadata } from "domain/entities/Metadata";

export interface MetadataImportRepository {
    import(options: MetadataImportOptions): Async<Metadata>;
}

export type MetadataImportOptions = {
    inputFile: string;
};
