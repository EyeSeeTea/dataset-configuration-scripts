import _ from "lodash";

export type Id = string;
export type Ref = { id: Id };
export type NamedRef = { id: Id; name: string };

export type FilePath = string;
export type Username = string;

export type IndexedById<T> = Record<Id, T>;

export function indexById<T extends Ref>(objs: T[]): Record<Id, T> {
    return _.keyBy(objs, obj => obj.id);
}

export function getId<Obj extends Ref>(obj: Obj): Id {
    return obj.id;
}

export function getName<Obj extends NamedRef>(obj: Obj): string {
    return obj.name;
}

export function getRef<Obj extends Ref>(obj: Obj): Ref {
    return { id: obj.id };
}
