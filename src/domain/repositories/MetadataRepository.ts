import { Async } from "domain/entities/Async";
import { Metadata } from "domain/entities/Metadata";

export interface MetadataRepository {
    save(metadata: Metadata): Async<void>;
}
