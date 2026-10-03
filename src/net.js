// fetch reports every network failure as a bare TypeError; the useful detail sits on its cause.
export function networkErrorCode(err) {
  return err.cause?.code ?? err.cause?.message ?? err.name;
}
