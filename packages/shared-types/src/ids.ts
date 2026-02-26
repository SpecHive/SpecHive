// Branded UUID v7 types - prevent accidental mixing of different ID types at compile time

export type OrganizationId = string & { readonly __brand: 'OrganizationId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type RunId = string & { readonly __brand: 'RunId' };
export type SuiteId = string & { readonly __brand: 'SuiteId' };
export type TestId = string & { readonly __brand: 'TestId' };
export type ArtifactId = string & { readonly __brand: 'ArtifactId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type MembershipId = string & { readonly __brand: 'MembershipId' };
export type ProjectTokenId = string & { readonly __brand: 'ProjectTokenId' };

// Type-safe casting helpers - callers must explicitly opt into the cast
export const asOrganizationId = (id: string) => id as OrganizationId;
export const asProjectId = (id: string) => id as ProjectId;
export const asRunId = (id: string) => id as RunId;
export const asSuiteId = (id: string) => id as SuiteId;
export const asTestId = (id: string) => id as TestId;
export const asArtifactId = (id: string) => id as ArtifactId;
export const asUserId = (id: string) => id as UserId;
export const asMembershipId = (id: string) => id as MembershipId;
export const asProjectTokenId = (id: string) => id as ProjectTokenId;
