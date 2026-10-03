// fetch reports every network failure as a bare TypeError; the useful code sits on its cause,
// or on the first of several causes when more than one address was tried.
export function networkErrorCode(err) {
  return err.cause?.code ?? err.cause?.errors?.[0]?.code ?? err.name;
}
