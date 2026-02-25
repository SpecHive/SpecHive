// Branded UUID v7 types - prevent accidental mixing of different ID types at compile time

export type OrganizationId = string & { readonly __brand: unique symbol };
export type ProjectId = string & { readonly __brand: unique symbol };
export type RunId = string & { readonly __brand: unique symbol };
export type SuiteId = string & { readonly __brand: unique symbol };
export type TestId = string & { readonly __brand: unique symbol };
export type ArtifactId = string & { readonly __brand: unique symbol };
export type UserId = string & { readonly __brand: unique symbol };

// Type-safe casting helpers - callers must explicitly opt into the cast
export const asOrganizationId = (id: string) => id as OrganizationId;
export const asProjectId = (id: string) => id as ProjectId;
export const asRunId = (id: string) => id as RunId;
export const asSuiteId = (id: string) => id as SuiteId;
export const asTestId = (id: string) => id as TestId;
export const asArtifactId = (id: string) => id as ArtifactId;
export const asUserId = (id: string) => id as UserId;
