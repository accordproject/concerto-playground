declare module "@accordproject/concerto-codegen/lib/codegen/fromjson/cto/inferModel" {
  export default function inferModel(
    namespace: string,
    rootTypeName: string,
    input: object | unknown[],
  ): string;
}
